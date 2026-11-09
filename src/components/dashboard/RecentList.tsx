import Link from "next/link";
import { EnvelopeSwatch } from "@/components/ui";
import { signedAmount, swatchEnvelopeId, transactionLabel, type EnvelopesById } from "@/components/history/labels";
import { cn } from "@/lib/cn";
import { formatISODate } from "@/lib/dates";
import type { TransactionView } from "@/lib/types";

/**
 * Read-only transaction list card. TransactionRow needs a client onSelect, so this mirrors it with the same label helpers.
 * `hrefFor` makes each row a link (server-to-server prop, no client code).
 */
export function RecentList({
  items,
  envelopes,
  title = "Recent activity",
  action = { href: "/activity", label: "See all" },
  emptyText = "Nothing recorded yet.",
  hrefFor,
}: {
  items: TransactionView[];
  envelopes: EnvelopesById;
  title?: string;
  action?: { href: string; label: string } | null;
  emptyText?: string;
  hrefFor?: (tx: TransactionView) => string;
}) {
  const headingId = `${title.toLowerCase().replace(/\W+/g, "-")}-heading`;
  return (
    <section aria-labelledby={headingId} className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-1 flex min-h-11 items-center justify-between gap-2">
        <h2 id={headingId} className="font-medium">
          {title}
        </h2>
        {action && (
          <Link href={action.href} className="flex min-h-11 items-center px-2 text-sm font-medium underline-offset-4 hover:underline">
            {action.label}
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul>
          {items.map((tx) => {
            const id = swatchEnvelopeId(tx);
            const amount = signedAmount(tx);
            const voided = tx.voidedAt !== null;
            const row = (
              <>
                <EnvelopeSwatch colour={id ? (envelopes[id]?.colour ?? null) : null} icon={id ? envelopes[id]?.icon : null} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{transactionLabel(tx, envelopes)}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatISODate(tx.occurredOn)}
                    {voided && (tx.correctedById ? " · Corrected" : " · Voided")}
                  </span>
                </span>
                <span className={cn("shrink-0 tabular-nums", amount.effect === "move" && "text-muted-foreground", voided && "line-through")}>
                  {amount.text}
                </span>
              </>
            );
            const rowClass = cn("flex min-h-14 items-center gap-3 py-2", voided && "opacity-60");
            return (
              <li key={tx.id} className="border-b border-border last:border-b-0">
                {hrefFor ? (
                  <Link href={hrefFor(tx)} className={cn(rowClass, "-mx-2 rounded-lg px-2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring")}>
                    {row}
                  </Link>
                ) : (
                  <div className={rowClass}>{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
