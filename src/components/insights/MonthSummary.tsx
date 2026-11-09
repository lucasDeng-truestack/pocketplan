import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatChange } from "@/components/charts/format";
import { cn } from "@/lib/cn";
import { addMonths } from "@/lib/dates";
import { formatSen } from "@/lib/money";
import type { InsightsView, MonthInsights } from "@/lib/types";
import { insightsHref } from "./href";

const shiftMonth = (month: string, by: number) => addMonths(`${month}-01`, by).slice(0, 7);
const longMonth = (month: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));

/** Spending going up is bad (red), down is good (green). */
const tone = (pct: number) => (pct > 0 ? "text-destructive" : pct < 0 ? "text-success" : "text-muted-foreground");

const navClass =
  "flex size-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** "‹ November 2026 ›" picker, the month's spent / income / net, and spending vs last month and the 3-month average. */
export function MonthSummary({ data, view, currentMonth }: { data: MonthInsights; view: InsightsView; currentMonth: string }) {
  const prev = shiftMonth(data.month, -1);
  const next = shiftMonth(data.month, 1);
  const { changePct, vsAvg3Pct } = data.compare;
  const stats = [
    { label: "Spent", sen: data.spentSen },
    { label: "Income", sen: data.incomeSen },
    { label: "Net", sen: data.netSen },
  ];
  return (
    <section aria-labelledby="month-heading" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <Link href={insightsHref({ view, month: prev })} scroll={false} aria-label={`Previous month, ${longMonth(prev)}`} className={cn(navClass, "hover:bg-muted")}>
          <ChevronLeft aria-hidden="true" className="size-5" />
        </Link>
        <h2 id="month-heading" className="text-lg font-semibold">
          {data.label}
        </h2>
        {data.month < currentMonth ? (
          <Link href={insightsHref({ view, month: next })} scroll={false} aria-label={`Next month, ${longMonth(next)}`} className={cn(navClass, "hover:bg-muted")}>
            <ChevronRight aria-hidden="true" className="size-5" />
          </Link>
        ) : (
          <span role="link" aria-disabled="true" aria-label="Next month" className={cn(navClass, "text-muted-foreground opacity-40")}>
            <ChevronRight aria-hidden="true" className="size-5" />
          </span>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className="truncate font-semibold tabular-nums">{formatSen(s.sen)}</dd>
          </div>
        ))}
      </dl>

      {(changePct !== null || vsAvg3Pct !== null) && (
        <ul className="flex flex-col gap-1 text-sm tabular-nums">
          {changePct !== null && (
            <li>
              <span className={cn("font-medium", tone(changePct))}>{formatChange(changePct)}</span>{" "}
              <span className="text-muted-foreground">spending vs {longMonth(prev)}</span>
            </li>
          )}
          {vsAvg3Pct !== null && (
            <li>
              <span className={cn("font-medium", tone(vsAvg3Pct))}>{formatChange(vsAvg3Pct)}</span>{" "}
              <span className="text-muted-foreground">vs 3-month average ({formatSen(data.compare.avg3SpentSen)})</span>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
