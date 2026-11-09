"use client";

import { useSyncExternalStore } from "react";
import { COLOR_MODES, THEMES, type Preferences } from "@/lib/types";

/** Notifies on changes to <html data-theme/data-mode> (Settings, the mode toggle) and to the OS colour scheme. */
export function subscribeHtmlPrefs(onChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onChange);
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode", "data-theme"] });
  return () => {
    mq.removeEventListener("change", onChange);
    observer.disconnect();
  };
}

/** The preferences currently applied on <html>, as set by the root layout or an optimistic change. */
export function readHtmlPrefs(): Preferences {
  const { theme, mode } = document.documentElement.dataset;
  return { theme: THEMES.find((t) => t === theme) ?? "modern", mode: COLOR_MODES.find((m) => m === mode) ?? "system" };
}

export function applyHtmlPrefs(p: Preferences) {
  document.documentElement.dataset.theme = p.theme;
  document.documentElement.dataset.mode = p.mode;
}

/** Where a click happened, or the element's centre for keyboard activation (detail 0 = no pointer). */
export function originOf(e: { clientX: number; clientY: number; detail: number; currentTarget: Element }) {
  if (e.detail > 0) return { x: e.clientX, y: e.clientY };
  const r = e.currentTarget.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * Runs a theme or mode change as a circular reveal growing from `origin` (the tap point).
 * Falls back to an instant change without the View Transitions API or when reduced motion is on.
 */
export function withThemeTransition(update: () => void, origin: { x: number; y: number }) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || typeof document.startViewTransition !== "function") {
    update();
    return;
  }
  const { x, y } = origin;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const transition = document.startViewTransition(update);
  transition.ready
    .then(() =>
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 520, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" },
      ),
    )
    .catch(() => {}); // a skipped transition still applied the update
}

/** Live <html> preferences; `fallback` is what the server rendered (used before hydration). */
export function useHtmlPrefs(fallback: Preferences): Preferences {
  const key = useSyncExternalStore(
    subscribeHtmlPrefs,
    () => {
      const p = readHtmlPrefs();
      return `${p.theme}|${p.mode}`; // a primitive, so unchanged values do not re-render
    },
    () => `${fallback.theme}|${fallback.mode}`,
  );
  const [theme, mode] = key.split("|") as [Preferences["theme"], Preferences["mode"]];
  return { theme, mode };
}
