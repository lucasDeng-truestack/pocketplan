"use client";

import { Suspense, createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { QUICK_ADD_TABS, QuickAddSheet, type QuickAddTab } from "./QuickAddSheet";
import type { EnvelopeView, Sen } from "@/lib/types";

type OpenQuickAdd = (tab?: QuickAddTab, opts?: { repeats?: boolean }) => void;

const QuickAddContext = createContext<OpenQuickAdd | null>(null);

/** Opens the shell's Quick add sheet from anywhere inside the app shell. */
export function useQuickAdd(): OpenQuickAdd {
  const open = useContext(QuickAddContext);
  if (!open) throw new Error("useQuickAdd must be used inside QuickAddProvider");
  return open;
}

/**
 * Mounted once by the app shell. Opening (the + buttons via useQuickAdd, or a `?add=expense|income|transfer` deep link)
 * pushes `?add=` onto the URL and the sheet follows that param, so the browser's Back closes it. Closing from the sheet
 * drops `add` with a replace, so a reload does not reopen it (Back then revisits the same page once; harmless).
 */
export function QuickAddProvider({
  data,
  children,
}: {
  data: { envelopes: EnvelopeView[]; unallocatedSen: Sen } | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<{ open: boolean; tab: QuickAddTab; repeats: boolean }>({
    open: false,
    tab: "expense",
    repeats: false,
  });

  const open = useCallback<OpenQuickAdd>(
    (tab = "expense", opts) => {
      setState({ open: true, tab, repeats: opts?.repeats ?? false });
      const qs = new URLSearchParams(window.location.search);
      if (qs.get("add") === tab) return; // already in the URL (deep link, or reopened from the param)
      qs.set("add", tab);
      router.push(`${pathname}?${qs}`, { scroll: false });
    },
    [pathname, router],
  );
  // The URL lost `add` (Back, or a link elsewhere) without the sheet closing itself.
  const closeFromUrl = useCallback(() => setState((s) => (s.open ? { ...s, open: false } : s)), []);

  // Stable: Sheet's focus effect depends on onClose, so a new function per render would yank focus.
  const close = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
    const qs = new URLSearchParams(window.location.search);
    if (!qs.has("add")) return;
    qs.delete("add");
    const rest = qs.toString();
    router.replace(rest ? `${pathname}?${rest}` : pathname, { scroll: false });
  }, [pathname, router]);

  return (
    <QuickAddContext value={open}>
      {children}
      {/* useSearchParams needs a Suspense boundary; this reader renders nothing. */}
      <Suspense fallback={null}>
        <AddParamReader onAdd={open} onNone={closeFromUrl} />
      </Suspense>
      <QuickAddSheet
        open={state.open}
        onClose={close}
        tab={state.tab}
        onTabChange={(tab) => setState((s) => ({ ...s, tab, repeats: false }))}
        initialRepeats={state.repeats}
        envelopes={data?.envelopes ?? null}
        unallocatedSen={data?.unallocatedSen ?? 0}
      />
    </QuickAddContext>
  );
}

function AddParamReader({ onAdd, onNone }: { onAdd: OpenQuickAdd; onNone: () => void }) {
  const add = useSearchParams().get("add");
  useEffect(() => {
    const tab = QUICK_ADD_TABS.find((t) => t === add);
    if (tab) onAdd(tab);
    else onNone();
  }, [add, onAdd, onNone]);
  return null;
}

/**
 * @deprecated The app shell mounts Quick add on every page now; pages should not render this.
 * Kept, rendering nothing, so a page that still mounts it compiles and does not show a second sheet.
 */
export function QuickAdd(props: { envelopes?: EnvelopeView[]; unallocatedSen?: Sen; initialTab?: QuickAddTab }) {
  void props;
  return null;
}
