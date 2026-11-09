"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { archiveEnvelope, reorderEnvelopes, unarchiveEnvelope } from "@/server/actions/envelopes";
import { Button, ConfirmSheet, useToast } from "@/components/ui";
import { EnvelopeFormSheet } from "./EnvelopeFormSheet";
import { EnvelopeRow } from "./EnvelopeRow";
import type { EnvelopeView } from "@/lib/types";

export function EnvelopeManager({ envelopes }: { envelopes: EnvelopeView[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(envelopes);
  const [prevEnvelopes, setPrevEnvelopes] = useState(envelopes);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  // Stable: Sheet's focus effect depends on onClose, so a new function each render would steal focus.
  const closeCreate = useCallback(() => setCreating(false), []);

  // Fresh server data (after any save) replaces the optimistic copy.
  if (envelopes !== prevEnvelopes) {
    setPrevEnvelopes(envelopes);
    setItems(envelopes);
  }

  const active = items.filter((e) => !e.archivedAt);
  const archived = items.filter((e) => e.archivedAt);

  async function move(index: number, by: -1 | 1) {
    const next = [...active];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    const before = items;
    setItems([...next, ...archived]);
    setBusy(true);
    try {
      const result = await reorderEnvelopes({ ids: next.map((e) => e.id) });
      if (!result.ok) throw new Error(result.message);
      router.refresh();
    } catch (e) {
      setItems(before);
      toast({ message: e instanceof Error && e.message ? e.message : "Could not reorder. Try again.", kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function unarchive(e: EnvelopeView) {
    setBusy(true);
    try {
      const result = await unarchiveEnvelope({ id: e.id });
      if (!result.ok) throw new Error(result.message);
      toast({ message: `${e.name} is back in your envelopes`, kind: "success" });
      router.refresh();
    } catch (err) {
      toast({ message: err instanceof Error && err.message ? err.message : "Could not unarchive. Try again.", kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Your envelopes</h2>
        <Button size="sm" onClick={() => setCreating(true)}>
          New envelope
        </Button>
      </div>

      {active.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-muted-foreground">
          No envelopes yet. Create one for each thing you spend on, like Food or Transport.
        </p>
      ) : (
        <ul className="rounded-xl border border-border bg-card px-3">
          {active.map((e, i) => (
            <EnvelopeRow
              key={e.id}
              envelope={e}
              actions={
                <>
                  <ArrowButton label={`Move ${e.name} up`} disabled={busy || i === 0} onClick={() => move(i, -1)}>
                    ↑
                  </ArrowButton>
                  <ArrowButton
                    label={`Move ${e.name} down`}
                    disabled={busy || i === active.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    ↓
                  </ArrowButton>
                </>
              }
            />
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <div className="flex flex-col gap-2">
          <Button variant="ghost" size="sm" className="self-start" aria-expanded={showArchived} onClick={() => setShowArchived((s) => !s)}>
            {showArchived ? "Hide archived" : `Show archived (${archived.length})`}
          </Button>
          {showArchived && (
            <ul className="rounded-xl border border-border bg-card px-3">
              {archived.map((e) => (
                <EnvelopeRow
                  key={e.id}
                  envelope={e}
                  actions={
                    <Button variant="secondary" size="sm" disabled={busy} onClick={() => unarchive(e)}>
                      Unarchive
                    </Button>
                  }
                />
              ))}
            </ul>
          )}
        </div>
      )}

      <EnvelopeFormSheet open={creating} onClose={closeCreate} />
    </div>
  );
}

function ArrowButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-lg text-muted-foreground hover:bg-border/50 disabled:opacity-30"
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}

/** Edit and archive controls for /envelopes/[id]. Lives here with the other envelope mutations. */
export function EnvelopeDetailActions({ envelope }: { envelope: EnvelopeView }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const isArchived = envelope.archivedAt !== null;
  const closeEdit = useCallback(() => setEditing(false), []);
  const closeConfirm = useCallback(() => setConfirming(false), []);

  async function confirm() {
    setPending(true);
    try {
      const result = isArchived ? await unarchiveEnvelope({ id: envelope.id }) : await archiveEnvelope({ id: envelope.id });
      if (!result.ok) throw new Error(result.message);
      toast({ message: isArchived ? `${envelope.name} is back in your envelopes` : `${envelope.name} archived`, kind: "success" });
      setConfirming(false);
      router.refresh();
    } catch (e) {
      setConfirming(false);
      toast({ message: e instanceof Error && e.message ? e.message : "Something went wrong. Try again.", kind: "error" });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" onClick={() => setEditing(true)}>
        Edit
      </Button>
      <Button variant={isArchived ? "secondary" : "ghost"} onClick={() => setConfirming(true)}>
        {isArchived ? "Unarchive" : "Archive"}
      </Button>
      <EnvelopeFormSheet open={editing} onClose={closeEdit} envelope={envelope} />
      <ConfirmSheet
        open={confirming}
        onClose={closeConfirm}
        onConfirm={confirm}
        pending={pending}
        title={isArchived ? `Unarchive ${envelope.name}?` : `Archive ${envelope.name}?`}
        message={
          isArchived
            ? "It goes back to the end of your envelope list."
            : "It disappears from your dashboard and quick add. Its history stays. Only an empty envelope can be archived."
        }
        confirmLabel={isArchived ? "Unarchive" : "Archive"}
        danger={!isArchived}
      />
    </div>
  );
}
