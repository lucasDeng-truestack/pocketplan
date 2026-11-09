import Link from "next/link";
import { envelopeColour, pctChange, UNALLOCATED_COLOUR as UNALLOCATED } from "@/components/charts/format";
import { EnvelopeSwatch } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatSen } from "@/lib/money";
import type { InsightsView, MonthInsights } from "@/lib/types";
import { insightsHref } from "./href";

function Change({ pct, label }: { pct: number | null; label: string }) {
  return (
    <span className="tabular-nums">
      <span className={cn(pct === null || pct === 0 ? "text-muted-foreground" : pct > 0 ? "text-destructive" : "text-success")}>
        {pct === null ? "—" : `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(pct)}%`}
      </span>{" "}
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

/** Each envelope's spending in the month: bar vs its target (else vs the biggest), and change vs last month and the 3-month average. */
export function ByEnvelope({
  rows,
  view,
  month,
  selected,
  unassignedSen,
}: {
  rows: MonthInsights["byEnvelope"];
  view: InsightsView;
  month: string;
  selected: string | null;
  /** spending with no envelope this month (came out of Unallocated) */
  unassignedSen: number;
}) {
  const max = Math.max(1, unassignedSen, ...rows.map((r) => r.spentSen));
  return (
    <section aria-labelledby="by-envelope-heading" className="rounded-2xl border border-border bg-card p-4">
      <h2 id="by-envelope-heading" className="mb-1 font-medium">
        By envelope
      </h2>
      {rows.length === 0 && unassignedSen <= 0 ? (
        <p className="text-sm text-muted-foreground">No envelope spending this month.</p>
      ) : (
        <ul>
          {rows.map((r) => {
            const colour = envelopeColour(r.colour);
            const ref = r.targetSen || max;
            const width = Math.round(Math.min(1, Math.max(0, r.spentSen) / ref) * 100);
            const isSelected = r.envelopeId === selected;
            return (
              <li key={r.envelopeId} className="border-b border-border last:border-b-0">
                <Link
                  href={insightsHref({ view, month, envelope: r.envelopeId })}
                  scroll={false}
                  aria-current={isSelected ? "true" : undefined}
                  className={cn(
                    "-mx-2 flex min-h-14 flex-col justify-center gap-1.5 rounded-lg px-2 py-2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
                    isSelected && "bg-muted",
                  )}
                >
                  <span className="flex items-center gap-2 text-sm">
                    <EnvelopeSwatch colour={colour} />
                    <span className="truncate font-medium">{r.name}</span>
                    <span className="ml-auto shrink-0 tabular-nums">
                      {formatSen(r.spentSen)}
                      {r.targetSen !== null && <span className="text-muted-foreground"> / {formatSen(r.targetSen)}</span>}
                    </span>
                  </span>
                  <span aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full" style={{ width: `${width}%`, backgroundColor: colour }} />
                  </span>
                  <span className="flex flex-wrap gap-x-4 text-xs">
                    <Change pct={r.changePct} label="vs last month" />
                    <Change pct={pctChange(r.spentSen, r.avg3Sen)} label="vs 3-mo avg" />
                  </span>
                </Link>
              </li>
            );
          })}
          {unassignedSen > 0 && (
            <li className="flex min-h-14 flex-col justify-center gap-1.5 py-2">
              <span className="flex items-center gap-2 text-sm">
                <EnvelopeSwatch colour={UNALLOCATED} />
                <span className="truncate font-medium">Unallocated</span>
                <span className="ml-auto shrink-0 tabular-nums">{formatSen(unassignedSen)}</span>
              </span>
              <span aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full" style={{ width: `${Math.round((unassignedSen / max) * 100)}%`, backgroundColor: UNALLOCATED }} />
              </span>
              <span className="text-xs text-muted-foreground">Spent without an envelope</span>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
