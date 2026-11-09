import "./setup";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { getBalances, getUnallocatedDirect } from "@/server/ledger/balances";
import * as ledger from "@/server/ledger/service";
import { archiveEnvelope, createEnvelope } from "@/server/envelopes/service";
import { addDays, todayKL } from "@/lib/dates";
import { recordIncomeSchema } from "@/lib/validation";
import { cleanupTestUsers, makeTestUser, testDb } from "./helpers";

const D1 = "2026-11-01";
const D3 = "2026-11-03";
const D4 = "2026-11-04";
const D6 = "2026-11-06";

const count = (userId: string) => testDb.transaction.count({ where: { userId } });

/** The money invariant, plus the independent unallocated formula; returns the balances for further checks. */
async function assertInvariant(userId: string, asOf?: string) {
  const b = await getBalances(userId, asOf);
  const envelopeSum = Object.values(b.envelopes).reduce((s, v) => s + v, 0);
  expect(b.unallocatedSen + envelopeSum).toBe(b.totalSen);
  expect(await getUnallocatedDirect(userId, asOf)).toBe(b.unallocatedSen);
  return b;
}

const newEnvelope = async (userId: string, name: string) => (await createEnvelope(userId, { name, colour: null, targetSen: null })).id;

async function findExpense(userId: string, amountSen: number) {
  return testDb.transaction.findFirstOrThrow({ where: { userId, type: "EXPENSE", amountSen }, orderBy: { createdAt: "desc" } });
}

let lucas: string;
let other: string;
let food: string, transport: string, bills: string, fun: string;

beforeAll(async () => {
  expect(db).toBe(testDb); // guard: the service must be talking to the test branch
  lucas = (await makeTestUser()).id;
  other = (await makeTestUser()).id;
  food = await newEnvelope(lucas, "Food");
  transport = await newEnvelope(lucas, "Transport");
  bills = await newEnvelope(lucas, "Bills");
  fun = await newEnvelope(lucas, "Fun");
});

afterAll(async () => {
  await cleanupTestUsers();
  await testDb.$disconnect();
});

describe("plan §5 walkthrough", () => {
  it("1. income raises total and unallocated", async () => {
    await ledger.recordIncome(lucas, { amountSen: 300000, occurredOn: D1 });
    const b = await assertInvariant(lucas);
    expect(b).toMatchObject({ totalSen: 300000, unallocatedSen: 300000 });
  });

  it("2. allocation moves money without changing the total", async () => {
    await ledger.allocate(lucas, {
      occurredOn: D1,
      items: [
        { envelopeId: food, amountSen: 60000 },
        { envelopeId: transport, amountSen: 20000 },
        { envelopeId: bills, amountSen: 120000 },
        { envelopeId: fun, amountSen: 30000 },
      ],
    });
    const b = await assertInvariant(lucas);
    expect(b).toMatchObject({ totalSen: 300000, unallocatedSen: 70000 });
    expect(b.envelopes).toEqual({ [food]: 60000, [transport]: 20000, [bills]: 120000, [fun]: 30000 });
  });

  it("3. expense lowers the envelope and the total equally", async () => {
    await ledger.recordExpense(lucas, { amountSen: 1850, envelopeId: food, occurredOn: D3, note: "nasi lemak" });
    const b = await assertInvariant(lucas);
    expect(b.envelopes[food]).toBe(58150);
    expect(b.totalSen).toBe(298150);
  });

  it("4. refund restores the envelope, is linked, and is capped", async () => {
    await ledger.recordExpense(lucas, { amountSen: 15000, envelopeId: fun, occurredOn: D4, merchant: "Jacket shop" });
    await assertInvariant(lucas);
    const jacket = await findExpense(lucas, 15000);
    await ledger.recordRefund(lucas, { expenseId: jacket.id, amountSen: 15000, occurredOn: D6 });
    const b = await assertInvariant(lucas);
    expect(b.envelopes[fun]).toBe(30000);
    expect(b.totalSen).toBe(298150);
    expect((await ledger.getTransaction(lucas, { id: jacket.id })).refundedSen).toBe(15000);
    const refund = await testDb.transaction.findFirstOrThrow({ where: { userId: lucas, type: "REFUND" } });
    expect(refund).toMatchObject({ refundOfId: jacket.id, envelopeId: fun });

    const before = await count(lucas);
    await expect(ledger.recordRefund(lucas, { expenseId: jacket.id, amountSen: 1, occurredOn: D6 })).rejects.toMatchObject({
      code: "VALIDATION",
      message: "Refund exceeds the remaining RM 0.00 on this expense",
    });
    expect(await count(lucas)).toBe(before);
  });

  it("5. overspending is blocked with the shortfall and writes nothing", async () => {
    const before = await count(lucas);
    await expect(ledger.recordExpense(lucas, { amountSen: 32000, envelopeId: transport, occurredOn: D6 })).rejects.toMatchObject({
      code: "INSUFFICIENT",
      message: "Transport has RM 200.00, short by RM 120.00",
    });
    expect(await count(lucas)).toBe(before);
    await assertInvariant(lucas);
  });

  it("6. transfer then re-enter the corrected expense", async () => {
    await ledger.transfer(lucas, { fromEnvelopeId: fun, toEnvelopeId: transport, amountSen: 15000, occurredOn: D6 });
    const mid = await assertInvariant(lucas);
    expect(mid.totalSen).toBe(298150); // transfers never change the total
    await ledger.recordExpense(lucas, { amountSen: 3200, envelopeId: transport, occurredOn: D6, merchant: "Grab" });
    const b = await assertInvariant(lucas);
    expect(b.envelopes[transport]).toBe(31800);
    expect(b.envelopes[fun]).toBe(15000);
    expect(b.totalSen).toBe(294950);
  });
});

