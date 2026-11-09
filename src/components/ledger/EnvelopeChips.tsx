"use client";

import { EnvelopeSwatch } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatSen } from "@/lib/money";
import type { EnvelopeIcon, Sen } from "@/lib/types";

/** id null = Unallocated. balanceSen is optional: edit forms only know names. */
export type EnvelopeChip = { id: string | null; name: string; colour: string | null; icon?: EnvelopeIcon | null; balanceSen?: Sen };

/** Envelope picker as a wrap of chips (colour, name, balance); a radiogroup for screen readers. */
export function EnvelopeChips({
  label,
  options,
  value,
  onChange,
  disabled,
  describedBy,
}: {
  label: string;
  options: EnvelopeChip[];
  /** undefined = nothing chosen yet */
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  describedBy?: string;
}) {
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div role="radiogroup" aria-label={label} aria-describedby={describedBy} className="flex flex-wrap gap-2">
        {options.map((o) => {
          const checked = value !== undefined && o.id === value;
          return (
            <button
              key={o.id ?? "unallocated"}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onChange(o.id)}
              className={cn(
                "flex min-h-11 max-w-full items-center gap-2 rounded-full border px-3 text-left text-sm",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50",
                checked ? "border-foreground bg-accent font-medium text-accent-foreground" : "border-border bg-card",
              )}
            >
              <EnvelopeSwatch colour={o.colour} icon={o.icon} className={o.icon ? "-ml-1.5 size-7" : undefined} />
              <span className="truncate">{o.name}</span>
              {o.balanceSen !== undefined && (
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatSen(o.balanceSen)}</span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
