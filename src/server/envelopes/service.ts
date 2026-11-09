import "server-only";
import { Prisma, type Envelope } from "@prisma/client";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { cache } from "react";
import { getBalances, getCurrentBalances } from "@/server/ledger/balances";
import { TX_OPTIONS, lockUser } from "@/server/lock";
import { formatSen } from "@/lib/money";
import { ENVELOPE_ICONS, type Balances, type EnvelopeIcon, type EnvelopeView, type Sen } from "@/lib/types";

const notFound = () => new AppError("NOT_FOUND", "Envelope not found");

/** A stored key that is no longer in the list (or garbage) reads as no icon, never as a crash. */
const toIcon = (s: string | null): EnvelopeIcon | null => ENVELOPE_ICONS.find((i) => i === s) ?? null;

function toView(e: Envelope, balanceSen: Sen): EnvelopeView {
  return {
    id: e.id,
    name: e.name,
    colour: e.colour,
    icon: toIcon(e.icon),
    targetSen: e.targetSen,
    sortOrder: e.sortOrder,
    archivedAt: e.archivedAt ? e.archivedAt.toISOString() : null,
    balanceSen,
  };
}

async function nextSortOrder(tx: Prisma.TransactionClient, userId: string): Promise<number> {
  const { _max } = await tx.envelope.aggregate({ where: { userId }, _max: { sortOrder: true } });
  return (_max.sortOrder ?? -1) + 1;
}

/** Active envelope names are unique per person, ignoring case and surrounding spaces. Call under lockUser. */
async function assertNameFree(tx: Prisma.TransactionClient, userId: string, name: string, exceptId?: string, verb?: "restore"): Promise<void> {
  const clash = await tx.envelope.findFirst({
    where: { userId, archivedAt: null, name: { equals: name.trim(), mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { name: true },
  });
  if (!clash) return;
  if (verb === "restore") throw new AppError("DUPLICATE", `An active envelope named ${clash.name} already exists. Rename it to restore this one.`);
  throw new AppError("DUPLICATE", `You already have an envelope called ${clash.name}`);
}

const ORDER: Prisma.EnvelopeOrderByWithRelationInput[] = [{ sortOrder: "asc" }, { createdAt: "asc" }];

/** Pass `balances` when the caller already has them, so the page shows one consistent snapshot. */
export async function listEnvelopes(
  userId: string,
  opts: { includeArchived: boolean },
  balances?: Balances,
): Promise<EnvelopeView[]> {
  // Unbounded on purpose: one person's envelopes number in the tens, and the manage screen needs all of them.
  const [rows, snapshot] = await Promise.all([
    db.envelope.findMany({ where: { userId, ...(opts.includeArchived ? {} : { archivedAt: null }) }, orderBy: ORDER }),
    balances ?? getBalances(userId),
  ]);
  return rows.map((e) => toView(e, snapshot.envelopes[e.id] ?? 0));
}

/** Active envelopes with current balances, deduped per request so the layout's Quick add and the page share one read. */
export const listActiveEnvelopesCached = cache(async (userId: string) =>
  listEnvelopes(userId, { includeArchived: false }, await getCurrentBalances(userId)),
);

/** Names and colours for labels and filter options; no balance scan. Archived included. */
export async function listEnvelopeNames(
  userId: string,
): Promise<{ id: string; name: string; colour: string | null; icon: EnvelopeIcon | null; archivedAt: string | null }[]> {
  // Unbounded on purpose: one person's envelopes number in the tens, and the manage screen needs all of them.
  const rows = await db.envelope.findMany({
    where: { userId },
    orderBy: ORDER,
    select: { id: true, name: true, colour: true, icon: true, archivedAt: true },
  });
  return rows.map((e) => ({ ...e, icon: toIcon(e.icon), archivedAt: e.archivedAt ? e.archivedAt.toISOString() : null }));
}

/** listEnvelopeNames plus deleted envelopes ("Food (deleted)", treated as archived), for labelling past entries. */
export async function listEnvelopeLabels(userId: string): ReturnType<typeof listEnvelopeNames> {
  const [names, deleted] = await Promise.all([
    listEnvelopeNames(userId),
    db.deletedEnvelope.findMany({ where: { userId }, orderBy: { deletedAt: "asc" } }), // bounded like envelopes: tens
  ]);
  return [
    ...names,
    ...deleted.map((d) => ({ id: d.id, name: `${d.name} (deleted)`, colour: d.colour, icon: toIcon(d.icon), archivedAt: d.deletedAt.toISOString() })),
  ];
}

export async function getEnvelope(userId: string, id: string): Promise<EnvelopeView> {
  const [row, balances] = await Promise.all([db.envelope.findFirst({ where: { id, userId } }), getBalances(userId)]);
  if (!row) throw notFound();
  return toView(row, balances.envelopes[row.id] ?? 0);
}

export async function createEnvelope(
  userId: string,
  input: { name: string; colour: string | null; icon?: EnvelopeIcon | null; targetSen: Sen | null },
): Promise<EnvelopeView> {
  const row = await db.$transaction(async (tx) => {
    await lockUser(tx, userId); // two concurrent creates must not share a sortOrder or a name
    await assertNameFree(tx, userId, input.name);
    const sortOrder = await nextSortOrder(tx, userId);
    return tx.envelope.create({
      data: { userId, name: input.name, colour: input.colour, icon: input.icon ?? null, targetSen: input.targetSen, sortOrder },
    });
  }, TX_OPTIONS);
  return toView(row, 0);
}

export async function updateEnvelope(
  userId: string,
  input: { id: string; name?: string; colour?: string | null; icon?: EnvelopeIcon | null; targetSen?: Sen | null },
): Promise<EnvelopeView> {
  const { id, ...data } = input;
  await db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const row = await tx.envelope.findFirst({ where: { id, userId }, select: { archivedAt: true } });
    if (!row) throw notFound();
    if (data.name !== undefined && !row.archivedAt) await assertNameFree(tx, userId, data.name, id);
    await tx.envelope.update({ where: { id, userId }, data });
  }, TX_OPTIONS);
  return getEnvelope(userId, id);
}

