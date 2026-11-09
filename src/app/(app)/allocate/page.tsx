import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/auth";
import { getBalances } from "@/server/ledger/balances";
import { listEnvelopes } from "@/server/envelopes/service";
import { AllocateForm } from "@/components/ledger/AllocateForm";

export const metadata: Metadata = { title: "Allocate · PocketPlan" };

export default async function AllocatePage() {
  const user = await requireUser();
  const balances = await getBalances(user.id);
  const envelopes = await listEnvelopes(user.id, { includeArchived: false }, balances); // one snapshot

  if (envelopes.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-xl border border-dashed border-border p-4 text-muted-foreground">
          You need an envelope to put money into.{" "}
          <Link href="/envelopes" className="font-medium text-foreground underline">
            Create envelopes
          </Link>
        </p>
      </div>
    );
  }
  return <AllocateForm unallocatedSen={balances.unallocatedSen} envelopes={envelopes} />;
}
