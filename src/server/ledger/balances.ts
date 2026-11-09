import "server-only";
import { cache } from "react";
import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/server/db";
import type { Balances, ISODate, Sen } from "@/lib/types";

type Client = Prisma.TransactionClient | PrismaClient;

// Sums are cast to bigint, not int: a SUM of Int columns can pass 2^31 sen, and ::int would then error.
// bigint comes back as a JS BigInt; Number() is exact below 2^53 sen.

/** Balances over non-voided rows, optionally as of a date (inclusive). One query. */
export async function getBalances(userId: string, asOf?: ISODate, client: Client = db): Promise<Balances> {
  const rows = await client.$queryRaw<{ kind: "env" | "total"; envelopeId: string | null; sen: bigint }[]>`
    WITH t AS (
      SELECT type, "amountSen" AS a, "envelopeId", "fromEnvelopeId", "toEnvelopeId"
      FROM "Transaction"
      WHERE "userId" = ${userId} AND "voidedAt" IS NULL
        AND (${asOf ?? null}::date IS NULL OR "occurredOn" <= ${asOf ?? null}::date)
    ),
    moves AS (
      SELECT "toEnvelopeId" AS env, a AS delta FROM t WHERE type = 'TRANSFER' AND "toEnvelopeId" IS NOT NULL
      UNION ALL SELECT "fromEnvelopeId", -a FROM t WHERE type = 'TRANSFER' AND "fromEnvelopeId" IS NOT NULL
      UNION ALL SELECT "envelopeId", -a FROM t WHERE type = 'EXPENSE'
      UNION ALL SELECT "envelopeId", a FROM t WHERE type = 'REFUND'
    )
    SELECT 'env' AS kind, env AS "envelopeId", SUM(delta)::bigint AS sen FROM moves GROUP BY env
    UNION ALL
    SELECT 'total', NULL,
      COALESCE(SUM(CASE type WHEN 'INCOME' THEN a WHEN 'EXPENSE' THEN -a WHEN 'REFUND' THEN a ELSE 0 END), 0)::bigint
    FROM t`;

  let totalSen: Sen = 0;
  let envelopeSum: Sen = 0;
  const envelopes: Record<string, Sen> = {};
  for (const r of rows) {
    const sen = Number(r.sen);
    if (r.kind === "total") totalSen = sen;
    else if (r.envelopeId) {
      envelopes[r.envelopeId] = sen;
      envelopeSum += sen;
    }
  }
  return { totalSen, unallocatedSen: totalSen - envelopeSum, envelopes };
}

/** Current balances, deduped per request (layout + page). Not for writes: those read through their transaction client. */
export const getCurrentBalances = cache((userId: string) => getBalances(userId));

/** Unallocated computed straight from income, allocations and envelope-less spending; tests use it to cross-check getBalances. */
export async function getUnallocatedDirect(userId: string, asOf?: ISODate, client: Client = db): Promise<Sen> {
  const [row] = await client.$queryRaw<{ sen: bigint }[]>`
    SELECT COALESCE(SUM(CASE
      WHEN type = 'INCOME' THEN "amountSen"
      WHEN type = 'TRANSFER' AND "fromEnvelopeId" IS NULL THEN -"amountSen"
      WHEN type = 'TRANSFER' AND "toEnvelopeId" IS NULL THEN "amountSen"
      WHEN type = 'EXPENSE' AND "envelopeId" IS NULL THEN -"amountSen"
      WHEN type = 'REFUND' AND "envelopeId" IS NULL THEN "amountSen"
      ELSE 0 END), 0)::bigint AS sen
    FROM "Transaction"
    WHERE "userId" = ${userId} AND "voidedAt" IS NULL
      AND (${asOf ?? null}::date IS NULL OR "occurredOn" <= ${asOf ?? null}::date)`;
  return Number(row.sen);
}
