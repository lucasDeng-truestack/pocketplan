import { ColumnBars } from "@/components/charts/ColumnBars";
import { formatChange } from "@/components/charts/format";
import { SegmentedLinks } from "@/components/charts/SegmentedLinks";
import { cn } from "@/lib/cn";
import { formatISODate } from "@/lib/dates";
import { formatSen } from "@/lib/money";
import type { EnvelopesInsights, InsightsView } from "@/lib/types";
import { insightsHref } from "./href";

export const VIEW_OPTIONS = [
  { value: "spending", label: "Spending" },
  { value: "income", label: "Income" },
  { value: "cashflow", label: "Cash flow" },
] as const satisfies readonly { value: InsightsView; label: string }[];

export function parseView(v: unknown): InsightsView {
  return VIEW_OPTIONS.find((o) => o.value === v)?.value ?? "spending";
}

const TITLES: Record<InsightsView, string> = { spending: "Spent this month", income: "Income this month", cashflow: "Net this month" };
const NAMES: Record<InsightsView, string> = { spending: "Spending", income: "Income", cashflow: "Net cash flow" };

/** Spending / Income / Cash flow switcher, this month's total vs last month, and 12 month columns that select a month. */
export function InsightsTabs({ insights, selectedMonth }: { insights: EnvelopesInsights; selectedMonth: string }) {
  const { view, changePct } = insights;
  // Spending going up is bad; income and net cash flow going up is good.
  const r = changePct ?? 0;
  const tone = r === 0 ? "text-muted-foreground" : (view === "spending" ? r < 0 : r > 0) ? "text-success" : "text-destructive";
  return (
    <section aria-labelledby="insights-heading" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
      <SegmentedLinks label="Insight" param="view" options={VIEW_OPTIONS} current={view} keep={{ month: selectedMonth }} />
      <div>
        <h2 id="insights-heading" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {TITLES[view]}
        </h2>
        <p className="text-3xl font-semibold tabular-nums">{formatSen(insights.thisMonthSen)}</p>
        {changePct !== null && (
          <p className={cn("text-sm font-medium tabular-nums", tone)}>
            {formatChange(changePct)} <span className="font-normal text-muted-foreground">vs last month</span>
          </p>
        )}
      </div>
      <ColumnBars
        columns={insights.months.map((m) => ({
          key: m.month,
          label: m.label,
          name: formatISODate(`${m.month}-01`).replace(/^\d+ /, ""),
          sen: m.sen,
          href: insightsHref({ view, month: m.month }),
        }))}
        highlight={selectedMonth}
        caption={`${NAMES[view]}, last 12 months`}
        emptyText="Nothing recorded in the last 12 months"
      />
    </section>
  );
}
