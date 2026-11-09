import type { ReactNode } from "react";
import { requireUser } from "@/server/auth";
import { getCurrentBalances } from "@/server/ledger/balances";
import { listActiveEnvelopesCached } from "@/server/envelopes/service";
import { AppShell } from "@/components/AppShell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  // For Quick add on every page. Actions revalidate the layout, so these stay current after each write.
  // A failed read must not take the whole shell down (error.tsx sits inside this layout): Quick add says so instead.
  const quickAdd = await getCurrentBalances(user.id)
    .then(async (balances) => ({
      envelopes: await listActiveEnvelopesCached(user.id), // same cached snapshot as balances
      unallocatedSen: balances.unallocatedSen,
    }))
    .catch((e) => {
      console.error("Quick add data failed to load", e);
      return null;
    });
  return (
    <AppShell quickAdd={quickAdd}>
      {children}
    </AppShell>
  );
}
