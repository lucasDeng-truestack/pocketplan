import Link from "next/link";
import { envelopeColour, UNALLOCATED_COLOUR } from "@/components/charts/format";
import { EnvelopeSwatch } from "@/components/ui";
import { formatSen } from "@/lib/money";
import type { DashboardData } from "@/lib/types";

const TOP = 4;

/** Spending by envelope for the period: total, a segmented bar, and named rows beneath (the rows carry the information). */
/** unassignedSen: spending with no envelope in the period; it came out of Unallocated. */
export function SpentBar({ spent, unassignedSen }: { spent: DashboardData["spentByEnvelope"]; unassignedSen: number }) {
  const unassigned = Math.max(0, unassignedSen); // refunds above spending in the period show as nothing spent
  const total = spent.reduce((s, e) => s + e.spentSen, 0) + unassigned;
  const top = spent.slice(0, TOP).map((e) => ({
    key: e.envelopeId,
    name: e.name,
    sen: e.spentSen,
    colour: envelopeColour(e.colour),
  }));
  const restSen = spent.slice(TOP).reduce((s, e) => s + e.spentSen, 0);
  const slices = [
    ...top,
    ...(unassigned > 0 ? [{ key: "unallocated", name: "Unallocated", sen: unassigned, colour: UNALLOCATED_COLOUR }] : []),
    ...(restSen > 0 ? [{ key: "rest", name: "Everything else", sen: restSen, colour: "color-mix(in srgb, var(--muted-foreground) 45%, transparent)" }] : []),
  ];
  const pct = (sen: number) => (total > 0 ? Math.round((sen * 100) / total) : 0);

  return (
    <section aria-labelledby="spent-heading" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="-my-2 flex items-center gap-2">
        <h2 id="spent-heading" className="font-medium">
          Spent by envelope
        </h2>
        <Link href="/insights" className="ml-auto flex min-h-11 shrink-0 items-center px-2 text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">
          Insights →
        </Link>
      </div>
      {total > 0 && <p className="-mt-1 font-semibold tabular-nums">{formatSen(total)}</p>}
      {total > 0 ? (
        <>
          {/* flex-grow in sen splits the width by share after the 2px gaps */}
          <div aria-hidden="true" className="flex h-2 gap-0.5 overflow-hidden rounded-full">
            {slices.map((s) => (
              <div
                key={s.key}
                className="min-w-px"
                style={{ flex: `${s.sen} 1 0`, backgroundColor: s.colour }}
                title={`${s.name}: ${formatSen(s.sen)} (${pct(s.sen)}%)`}
              />
            ))}
          </div>
          <ul className="flex flex-col gap-2 text-sm">
            {slices.map((s) => (
              <li key={s.key} className="flex items-center gap-2">
                <EnvelopeSwatch colour={s.colour} />
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <span className="shrink-0 tabular-nums">{formatSen(s.sen)}</span>
                <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">{pct(s.sen)}%</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No spending in this period</p>
      )}
    </section>
  );
}
