import Link from "next/link";
import { formatISODate } from "@/lib/dates";
import { formatSen } from "@/lib/money";
import type { ISODate, RecurringView } from "@/lib/types";

/** Recurring reminders due within the week; each opens the recurring view to record or skip. Hidden when empty. */
export function DueList({ items, today }: { items: RecurringView[]; today: ISODate }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="due-heading" className="rounded-2xl border border-border bg-card p-4">
      <h2 id="due-heading" className="mb-1 font-medium">
        Due soon
      </h2>
      <ul>
        {items.map((r) => {
          const due = r.nextDueOn <= today || r.dueCount > 0;
          return (
            <li key={r.id} className="border-b border-border last:border-b-0">
              <Link href="/activity?view=recurring" className="flex min-h-14 items-center gap-3 py-2">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{r.merchant ?? r.note ?? (r.kind === "INCOME" ? "Income" : "Expense")}</span>
                  <span className="text-xs text-muted-foreground">{formatISODate(r.nextDueOn)}</span>
                </span>
                {due && <span className="shrink-0 rounded-full bg-warning/20 px-2 text-xs font-medium text-foreground">Due</span>}
                <span className="shrink-0 tabular-nums">
                  {r.kind === "INCOME" ? "+" : "−"}
                  {formatSen(r.amountSen)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
