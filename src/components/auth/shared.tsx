"use client";

import { useId, useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";

export type AuthError = { status: number; code?: string; message?: string };

/** Message for an unexpected auth failure; in dev it carries status and code to make debugging fast. */
export function fallbackMessage(error: AuthError, what: string): string {
  return process.env.NODE_ENV === "production"
    ? `Could not ${what}. Try again.`
    : `Could not ${what} (${error.status} ${error.code ?? error.message ?? ""}). Try again.`;
}

export const NETWORK_ERROR = "Could not reach PocketPlan. Check your connection and try again.";
export const TOO_MANY = "Too many attempts. Wait a minute and try again.";

export const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/** Password field with a show/hide icon button inside it; `aside` sits on the label row (e.g. "Forgot password?"). */
export function PasswordInput({
  label,
  value,
  onChange,
  autoComplete,
  error,
  describedBy,
  aside,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  error?: string | null;
  describedBy?: string;
  aside?: ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {aside}
      </div>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={[describedBy, error ? errorId : null].filter(Boolean).join(" ") || undefined}
          maxLength={128}
          required
          className={cn(
            "min-h-12 w-full rounded-xl border bg-card pr-13 pl-3 text-base text-foreground placeholder:text-muted-foreground",
            "focus:outline-2 focus:outline-offset-1 focus:outline-ring",
            error ? "border-destructive" : "border-border",
          )}
        />
        <button
          type="button"
          aria-label="Show password"
          aria-pressed={visible}
          aria-controls={id}
          onClick={() => setVisible((v) => !v)}
          className="absolute top-0.5 right-0.5 grid size-11 place-items-center rounded-lg text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          {visible ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
        </button>
      </div>
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-sm text-destructive">
      {children}
    </p>
  );
}
