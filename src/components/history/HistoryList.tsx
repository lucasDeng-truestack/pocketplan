"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/cn";
import { formatSen } from "@/lib/money";
import type { TransactionView } from "@/lib/types";
import { TransactionDetailSheet } from "./TransactionDetailSheet";
import { TransactionRow } from "./TransactionRow";
import { dayLabel, dayNetSen, type EnvelopesById } from "./labels";

/**
 * Rows grouped by day (items arrive newest first); tapping one opens the detail sheet.
 * dayTotals: each day's net (income + refunds − expenses) on the right, summed from the rows on this page.
 * A day that may continue on another page (the first group when continuesFromBefore, the last when
 * hasMoreAfter) shows no total, since a partial sum would be wrong.
 */
export function HistoryList({
  items,
  envelopes,
  dayTotals = false,
  continuesFromBefore = false,
  hasMoreAfter = false,
}: {
  items: TransactionView[];
  envelopes: EnvelopesById;
  dayTotals?: boolean;
  /** This page was reached with a cursor: its first day may have rows on the previous page. */
  continuesFromBefore?: boolean;
  /** There is a next page: its last day may have more rows there. */
  hasMoreAfter?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const close = useCallback(() => setSelectedId(null), []); // stable: Sheet's focus effect depends on it
  const selected = items.find((t) => t.id === selectedId) ?? null;
  const canOpen = useCallback((id: string) => items.some((t) => t.id === id), [items]);

  const days: { date: string; rows: TransactionView[] }[] = [];
  for (const tx of items) {
    const last = days[days.length - 1];
    if (last?.date === tx.occurredOn) last.rows.push(tx);
    else days.push({ date: tx.occurredOn, rows: [tx] });
  }

  return (
    <>
      <div className="flex flex-col gap-4 2xl:block 2xl:columns-2 2xl:gap-6 2xl:*:mb-4 2xl:*:break-inside-avoid">
        {days.map((day, i) => {
          const maybeCut = (continuesFromBefore && i === 0) || (hasMoreAfter && i === days.length - 1);
          const net = dayTotals && !maybeCut && day.rows.some((t) => t.type !== "TRANSFER" && t.voidedAt === null) ? dayNetSen(day.rows) : null;
          return (
            <section key={day.date} aria-labelledby={`day-${day.date}`}>
              <div className="mb-1 flex items-baseline justify-between gap-2 px-1">
                <h2 id={`day-${day.date}`} className="font-sans text-sm font-medium text-muted-foreground">
                  {dayLabel(day.date)}
                </h2>
                {net !== null && (
                  <span className={cn("text-sm tabular-nums", net > 0 ? "text-success" : "text-muted-foreground")}>
                    <span className="sr-only">Net for the day </span>
                    {net > 0 ? `+${formatSen(net)}` : formatSen(net)}
                  </span>
                )}
              </div>
              <ul className="rounded-2xl border border-border bg-card px-3">
                {day.rows.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} envelopes={envelopes} onSelect={setSelectedId} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      {/* key: fresh form state for each entry */}
      <TransactionDetailSheet
        key={selected?.id ?? "none"}
        tx={selected}
        envelopes={envelopes}
        onClose={close}
        onOpen={setSelectedId}
        canOpen={canOpen}
      />
    </>
  );
}
