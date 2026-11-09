"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { deleteEnvelope, transfer } from "@/server/actions/ledger";
import { Button, MoneyInput, Sheet, parsePositiveSen, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { todayKL } from "@/lib/dates";
import { formatSen, formatSenPlain } from "@/lib/money";
import type { Sen } from "@/lib/types";

type EnvelopeRef = { id: string; name: string; balanceSen: Sen };

/** Move some or all of an envelope's money back to Unallocated (a logged transfer; void it in Activity to undo). */
export function MoveBackSheet({ envelope, open, onClose }: { envelope: EnvelopeRef; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountSen = parsePositiveSen(amount);
  const over = amountSen !== null && amountSen > envelope.balanceSen;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (amountSen === null || over || pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await transfer({ fromEnvelopeId: envelope.id, toEnvelopeId: null, amountSen, occurredOn: todayKL() });
      if (!result.ok) return setError(result.message);
      toast({ message: `Moved ${formatSen(amountSen)} back to Unallocated`, kind: "success" });
      setAmount("");
      onClose();
      router.refresh();
    } catch {
      setError("Could not save. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Move money out of ${envelope.name}`}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          It goes back to Unallocated. {envelope.name} has {formatSen(envelope.balanceSen)}.
        </p>
        <MoneyInput value={amount} onChange={setAmount} />
        <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setAmount(formatSenPlain(envelope.balanceSen))}>
          Move all {formatSen(envelope.balanceSen)}
        </Button>
        {over && (
          <p role="alert" className="text-sm text-destructive">
            {envelope.name} has {formatSen(envelope.balanceSen)}, short by {formatSen(amountSen - envelope.balanceSen)}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" pending={pending} disabled={amountSen === null || over}>
          Move back to Unallocated
        </Button>
      </form>
    </Sheet>
  );
}

/**
 * Permanently delete an envelope. With money in it, the person first picks where the balance goes.
 * Past entries stay in Activity under "Name (deleted)".
 */
export function DeleteEnvelopeSheet({
  envelope,
  others,
  open,
  onClose,
}: {
  envelope: EnvelopeRef;
  others: { id: string; name: string }[];
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [moveTo, setMoveTo] = useState<string | null>(null); // null = Unallocated
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasMoney = envelope.balanceSen > 0;

  async function onDelete() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await deleteEnvelope({ id: envelope.id, moveToEnvelopeId: hasMoney ? moveTo : null });
      if (!result.ok) return setError(result.message);
      toast({ message: `${envelope.name} deleted`, kind: "success" });
      onClose();
      router.push("/envelopes");
      router.refresh();
    } catch {
      setError("Could not delete. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  const destinations = [{ id: null, name: "Unallocated" }, ...others];
  return (
    <Sheet open={open} onClose={onClose} title={`Delete ${envelope.name}?`}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          This can&apos;t be undone. Its past entries stay in Activity as &ldquo;{envelope.name} (deleted)&rdquo; and can no longer be changed.
          Repeats that spend from it are stopped.
        </p>
        {hasMoney && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Move its {formatSen(envelope.balanceSen)} to</legend>
            {destinations.map((d) => (
              <label
                key={d.id ?? "unallocated"}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3",
                  moveTo === d.id ? "border-foreground" : "border-border",
                )}
              >
                <input type="radio" name="move-to" checked={moveTo === d.id} onChange={() => setMoveTo(d.id)} className="size-4 accent-current" />
                {d.name}
              </label>
            ))}
          </fieldset>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button variant="danger" onClick={onDelete} pending={pending}>
          {hasMoney ? `Move ${formatSen(envelope.balanceSen)} and delete` : "Delete envelope"}
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
      </div>
    </Sheet>
  );
}
