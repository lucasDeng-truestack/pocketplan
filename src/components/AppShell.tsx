import type { ReactNode } from "react";
import { BottomNav } from "@/components/BottomNav";
import { SideNav } from "@/components/SideNav";
import { TopBar } from "@/components/TopBar";
import { QuickAddProvider } from "@/components/ledger/QuickAdd";
import type { EnvelopeView, Sen } from "@/lib/types";

/**
 * Phone (< 640): full-width column, bottom bar. Tablet (640–1023): bottom bar, column up to 720 px.
 * Desktop (>= 1024): left sidebar, content up to 1680 px. Quick add is mounted here so + works on every page.
 */
export function AppShell({
  children,
  quickAdd,
}: {
  children: ReactNode;
  /** null when it failed to load; Quick add then shows an error instead of the forms. */
  quickAdd: { envelopes: EnvelopeView[]; unallocatedSen: Sen } | null;
}) {
  return (
    <QuickAddProvider data={quickAdd}>
      <SideNav />
      <div className="lg:pl-60">
        <TopBar />
        <main className="mx-auto w-full max-w-[720px] px-4 pt-2 pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:max-w-[1680px] lg:px-8 lg:pb-12">
          {children}
        </main>
      </div>
      <BottomNav />
    </QuickAddProvider>
  );
}
