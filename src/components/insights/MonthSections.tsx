import Link from "next/link";
import { ColumnBars } from "@/components/charts/ColumnBars";
import { envelopeColour } from "@/components/charts/format";
import { EnvelopeSwatch, ProgressBar } from "@/components/ui";
import { formatISODate } from "@/lib/dates";
import { formatSen, formatSenPlain } from "@/lib/money";
import type { InsightsView, MonthInsights, TransactionView } from "@/lib/types";
import { insightsHref } from "./href";

/** Which column indexes get a day label: about five, evenly spaced from day 1, plus the last day when it is not too close. */
export function labelledIndexes(count: number): Set<number> {
  const step = Math.max(1, Math.ceil(count / 5));
  const picked = new Set<number>();
  for (let i = 0; i < count; i += step) picked.add(i);
  const lastPicked = Math.max(...picked, 0);
  if (count > 0 && count - 1 - lastPicked >= step / 2) picked.add(count - 1);
  return picked;
}

/** Spending per day across the month, today (or the month's last day) in the accent. */
export function DailySpending({ daily, end }: { daily: MonthInsights["daily"]; end: string }) {
  return (
    <section aria-labelledby="daily-heading" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <h2 id="daily-heading" className="font-medium">
        Daily spending
      </h2>
      <ColumnBars
        columns={daily.map((d, i, all) => ({
          key: d.date,
          label: labelledIndexes(all.length).has(i) ? String(Number(d.date.slice(8))) : "",
          name: formatISODate(d.date),
          sen: d.spentSen,
        }))}
        highlight={end}
        caption="Spending per day"
        emptyText="No spending this month"
        height="h-32"
      />
    </section>
  );
}

/** Activity has no per-id deep link, so a big expense opens a search for its merchant, else its amount. */
export function activitySearchHref(tx: TransactionView): string {
  return `/activity?${new URLSearchParams({ q: tx.merchant?.trim() || formatSenPlain(tx.amountSen) })}`;
}

export function TopMerchants({ merchants }: { merchants: MonthInsights["topMerchants"] }) {
  return (
    <section aria-labelledby="merchants-heading" className="rounded-2xl border border-border bg-card p-4">
      <h2 id="merchants-heading" className="mb-1 font-medium">
        Top merchants
      </h2>
      {merchants.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">No merchants recorded this month.</p>
      ) : (
        <ol>
          {merchants.map((m) => (
            <li key={m.merchant} className="flex min-h-12 items-center gap-3 border-b border-border py-2 last:border-b-0">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{m.merchant}</span>
                <span className="text-xs text-muted-foreground">
                  {m.count} {m.count === 1 ? "expense" : "expenses"}
                </span>
              </span>
              <span className="shrink-0 tabular-nums">{formatSen(m.spentSen)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** One envelope's month: balance, spent vs target, 6 months of columns. Expenses are listed by the page beneath it. */
export function EnvelopeDrill({
  envelope,
  view,
  month,
}: {
  envelope: NonNullable<MonthInsights["envelope"]>;
  view: InsightsView;
  month: string;
}) {
  const colour = envelopeColour(envelope.colour);
  return (
    <section aria-labelledby="drill-heading" className="flex flex-col gap-4 rounded-2xl border-2 border-primary/30 bg-card p-4">
      <div className="flex items-center gap-2">
        <EnvelopeSwatch colour={colour} />
        <h2 id="drill-heading" className="truncate text-lg font-semibold">
          {envelope.name}
        </h2>
        <Link
          href={insightsHref({ view, month })}
          scroll={false}
          className="ml-auto flex min-h-11 items-center rounded-lg px-3 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
        >
          Close
        </Link>
      </div>
      <dl className="grid grid-cols-2 gap-2">
        <div>
          <dt className="text-xs text-muted-foreground">Balance</dt>
          <dd className="font-semibold tabular-nums">{formatSen(envelope.balanceSen)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Spent this month</dt>
          <dd className="font-semibold tabular-nums">
            {formatSen(envelope.spentSen)}
            {envelope.targetSen ? <span className="font-normal text-muted-foreground"> of {formatSen(envelope.targetSen)}</span> : null}
          </dd>
        </div>
      </dl>
      {envelope.targetSen ? (
        <ProgressBar value={envelope.spentSen / envelope.targetSen} colour={colour} label={`${envelope.name} spent against target`} />
      ) : null}
      <ColumnBars
        columns={envelope.sixMonths.map((m) => ({
          key: m.month,
          label: m.label,
          name: formatISODate(`${m.month}-01`).replace(/^\d+ /, ""),
          sen: m.sen,
          href: insightsHref({ view, month: m.month, envelope: envelope.envelopeId }),
        }))}
        highlight={month}
        caption={`${envelope.name} spending, last 6 months`}
        emptyText="No spending in the last 6 months"
        height="h-24"
      />
    </section>
  );
}
