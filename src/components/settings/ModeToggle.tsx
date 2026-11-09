"use client";

import { useSyncExternalStore, type MouseEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { setPreferences } from "@/server/actions/preferences";
import { useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { THEMES, type ColorMode } from "@/lib/types";
import { originOf, subscribeHtmlPrefs, withThemeTransition } from "./htmlPrefs";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** What is on screen now: the explicit mode, or the OS setting when the mode is "system". */
function isDarkShowing(): boolean {
  const mode = document.documentElement.dataset.mode;
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return window.matchMedia(DARK_QUERY).matches;
}

/**
 * Quick light/dark switch. Always picks the explicit opposite of what is showing (never "system";
 * Settings offers that). Applies at once, saves to the account, rolls back with a toast on failure.
 */
export function ModeToggle({ className }: { className?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const dark = useSyncExternalStore(subscribeHtmlPrefs, isDarkShowing, () => false);
  const reduce = useReducedMotion();

  async function onClick(e: MouseEvent<HTMLButtonElement>) {
    const html = document.documentElement;
    const previous = html.dataset.mode;
    const mode: ColorMode = isDarkShowing() ? "light" : "dark";
    const theme = THEMES.find((t) => t === html.dataset.theme) ?? "modern";
    withThemeTransition(() => {
      html.dataset.mode = mode;
    }, originOf(e));
    let message: string | null = null;
    try {
      const r = await setPreferences({ theme, mode });
      if (!r.ok) message = r.message;
    } catch {
      message = "Could not save. Check your connection and try again.";
    }
    if (message) {
      if (html.dataset.mode === mode) html.dataset.mode = previous ?? "system"; // only undo our own change
      toast({ message, kind: "error" });
      return;
    }
    router.refresh();
  }

  const Icon = dark ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={dark ? "sun" : "moon"}
          initial={reduce ? { opacity: 0 } : { opacity: 0, rotate: -90, scale: 0.5 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, rotate: 90, scale: 0.5 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="flex"
        >
          <Icon aria-hidden="true" className="size-5" />
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
