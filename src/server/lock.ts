import "server-only";
import type { Prisma } from "@prisma/client";

/** Serialises every balance-dependent write for one user (docs/architecture.md). Call first inside db.$transaction. */
export async function lockUser(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
}

/** Prisma defaults to 5 s; a cold Neon compute plus ~6 round trips in a void can exceed that. */
export const TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 } as const;
