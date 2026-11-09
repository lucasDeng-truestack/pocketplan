"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createEnvelope, updateEnvelope } from "@/server/actions/envelopes";
import { Button, EnvelopeSwatch, Input, Sheet } from "@/components/ui";
import { ENVELOPE_ICON_LABELS } from "@/components/ui/EnvelopeSwatch";
import { cn } from "@/lib/cn";
import { formatSenPlain, parseSen } from "@/lib/money";
import { ENVELOPE_COLOURS, ENVELOPE_ICONS, type EnvelopeIcon, type EnvelopeView } from "@/lib/types";

export type EnvelopeFormSheetProps = {
  open: boolean;
  onClose: () => void;
  /** Present = edit, absent = create. */
  envelope?: EnvelopeView;
};

export function EnvelopeFormSheet({ open, onClose, envelope }: EnvelopeFormSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={envelope ? "Edit envelope" : "New envelope"}>
      {/* Sheet renders nothing when closed, so the form remounts with fresh state on every open. */}
      <EnvelopeForm envelope={envelope} onDone={onClose} />
    </Sheet>
  );
}

function EnvelopeForm({ envelope, onDone }: { envelope?: EnvelopeView; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(envelope?.name ?? "");
  const [colour, setColour] = useState<string | null>(envelope?.colour ?? null);
  const [icon, setIcon] = useState<EnvelopeIcon | null>(envelope?.icon ?? null);
  const [target, setTarget] = useState(envelope?.targetSen ? formatSenPlain(envelope.targetSen) : "");
  const [targetError, setTargetError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const targetSen = target.trim() === "" ? null : parseSen(target);
    if (targetSen === 0 || (targetSen === null && target.trim() !== "")) {
      setTargetError("Enter an amount like 600 or 600.50");
      return;
    }
    setTargetError(null);
    setError(null);
    setPending(true);
    try {
      const input = { name, colour, icon, targetSen };
      const result = envelope ? await updateEnvelope({ id: envelope.id, ...input }) : await createEnvelope(input);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
      onDone();
    } catch {
      setError("Could not save. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="off" required />

      <fieldset>
        <legend className="mb-1 text-sm font-medium">Colour</legend>
        <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-1">
          <ColourOption selected={colour === null} onSelect={() => setColour(null)} label="No colour">
            <span className="text-xs text-muted-foreground">None</span>
          </ColourOption>
          {ENVELOPE_COLOURS.map((c) => (
            <ColourOption key={c} selected={colour === c} onSelect={() => setColour(c)} label={`Colour ${c}`}>
              <span className="size-7 rounded-full" style={{ backgroundColor: c }} />
            </ColourOption>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">Icon (optional)</legend>
        <div role="radiogroup" aria-label="Icon" className="flex flex-wrap gap-1">
          <ColourOption selected={icon === null} onSelect={() => setIcon(null)} label="No icon">
            <span className="text-xs text-muted-foreground">None</span>
          </ColourOption>
          {ENVELOPE_ICONS.map((i) => (
            <ColourOption key={i} selected={icon === i} onSelect={() => setIcon(i)} label={ENVELOPE_ICON_LABELS[i]}>
              {/* previews in the colour chosen above */}
              <EnvelopeSwatch colour={colour} icon={i} className="size-8" />
            </ColourOption>
          ))}
        </div>
      </fieldset>

      <Input
        label="Target (optional)"
        inputMode="decimal"
        placeholder="600.00"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        error={targetError}
      />
      <p className="-mt-3 text-xs text-muted-foreground">A goal for this envelope. It does not move any money.</p>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" pending={pending}>
        {envelope ? "Save" : "Create envelope"}
      </Button>
    </form>
  );
}

function ColourOption({
  selected,
  onSelect,
  label,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      onClick={onSelect}
      className={cn(
        "flex size-11 items-center justify-center rounded-full border-2",
        selected ? "border-foreground" : "border-transparent",
      )}
    >
      {children}
    </button>
  );
}
