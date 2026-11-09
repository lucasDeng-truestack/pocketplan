import { addDays, formatISODate, todayKL } from "@/lib/dates";
import { formatSen } from "@/lib/money";
import type { EnvelopeIcon, ISODate, RecurringView, Sen, TransactionView } from "@/lib/types";

export type EnvelopeInfo = { name: string; colour: string | null; icon?: EnvelopeIcon | null; archived: boolean };
export type EnvelopesById = Record<string, EnvelopeInfo>;

/** null = Unallocated. Deleted envelopes arrive as "Name (deleted)" via listEnvelopeLabels; a missing id means stale props. */
export function envelopeName(id: string | null, envelopes: EnvelopesById): string {
  if (!id) return "Unallocated";
  return envelopes[id]?.name ?? "Unknown envelope";
}

export function transactionLabel(tx: TransactionView, envelopes: EnvelopesById): string {
  switch (tx.type) {
    case "EXPENSE":
      return tx.merchant || envelopeName(tx.envelopeId, envelopes);
    case "INCOME":
      return tx.note || "Income";
    case "REFUND":
      return `Refund · ${envelopeName(tx.envelopeId, envelopes)}`;
    case "TRANSFER":
      if (!tx.fromEnvelopeId) return `Allocation → ${envelopeName(tx.toEnvelopeId, envelopes)}`;
      if (!tx.toEnvelopeId) return `Moved back · ${envelopeName(tx.fromEnvelopeId, envelopes)}`;
      return `${envelopeName(tx.fromEnvelopeId, envelopes)} → ${envelopeName(tx.toEnvelopeId, envelopes)}`;
  }
}

export function transactionKind(tx: TransactionView): string {
  switch (tx.type) {
    case "EXPENSE":
      return "Expense";
    case "INCOME":
      return "Income";
    case "REFUND":
      return "Refund";
    case "TRANSFER":
      return !tx.fromEnvelopeId ? "Allocation" : !tx.toEnvelopeId ? "Moved back to Unallocated" : "Transfer";
  }
}

/** The envelope whose colour marks the row; null for income. */
export function swatchEnvelopeId(tx: TransactionView): string | null {
  return tx.type === "TRANSFER" ? (tx.toEnvelopeId ?? tx.fromEnvelopeId) : tx.envelopeId;
}

/** Signed by its effect on total remaining; transfers only move money, so they carry no sign. */
export function signedAmount(tx: TransactionView): { text: string; effect: "in" | "out" | "move" } {
  const abs = formatSen(tx.amountSen);
  if (tx.type === "INCOME" || tx.type === "REFUND") return { text: `+${abs}`, effect: "in" };
  if (tx.type === "EXPENSE") return { text: `−${abs}`, effect: "out" };
  return { text: abs, effect: "move" };
}

/** Second line under the label: the envelope when the label is a merchant, else the note if not already shown. */
export function transactionSubtitle(tx: TransactionView, envelopes: EnvelopesById): string | null {
  if ((tx.type === "EXPENSE" || tx.type === "REFUND") && tx.merchant) return envelopeName(tx.envelopeId, envelopes);
  if (tx.type === "INCOME") return tx.note ? "Income" : null;
  return tx.note;
}

/** Day heading: "Today", "Yesterday", else "6 Nov 2026". */
export function dayLabel(iso: ISODate): string {
  const today = todayKL();
  if (iso === today) return "Today";
  if (iso === addDays(today, -1)) return "Yesterday";
  return formatISODate(iso);
}

/** Net effect on total remaining of the given rows: income + refunds − expenses, voided rows and transfers excluded. */
export function dayNetSen(rows: TransactionView[]): Sen {
  let net = 0;
  for (const t of rows) {
    if (t.voidedAt !== null) continue;
    if (t.type === "INCOME" || t.type === "REFUND") net += t.amountSen;
    else if (t.type === "EXPENSE") net -= t.amountSen;
  }
  return net;
}

/** Shown name of a recurring item. */
export function recurringName(r: RecurringView, envelopes: EnvelopesById): string {
  return r.merchant || r.note || (r.kind === "INCOME" ? "Income" : envelopeName(r.envelopeId, envelopes));
}
