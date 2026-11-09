"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { parseSen } from "@/lib/money";
import type { Sen } from "@/lib/types";

export type MoneyInputProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  /** Parsed amount in sen, or null when empty, invalid or zero. */
  onSen?: (sen: Sen | null) => void;
  autoFocus?: boolean;
};

/** Positive amount in sen, or null. */
export function parsePositiveSen(value: string): Sen | null {
  const sen = parseSen(value);
  return sen && sen > 0 ? sen : null;
}

/** Same look as Input, with an "RM" prefix inside the box (Input has no slot for one). */
export function MoneyInput({ label = "Amount", value, onChange, onSen, autoFocus }: MoneyInputProps) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [touched, setTouched] = useState(false);
  const error = touched && value.trim() !== "" && parsePositiveSen(value) === null ? "Enter an amount like 12.50" : null;

  useEffect(() => {
    if (!autoFocus) return;
    // Next frame, so this wins over a parent Sheet's own focus effect (parent effects run after child effects).
    const frame = requestAnimationFrame(() => ref.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [autoFocus]);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div
        className={cn(
          "flex min-h-16 items-center gap-2 rounded-xl border bg-card px-3 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-ring",
          error ? "border-destructive" : "border-border",
        )}
      >
        <span aria-hidden="true" className="text-xl text-muted-foreground">
          RM
        </span>
        <input
          ref={ref}
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            onSen?.(parsePositiveSen(e.target.value));
          }}
          onBlur={() => setTouched(true)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="w-full min-w-0 bg-transparent text-3xl tabular-nums text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
