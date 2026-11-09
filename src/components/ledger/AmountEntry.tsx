"use client";

import { useSyncExternalStore } from "react";
import { Delete } from "lucide-react";
import { MoneyInput } from "@/components/ui";

const COARSE = "(pointer: coarse)";

/** True on touch-first devices. Server render and first paint assume a fine pointer. */
function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(COARSE);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(COARSE).matches,
    () => false,
  );
}

/**
 * Edits the typed string only (never the amount): parsePositiveSen still decides what it is worth.
 * At most one dot, two decimals and 7 whole digits, so a keypad amount always stays under MAX_SEN (RM 21,474,836.47).
 */
export function pressKey(value: string, key: string): string {
  if (key === "back") return value.slice(0, -1);
  if (key === ".") return value.includes(".") ? value : `${value || "0"}.`;
  const frac = value.split(".")[1];
  if (frac !== undefined && frac.length >= 2) return value;
  if (frac === undefined && value.replace(/\D/g, "").length >= 7) return value;
  return value === "0" ? key : value + key;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];

/**
 * The shared MoneyInput (so typing and validation behave as everywhere else), plus an on-screen keypad on touch.
 * On touch the input is not auto-focused, so the phone's own keyboard does not cover the keypad.
 */
export function AmountEntry({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const coarse = useCoarsePointer();
  return (
    <div className="flex flex-col gap-2">
      <MoneyInput value={value} onChange={onChange} autoFocus={!coarse && !disabled} />
      {coarse && !disabled && (
        <div className="grid grid-cols-3 gap-1.5" aria-label="Amount keypad" role="group">
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              aria-label={k === "back" ? "Delete last digit" : k === "." ? "Decimal point" : undefined}
              onClick={() => onChange(pressKey(value, k))}
              className="flex min-h-12 items-center justify-center rounded-xl bg-muted text-xl font-medium tabular-nums text-foreground active:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
            >
              {k === "back" ? <Delete aria-hidden="true" className="size-5" /> : k}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
