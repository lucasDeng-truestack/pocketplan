"use client";

import { useCallback, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import {
  pauseRecurring,
  recordRecurring,
  resumeRecurring,
  skipRecurring,
  stopRecurring,
  updateRecurring,
} from "@/server/actions/recurring";
import { Button, ConfirmSheet, EnvelopeSwatch, Input, MoneyInput, Sheet, parsePositiveSen } from "@/components/ui";
import { EnvelopeChips } from "@/components/ledger/EnvelopeChips";
import { useQuickAdd } from "@/components/ledger/QuickAdd";
import { useRunAction } from "@/components/ledger/useRunAction";
import { cn } from "@/lib/cn";
import { formatISODate } from "@/lib/dates";
import { formatSen, formatSenPlain } from "@/lib/money";
import type { ActionResult, RecurringCadence, RecurringView } from "@/lib/types";
import { envelopeName, recurringName, type EnvelopesById } from "./labels";

const badge = "shrink-0 rounded-full px-2 text-[0.6875rem] leading-5 font-medium";
const cadenceLabel = (r: RecurringView) => (r.cadence === "MONTHLY" ? "Monthly" : "Weekly");
const isDue = (r: RecurringView) => r.pausedAt === null && r.dueCount > 0;

/** Recurring items are reminders: each occurrence shows as due and is recorded only when the person taps Record. */
export function RecurringList({ items, envelopes }: { items: RecurringView[]; envelopes: EnvelopesById }) {
  const openQuickAdd = useQuickAdd();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const close = useCallback(() => setSelectedId(null), []); // stable: Sheet's focus effect depends on it
  const selected = items.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <Button variant="secondary" className="self-start" onClick={() => openQuickAdd("expense", { repeats: true })}>
        <Plus aria-hidden="true" className="size-4" />
        New recurring
      </Button>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-4 text-muted-foreground">
          No recurring items yet. A recurring bill or income is a reminder: it shows as due on its date and you tap Record to
          add it. Nothing is recorded automatically.
        </p>
      ) : (
        <ul className="rounded-2xl border border-border bg-card px-3">
          {items.map((r) => (
            <li key={r.id} className="border-b border-border last:border-b-0">
              <button
                type="button"
                onClick={() => setSelectedId(r.id)}
                className={cn(
                  "flex min-h-16 w-full items-center gap-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  r.pausedAt && "opacity-70",
                )}
              >
                <EnvelopeSwatch
                  colour={r.envelopeId ? (envelopes[r.envelopeId]?.colour ?? null) : null}
                  icon={r.envelopeId ? envelopes[r.envelopeId]?.icon : null}
                  className={r.envelopeId && envelopes[r.envelopeId]?.icon ? undefined : "size-3.5"}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{recurringName(r, envelopes)}</span>
                    {isDue(r) && (
                      <span className={cn(badge, "bg-warning text-warning-foreground")}>Due{r.dueCount > 1 ? ` ×${r.dueCount}` : ""}</span>
                    )}
                    {r.pausedAt && <span className={cn(badge, "border border-border text-muted-foreground")}>Paused</span>}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {cadenceLabel(r)} · {r.pausedAt ? "paused" : `next ${formatISODate(r.nextDueOn)}`}
                  </span>
                </span>
                <span className={cn("shrink-0 tabular-nums", r.kind === "INCOME" && "font-medium text-success")}>
                  {r.kind === "INCOME" ? `+${formatSen(r.amountSen)}` : `−${formatSen(r.amountSen)}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* key: fresh state for each item */}
      <RecurringSheet key={selected?.id ?? "none"} item={selected} envelopes={envelopes} onClose={close} />
    </div>
  );
}

type Mode = "view" | "edit" | "confirm-stop";

function RecurringSheet({ item, envelopes, onClose }: { item: RecurringView | null; envelopes: EnvelopesById; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("view");
  const { pending, error, run: runAction } = useRunAction();
  const backToView = useCallback(() => setMode("view"), []);

  async function run(action: () => Promise<ActionResult<unknown>>, message: string) {
    const ok = await runAction(action, message, { onSuccess: onClose });
    if (!ok) setMode((m) => (m === "confirm-stop" ? "view" : m)); // show the reason in the sheet
  }

  if (!item) return null;
  const name = recurringName(item, envelopes);
  const due = isDue(item);

  return (
    <>
      <Sheet open={mode !== "confirm-stop"} onClose={onClose} title={name}>
        {mode === "edit" ? (
          <EditRecurringForm
            item={item}
            envelopes={envelopes}
            pending={pending}
            error={error}
            onCancel={backToView}
            onSave={(input) => run(() => updateRecurring(input), "Recurring item updated")}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Amount</dt>
              <dd className="tabular-nums">{formatSen(item.amountSen)}</dd>
              <dt className="text-muted-foreground">Kind</dt>
              <dd>{item.kind === "INCOME" ? "Income" : `Expense · ${envelopeName(item.envelopeId, envelopes)}`}</dd>
              <dt className="text-muted-foreground">Repeats</dt>
              <dd>{cadenceLabel(item)}</dd>
              <dt className="text-muted-foreground">{item.pausedAt ? "Paused" : "Next due"}</dt>
              <dd>
                {item.pausedAt ? "Resume to see it as due again" : formatISODate(item.nextDueOn)}
                {due && item.dueCount > 1 && ` (${item.dueCount} due)`}
              </dd>
              {item.merchant && (
                <>
                  <dt className="text-muted-foreground">Merchant</dt>
                  <dd className="min-w-0 break-words">{item.merchant}</dd>
                </>
              )}
              {item.note && (
                <>
                  <dt className="text-muted-foreground">Note</dt>
                  <dd className="min-w-0 break-words">{item.note}</dd>
                </>
              )}
            </dl>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-2">
              {due && (
                <>
                  <Button pending={pending} onClick={() => run(() => recordRecurring({ id: item.id, dueOn: item.nextDueOn }), "Recorded")}>
                    Record {formatISODate(item.nextDueOn)}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={pending}
                    onClick={() => run(() => skipRecurring({ id: item.id, dueOn: item.nextDueOn }), `Skipped ${formatISODate(item.nextDueOn)}`)}
                  >
                    Skip this one
                  </Button>
                </>
              )}
              <Button variant="secondary" disabled={pending} onClick={() => setMode("edit")}>
                Edit
              </Button>
              {item.pausedAt ? (
                <Button variant="secondary" disabled={pending} onClick={() => run(() => resumeRecurring({ id: item.id }), "Resumed")}>
                  Resume
                </Button>
              ) : (
                <Button variant="secondary" disabled={pending} onClick={() => run(() => pauseRecurring({ id: item.id }), "Paused")}>
                  Pause
                </Button>
              )}
              <Button variant="danger" disabled={pending} onClick={() => setMode("confirm-stop")}>
                Stop repeating
              </Button>
            </div>
          </div>
        )}
      </Sheet>
      <ConfirmSheet
        open={mode === "confirm-stop"}
        onClose={backToView}
        onConfirm={() => run(() => stopRecurring({ id: item.id }), "Stopped")}
        pending={pending}
        title="Stop repeating?"
        message="It will not show as due again. Entries it already recorded stay in your history."
        confirmLabel="Stop repeating"
        danger
      />
    </>
  );
}

function EditRecurringForm({
  item,
  envelopes,
  pending,
  error,
  onCancel,
  onSave,
}: {
  item: RecurringView;
  envelopes: EnvelopesById;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (input: { id: string; amountSen: number; cadence?: RecurringCadence; envelopeId?: string | null; merchant?: string; note?: string }) => void;
}) {
  const [amount, setAmount] = useState(formatSenPlain(item.amountSen));
  const [cadence, setCadence] = useState<RecurringCadence>(item.cadence);
  const [envelopeId, setEnvelopeId] = useState(item.envelopeId);
  const [merchant, setMerchant] = useState(item.merchant ?? "");
  const [note, setNote] = useState(item.note ?? "");
  const isExpense = item.kind === "EXPENSE";
  const amountSen = parsePositiveSen(amount);
  const canSave = amountSen !== null;
  const options = [
    { id: null, name: "Unallocated", colour: null },
    ...Object.entries(envelopes)
      .filter(([id, e]) => !e.archived || id === item.envelopeId)
      .map(([id, e]) => ({ id, name: e.name, colour: e.colour, icon: e.icon ?? null })),
  ];

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSave || amountSen === null) return;
    onSave({
      id: item.id,
      amountSen,
      cadence,
      note: note.trim() || undefined,
      ...(isExpense ? { envelopeId, merchant: merchant.trim() || undefined } : {}),
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">Changes apply to the next ones. Entries already recorded stay as they are.</p>
      <MoneyInput value={amount} onChange={setAmount} />
      <div className="flex flex-col gap-1">
        <span id={`${item.id}-cadence`} className="text-sm font-medium">
          Repeats
        </span>
        <div role="radiogroup" aria-labelledby={`${item.id}-cadence`} className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          {(["WEEKLY", "MONTHLY"] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={cadence === c}
              onClick={() => setCadence(c)}
              className={cn("min-h-11 rounded-lg text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring", cadence === c ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}
            >
              {c === "WEEKLY" ? "Weekly" : "Monthly"}
            </button>
          ))}
        </div>
        {cadence !== item.cadence && (
          <p className="text-xs text-muted-foreground">The new schedule starts from {formatISODate(item.nextDueOn)}.</p>
        )}
      </div>
      {isExpense && <EnvelopeChips label="Envelope (optional)" options={options} value={envelopeId} onChange={setEnvelopeId} />}
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
        Save changes
      </Button>
      <Button variant="ghost" onClick={onCancel} disabled={pending}>
        Back
      </Button>
    </form>
  );
}
