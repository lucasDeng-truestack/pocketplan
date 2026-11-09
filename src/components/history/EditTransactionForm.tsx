"use client";

import { useState, type FormEvent } from "react";
import { Button, Input, MoneyInput, parsePositiveSen } from "@/components/ui";
import { EnvelopeChips, type EnvelopeChip } from "@/components/ledger/EnvelopeChips";
import { entryDateError, todayKL } from "@/lib/dates";
import { formatSenPlain } from "@/lib/money";
import type { TransactionView } from "@/lib/types";
import type { EnvelopesById } from "./labels";

export type CorrectionInput = {
  id: string;
  amountSen: number;
  occurredOn: string;
  /** null = no envelope (Unallocated) */
  envelopeId?: string | null;
  fromEnvelopeId?: string | null;
  toEnvelopeId?: string | null;
  merchant?: string;
  note?: string;
};

/** Active envelopes, plus the ones this entry already uses (which may be archived since). */
function chipOptions(envelopes: EnvelopesById, keep: (string | null)[], withUnallocated: boolean): EnvelopeChip[] {
  const list: EnvelopeChip[] = Object.entries(envelopes)
    .filter(([id, e]) => !e.archived || keep.includes(id))
    .map(([id, e]) => ({ id, name: e.archived ? `${e.name} (archived)` : e.name, colour: e.colour, icon: e.icon ?? null }));
  return withUnallocated ? [{ id: null, name: "Unallocated", colour: null }, ...list] : list;
}

/**
 * Edit = a correction: the server voids this entry and records the corrected copy in one step.
 * The type never changes; fields follow it (expense: envelope + merchant; transfer: from/to).
 */
export function EditTransactionForm({
  tx,
  envelopes,
  pending,
  error,
  onCancel,
  onSave,
}: {
  tx: TransactionView;
  envelopes: EnvelopesById;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (input: CorrectionInput) => void;
}) {
  const today = todayKL();
  const [amount, setAmount] = useState(formatSenPlain(tx.amountSen));
  const [date, setDate] = useState(tx.occurredOn);
  const [envelopeId, setEnvelopeId] = useState(tx.envelopeId);
  const [from, setFrom] = useState(tx.fromEnvelopeId);
  const [to, setTo] = useState(tx.toEnvelopeId);
  const [merchant, setMerchant] = useState(tx.merchant ?? "");
  const [note, setNote] = useState(tx.note ?? "");

  const isExpense = tx.type === "EXPENSE";
  const isTransfer = tx.type === "TRANSFER";
  const amountSen = parsePositiveSen(amount);
  const dateError = entryDateError(date);
  const same = isTransfer && from === to;
  const changed =
    amountSen !== tx.amountSen ||
    date !== tx.occurredOn ||
    note.trim() !== (tx.note ?? "") ||
    (isExpense && (envelopeId !== tx.envelopeId || merchant.trim() !== (tx.merchant ?? ""))) ||
    (isTransfer && (from !== tx.fromEnvelopeId || to !== tx.toEnvelopeId));
  const canSave = amountSen !== null && dateError === null && !same && changed;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSave || amountSen === null) return;
    onSave({
      id: tx.id,
      amountSen,
      occurredOn: date,
      note: note.trim() || undefined,
      ...(isExpense ? { envelopeId, merchant: merchant.trim() || undefined } : {}),
      ...(isTransfer ? { fromEnvelopeId: from, toEnvelopeId: to } : {}),
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">Saving replaces this entry with the corrected one. The original stays in your history, marked Corrected.</p>
      <MoneyInput value={amount} onChange={setAmount} />
      {isExpense && (
        <EnvelopeChips label="Envelope (optional)" options={chipOptions(envelopes, [tx.envelopeId], true)} value={envelopeId} onChange={setEnvelopeId} />
      )}
      {isTransfer && (
        <>
          <EnvelopeChips label="From" options={chipOptions(envelopes, [tx.fromEnvelopeId, tx.toEnvelopeId], true)} value={from} onChange={setFrom} />
          <EnvelopeChips label="To" options={chipOptions(envelopes, [tx.fromEnvelopeId, tx.toEnvelopeId], true)} value={to} onChange={setTo} />
          {same && <p className="-mt-2 text-sm text-destructive">Choose two different envelopes</p>}
        </>
      )}
      <Input label="Date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} error={dateError} required />
      {isExpense && (
        <Input label="Merchant (optional)" value={merchant} onChange={(e) => setMerchant(e.target.value)} maxLength={140} autoComplete="off" />
      )}
      <Input label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} autoComplete="off" />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" pending={pending} disabled={!canSave}>
        Save correction
      </Button>
      <Button variant="ghost" onClick={onCancel} disabled={pending}>
        Back
      </Button>
    </form>
  );
}
