import "./setup";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { getBalances } from "@/server/ledger/balances";
import {
  archiveEnvelope,
  createEnvelope,
  getEnvelope,
  listEnvelopeNames,
  listEnvelopes,
  reorderEnvelopes,
  unarchiveEnvelope,
  updateEnvelope,
} from "@/server/envelopes/service";
import { createEnvelopeSchema } from "@/lib/validation";
import { cleanupTestUsers, makeTestUser, testDb } from "./helpers";

vi.mock("@/server/ledger/balances", () => ({
  getBalances: vi.fn(async () => ({ totalSen: 0, unallocatedSen: 0, envelopes: {} })),
}));

const env = (name: string) => ({ name, colour: null, targetSen: null });

let alice: { id: string };
let bob: { id: string };

beforeAll(async () => {
  expect(db).toBe(testDb); // guard: the service must be talking to the test branch
  alice = await makeTestUser();
  bob = await makeTestUser();
});

afterAll(async () => {
  await cleanupTestUsers();
  await testDb.$disconnect();
});

describe("envelopes service", () => {
  it("creates envelopes in order with dense sortOrder", async () => {
    const food = await createEnvelope(alice.id, { name: "Food", colour: "#E07A5F", targetSen: 60000 });
    const fun = await createEnvelope(alice.id, env("Fun"));
    expect(food).toMatchObject({ name: "Food", colour: "#E07A5F", targetSen: 60000, balanceSen: 0, archivedAt: null });
    expect(fun.sortOrder).toBe(food.sortOrder + 1);
    expect((await listEnvelopes(alice.id, { includeArchived: false })).map((e) => e.name)).toEqual(["Food", "Fun"]);
  });

  it("reorders only with the exact active set", async () => {
    const bills = await createEnvelope(alice.id, env("Bills"));
    const ids = (await listEnvelopes(alice.id, { includeArchived: false })).map((e) => e.id);
    const reversed = [...ids].reverse();
    await reorderEnvelopes(alice.id, reversed);
    const after = await listEnvelopes(alice.id, { includeArchived: false });
    expect(after.map((e) => e.id)).toEqual(reversed);
    expect(after.map((e) => e.sortOrder)).toEqual([0, 1, 2]);

    const stale = { code: "VALIDATION", message: "Envelope list is out of date, reload" };
    await expect(reorderEnvelopes(alice.id, ids.slice(1))).rejects.toMatchObject(stale);
    await expect(reorderEnvelopes(alice.id, [bills.id, bills.id, ids[0]])).rejects.toMatchObject(stale);
  });

  it("archives only at zero balance and unarchives to the end", async () => {
    const [first] = await listEnvelopes(alice.id, { includeArchived: false });

    vi.mocked(getBalances).mockResolvedValueOnce({ totalSen: 1250, unallocatedSen: 0, envelopes: { [first.id]: 1250 } });
    await expect(archiveEnvelope(alice.id, first.id)).rejects.toMatchObject({
      code: "INSUFFICIENT",
      message: `Move RM 12.50 out of ${first.name} first`,
    });
    expect((await getEnvelope(alice.id, first.id)).archivedAt).toBeNull();

    await archiveEnvelope(alice.id, first.id);
    await archiveEnvelope(alice.id, first.id); // already archived: no-op
    expect((await getEnvelope(alice.id, first.id)).archivedAt).not.toBeNull();
    expect((await listEnvelopes(alice.id, { includeArchived: false })).map((e) => e.id)).not.toContain(first.id);

    // Archived envelopes can still be renamed.
    expect((await updateEnvelope(alice.id, { id: first.id, name: "Old" })).name).toBe("Old");

    await unarchiveEnvelope(alice.id, first.id);
    const active = await listEnvelopes(alice.id, { includeArchived: false });
    expect(active.at(-1)?.id).toBe(first.id);
  });

  it("never lets another user see or touch an envelope", async () => {
    const [mine] = await listEnvelopes(alice.id, { includeArchived: true });
    const notFound = { code: "NOT_FOUND" };
    await expect(getEnvelope(bob.id, mine.id)).rejects.toMatchObject(notFound);
    await expect(updateEnvelope(bob.id, { id: mine.id, name: "Mine now" })).rejects.toMatchObject(notFound);
    await expect(archiveEnvelope(bob.id, mine.id)).rejects.toMatchObject(notFound);
    await expect(unarchiveEnvelope(bob.id, mine.id)).rejects.toMatchObject(notFound);
    await expect(reorderEnvelopes(bob.id, [mine.id])).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await listEnvelopes(bob.id, { includeArchived: true })).toEqual([]);
    expect((await getEnvelope(alice.id, mine.id)).name).not.toBe("Mine now");
  });
});

describe("envelope icons", () => {
  it("saves an icon on create, changes and clears it on update, and lists it", async () => {
    const owner = await makeTestUser();
    const e = await createEnvelope(owner.id, { name: "Petrol", colour: "#81B29A", icon: "fuel", targetSen: null });
    expect(e.icon).toBe("fuel");
    expect((await updateEnvelope(owner.id, { id: e.id, icon: "car" })).icon).toBe("car");
    expect((await updateEnvelope(owner.id, { id: e.id, name: "Car" })).icon).toBe("car"); // omitted keeps it
    expect((await updateEnvelope(owner.id, { id: e.id, icon: null })).icon).toBeNull();
    expect((await listEnvelopeNames(owner.id))[0]).toMatchObject({ name: "Car", icon: null });
  });

  it("rejects an icon outside the list at the schema", () => {
    expect(createEnvelopeSchema.safeParse({ name: "X", icon: "rocket" }).success).toBe(false);
    expect(createEnvelopeSchema.parse({ name: "X" }).icon).toBeNull();
  });
});
