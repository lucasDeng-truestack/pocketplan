import type { ISODate, RecurringCadence } from "./types";

const TZ = "Asia/Kuala_Lumpur";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Date -> "YYYY-MM-DD" as seen in Kuala Lumpur. */
export function toISODate(d: Date): ISODate {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function todayKL(): ISODate {
  return toISODate(new Date());
}

export function isISODate(s: string): s is ISODate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** "2026-11-06" -> "6 Nov 2026" */
export function formatISODate(iso: ISODate): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "2026-11-01","2026-11-30" -> "1–30 Nov 2026"; across months "25 Oct – 6 Nov 2026" */
export function formatRange(start: ISODate, end: ISODate): string {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  if (sy === ey && sm === em) return `${sd}–${ed} ${MONTHS[sm - 1]} ${sy}`;
  if (sy === ey) return `${sd} ${MONTHS[sm - 1]} – ${ed} ${MONTHS[em - 1]} ${ey}`;
  return `${formatISODate(start)} – ${formatISODate(end)}`;
}

/** Add days to an ISO date (calendar arithmetic, timezone-free). */
export function addDays(iso: ISODate, days: number): ISODate {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Inline error for the date of a new entry: a real date, not in the future (Kuala Lumpur). */
export function entryDateError(date: string): string | null {
  if (!isISODate(date)) return "Enter a date";
  return date > todayKL() ? "Pick today or an earlier date" : null;
}

/** Monday of the week containing iso. */
export function startOfWeek(iso: ISODate): ISODate {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // 0 = Monday
  return addDays(iso, -dow);
}

/** First day of the month containing iso. */
export function startOfMonth(iso: ISODate): ISODate {
  return `${iso.slice(0, 7)}-01`;
}

/** Add whole months, clamping the day to the target month's last day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(iso: ISODate, months: number): ISODate {
  const [y, m, d] = iso.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10);
}

/** The n-th occurrence (0-based) of a recurring item. Monthly keeps startOn's day, clamped per month. */
export function occurrenceDate(startOn: ISODate, cadence: RecurringCadence, n: number): ISODate {
  return cadence === "WEEKLY" ? addDays(startOn, 7 * n) : addMonths(startOn, n);
}
