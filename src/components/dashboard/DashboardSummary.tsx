import Link from "next/link";
import { formatSen } from "@/lib/money";
import type { Sen } from "@/lib/types";

export function DashboardSummary({ totalSen, unallocatedSen }: { totalSen: Sen; unallocatedSen: Sen }) {
  const row = (
    <>
      <span className="text-muted-foreground">Unallocated</span>
      <span className="ml-auto tabular-nums whitespace-nowrap">{formatSen(unallocatedSen)}</span>
      {unallocatedSen > 0 && <span className="font-medium whitespace-nowrap">Allocate →</span>}
    </>
  );
  return (
    <section aria-label="Summary" className="rounded-2xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">Total remaining</p>
      <p className="text-4xl font-semibold tabular-nums lg:text-5xl">{formatSen(totalSen)}</p>
      {unallocatedSen > 0 ? (
        <Link href="/allocate" className="-mx-2 mt-2 flex min-h-11 flex-wrap items-center gap-x-2 rounded-lg px-2 hover:bg-background">
          {row}
        </Link>
      ) : (
        <p className="mt-2 flex min-h-11 items-center gap-2">{row}</p>
      )}
    </section>
  );
}
