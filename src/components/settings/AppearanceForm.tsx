"use client";

import { useId, useRef, useState, type MouseEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { setPreferences } from "@/server/actions/preferences";
import { cn } from "@/lib/cn";
import { COLOR_MODES, THEMES, type ColorMode, type Preferences, type ThemeName } from "@/lib/types";
import { applyHtmlPrefs, originOf, readHtmlPrefs, useHtmlPrefs, withThemeTransition } from "./htmlPrefs";

const THEME_INFO: Record<ThemeName, { label: string; blurb: string }> = {
  modern: { label: "Modern", blurb: "Warm and clean" },
  premium: { label: "Premium", blurb: "Ink and champagne" },
  retro: { label: "Retro", blurb: "Paper passbook" },
  pixel: { label: "Pixel", blurb: "8-bit wallet" },
};
const MODE_LABEL: Record<ColorMode, string> = { system: "System", light: "Light", dark: "Dark" };

/**
 * Follows <html data-theme/data-mode>, so a change from the top-bar mode toggle shows here too and is never
 * overwritten by a stale value. Applies a choice at once, then saves it; reverts if the save fails.
 */
export function AppearanceForm({ initial }: { initial: Preferences }) {
  const router = useRouter();
  const prefs = useHtmlPrefs(initial);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0); // only the newest save may revert
  const pillId = useId();
  const reduce = useReducedMotion();
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 500, damping: 46 };

  async function choose(change: Partial<Preferences>, e: MouseEvent<HTMLButtonElement>) {
    const previous = readHtmlPrefs();
    const next = { ...previous, ...change };
    if (next.theme === previous.theme && next.mode === previous.mode) return;
    setError(null);
    withThemeTransition(() => applyHtmlPrefs(next), originOf(e));
    const n = ++latest.current;
    let message: string | null = null;
    try {
      const r = await setPreferences(next);
      if (!r.ok) message = r.message;
    } catch {
      message = "Could not save. Check your connection and try again.";
    }
    if (n !== latest.current) return;
    if (message) {
      setError(message);
      applyHtmlPrefs(previous);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {THEMES.map((t) => {
          const checked = prefs.theme === t;
          return (
            <motion.button
              key={t}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={(e) => choose({ theme: t }, e)}
              whileHover={reduce ? undefined : { y: -2 }}
              whileTap={reduce ? undefined : { scale: 0.97 }}
              transition={spring}
              className={cn(
                "flex flex-col gap-2 rounded-2xl border p-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                checked ? "border-foreground" : "border-border",
              )}
            >
              <ThemePreview theme={t} />
              <span className="flex items-center justify-between gap-1 px-1">
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{THEME_INFO[t].label}</span>
                  <span className="text-xs text-muted-foreground">{THEME_INFO[t].blurb}</span>
                </span>
                <AnimatePresence initial={false}>
                  {checked && (
                    <motion.span
                      key="check"
                      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.3, rotate: -30 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.3 }}
                      transition={spring}
                      className="flex shrink-0"
                    >
                      <Check aria-hidden="true" className="size-4" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
            </motion.button>
          );
        })}
      </div>

      <div role="radiogroup" aria-label="Light or dark" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
        {COLOR_MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={prefs.mode === m}
            onClick={(e) => choose({ mode: m }, e)}
            className={cn(
              "relative min-h-11 rounded-lg text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              prefs.mode === m ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {/* the selected pill slides between options */}
            {prefs.mode === m && <motion.span layoutId={`${pillId}-mode`} transition={spring} className="absolute inset-0 rounded-lg bg-card shadow-sm" />}
            <span className="relative">{MODE_LABEL[m]}</span>
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** A tiny live render of the theme: its own tokens via a nested data-theme, in the current mode. */
function ThemePreview({ theme }: { theme: ThemeName }) {
  return (
    <span data-theme={theme} aria-hidden="true" className="flex flex-col gap-1.5 rounded-xl border border-border bg-background p-2 font-sans text-foreground">
      <span className="font-heading text-xs font-semibold">RM 1,240.00</span>
      <span className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-1.5 py-1 shadow-sm">
        <span className="size-2 rounded-full bg-chart-2" />
        <span className="h-1.5 flex-1 rounded-full bg-muted" />
      </span>
      <span className="flex gap-1">
        <span className="h-4 flex-1 rounded-md bg-primary" />
        <span className="h-4 w-4 rounded-md bg-chart-3" />
      </span>
    </span>
  );
}
