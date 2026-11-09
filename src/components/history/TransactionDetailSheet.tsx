"use client";

import { useCallback, useState, type FormEvent, type ReactNode } from "react";
import { correctTransaction, recordRefund, unvoidTransaction, voidTransaction } from "@/server/actions/ledger";
import { Button, ConfirmSheet, Input, MoneyInput, Sheet, parsePositiveSen } from "@/components/ui";
import { useRunAction } from "@/components/ledger/useRunAction";
import { entryDateError, formatISODate, toISODate, todayKL } from "@/lib/dates";
import { formatSen, formatSenPlain } from "@/lib/money";
import type { ActionResult, TransactionView } from "@/lib/types";
import { EditTransactionForm } from "./EditTransactionForm";
import { envelopeName, signedAmount, transactionKind, type EnvelopesById } from "./labels";

type Mode = "view" | "confirm-void" | "refund" | "edit";

/**
 * Detail, edit (a correction that keeps the original), void/restore and refund for one entry. The void confirm is a sibling ConfirmSheet,
 * not nested inside this Sheet: two nested Sheets would both close on Escape and fight over Tab.
 */
export function TransactionDetailSheet({
  tx,
  envelopes,
  onClose,
  onOpen,
  canOpen,
}: {
  tx: TransactionView | null;
  envelopes: EnvelopesById;
  onClose: () => void;
  /** Switch the sheet to another entry (the correction or the original), when it is in the list. */
  onOpen?: (id: string) => void;
  canOpen?: (id: string) => boolean;
}) {
  const [mode, setMode] = useState<Mode>("view");
  const { pending, error, run: runAction } = useRunAction();
  const backToView = useCallback(() => setMode("view"), []);

  async function run(action: () => Promise<ActionResult<unknown>>, successMessage: string) {
    const ok = await runAction(action, successMessage, { onSuccess: onClose });
    if (!ok) setMode((m) => (m === "confirm-void" ? "view" : m)); // show the reason in the detail sheet
  }

  if (!tx) return null;
  const voided = tx.voidedAt !== null;
  const isExpense = tx.type === "EXPENSE";
  const refundable = isExpense ? tx.amountSen - tx.refundedSen : 0; // the one client sum: remaining refundable

  return (
    <>
      <Sheet open={mode !== "confirm-void"} onClose={onClose} title={transactionKind(tx)}>
        {mode === "edit" ? (
          <EditTransactionForm
            tx={tx}
            envelopes={envelopes}
            pending={pending}
            error={error}
            onCancel={backToView}
            onSave={(input) => run(() => correctTransaction(input), "Corrected. The original is kept in history.")}
          />
        ) : mode === "refund" ? (
          <RefundForm
            remainingSen={refundable}
            expenseDate={tx.occurredOn}
            pending={pending}
            error={error}
            onCancel={backToView}
            onSave={(amountSen, occurredOn, note) =>
              run(() => recordRefund({ expenseId: tx.id, amountSen, occurredOn, note }), "Refund recorded")
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <Field label="Amount">
                <span className={voided ? "line-through" : undefined}>{signedAmount(tx).text}</span>
              </Field>
              <Field label="Date">{formatISODate(tx.occurredOn)}</Field>
              {tx.type === "TRANSFER" ? (
                <>
                  <Field label="From">{envelopeLabel(tx.fromEnvelopeId, envelopes)}</Field>
                  <Field label="To">{envelopeLabel(tx.toEnvelopeId, envelopes)}</Field>
                </>
              ) : (
                tx.envelopeId && <Field label="Envelope">{envelopeLabel(tx.envelopeId, envelopes)}</Field>
              )}
              {tx.merchant && <Field label="Merchant">{tx.merchant}</Field>}
              {tx.note && <Field label="Note">{tx.note}</Field>}
              {isExpense && (
                <Field label="Refunded">
                  {formatSen(tx.refundedSen)} of {formatSen(tx.amountSen)}
                </Field>
              )}
              {tx.voidedAt && (
                <Field label={tx.correctedById ? "Corrected" : "Voided"}>{formatISODate(toISODate(new Date(tx.voidedAt)))}</Field>
              )}
              {tx.correctedById && (
                <Field label="Replaced by">
                  <EntryLink id={tx.correctedById} onOpen={onOpen} canOpen={canOpen} label="the corrected entry" />
                </Field>
              )}
              {tx.correctsId && (
                <Field label="Correction of">
                  <EntryLink id={tx.correctsId} onOpen={onOpen} canOpen={canOpen} label="an earlier entry" />
                </Field>
              )}
            </dl>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-2">
              {!voided && (
                <Button variant="secondary" onClick={() => setMode("edit")} disabled={pending}>
                  Edit
                </Button>
              )}
              {isExpense && !voided && refundable > 0 && (
                <Button variant="secondary" onClick={() => setMode("refund")} disabled={pending}>
                  Record refund
                </Button>
              )}
              {voided ? (
                <Button variant="secondary" pending={pending} onClick={() => run(() => unvoidTransaction({ id: tx.id }), "Entry restored")}>
                  Restore entry
                </Button>
              ) : (
                <Button variant="danger" onClick={() => setMode("confirm-void")} disabled={pending}>
                  Void entry
                </Button>
              )}
            </div>
          </div>
        )}
      </Sheet>
      <ConfirmSheet
        open={mode === "confirm-void"}
        onClose={backToView}
        onConfirm={() => run(() => voidTransaction({ id: tx.id }), "Entry voided")}
        pending={pending}
        title="Void this entry?"
        message={`This entry stops counting. It stays in your history and you can restore it.${
          isExpense && tx.refundedSen > 0 ? " Its refunds are voided too." : ""
        }`}
        confirmLabel="Void entry"
        danger
      />
    </>
  );
}

/** A link-styled button that opens another entry when it is on this page; plain text otherwise. */
function EntryLink({
  id,
  label,
  onOpen,
  canOpen,
}: {
  id: string;
  label: string;
  onOpen?: (id: string) => void;
  canOpen?: (id: string) => boolean;
}) {
  if (!onOpen || !canOpen?.(id)) return <>{label[0].toUpperCase() + label.slice(1)}</>;
  return (
    <button type="button" onClick={() => onOpen(id)} className="min-h-11 text-left font-medium underline">
      View {label}
    </button>
  );
}

function envelopeLabel(id: string | null, envelopes: EnvelopesById): string {
  const name = envelopeName(id, envelopes);
  return id && envelopes[id]?.archived ? `${name} (archived)` : name;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words tabular-nums">{children}</dd>
    </>
  );
}

