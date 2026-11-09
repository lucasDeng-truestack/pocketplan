import { EnvelopeSwatch } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatSen } from "@/lib/money";
import type { TransactionView } from "@/lib/types";
import { signedAmount, swatchEnvelopeId, transactionLabel, transactionSubtitle, type EnvelopesById } from "./labels";

const badge = "shrink-0 rounded-full border border-border px-2 text-[0.6875rem] leading-5 font-medium text-muted-foreground";

export function TransactionRow({
  tx,
  envelopes,
  onSelect,
}: {
  tx: TransactionView;
  envelopes: EnvelopesById;
  onSelect: (id: string) => void;
}) {
  const swatchId = swatchEnvelopeId(tx);
  const amount = signedAmount(tx);
  const voided = tx.voidedAt !== null;
  const subtitle = transactionSubtitle(tx, envelopes);
  return (
    <li className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => onSelect(tx.id)}
        className={cn(
          "flex min-h-14 w-full items-center gap-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          voided && "opacity-60",
        )}
      >
        {(() => {
          const e = swatchId ? envelopes[swatchId] : undefined;
          return <EnvelopeSwatch colour={e?.colour ?? null} icon={e?.icon} className={e?.icon ? undefined : "size-3.5"} />;
        })()}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            <span className={cn("truncate font-medium", voided && "line-through")}>{transactionLabel(tx, envelopes)}</span>
            {tx.recurringId && <span className={cn(badge, "tracking-wide")}>REPEATS</span>}
            {voided && <span className={badge}>{tx.correctedById ? "Corrected" : "Voided"}</span>}
          </span>
          {subtitle && <span className="truncate text-xs text-muted-foreground">{subtitle}</span>}
          {tx.type === "EXPENSE" && tx.refundedSen > 0 && (
            <span className="text-xs text-muted-foreground">Refunded {formatSen(tx.refundedSen)}</span>
          )}
        </span>
        <span
          className={cn(
            "shrink-0 tabular-nums",
            amount.effect === "move" && "text-muted-foreground",
            amount.effect === "in" && "font-medium text-success",
            voided && "text-muted-foreground line-through",
          )}
        >
          {amount.text}
        </span>
      </button>
    </li>
  );
}
