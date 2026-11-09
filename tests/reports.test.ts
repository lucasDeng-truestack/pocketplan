import "./setup";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email/send";
import { AppError } from "@/server/errors";
import { createEnvelope } from "@/server/envelopes/service";
import { getBalances } from "@/server/ledger/balances";
import * as ledger from "@/server/ledger/service";
import { buildReport } from "@/server/reports/build";
import { escapeHtml, renderReport } from "@/server/reports/render";
import { htmlHash, sendReport } from "@/server/reports/send";
import type { ReportParams, ReportRow } from "@/lib/types";
import { PREVIEW_STALE_MESSAGE, SELF_ONLY_MESSAGE } from "@/lib/validation";
import { cleanupTestUsers, makeTestUser, testDb } from "./helpers";

vi.mock("@/server/email/send", () => ({ sendEmail: vi.fn(async () => ({ id: "re_test" })) }));

const D1 = "2026-11-01";
const D3 = "2026-11-03";
const D4 = "2026-11-04";
const D6 = "2026-11-06";

const reconciles = (r: ReportRow) =>
  expect(r.openingSen + r.allocatedInSen - r.movedOutSen - r.spentSen + r.refundsSen).toBe(r.closingSen);

let user: { id: string; email: string };
let other: { id: string; email: string };
let food: string, transport: string, bills: string, fun: string, evil: string;
let all: string[];

beforeAll(async () => {
  expect(db).toBe(testDb); // guard: the service must be talking to the test branch
  user = await makeTestUser();
  other = await makeTestUser();
  // Most sends go to other addresses, which only verified accounts may do.
  await testDb.user.updateMany({ where: { id: { in: [user.id, other.id] } }, data: { emailVerified: true } });
  const env = async (name: string) => (await createEnvelope(user.id, { name, colour: "#81B29A", targetSen: null })).id;
  [food, transport, bills, fun] = [await env("Food"), await env("Transport"), await env("Bills"), await env("Fun")];
  evil = await env("<script>alert(1)</script>");
  all = [food, transport, bills, fun, evil];

  // docs/plan.md §5 walkthrough
  await ledger.recordIncome(user.id, { amountSen: 300000, occurredOn: D1 });
  await ledger.allocate(user.id, {
    occurredOn: D1,
    items: [
      { envelopeId: food, amountSen: 60000 },
      { envelopeId: transport, amountSen: 20000 },
      { envelopeId: bills, amountSen: 120000 },
      { envelopeId: fun, amountSen: 30000 },
    ],
  });
  await ledger.recordExpense(user.id, { amountSen: 1850, envelopeId: food, occurredOn: D3, merchant: "Kedai Ali", note: "nasi lemak" });
  await ledger.recordExpense(user.id, { amountSen: 15000, envelopeId: fun, occurredOn: D4, merchant: "Jacket shop" });
  const jacket = await testDb.transaction.findFirstOrThrow({ where: { userId: user.id, amountSen: 15000, type: "EXPENSE" } });
  await ledger.recordRefund(user.id, { expenseId: jacket.id, amountSen: 15000, occurredOn: D6 });
  await ledger.transfer(user.id, { fromEnvelopeId: fun, toEnvelopeId: transport, amountSen: 15000, occurredOn: D6 });
  await ledger.recordExpense(user.id, { amountSen: 3200, envelopeId: transport, occurredOn: D6, merchant: "Grab" });
});

afterAll(async () => {
  await cleanupTestUsers();
  await testDb.$disconnect();
});