function RefundForm({
  remainingSen,
  expenseDate,
  pending,
  error,
  onCancel,
  onSave,
}: {
  remainingSen: number;
  /** A refund can't be dated before its expense. */
  expenseDate: string;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (amountSen: number, occurredOn: string, note: string | undefined) => void;
}) {
  const today = todayKL();
  const [amount, setAmount] = useState(formatSenPlain(remainingSen));
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const amountSen = parsePositiveSen(amount);
  const overLimit = amountSen !== null && amountSen > remainingSen;
  const dateError =
    entryDateError(date) ??
    (date < expenseDate ? `A refund can't be dated before its expense (${formatISODate(expenseDate)})` : null);
  const canSave = amountSen !== null && !overLimit && dateError === null;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (canSave) onSave(amountSen, date, note || undefined);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <MoneyInput label="Refund amount" value={amount} onChange={setAmount} autoFocus />
      {overLimit && <p className="-mt-2 text-sm text-destructive">You can refund up to {formatSen(remainingSen)}</p>}
      <Input label="Date" type="date" value={date} min={expenseDate} max={today} onChange={(e) => setDate(e.target.value)} error={dateError} required />
      <Input label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} autoComplete="off" />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" pending={pending} disabled={!canSave}>
        Save refund
      </Button>
      <Button variant="ghost" onClick={onCancel} disabled={pending}>
        Back
      </Button>
    </form>
  );
}