describe("blocking rules and corrections", () => {
  it("cannot allocate more than unallocated; transfer from unallocated equals allocate", async () => {
    const before = await count(lucas);
    await expect(ledger.allocate(lucas, { occurredOn: D6, items: [{ envelopeId: food, amountSen: 70001 }] })).rejects.toMatchObject({
      code: "INSUFFICIENT",
      message: "Unallocated has RM 700.00, short by RM 0.01",
    });
    await expect(ledger.transfer(lucas, { fromEnvelopeId: null, toEnvelopeId: food, amountSen: 70001, occurredOn: D6 })).rejects.toMatchObject({
      code: "INSUFFICIENT",
    });
    await expect(
      ledger.allocate(lucas, { occurredOn: D6, items: [{ envelopeId: food, amountSen: 1 }, { envelopeId: food, amountSen: 1 }] }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await count(lucas)).toBe(before);

    const start = await getBalances(lucas);
    await ledger.allocate(lucas, { occurredOn: D6, items: [{ envelopeId: bills, amountSen: 1000 }] });
    const afterAllocate = await assertInvariant(lucas);
    await ledger.transfer(lucas, { fromEnvelopeId: null, toEnvelopeId: bills, amountSen: 1000, occurredOn: D6 });
    const afterTransfer = await assertInvariant(lucas);
    expect(afterAllocate.unallocatedSen - afterTransfer.unallocatedSen).toBe(start.unallocatedSen - afterAllocate.unallocatedSen);
    expect(afterTransfer.envelopes[bills] - afterAllocate.envelopes[bills]).toBe(1000);
    const [a, t] = await testDb.transaction.findMany({
      where: { userId: lucas, type: "TRANSFER", toEnvelopeId: bills, amountSen: 1000 },
      orderBy: { createdAt: "asc" },
    });
    expect({ ...a, id: "", createdAt: null }).toEqual({ ...t, id: "", createdAt: null });

    // Unallocate both back so later numbers match the walkthrough.
    await ledger.transfer(lucas, { fromEnvelopeId: bills, toEnvelopeId: null, amountSen: 2000, occurredOn: D6 });
    const back = await assertInvariant(lucas);
    expect(back.unallocatedSen).toBe(start.unallocatedSen);
    await expect(ledger.transfer(lucas, { fromEnvelopeId: food, toEnvelopeId: food, amountSen: 1, occurredOn: D6 })).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });

  it("void and unvoid an expense", async () => {
    const lunch = await findExpense(lucas, 1850);
    await ledger.voidTransaction(lucas, { id: lunch.id });
    expect((await assertInvariant(lucas)).envelopes[food]).toBe(60000);
    expect(await testDb.transaction.count({ where: { id: lunch.id } })).toBe(1); // voided, never deleted
    await expect(ledger.voidTransaction(lucas, { id: lunch.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await ledger.unvoidTransaction(lucas, { id: lunch.id });
    expect((await assertInvariant(lucas)).envelopes[food]).toBe(58150);
  });

  it("voiding an expense voids its refunds; unvoiding does not restore them", async () => {
    const jacket = await findExpense(lucas, 15000);
    const refund = await testDb.transaction.findFirstOrThrow({ where: { userId: lucas, refundOfId: jacket.id } });

    await ledger.voidTransaction(lucas, { id: jacket.id });
    expect((await testDb.transaction.findUniqueOrThrow({ where: { id: refund.id } })).voidedAt).not.toBeNull();
    expect((await assertInvariant(lucas)).envelopes[fun]).toBe(15000);

    await expect(ledger.unvoidTransaction(lucas, { id: refund.id })).rejects.toMatchObject({
      code: "VALIDATION",
      message: "Unvoid the original expense first",
    });
    await expect(ledger.recordRefund(lucas, { expenseId: jacket.id, amountSen: 1, occurredOn: D6 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    await ledger.unvoidTransaction(lucas, { id: jacket.id });
    expect((await testDb.transaction.findUniqueOrThrow({ where: { id: refund.id } })).voidedAt).not.toBeNull();
    expect((await assertInvariant(lucas)).envelopes[fun]).toBe(0);
    expect((await ledger.getTransaction(lucas, { id: jacket.id })).refundedSen).toBe(0);

    await ledger.unvoidTransaction(lucas, { id: refund.id });
    expect((await assertInvariant(lucas)).envelopes[fun]).toBe(15000);
  });

  it("refuses a void that would leave a balance negative", async () => {
    const income = await testDb.transaction.findFirstOrThrow({ where: { userId: lucas, type: "INCOME" } });
    const before = await getBalances(lucas);
    await expect(ledger.voidTransaction(lucas, { id: income.id })).rejects.toMatchObject({
      code: "INSUFFICIENT",
      message: "Voiding this would leave Unallocated at −RM 2,300.00",
    });
    expect((await testDb.transaction.findUniqueOrThrow({ where: { id: income.id } })).voidedAt).toBeNull();
    expect(await assertInvariant(lucas)).toEqual(before);

    const allocation = await testDb.transaction.findFirstOrThrow({ where: { userId: lucas, type: "TRANSFER", toEnvelopeId: fun, fromEnvelopeId: null } });
    await expect(ledger.voidTransaction(lucas, { id: allocation.id })).rejects.toMatchObject({
      code: "INSUFFICIENT",
      message: "Voiding this would leave Fun at −RM 150.00",
    });
    expect((await testDb.transaction.findUniqueOrThrow({ where: { id: allocation.id } })).voidedAt).toBeNull();
  });

  it("archived envelopes take no expenses or refunds and stay at zero", async () => {
    const gift = await newEnvelope(lucas, "Gift");
    await ledger.allocate(lucas, { occurredOn: D6, items: [{ envelopeId: gift, amountSen: 500 }] });
    await ledger.recordExpense(lucas, { amountSen: 500, envelopeId: gift, occurredOn: D6 });
    const giftExpense = await findExpense(lucas, 500);
    await archiveEnvelope(lucas, gift);
    const before = await count(lucas);

    await expect(ledger.recordExpense(lucas, { amountSen: 1, envelopeId: gift, occurredOn: D6 })).rejects.toMatchObject({
      code: "ARCHIVED",
      message: "Gift is archived",
    });
    await expect(ledger.recordRefund(lucas, { expenseId: giftExpense.id, amountSen: 100, occurredOn: D6 })).rejects.toMatchObject({
      code: "ARCHIVED",
      message: "Unarchive Gift first",
    });
    await expect(ledger.allocate(lucas, { occurredOn: D6, items: [{ envelopeId: gift, amountSen: 1 }] })).rejects.toMatchObject({
      code: "ARCHIVED",
    });
    await expect(ledger.transfer(lucas, { fromEnvelopeId: null, toEnvelopeId: gift, amountSen: 1, occurredOn: D6 })).rejects.toMatchObject({
      code: "ARCHIVED",
    });
    await expect(ledger.voidTransaction(lucas, { id: giftExpense.id })).rejects.toMatchObject({
      code: "ARCHIVED",
      message: "Unarchive Gift first",
    });
    expect(await count(lucas)).toBe(before);
    expect((await assertInvariant(lucas)).envelopes[gift]).toBe(0);
  });
});

describe("ownership", () => {
  it("another user's ids are NOT_FOUND and nothing is written", async () => {
    await ledger.recordIncome(other, { amountSen: 100000, occurredOn: D1 });
    const mine = await newEnvelope(other, "Mine");
    const lucasExpense = await findExpense(lucas, 1850);
    const lucasBefore = await count(lucas);
    const otherBefore = await count(other);
    const nf = { code: "NOT_FOUND" };

    await expect(ledger.recordExpense(other, { amountSen: 1, envelopeId: food, occurredOn: D6 })).rejects.toMatchObject(nf);
    await expect(ledger.allocate(other, { occurredOn: D6, items: [{ envelopeId: food, amountSen: 1 }] })).rejects.toMatchObject(nf);
    await expect(ledger.transfer(other, { fromEnvelopeId: null, toEnvelopeId: food, amountSen: 1, occurredOn: D6 })).rejects.toMatchObject(nf);
    await expect(ledger.transfer(other, { fromEnvelopeId: food, toEnvelopeId: mine, amountSen: 1, occurredOn: D6 })).rejects.toMatchObject(nf);
    await expect(ledger.recordRefund(other, { expenseId: lucasExpense.id, amountSen: 1, occurredOn: D6 })).rejects.toMatchObject(nf);
    await expect(ledger.voidTransaction(other, { id: lucasExpense.id })).rejects.toMatchObject(nf);
    await expect(ledger.unvoidTransaction(other, { id: lucasExpense.id })).rejects.toMatchObject(nf);
    await expect(ledger.getTransaction(other, { id: lucasExpense.id })).rejects.toMatchObject(nf);
    await expect(ledger.listTransactions(other, { cursor: lucasExpense.id })).rejects.toMatchObject({ code: "VALIDATION" });

    expect(await count(lucas)).toBe(lucasBefore);
    expect(await count(other)).toBe(otherBefore);
    expect((await ledger.listTransactions(other, {})).items.every((t) => t.id !== lucasExpense.id)).toBe(true);
    expect((await ledger.listTransactions(other, { envelopeId: food })).items).toEqual([]);
    await assertInvariant(other);
  });
});

describe("as-of balances and listing", () => {
  let carol: string;
  let jar: string;

  beforeAll(async () => {
    carol = (await makeTestUser()).id;
    jar = await newEnvelope(carol, "Jar");
    await ledger.recordIncome(carol, { amountSen: 1000, occurredOn: D1 });
    await ledger.recordIncome(carol, { amountSen: 500, occurredOn: D3 });
    await ledger.allocate(carol, { occurredOn: D3, items: [{ envelopeId: jar, amountSen: 300 }] });
    await ledger.recordExpense(carol, { amountSen: 100, envelopeId: jar, occurredOn: D4 });
  });

  it("getBalances respects asOf", async () => {
    expect(await assertInvariant(carol, "2026-11-02")).toEqual({ totalSen: 1000, unallocatedSen: 1000, envelopes: {} });
    expect(await assertInvariant(carol, D3)).toEqual({ totalSen: 1500, unallocatedSen: 1200, envelopes: { [jar]: 300 } });
    expect(await assertInvariant(carol)).toEqual({ totalSen: 1400, unallocatedSen: 1200, envelopes: { [jar]: 200 } });
  });

  it("listTransactions paginates newest first with disjoint pages", async () => {
    const first = await ledger.listTransactions(carol, { limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    const second = await ledger.listTransactions(carol, { limit: 2, cursor: first.nextCursor! });
    expect(second.items).toHaveLength(2);
    expect(second.nextCursor).toBeNull();

    const all = [...first.items, ...second.items];
    expect(new Set(all.map((t) => t.id)).size).toBe(4);
    expect(all.map((t) => t.occurredOn)).toEqual([D4, D3, D3, D1]);
    expect((await ledger.listTransactions(carol, { type: "INCOME" })).items.map((t) => t.amountSen).sort()).toEqual([1000, 500].sort());
    expect((await ledger.listTransactions(carol, { envelopeId: jar })).items).toHaveLength(2);
    expect((await ledger.listTransactions(carol, { start: D3, end: D3 })).items).toHaveLength(2);
  });
});

describe("review fixes", () => {
  it("serialises concurrent expenses: exactly one of two 150.00 spends from 200.00 succeeds", async () => {
    const dana = (await makeTestUser()).id;
    const pot = await newEnvelope(dana, "Pot");
    await ledger.recordIncome(dana, { amountSen: 20000, occurredOn: D1 });
    await ledger.allocate(dana, { occurredOn: D1, items: [{ envelopeId: pot, amountSen: 20000 }] });

    const spend = () => ledger.recordExpense(dana, { amountSen: 15000, envelopeId: pot, occurredOn: D3 });
    const results = await Promise.allSettled([spend(), spend()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ code: "INSUFFICIENT" });

    const b = await assertInvariant(dana);
    expect(b.envelopes[pot]).toBe(5000);
    expect(await testDb.transaction.count({ where: { userId: dana, type: "EXPENSE" } })).toBe(1);
  });

  it("rejects a future-dated entry at the schema", () => {
    const tomorrow = addDays(todayKL(), 1);
    const result = recordIncomeSchema.safeParse({ amountSen: 100, occurredOn: tomorrow });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Pick today or an earlier date");
    expect(recordIncomeSchema.safeParse({ amountSen: 100, occurredOn: todayKL() }).success).toBe(true);
  });

  it("rejects a refund dated before its expense", async () => {
    const jacket = await findExpense(lucas, 15000); // dated D4; the date check runs before the amount check
    const before = await count(lucas);
    await expect(ledger.recordRefund(lucas, { expenseId: jacket.id, amountSen: 1, occurredOn: D3 })).rejects.toMatchObject({
      code: "VALIDATION",
      message: "A refund can't be dated before its expense (4 Nov 2026)",
    });
    expect(await count(lucas)).toBe(before);
  });
});

describe("corrections (edit = replace and keep the old one)", () => {
  let erin: string;
  let groc: string, petrol: string;
  const row = (id: string) => testDb.transaction.findUniqueOrThrow({ where: { id } });
  const live = (userId: string, type: "EXPENSE" | "TRANSFER" | "INCOME" | "REFUND") =>
    testDb.transaction.count({ where: { userId, type, voidedAt: null } });

  beforeAll(async () => {
    erin = (await makeTestUser()).id;
    groc = await newEnvelope(erin, "Groceries");
    petrol = await newEnvelope(erin, "Petrol");
    await ledger.recordIncome(erin, { amountSen: 100000, occurredOn: D1 });
    await ledger.allocate(erin, { occurredOn: D1, items: [{ envelopeId: groc, amountSen: 30000 }, { envelopeId: petrol, amountSen: 10000 }] });
    await ledger.recordExpense(erin, { amountSen: 5000, envelopeId: groc, occurredOn: D3, merchant: "Tesco Mutiara", note: "weekly shop" });
  });

  let orig: string, c1: string, c2: string;

  it("corrects an expense up then down: invariant holds and it is counted once", async () => {
    orig = (await findExpense(erin, 5000)).id;
    c1 = (await ledger.correctTransaction(erin, { id: orig, amountSen: 8000, occurredOn: D3, merchant: "Tesco Mutiara", note: "weekly shop" })).id;
    let b = await assertInvariant(erin);
    expect(b.envelopes[groc]).toBe(22000);
    expect(b.totalSen).toBe(92000);
    expect((await row(orig)).voidedAt).not.toBeNull(); // kept, never edited in place
    expect(await row(c1)).toMatchObject({ type: "EXPENSE", amountSen: 8000, envelopeId: groc, correctsId: orig, merchant: "Tesco Mutiara", voidedAt: null });
    expect(await live(erin, "EXPENSE")).toBe(1);
    expect((await ledger.getTransaction(erin, { id: orig })).correctedById).toBe(c1);
    expect((await ledger.getTransaction(erin, { id: c1 })).correctsId).toBe(orig);

    c2 = (await ledger.correctTransaction(erin, { id: c1, amountSen: 2000, occurredOn: D4, merchant: "Tesco Mutiara" })).id;
    b = await assertInvariant(erin);
    expect(b.envelopes[groc]).toBe(28000);
    expect(b.totalSen).toBe(98000);
    expect(await live(erin, "EXPENSE")).toBe(1);
    expect(await row(c2)).toMatchObject({ note: null, occurredOn: new Date(`${D4}T00:00:00Z`) }); // note replaced: omitted clears it

    const { items } = await ledger.listTransactions(erin, { type: "EXPENSE" });
    const byId = new Map(items.map((t) => [t.id, t]));
    expect(byId.get(orig)?.correctedById).toBeNull(); // its correction c1 is itself voided now
    expect(byId.get(c1)?.correctedById).toBe(c2);
    expect(byId.get(c2)?.correctedById).toBeNull();
    // Already voided: a second correction of the same version is NOT_FOUND, not a second live copy.
    await expect(ledger.correctTransaction(erin, { id: c1, amountSen: 1, occurredOn: D3 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses a correction into an envelope without enough money and rolls back", async () => {
    const before = await getBalances(erin);
    const n = await count(erin);
    await expect(ledger.correctTransaction(erin, { id: c2, amountSen: 15000, envelopeId: petrol, occurredOn: D4 })).rejects.toMatchObject({
      code: "INSUFFICIENT",
      message: "Petrol has RM 100.00, short by RM 50.00",
    });
    expect((await row(c2)).voidedAt).toBeNull(); // original still active
    expect(await count(erin)).toBe(n);
    expect(await assertInvariant(erin)).toEqual(before);

    // Moving to another envelope: Groceries gets its 20.00 back, Petrol pays.
    c2 = (await ledger.correctTransaction(erin, { id: c2, amountSen: 2000, envelopeId: petrol, occurredOn: D4 })).id;
    const b = await assertInvariant(erin);
    expect(b.envelopes).toMatchObject({ [groc]: 30000, [petrol]: 8000 });
    expect(b.totalSen).toBe(98000);
  });

  it("refuses an expense with refunds until they are voided", async () => {
    await ledger.recordRefund(erin, { expenseId: c2, amountSen: 500, occurredOn: D4 });
    const refund = await testDb.transaction.findFirstOrThrow({ where: { userId: erin, refundOfId: c2 } });
    await expect(ledger.correctTransaction(erin, { id: c2, amountSen: 2500, occurredOn: D4 })).rejects.toMatchObject({
      code: "VALIDATION",
      message: "This expense has refunds. Void them first.",
    });
    expect((await row(c2)).voidedAt).toBeNull();
    await ledger.voidTransaction(erin, { id: refund.id });
    c2 = (await ledger.correctTransaction(erin, { id: c2, amountSen: 2500, occurredOn: D4 })).id;
    expect((await row(c2)).envelopeId).toBe(petrol); // undefined envelope keeps the original's
    expect((await assertInvariant(erin)).envelopes[petrol]).toBe(7500);
  });

  it("corrects a refund within what is left on its expense", async () => {
    await ledger.recordRefund(erin, { expenseId: c2, amountSen: 1000, occurredOn: D4 });
    const refund = await testDb.transaction.findFirstOrThrow({ where: { userId: erin, refundOfId: c2, voidedAt: null } });
    await expect(ledger.correctTransaction(erin, { id: refund.id, amountSen: 2501, occurredOn: D4 })).rejects.toMatchObject({
      code: "VALIDATION",
      message: "Refund exceeds the remaining RM 25.00 on this expense",
    });
    const fixed = (await ledger.correctTransaction(erin, { id: refund.id, amountSen: 2500, occurredOn: D6 })).id;
    expect(await row(fixed)).toMatchObject({ type: "REFUND", refundOfId: c2, envelopeId: petrol, correctsId: refund.id });
    expect((await ledger.getTransaction(erin, { id: c2 })).refundedSen).toBe(2500); // the old refund no longer counts
    expect((await assertInvariant(erin)).envelopes[petrol]).toBe(10000);
    await ledger.voidTransaction(erin, { id: fixed });
  });

  it("corrects transfer endpoints: undefined keeps, null means Unallocated", async () => {
    await ledger.transfer(erin, { fromEnvelopeId: groc, toEnvelopeId: petrol, amountSen: 3000, occurredOn: D3 });
    const t = await testDb.transaction.findFirstOrThrow({ where: { userId: erin, type: "TRANSFER", fromEnvelopeId: groc } });
    const before = await assertInvariant(erin);

    const t2 = (await ledger.correctTransaction(erin, { id: t.id, amountSen: 3000, occurredOn: D3, fromEnvelopeId: null })).id;
    expect(await row(t2)).toMatchObject({ fromEnvelopeId: null, toEnvelopeId: petrol, correctsId: t.id });
    const b = await assertInvariant(erin);
    expect(b.totalSen).toBe(before.totalSen); // transfers never change the total
    expect(b.envelopes[groc]).toBe(before.envelopes[groc] + 3000);
    expect(b.unallocatedSen).toBe(before.unallocatedSen - 3000);

    for (const ends of [{ toEnvelopeId: null }, { fromEnvelopeId: petrol }, { fromEnvelopeId: null, toEnvelopeId: null }]) {
      await expect(ledger.correctTransaction(erin, { id: t2, amountSen: 3000, occurredOn: D3, ...ends })).rejects.toMatchObject({
        code: "VALIDATION",
        message: "Choose two different envelopes",
      });
    }
    await expect(ledger.correctTransaction(erin, { id: t2, amountSen: 999999, occurredOn: D3 })).rejects.toMatchObject({ code: "INSUFFICIENT" });
    expect((await row(t2)).voidedAt).toBeNull();
  });

  it("refuses fields the type doesn't have, and a correction that strands allocated money", async () => {
    const income = await testDb.transaction.findFirstOrThrow({ where: { userId: erin, type: "INCOME" } });
    const bad = { code: "VALIDATION", message: "That field can't be changed on this kind of entry" };
    await expect(ledger.correctTransaction(erin, { id: income.id, amountSen: 1, occurredOn: D1, merchant: "Boss" })).rejects.toMatchObject(bad);
    await expect(ledger.correctTransaction(erin, { id: income.id, amountSen: 1, occurredOn: D1, envelopeId: groc })).rejects.toMatchObject(bad);
    await expect(ledger.correctTransaction(erin, { id: c2, amountSen: 1, occurredOn: D1, fromEnvelopeId: null })).rejects.toMatchObject(bad);

    const before = await getBalances(erin);
    await expect(ledger.correctTransaction(erin, { id: income.id, amountSen: 10000, occurredOn: D1 })).rejects.toMatchObject({
      code: "INSUFFICIENT",
      message: "Correcting this would leave Unallocated at −RM 330.00", // total 75.00 − envelopes 405.00
    });
    expect((await row(income.id)).voidedAt).toBeNull();
    expect(await assertInvariant(erin)).toEqual(before);

    const raised = (await ledger.correctTransaction(erin, { id: income.id, amountSen: 100100, occurredOn: D1, note: "with bonus" })).id;
    expect((await assertInvariant(erin)).totalSen).toBe(before.totalSen + 100);
    expect(await live(erin, "INCOME")).toBe(1);
    expect((await row(raised)).note).toBe("with bonus");
  });

  it("unvoid: a corrected entry stays down; voiding a correction does not restore the original", async () => {
    const corrected = { code: "VALIDATION", message: "This entry was corrected. Void the correction instead." };
    await expect(ledger.unvoidTransaction(erin, { id: orig })).rejects.toMatchObject(corrected); // live c2 is down the chain
    await expect(ledger.unvoidTransaction(erin, { id: c1 })).rejects.toMatchObject(corrected);

    await ledger.recordExpense(erin, { amountSen: 700, envelopeId: groc, occurredOn: D6, merchant: "Kedai" });
    const x = (await findExpense(erin, 700)).id;
    const y = (await ledger.correctTransaction(erin, { id: x, amountSen: 900, occurredOn: D6, merchant: "Kedai" })).id;
    const withY = await assertInvariant(erin);
    await ledger.voidTransaction(erin, { id: y });
    expect((await row(x)).voidedAt).not.toBeNull(); // not restored
    expect((await assertInvariant(erin)).envelopes[groc]).toBe(withY.envelopes[groc] + 900);

    await ledger.unvoidTransaction(erin, { id: x }); // the user brings the original back deliberately
    const withX = await assertInvariant(erin);
    expect(withX.envelopes[groc]).toBe(withY.envelopes[groc] + 200);
    await expect(ledger.unvoidTransaction(erin, { id: y })).rejects.toMatchObject({
      code: "VALIDATION",
      message: "Another version of this entry is active. Void it first.",
    });
    expect(await assertInvariant(erin)).toEqual(withX); // never both live
  });

  it("another user's entry is NOT_FOUND", async () => {
    const n = await count(erin);
    await expect(ledger.correctTransaction(other, { id: c2, amountSen: 1, occurredOn: D4 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const theirs = await newEnvelope(other, "Theirs");
    await expect(ledger.correctTransaction(erin, { id: c2, amountSen: 1, occurredOn: D4, envelopeId: theirs })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Envelope not found",
    });
    expect(await count(erin)).toBe(n);
    expect((await row(c2)).voidedAt).toBeNull();
  });

  it("searches merchant and note case-insensitively, and amounts exactly", async () => {
    const byMerchant = (await ledger.listTransactions(erin, { q: "tesco" })).items;
    expect(byMerchant.map((t) => t.id)).toEqual(expect.arrayContaining([orig, c1])); // voided versions stay findable
    expect(byMerchant.every((t) => t.merchant === "Tesco Mutiara")).toBe(true);
    expect((await ledger.listTransactions(erin, { q: "WEEKLY" })).items.map((t) => t.id).sort()).toEqual([orig, c1].sort());
    expect((await ledger.listTransactions(erin, { q: "bonus" })).items.map((t) => t.amountSen)).toEqual([100100]);
    const byAmount = (await ledger.listTransactions(erin, { q: "RM 25.00" })).items;
    expect(byAmount.length).toBeGreaterThan(0);
    expect(byAmount.every((t) => t.amountSen === 2500)).toBe(true);
    expect((await ledger.listTransactions(erin, { q: "no such thing" })).items).toEqual([]);
    expect((await ledger.listTransactions(erin, { q: "%" })).items).toEqual([]); // wildcards are literal
    expect((await ledger.listTransactions(erin, { q: "_" })).items).toEqual([]);
    expect((await ledger.listTransactions(other, { q: "tesco" })).items).toEqual([]);
  });
});

describe("expenses without an envelope (come out of Unallocated)", () => {
  let fay: string;
  let groceries: string;
  beforeAll(async () => {
    fay = (await makeTestUser()).id;
    groceries = await newEnvelope(fay, "Groceries");
    await ledger.recordIncome(fay, { amountSen: 50000, occurredOn: D1 });
    await ledger.allocate(fay, { items: [{ envelopeId: groceries, amountSen: 20000 }], occurredOn: D1 });
  });

  it("lowers Unallocated and the total, leaves envelopes alone", async () => {
    await ledger.recordExpense(fay, { amountSen: 12000, occurredOn: D3, merchant: "Market" });
    const b = await assertInvariant(fay);
    expect(b).toMatchObject({ totalSen: 38000, unallocatedSen: 18000 });
    expect(b.envelopes[groceries]).toBe(20000);
    expect((await findExpense(fay, 12000)).envelopeId).toBeNull();
  });

  it("is blocked when Unallocated is short, and writes nothing", async () => {
    const before = await count(fay);
    await expect(ledger.recordExpense(fay, { amountSen: 18001, occurredOn: D3 })).rejects.toMatchObject({ code: "INSUFFICIENT" });
    expect(await count(fay)).toBe(before);
    await assertInvariant(fay);
  });

  it("a refund goes back to Unallocated", async () => {
    const expense = await findExpense(fay, 12000);
    await ledger.recordRefund(fay, { expenseId: expense.id, amountSen: 2000, occurredOn: D4 });
    const b = await assertInvariant(fay);
    expect(b).toMatchObject({ totalSen: 40000, unallocatedSen: 20000 });
    expect(b.envelopes[groceries]).toBe(20000);
    const refund = await testDb.transaction.findFirstOrThrow({ where: { userId: fay, type: "REFUND", refundOfId: expense.id } });
    expect(refund.envelopeId).toBeNull();
    await ledger.voidTransaction(fay, { id: refund.id }); // corrections refuse an expense with refunds
    await assertInvariant(fay);
  });

  it("corrections move an expense into an envelope and back out", async () => {
    const original = await findExpense(fay, 12000);
    const { id: moved } = await ledger.correctTransaction(fay, { id: original.id, amountSen: 12000, occurredOn: D3, envelopeId: groceries });
    let b = await assertInvariant(fay);
    expect(b).toMatchObject({ totalSen: 38000, unallocatedSen: 30000 });
    expect(b.envelopes[groceries]).toBe(8000);

    await ledger.correctTransaction(fay, { id: moved, amountSen: 12000, occurredOn: D6, envelopeId: null });
    b = await assertInvariant(fay);
    expect(b).toMatchObject({ totalSen: 38000, unallocatedSen: 18000 });
    expect(b.envelopes[groceries]).toBe(20000);
  });
});
