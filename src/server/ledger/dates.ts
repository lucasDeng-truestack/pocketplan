import "server-only";
import type { ISODate } from "@/lib/types";

/** "2026-11-06" -> Date for a @db.Date column (midnight UTC; the column has no time or zone). */
export function isoToDbDate(iso: ISODate): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/** @db.Date value from Prisma (midnight UTC) -> "2026-11-06". */
export function dbDateToIso(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}
