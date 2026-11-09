"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { EnvelopeSwatch, ProgressBar } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatISODate } from "@/lib/dates";
import { formatSen } from "@/lib/money";
import type { EnvelopeInsight, HealthBand, HealthScore } from "@/lib/types";

const BANDS: Record<HealthBand, { word: string; text: string; stroke: string }> = {
  healthy: { word: "Healthy", text: "text-success", stroke: "stroke-success" },
  watch: { word: "Watch", text: "text-warning", stroke: "stroke-warning" },
  atRisk: { word: "At risk", text: "text-destructive", stroke: "stroke-destructive" },
};

/** Health score gauge; the button discloses the four parts and the envelopes at risk. */
export function HealthCard({
  health,
  lastMonth,
  atRisk,
}: {
  health: HealthScore | null;
  lastMonth: number | null;
  atRisk: Pick<EnvelopeInsight, "envelopeId" | "name" | "colour" | "daysLeft" | "bill">[];
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (!health) {
    return (
      <section aria-labelledby={`${panelId}-h`} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <h2 id={`${panelId}-h`} className="font-medium">
          Health score
        </h2>
        <p className="text-sm text-muted-foreground">Not enough activity yet. Record income and spending to see your score.</p>
      </section>
    );
  }

  const band = BANDS[health.band];
  const change = lastMonth === null ? null : health.score - lastMonth;

  return (
    <section aria-labelledby={`${panelId}-h`} className="rounded-2xl border border-border bg-card">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center gap-4 rounded-2xl p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <div className="relative size-16 shrink-0">
          <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
            <circle cx="50" cy="50" r="42" fill="none" strokeWidth="10" className="stroke-muted" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              pathLength="100"
              strokeDasharray={`${health.score} 100`}
              className={band.stroke}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold tabular-nums">{health.score}</span>
        </div>
        <span className="flex min-w-0 flex-1 flex-col">
          <span id={`${panelId}-h`} className="text-sm text-muted-foreground">
            Health score <span className="sr-only">{health.score} out of 100</span>
          </span>
          <span className={cn("text-lg font-semibold", band.text)}>{band.word}</span>
          {change !== null && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {change > 0 ? `▲ ${change}` : change < 0 ? `▼ ${-change}` : "No change"} this month
            </span>
          )}
        </span>
        <ChevronDown aria-hidden="true" className={cn("size-5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", open && "rotate-180")} />
        <span className="sr-only">{open ? "Hide details" : "Show details"}</span>
      </button>

      <div id={panelId} hidden={!open} className="flex flex-col gap-4 border-t border-border p-4">
        <ul className="flex flex-col gap-3">
          {health.parts.map((p) => (
            <li key={p.key} className="flex flex-col gap-1">
              <span className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">{p.label}</span>
                <span className="tabular-nums text-muted-foreground">{p.score}/25</span>
              </span>
              <ProgressBar value={p.score / 25} colour="var(--primary)" label={`${p.label}: ${p.score} of 25`} />
              <span className="text-xs text-muted-foreground">{p.detail}</span>
            </li>
          ))}
        </ul>
        {atRisk.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Envelopes at risk</h3>
            <ul className="flex flex-col gap-1 text-sm">
              {atRisk.map((e) => (
                <li key={e.envelopeId} className="flex items-center gap-2">
                  <EnvelopeSwatch colour={e.colour} />
                  <span className="truncate">{e.name}</span>
                  {e.bill ? (
                    <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                      {formatSen(e.bill.sen)} due {formatISODate(e.bill.dueOn)}
                    </span>
                  ) : (
                    e.daysLeft !== null && (
                      <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                        {e.daysLeft} {e.daysLeft === 1 ? "day" : "days"} left
                      </span>
                    )
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
