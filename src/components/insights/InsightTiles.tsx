import { formatSen } from "@/lib/money";
import type { EnvelopesInsights } from "@/lib/types";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]; // 0 = Monday

/** "Priciest day" (last 90 days) and "Small spends" (under RM 20 this month); "—" when there is nothing to show. */
export function InsightTiles({ priciest, small }: { priciest: EnvelopesInsights["priciestWeekday"]; small: EnvelopesInsights["smallSpends"] }) {
  const tiles = [
    {
      label: "Priciest day",
      value: priciest ? WEEKDAYS[priciest.weekday] : null,
      sub: priciest ? `avg ${formatSen(priciest.avgSen)}` : "Last 90 days",
    },
    {
      label: "Small spends",
      value: small.countThisMonth > 0 ? formatSen(small.sumSen) : null,
      sub: small.countThisMonth > 0 ? `${small.countThisMonth} under RM 20 this month` : "Under RM 20 this month",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {tiles.map((t) => (
        <section key={t.label} aria-label={t.label} className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t.label}</p>
          <p className={t.value ? "truncate text-xl font-semibold tabular-nums" : "text-xl text-muted-foreground"}>{t.value ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{t.sub}</p>
        </section>
      ))}
    </div>
  );
}
