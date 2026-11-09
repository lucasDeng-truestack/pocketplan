import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/auth";
import { listEnvelopes } from "@/server/envelopes/service";
import { getEnvelopeGrid } from "@/server/insights/service";
import { getBalances } from "@/server/ledger/balances";
import { EnvelopesTabs } from "@/components/envelopes/EnvelopesTabs";
import { EnvelopeGrid } from "@/components/envelopes/EnvelopeGrid";
import { EnvelopeManager } from "@/components/envelopes/EnvelopeManager";
import { formatSen } from "@/lib/money";

export const metadata: Metadata = { title: "Envelopes · PocketPlan" };

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export default async function EnvelopesPage() {
  const user = await requireUser();
  const [{ balances, envelopes }, grid] = await Promise.all([
    // one balance snapshot for the Split money label and the envelope list
    getBalances(user.id).then(async (balances) => ({ balances, envelopes: await listEnvelopes(user.id, { includeArchived: true }, balances) })),
    getEnvelopeGrid(user.id),
  ]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
      <div className="lg:col-span-2">
        <EnvelopesTabs current="envelopes" />
      </div>
      <section className="flex flex-col gap-3">
        <EnvelopeManager envelopes={envelopes} />
        <Link href="/allocate" className={`flex min-h-12 flex-col items-center justify-center rounded-xl bg-primary px-4 text-center font-medium text-primary-foreground ${focus}`}>
          Split money
          {balances.unallocatedSen > 0 && <span className="text-xs font-normal tabular-nums opacity-80">{formatSen(balances.unallocatedSen)} to split</span>}
        </Link>
      </section>
      <div className="flex flex-col gap-2">
        <EnvelopeGrid grid={grid} />
        <Link href="/insights" className={`flex min-h-11 items-center self-end rounded-lg px-2 text-sm font-medium underline-offset-4 hover:underline ${focus}`}>
          See insights →
        </Link>
      </div>
    </div>
  );
}
