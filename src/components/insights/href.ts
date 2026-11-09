import type { InsightsView } from "@/lib/types";

/** /insights URL for a view + month, optionally drilled into one envelope. */
export function insightsHref({ view, month, envelope }: { view: InsightsView; month: string; envelope?: string | null }): string {
  const q = new URLSearchParams({ view, month });
  if (envelope) q.set("envelope", envelope);
  return `/insights?${q}`;
}
