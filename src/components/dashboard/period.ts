import { formatISODate } from "@/lib/dates";
import type { DashboardRange, ISODate } from "@/lib/types";

export const RANGE_OPTIONS = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
] as const satisfies readonly { value: DashboardRange; label: string }[];

export function parseRange(v: unknown): DashboardRange {
  return RANGE_OPTIONS.find((o) => o.value === v)?.value ?? "month";
}

/** long: "November 2026"-style heading text; short: the card prefix ("Nov", "This week", "12 months"). */
export function periodLabel(range: DashboardRange, start: ISODate): { long: string; short: string } {
  if (range === "week") return { long: "This week", short: "This week" };
  if (range === "year") return { long: "Last 12 months", short: "12 months" };
  const [, mon, year] = formatISODate(start).split(" ");
  return { long: `${mon} ${year}`, short: mon };
}
