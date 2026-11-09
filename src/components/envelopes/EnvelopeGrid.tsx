import { envelopeColour, formatSenCompact } from "@/components/charts/format";
import { EnvelopeSwatch } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatRange } from "@/lib/dates";
import { formatSen } from "@/lib/money";
import type { EnvelopeGrid as Grid } from "@/lib/types";

// Sequential, one hue: intensity steps of the accent. Index 0 = nothing spent.
const LEVELS = ["", "bg-primary/15", "bg-primary/35", "bg-primary/60 text-primary-foreground", "bg-primary/85 text-primary-foreground"];

/** Display-only shade: spend vs a quarter of the monthly target, else vs the row's busiest week. */
function level(spent: number, ref: number): number {
  if (spent <= 0 || ref <= 0) return 0;
  return Math.max(1, Math.ceil(Math.min(1, spent / ref) * 4));
}

export function EnvelopeGrid({ grid }: { grid: Grid }) {
  return (
    <section aria-labelledby="grid-heading" className="rounded-2xl border border-border bg-card p-4">
      <h2 id="grid-heading" className="font-medium">
        Last 8 weeks
      </h2>
      <p className="mb-2 text-xs text-muted-foreground">Spending per envelope, one column per week (Monday to Sunday).</p>
      {grid.rows.length === 0 || grid.weeks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Create envelopes and record spending to see your weekly pattern.</p>
      ) : (
        <div className="relative overflow-x-auto">
          {/* No padding on this scroller: a sticky column sticks inside padding, letting scrolled cells show to its left. */}
          <table className="w-full border-separate border-spacing-0.5 text-xs">
            <caption className="sr-only">Spending per week, last 8 weeks</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 bg-card text-left font-medium text-muted-foreground">
                  <span className="sr-only">Envelope</span>
                </th>
                {grid.weeks.map((w) => (
                  <th key={w.start} scope="col" title={formatRange(w.start, w.end)} className="min-w-16 px-1 pb-1 text-center leading-tight font-normal text-muted-foreground">
                    {/* the week's span, not its first day: "21–27 Sep", or "28 Sep – 4 Oct" across months */}
                    {formatRange(w.start, w.end).replace(/ \d{4}/g, "")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((r) => {
                const ref = r.targetSen ? Math.round(r.targetSen / 4) : Math.max(0, ...r.spentSen);
                return (
                  <tr key={r.envelopeId}>
                    <th scope="row" className="sticky left-0 z-10 bg-card pr-2 text-left font-medium">
                      <span className="flex w-24 items-center gap-2 sm:w-28">
                        <EnvelopeSwatch colour={envelopeColour(r.colour)} />
                        <span className="truncate">{r.name}</span>
                      </span>
                    </th>
                    {r.spentSen.map((sen, i) => (
                      <td
                        key={grid.weeks[i]?.start ?? i}
                        title={`${r.name}, ${grid.weeks[i] ? formatRange(grid.weeks[i].start, grid.weeks[i].end) : ""}: ${formatSen(sen)}`}
                        className={cn("h-11 rounded-md border border-border text-center tabular-nums", LEVELS[level(sen, ref)])}
                      >
                        <span aria-hidden="true">{sen > 0 ? formatSenCompact(sen) : ""}</span>
                        <span className="sr-only">{formatSen(sen)}</span>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
