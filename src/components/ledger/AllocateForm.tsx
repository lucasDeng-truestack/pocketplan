"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { allocate } from "@/server/actions/ledger";
import { Button, EnvelopeSwatch, useToast } from "@/components/ui";
import { MoveBackSheet } from "@/components/envelopes/MoneyOutSheets";
import { cn } from "@/lib/cn";
import { todayKL } from "@/lib/dates";
import { formatSen, formatSenPlain, parseSen } from "@/lib/money";
import type { EnvelopeView, Sen } from "@/lib/types";

/** Sen still needed to reach the target, or null when there is no target or it is met. */
function toTarget(e: EnvelopeView): Sen | null {
  return e.targetSen !== null && e.targetSen > e.balanceSen ? e.targetSen - e.balanceSen : null;
}


export function AllocateForm({ unallocatedSen, envelopes }: { unallocatedSen: Sen; envelopes: EnvelopeView[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const [movingBack, setMovingBack] = useState<EnvelopeView | null>(null);

  const parsed = envelopes.map((e) => {
    const raw = (entries[e.id] ?? "").trim();
    const sen = raw === "" ? 0 : parseSen(raw);
    return { id: e.id, raw, sen };
  });
  const anyInvalid = parsed.some((p) => p.sen === null);
  const items = parsed.filter((p): p is { id: string; raw: string; sen: Sen } => p.sen !== null && p.sen > 0);
  // The one client-side sum the plan allows: integer sen from parseSen, for the live counter only.
  const entered = items.reduce((s, i) => s + i.sen, 0);
  const left = unallocatedSen - entered;
  const canSave = !pending && !anyInvalid && items.length > 0 && left >= 0;

  function fill(e: EnvelopeView) {
    const need = toTarget(e);
    if (need === null) return;
    const own = parsed.find((p) => p.id === e.id)?.sen ?? 0;
    const available = left + own; // what is left if this row were empty
    const amount = Math.min(need, available);
    setEntries((s) => ({ ...s, [e.id]: amount > 0 ? formatSenPlain(amount) : "" }));
  }

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!canSave || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await allocate({ items: items.map((i) => ({ envelopeId: i.id, amountSen: i.sen })), occurredOn: todayKL() });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast({ message: `Allocated ${formatSen(entered)}`, kind: "success" });
      router.push("/");
      router.refresh();
    } catch {
      setError("Could not save. Check your connection and try again.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div>
          <p className="text-muted-foreground">
            Unallocated <span className="font-medium tabular-nums text-foreground">{formatSen(unallocatedSen)}</span>
          </p>
        </div>

        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card px-3">
          {envelopes.map((e, i) => {
            const need = toTarget(e);
            const invalid = parsed[i].sen === null;
            const inputId = `alloc-${e.id}`;
            return (
              <li key={e.id} className="flex flex-col gap-2 py-3">
                <div className="flex items-center gap-2">
                  <EnvelopeSwatch colour={e.colour} icon={e.icon} />
                  <label htmlFor={inputId} className="min-w-0 flex-1 truncate font-medium">
                    {e.name}
                  </label>
                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{formatSen(e.balanceSen)}</span>
                  {e.balanceSen > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setMovingBack(e)} aria-label={`Move money from ${e.name} back to Unallocated`}>
                      Move back
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex min-h-12 flex-1 items-center gap-2 rounded-xl border bg-background px-3",
                      invalid ? "border-destructive" : "border-border",
                    )}
                  >
                    <span aria-hidden="true" className="text-muted-foreground">
                      RM
                    </span>
                    <input
                      id={inputId}
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0.00"
                      value={entries[e.id] ?? ""}
                      onChange={(ev) => setEntries((s) => ({ ...s, [e.id]: ev.target.value }))}
                      aria-invalid={invalid || undefined}
                      aria-describedby={need !== null ? `${inputId}-hint` : undefined}
                      className="w-full min-w-0 bg-transparent text-lg tabular-nums focus:outline-none"
                    />
                  </div>
                  {need !== null && (
                    <Button variant="ghost" size="sm" onClick={() => fill(e)} aria-label={`Fill ${e.name} to target`}>
                      Fill to target
                    </Button>
                  )}
                </div>
                {invalid && <p className="text-sm text-destructive">Enter an amount like 12.50</p>}
                {need !== null && (
                  <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
                    {formatSen(need)} to target
                  </p>
                )}
              </li>
            );
          })}
        </ul>

        <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-lg">
          <p className="flex items-center justify-between" aria-live="polite">
            <span className="text-sm text-muted-foreground">Left to allocate</span>
            <span className={cn("font-semibold tabular-nums", left < 0 && "text-destructive")}>{formatSen(left)}</span>
          </p>
          {left < 0 && (
            <p role="alert" className="text-sm text-destructive">
              You&apos;re allocating {formatSen(-left)} more than you have unallocated.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" pending={pending} disabled={!canSave}>
            Save
          </Button>
        </div>
      </form>
      {/* outside the form: the sheet has its own form, and forms can't nest */}
      {movingBack && <MoveBackSheet envelope={movingBack} open onClose={() => setMovingBack(null)} />}
    </>
  );
}
