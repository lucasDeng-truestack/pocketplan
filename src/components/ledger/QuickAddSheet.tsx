"use client";

import Link from "next/link";
import { useId, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { recordExpense, recordIncome, transfer } from "@/server/actions/ledger";
import { createRecurring, recordRecurring } from "@/server/actions/recurring";
import { Button, Sheet, parsePositiveSen } from "@/components/ui";
import { cn } from "@/lib/cn";
import { addDays, entryDateError, formatISODate, isISODate, occurrenceDate, todayKL } from "@/lib/dates";
import { formatSen } from "@/lib/money";
import type { ActionResult, EnvelopeView, RecurringCadence, Sen } from "@/lib/types";
import { AmountEntry } from "./AmountEntry";
import { EnvelopeChips, type EnvelopeChip } from "./EnvelopeChips";
import { useRunAction, type SuccessToast } from "./useRunAction";

export type QuickAddTab = "expense" | "income" | "transfer";
export const QUICK_ADD_TABS: readonly QuickAddTab[] = ["expense", "income", "transfer"];

const TABS: { id: QuickAddTab; label: string }[] = [
  { id: "expense", label: "Expense" },
  { id: "income", label: "Income" },
  { id: "transfer", label: "Transfer" },
];

type FormProps = { envelopes: EnvelopeView[]; unallocatedSen: Sen; initialRepeats: boolean; onDone: () => void };

export function QuickAddSheet({
  open,
  onClose,
  tab,
  onTabChange,
  envelopes,
  unallocatedSen,
  initialRepeats = false,
}: {
  open: boolean;
  onClose: () => void;
  tab: QuickAddTab;
  onTabChange: (tab: QuickAddTab) => void;
  /** null = could not be loaded */
  envelopes: EnvelopeView[] | null;
  unallocatedSen: Sen;
  /** Opens Expense or Income with Repeats switched on ("+ New recurring"). */
  initialRepeats?: boolean;
}) {
  const baseId = useId();
  const reduce = useReducedMotion();
  // +1 when moving right (Expense → Transfer), −1 when moving left; the new form slides in from that side.
  const [dir, setDir] = useState(1);
  const index = TABS.findIndex((t) => t.id === tab);
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 500, damping: 46 };
  const offset = reduce ? 0 : 14; // small on purpose: big lateral moves are what make people queasy
  return (
    <Sheet open={open} onClose={onClose} title="Quick add">
      {/* Clicks only: no key handlers, so digits typed into the amount never switch tabs. */}
      <div role="tablist" aria-label="Kind of entry" className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${baseId}-${t.id}-tab`}
            aria-selected={tab === t.id}
            aria-controls={`${baseId}-panel`}
            onClick={() => {
              setDir(TABS.findIndex((x) => x.id === t.id) >= index ? 1 : -1);
              onTabChange(t.id);
            }}
            className={cn(
              "relative min-h-11 rounded-lg text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              tab === t.id ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {/* the selected pill slides between tabs */}
            {tab === t.id && <motion.span layoutId={`${baseId}-pill`} transition={spring} className="absolute inset-0 rounded-lg bg-card shadow-sm" />}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-${tab}-tab`}>
        <AutoHeight reduce={reduce ?? false}>
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={tab}
              custom={dir}
              initial={{ opacity: 0, x: dir * offset }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -dir * offset }}
              transition={reduce ? { duration: 0 } : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
            {envelopes === null ? (
              <p role="alert" className="rounded-xl border border-dashed border-border p-4 text-muted-foreground">
                Could not load your envelopes. Reload the page and try again.
              </p>
            ) : (
              <>
                {/* key: each tab (and each open) starts with fresh fields */}
                {tab === "expense" && (
                  <ExpenseForm key="expense" envelopes={envelopes} unallocatedSen={unallocatedSen} initialRepeats={initialRepeats} onDone={onClose} />
                )}
                {tab === "income" && (
                  <IncomeForm key="income" envelopes={envelopes} unallocatedSen={unallocatedSen} initialRepeats={initialRepeats} onDone={onClose} />
                )}
                {tab === "transfer" && (
                  <TransferForm key="transfer" envelopes={envelopes} unallocatedSen={unallocatedSen} initialRepeats={false} onDone={onClose} />
                )}
              </>
            )}
            </motion.div>
          </AnimatePresence>
        </AutoHeight>
      </div>
    </Sheet>
  );
}

// ---- shared ----

/**
 * Glides to its content's height instead of snapping, so switching tabs, toggling Repeats or showing an error
 * never makes the sheet jump. Clips while it moves; the inner padding keeps focus rings visible at the edges.
 */