describe("buildReport", () => {
  it("reconciles every row and matches the balances on the end date", async () => {
    const report = await buildReport(user.id, { start: D1, end: D6, envelopeIds: all, includeNotes: false });
    [...report.rows, report.unallocated, report.total].forEach(reconciles);
    const end = await getBalances(user.id, D6);
    expect(report.total.closingSen).toBe(end.totalSen);
    expect(report.total.closingSen).toBe(294950);
    expect(report.unallocated.closingSen).toBe(end.unallocatedSen);
    const foodRow = report.rows.find((r) => r.envelopeId === food)!;
    expect(foodRow).toMatchObject({ openingSen: 0, allocatedInSen: 60000, spentSen: 1850, closingSen: 58150 });
    expect(report.transactions).toBeNull();
  });

  it("uses the balance before the start date as the opening", async () => {
    const report = await buildReport(user.id, { start: D4, end: D6, envelopeIds: [food, fun, transport], includeNotes: false });
    [...report.rows, report.unallocated, report.total].forEach(reconciles);
    expect(report.rows.find((r) => r.envelopeId === food)).toMatchObject({ openingSen: 58150, spentSen: 0, closingSen: 58150 });
    expect(report.rows.find((r) => r.envelopeId === fun)).toMatchObject({
      openingSen: 30000,
      spentSen: 15000,
      refundsSen: 15000,
      movedOutSen: 15000,
      closingSen: 15000,
    });
    expect(report.unallocated).toMatchObject({ openingSen: 70000, allocatedInSen: 0, movedOutSen: 0, closingSen: 70000 });
    expect(report.total).toMatchObject({ openingSen: 298150, spentSen: 18200, refundsSen: 15000, closingSen: 294950 });
  });

  it("rejects another user's envelope", async () => {
    await expect(buildReport(other.id, { start: D1, end: D6, envelopeIds: [food], includeNotes: false })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("renderReport", () => {
  it("is email-safe, escapes names and keeps details private by default", async () => {
    const html = renderReport(await buildReport(user.id, { start: D1, end: D6, envelopeIds: all, includeNotes: false }), {
      senderEmail: user.email,
    });
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/class=/i);
    expect(html).not.toMatch(/<style/i);
    expect(html).toContain(escapeHtml("<script>alert(1)</script>"));
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    for (const secret of ["Kedai Ali", "nasi lemak", "Jacket shop", "Grab"]) expect(html).not.toContain(secret);
    expect(html.toLowerCase()).not.toContain("delivered");
    expect(html).toContain("Total (all envelopes)");
  });

  it("lists entries oldest first only when notes are included", async () => {
    const report = await buildReport(user.id, { start: D1, end: D6, envelopeIds: all, includeNotes: true });
    expect(report.transactions!.map((t) => t.occurredOn)).toEqual([...report.transactions!.map((t) => t.occurredOn)].sort());
    const html = renderReport(report, { senderEmail: user.email });
    expect(html).toContain("Kedai Ali · nasi lemak");
    expect(html).toContain("Jacket shop");
  });

  it("escapes all five characters", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});

describe("sendReport", () => {
  const sends = (userId: string) => testDb.reportSend.findMany({ where: { userId }, orderBy: { sentAt: "asc" } });
  const base = { start: D1, end: D6, includeNotes: false };
  /** What the preview route would hand the client: the hash of the HTML the person saw. */
  const previewHashOf = async (u: { id: string; email: string }, p: ReportParams) =>
    htmlHash(renderReport(await buildReport(u.id, p), { senderEmail: u.email }));
  /** sendReport with a preview hash taken just before, as the UI does. */
  const send = async (u: { id: string; email: string }, envelopeIds: string[], recipients: string[]) => {
    const p = { ...base, envelopeIds };
    return sendReport(u, { ...p, recipients, previewHash: await previewHashOf(u, p).catch(() => "0".repeat(64)) });
  };

  it("logs, refuses duplicates, logs failures and rate-limits", async () => {
    const first = await send(user, [food], ["Me@Example.com", "me@example.com "]);
    expect(first).toEqual({ status: "ACCEPTED", id: "re_test" });
    expect(vi.mocked(sendEmail).mock.calls[0][0]).toMatchObject({ to: ["me@example.com"] });
    let rows = await sends(user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "ACCEPTED", resendId: "re_test", error: null, recipients: ["me@example.com"] });

    await expect(send(user, [food], ["me@example.com"])).rejects.toMatchObject({
      code: "DUPLICATE",
    });
    expect(await sends(user.id)).toHaveLength(1);

    vi.mocked(sendEmail).mockRejectedValueOnce(new AppError("EMAIL_FAILED", "Provider said no"));
    await expect(send(user, [fun], ["me@example.com"])).rejects.toMatchObject({
      code: "EMAIL_FAILED",
      message: "Provider said no",
    });
    rows = await sends(user.id);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ status: "FAILED", error: "Provider said no", resendId: null });

    await send(user, [bills], ["me@example.com"]);
    expect(await sends(user.id)).toHaveLength(3);

    await expect(send(user, [transport], ["me@example.com"])).rejects.toMatchObject({
      code: "RATE_LIMIT",
    });
    expect(await sends(user.id)).toHaveLength(3);
  });

  it("refuses another user's envelope without logging", async () => {
    await expect(send(other, [food], ["x@example.com"])).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await sends(other.id)).toHaveLength(0);
  });

  it("rejects bad recipient lists", async () => {
    await expect(send(other, [food], [])).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(send(other, [food], ["not-an-email"])).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });

  describe("guards added in the final review", () => {
    let fresh: { id: string; email: string };
    let box: string;
    beforeAll(async () => {
      fresh = await makeTestUser(); // own account: the rate-limit test above leaves `user` at its per-minute cap
      box = (await createEnvelope(fresh.id, { name: "Box", colour: null, targetSen: null })).id;
      await ledger.recordIncome(fresh.id, { amountSen: 10000, occurredOn: D1 });
      await ledger.allocate(fresh.id, { items: [{ envelopeId: box, amountSen: 5000 }], occurredOn: D1 });
    });

    it("lets an unverified account send only to itself", async () => {
      await expect(send(fresh, [box], ["someone@example.com"])).rejects.toMatchObject({ code: "VALIDATION", message: SELF_ONLY_MESSAGE });
      await expect(send(fresh, [box], [fresh.email])).resolves.toMatchObject({ status: "ACCEPTED" });
      await testDb.user.update({ where: { id: fresh.id }, data: { emailVerified: true } });
    });

    it("refuses to send when the data changed since the preview", async () => {
      await testDb.reportSend.deleteMany({ where: { userId: fresh.id } }); // clear the rate-limit window
      const p = { ...base, envelopeIds: [box] };
      const seen = await previewHashOf(fresh, p);
      await ledger.recordExpense(fresh.id, { amountSen: 100, envelopeId: box, occurredOn: D3 });
      await expect(sendReport(fresh, { ...p, recipients: ["a@example.com"], previewHash: seen })).rejects.toMatchObject({
        code: "VALIDATION",
        message: PREVIEW_STALE_MESSAGE,
      });
      expect(await sends(fresh.id)).toHaveLength(0);
    });

    it("uses a new idempotency key for a deliberate resend after the duplicate window", async () => {
      await testDb.reportSend.deleteMany({ where: { userId: fresh.id } });
      vi.mocked(sendEmail).mockClear();
      await send(fresh, [box], ["b@example.com"]);
      // Pretend the first send happened 11 minutes ago, past the 10-minute duplicate window.
      await testDb.reportSend.updateMany({ where: { userId: fresh.id }, data: { sentAt: new Date(Date.now() - 11 * 60_000) } });
      await send(fresh, [box], ["b@example.com"]);
      const keys = vi.mocked(sendEmail).mock.calls.map((c) => c[0].idempotencyKey);
      expect(keys).toHaveLength(2);
      expect(keys[0]).not.toBe(keys[1]);
    });
  });
});

describe("spending with no envelope", () => {
  it("is counted in the Unallocated row, reconciles, and is listed", async () => {
    const fay = await makeTestUser();
    const pots = (await createEnvelope(fay.id, { name: "Pots", colour: null, targetSen: null })).id;
    await ledger.recordIncome(fay.id, { amountSen: 30000, occurredOn: D1 });
    await ledger.allocate(fay.id, { items: [{ envelopeId: pots, amountSen: 10000 }], occurredOn: D1 });
    await ledger.recordExpense(fay.id, { amountSen: 4500, occurredOn: D3, merchant: "Pasar malam" });
    const expense = await testDb.transaction.findFirstOrThrow({ where: { userId: fay.id, type: "EXPENSE" } });
    await ledger.recordRefund(fay.id, { expenseId: expense.id, amountSen: 500, occurredOn: D4 });

    const report = await buildReport(fay.id, { start: D1, end: D6, envelopeIds: [pots], includeNotes: true });
    [...report.rows, report.unallocated, report.total].forEach(reconciles);
    expect(report.unallocated).toMatchObject({ spentSen: 4500, refundsSen: 500, closingSen: 16000 });
    expect(report.transactions?.some((t) => t.id === expense.id)).toBe(true);
  });
});