export async function reorderEnvelopes(userId: string, ids: string[]): Promise<void> {
  await db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const active = await tx.envelope.findMany({ where: { userId, archivedAt: null }, select: { id: true } });
    const activeIds = new Set(active.map((e) => e.id));
    const sameSet = ids.length === activeIds.size && new Set(ids).size === ids.length && ids.every((id) => activeIds.has(id));
    if (!sameSet) throw new AppError("VALIDATION", "Envelope list is out of date, reload");
    const values = Prisma.join(ids.map((id, index) => Prisma.sql`(${id}::text, ${index}::int)`));
    await tx.$executeRaw`
      UPDATE "Envelope" AS e SET "sortOrder" = v.ord
      FROM (VALUES ${values}) AS v(id, ord)
      WHERE e.id = v.id AND e."userId" = ${userId}`;
  }, TX_OPTIONS);
}

export async function archiveEnvelope(userId: string, id: string): Promise<void> {
  await db.$transaction(async (tx) => {
    await lockUser(tx, userId); // no ledger write can change the balance between the check and the archive
    const row = await tx.envelope.findFirst({ where: { id, userId } });
    if (!row) throw notFound();
    if (row.archivedAt) return;
    const balance = (await getBalances(userId, undefined, tx)).envelopes[id] ?? 0;
    if (balance !== 0) throw new AppError("INSUFFICIENT", `Move ${formatSen(balance)} out of ${row.name} first`);
    await tx.envelope.update({ where: { id, userId }, data: { archivedAt: new Date() } });
  }, TX_OPTIONS);
}

export async function unarchiveEnvelope(userId: string, id: string): Promise<void> {
  await db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const row = await tx.envelope.findFirst({ where: { id, userId } });
    if (!row) throw notFound();
    if (!row.archivedAt) return;
    await assertNameFree(tx, userId, row.name, id, "restore");
    const sortOrder = await nextSortOrder(tx, userId);
    await tx.envelope.update({ where: { id, userId }, data: { archivedAt: null, sortOrder } });
  }, TX_OPTIONS);
}