function AutoHeight({ reduce, children }: { reduce: boolean; children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <motion.div
      initial={false}
      animate={{ height }}
      transition={reduce ? { duration: 0 } : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="-mx-1 -mb-1 overflow-clip"
    >
      <div ref={inner} className="px-1 pb-1">
        {children}
      </div>
    </motion.div>
  );
}

function useSave(onDone: () => void) {
  const { pending, error, run } = useRunAction();
  const save = (action: () => Promise<ActionResult<unknown>>, message: SuccessToast, toastAction?: { label: string; href: string }) =>
    run(action, message, { onSuccess: onDone, toastAction });
  return { pending, error, save };
}

/**
 * Date of the entry. With Repeats on it is the first occurrence and may be in the future
 * (nothing is recorded now then); otherwise it is a normal entry date (today or earlier).
 */
function useDate(allowFuture: boolean) {
  const today = todayKL();
  const [date, setDate] = useState(today);
  // createRecurringSchema accepts start dates up to 366 days back; say so here rather than after Save.
  const earliest = allowFuture ? addDays(today, -366) : undefined;
  const latest = allowFuture ? addDays(today, 366) : today;
  const dateError = allowFuture
    ? !isISODate(date)
      ? "Enter a date"
      : date < earliest!
        ? "Repeats can start at most a year ago. Turn Repeats off to record an older entry."
        : date > latest
          ? "Repeats can start at most a year from today."
          : null
    : entryDateError(date);
  return { date, setDate, dateError, today, earliest, latest };
}

/** One "label … value" line inside a DetailRows card. */
function DetailRow({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center gap-3 px-3">
      <label htmlFor={htmlFor} className="w-20 shrink-0 text-sm text-muted-foreground">
        {label}
      </label>
      <div className="flex min-w-0 flex-1 justify-end">{children}</div>
    </div>
  );
}

const rowInput =
  "min-h-11 w-full min-w-0 bg-transparent text-right text-base text-foreground placeholder:text-muted-foreground focus:outline-2 focus:outline-offset-2 focus:outline-ring rounded-md";

function DetailRows({ children }: { children: ReactNode }) {
  return <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">{children}</div>;
}

function DateRow({
  date,
  setDate,
  min,
  max,
  error,
}: {
  date: string;
  setDate: (d: string) => void;
  min?: string;
  max?: string;
  error: string | null;
}) {
  const id = useId();
  return (
    <>
      <DetailRow label="Date" htmlFor={id}>
        <input
          id={id}
          type="date"
          value={date}
          min={min}
          max={max}
          required
          onChange={(e) => setDate(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(rowInput, "w-auto")}
        />
      </DetailRow>
      {error && (
        <p id={`${id}-error`} className="px-3 pb-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </>
  );
}

function TextRow({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  const id = useId();
  return (
    <DetailRow label={label} htmlFor={id}>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} maxLength={140} autoComplete="off" placeholder={placeholder} className={rowInput} />
    </DetailRow>
  );
}

/** Repeats switch plus Monthly/Weekly. Expense and Income only. */
function RepeatsRow({
  on,
  setOn,
  cadence,
  setCadence,
}: {
  on: boolean;
  setOn: (on: boolean) => void;
  cadence: RecurringCadence;
  setCadence: (c: RecurringCadence) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2 px-3 py-2">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <span id={id} className="text-sm text-muted-foreground">
          Repeats
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby={id}
          onClick={() => setOn(!on)}
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full border border-border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            on ? "bg-primary" : "bg-muted",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "absolute top-0.5 left-0.5 size-5.5 rounded-full bg-card shadow-sm motion-safe:transition-transform",
              on && "translate-x-5",
            )}
          />
        </button>
      </div>
      {on && (
        <div role="radiogroup" aria-label="How often" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          {(["MONTHLY", "WEEKLY"] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={cadence === c}
              onClick={() => setCadence(c)}
              className={cn(
                "min-h-11 rounded-lg text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring",
                cadence === c ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {c === "MONTHLY" ? "Monthly" : "Weekly"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function repeatHint(date: string, today: string, cadence: RecurringCadence): string | null {
  if (!isISODate(date)) return null;
  if (date > today) return `Nothing is recorded now. It shows as due on ${formatISODate(date)}, and you confirm each one.`;
  return `Recorded now, then due again on ${formatISODate(occurrenceDate(date, cadence, 1))}. You confirm each one; nothing is recorded automatically.`;
}

/** "Food has RM 10.00, short by RM 5.00" when the chosen source can't cover the amount (the server says the same). */
function shortfall(options: EnvelopeChip[], id: string | null, amountSen: Sen | null): string | null {
  const source = options.find((o) => o.id === id);
  const have = source?.balanceSen;
  if (!source || have === undefined || amountSen === null || amountSen <= have) return null;
  return `${source.name} has ${formatSen(have)}, short by ${formatSen(amountSen - have)}`;
}

function Shortfall({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="-mt-2 text-sm text-destructive">
      {message}
    </p>
  ) : null;
}

function SaveBar({ error, pending, disabled, children }: { error: string | null; pending: boolean; disabled: boolean; children: ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 bg-card px-4 pt-2">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" pending={pending} disabled={disabled}>
        {children}
      </Button>
    </div>
  );
}

function NoEnvelopes() {
  return (
    <p className="rounded-xl border border-dashed border-border p-4 text-muted-foreground">
      Create an envelope first.{" "}
      <Link href="/envelopes" className="font-medium text-foreground underline">
        Go to Envelopes
      </Link>
    </p>
  );
}

const chipsFrom = (envelopes: EnvelopeView[]): EnvelopeChip[] =>
  envelopes.map((e) => ({ id: e.id, name: e.name, colour: e.colour, icon: e.icon, balanceSen: e.balanceSen }));

/**
 * Repeats on: create the item from the chosen date, then, when that date is today or earlier, record that first
 * occurrence through it. The entry carries REPEATS and later months keep the original day (the 31st stays the 31st).
 * A failed record after a successful create is reported, never retried, so the item is not created twice.
 */
async function createThenRecord(
  create: () => Promise<ActionResult<{ id: string }>>,
  recordNow: boolean,
  date: string,
): Promise<ActionResult<{ notRecorded: string | null }>> {
  const created = await create();
  if (!created.ok) return created;
  if (!recordNow) return { ok: true, data: { notRecorded: null } };
  try {
    const r = await recordRecurring({ id: created.data.id, dueOn: date });
    return { ok: true, data: { notRecorded: r.ok ? null : r.message } };
  } catch {
    return { ok: true, data: { notRecorded: "Check your connection." } };
  }
}

/** Toast for a repeating save; an error toast when the first occurrence was not recorded. */
function repeatOutcome(kind: string, recordNow: boolean, date: string, cadence: RecurringCadence) {
  return (data: unknown) => {
    const notRecorded = (data as { notRecorded: string | null }).notRecorded;
    if (notRecorded) {
      return {
        message: `Repeat saved, but this one wasn't recorded: ${notRecorded.replace(/\.$/, "")}. Record it from Activity → Recurring.`,
        kind: "error" as const,
      };
    }
    return { message: repeatToast(kind, recordNow, date, cadence) };
  };
}

function repeatToast(kind: string, recordNow: boolean, date: string, cadence: RecurringCadence): string {
  const every = cadence === "MONTHLY" ? "monthly" : "weekly";
  return recordNow
    ? `${kind} saved. Repeats ${every}, next due ${formatISODate(occurrenceDate(date, cadence, 1))}.`
    : `Repeat set up. First due ${formatISODate(date)}.`;
}

// ---- expense ----

function ExpenseForm({ envelopes, unallocatedSen, initialRepeats, onDone }: FormProps) {
  const [amount, setAmount] = useState("");
  const [envelopeId, setEnvelopeId] = useState<string | null>(null); // null = no envelope: comes out of Unallocated
  const [merchant, setMerchant] = useState("");
  const [note, setNote] = useState("");
  const [repeats, setRepeats] = useState(initialRepeats);
  const [cadence, setCadence] = useState<RecurringCadence>("MONTHLY");
  const { date, setDate, dateError, today, earliest, latest } = useDate(repeats);
  const { pending, error, save } = useSave(onDone);
  const amountSen = parsePositiveSen(amount);

  const sourceOptions: EnvelopeChip[] = [{ id: null, name: "Unallocated", colour: null, balanceSen: unallocatedSen }, ...chipsFrom(envelopes)];
  // Only a spend recorded now is checked against today's balance; a future repeat is checked when it is recorded.
  const short = repeats && date > today ? null : shortfall(sourceOptions, envelopeId, amountSen);
  const canSave = amountSen !== null && dateError === null && short === null;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (amountSen === null || dateError || short) return;
    const recordNow = date <= today;
    const fields = { amountSen, envelopeId: envelopeId ?? undefined, merchant: merchant || undefined, note: note || undefined };
    if (repeats) {
      void save(
        () => createThenRecord(() => createRecurring({ kind: "EXPENSE", ...fields, cadence, startOn: date }), recordNow, date),
        repeatOutcome("Expense", recordNow, date, cadence),
      );
    } else {
      void save(() => recordExpense({ ...fields, occurredOn: date }), "Expense saved");
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <fieldset className="flex min-w-0 flex-col gap-4">
        <AmountEntry value={amount} onChange={setAmount} />
        <EnvelopeChips
          label="Envelope (optional)"
          options={sourceOptions}
          value={envelopeId}
          onChange={setEnvelopeId}
        />
        <Shortfall message={short} />
        <DetailRows>
          <DateRow date={date} setDate={setDate} min={earliest} max={latest} error={dateError} />
          <TextRow label="Merchant" value={merchant} onChange={setMerchant} placeholder="Optional" />
          <TextRow label="Note" value={note} onChange={setNote} placeholder="Optional" />
          <RepeatsRow on={repeats} setOn={setRepeats} cadence={cadence} setCadence={setCadence} />
        </DetailRows>
      </fieldset>
      {repeats && <p className="-mt-2 text-sm text-muted-foreground">{repeatHint(date, today, cadence)}</p>}
      <SaveBar error={error} pending={pending} disabled={!canSave}>
        {repeats && date > today ? "Set up repeat" : "Save expense"}
      </SaveBar>
    </form>
  );
}

// ---- income ----

function IncomeForm({ initialRepeats, onDone }: FormProps) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [repeats, setRepeats] = useState(initialRepeats);
  const [cadence, setCadence] = useState<RecurringCadence>("MONTHLY");
  const { date, setDate, dateError, today, earliest, latest } = useDate(repeats);
  const { pending, error, save } = useSave(onDone);
  const amountSen = parsePositiveSen(amount);
  const canSave = amountSen !== null && dateError === null;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (amountSen === null || dateError) return;
    const recordNow = date <= today;
    const fields = { amountSen, note: note || undefined };
    if (repeats) {
      void save(
        () => createThenRecord(() => createRecurring({ kind: "INCOME", ...fields, cadence, startOn: date }), recordNow, date),
        repeatOutcome("Income", recordNow, date, cadence),
      );
    } else {
      void save(() => recordIncome({ ...fields, occurredOn: date }), "Income added.", { label: "Allocate", href: "/allocate" });
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <fieldset className="flex min-w-0 flex-col gap-4">
        <AmountEntry value={amount} onChange={setAmount} />
        <DetailRows>
          <DateRow date={date} setDate={setDate} min={earliest} max={latest} error={dateError} />
          <TextRow label="Note" value={note} onChange={setNote} placeholder="Optional, e.g. Salary" />
          <RepeatsRow on={repeats} setOn={setRepeats} cadence={cadence} setCadence={setCadence} />
        </DetailRows>
      </fieldset>
      {repeats && <p className="-mt-2 text-sm text-muted-foreground">{repeatHint(date, today, cadence)}</p>}
      <SaveBar error={error} pending={pending} disabled={!canSave}>
        {repeats && date > today ? "Set up repeat" : "Save income"}
      </SaveBar>
    </form>
  );
}

// ---- transfer ----

function TransferForm({ envelopes, unallocatedSen, onDone }: FormProps) {
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState<string | null>(null); // null = Unallocated
  const [to, setTo] = useState<string | null>(envelopes[0]?.id ?? null);
  const [note, setNote] = useState("");
  const { date, setDate, dateError, today } = useDate(false);
  const { pending, error, save } = useSave(onDone);
  const amountSen = parsePositiveSen(amount);
  const sameId = useId();

  if (envelopes.length === 0) return <NoEnvelopes />;

  const options: EnvelopeChip[] = [{ id: null, name: "Unallocated", colour: null, balanceSen: unallocatedSen }, ...chipsFrom(envelopes)];
  const same = from === to;
  const short = shortfall(options, from, amountSen);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (amountSen === null || same || dateError || short) return;
    void save(() => transfer({ fromEnvelopeId: from, toEnvelopeId: to, amountSen, occurredOn: date, note: note || undefined }), "Transfer saved");
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <AmountEntry value={amount} onChange={setAmount} />
      <EnvelopeChips label="From" options={options} value={from} onChange={setFrom} />
      <Shortfall message={short} />
      <EnvelopeChips label="To" options={options} value={to} onChange={setTo} describedBy={same ? sameId : undefined} />
      {same && (
        <p id={sameId} className="-mt-2 text-sm text-destructive">
          Choose two different envelopes
        </p>
      )}
      <DetailRows>
        <DateRow date={date} setDate={setDate} max={today} error={dateError} />
        <TextRow label="Note" value={note} onChange={setNote} placeholder="Optional" />
      </DetailRows>
      <SaveBar error={error} pending={pending} disabled={amountSen === null || same || dateError !== null || short !== null}>
        Save transfer
      </SaveBar>
    </form>
  );
}
