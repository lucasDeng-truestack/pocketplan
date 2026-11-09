import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/auth";
import { listEnvelopes } from "@/server/envelopes/service";
import { getDashboard } from "@/server/insights/service";
import { CashFlowLine } from "@/components/dashboard/CashFlowLine";
import { DashboardSummary } from "@/components/dashboard/DashboardSummary";
import { DueList } from "@/components/dashboard/DueList";
import { HealthCard } from "@/components/dashboard/HealthCard";
import { InOutCards } from "@/components/dashboard/InOutCards";
import { parseRange, periodLabel } from "@/components/dashboard/period";
import { RecentList } from "@/components/dashboard/RecentList";
import { SpentBar } from "@/components/dashboard/SpentBar";
import { EnvelopeRow } from "@/components/envelopes/EnvelopeRow";
import { todayKL } from "@/lib/dates";

export const metadata: Metadata = { title: "Dashboard · PocketPlan" };

// Desktop places every card explicitly (DOM order stays phone order), and cards stretch to their row's height, so no gaps open:
// row 1 summary | In/Out | health; row 2 cash flow | envelopes; rows 3-4 recent | spent, then due.
const CELL = "lg:*:h-full";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  const range = parseRange((await searchParams).range);
  const data = await getDashboard(user.id, range);
  const { balances } = data;
  // Same snapshot as the dashboard totals; archived included so old entries still get names and colours.
  const all = await listEnvelopes(user.id, { includeArchived: true }, balances);
  const active = all.filter((e) => !e.archivedAt);

  if (active.length === 0 && balances.totalSen === 0) {
    return (
      <section className="flex flex-col gap-3 rounded-2xl border border-dashed border-border p-4">
        <p className="font-medium">Start by recording the money you have</p>
        <Link href="/?add=income" className="flex min-h-12 items-center justify-center rounded-xl bg-primary px-4 font-medium text-primary-foreground">
          Record money
        </Link>
        <Link href="/envelopes" className="flex min-h-11 items-center justify-center text-sm font-medium underline">
          Create envelopes
        </Link>
      </section>
    );
  }

  const period = periodLabel(range, data.start);
  const envelopesById = Object.fromEntries(all.map((e) => [e.id, { name: e.name, colour: e.colour, icon: e.icon, archived: e.archivedAt !== null }]));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
      <div className={`sm:col-span-2 lg:col-span-5 lg:col-start-1 lg:row-start-1 ${CELL}`}>
        <DashboardSummary totalSen={balances.totalSen} unallocatedSen={balances.unallocatedSen} />
      </div>
      <div className={`sm:col-span-2 lg:col-span-4 lg:col-start-9 lg:row-start-2 ${CELL}`}>
        {active.length > 0 ? (
          <ul aria-label="Envelope balances" className="rounded-2xl border border-border bg-card px-3">
            {active.map((e) => (
              <EnvelopeRow key={e.id} envelope={e} />
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Next, split your money into envelopes.{" "}
            <Link href="/envelopes" className="font-medium text-foreground underline">
              Create envelopes
            </Link>
          </p>
        )}
      </div>
      <CashFlowLine
        className="sm:col-span-2 lg:col-span-8 lg:col-start-1 lg:row-start-2"
        range={range}
        periodLabel={period.long}
        netFlowSen={data.netFlowSen}
        points={data.cashFlow}
      />
      <div className={`lg:col-span-4 lg:col-start-6 lg:row-start-1 ${CELL}`}>
        <InOutCards periodShort={period.short} inSen={data.inSen} outSen={data.outSen} />
      </div>
      <div className={`lg:col-span-4 lg:col-start-9 lg:row-start-3 ${CELL}`}>
        <SpentBar spent={data.spentByEnvelope} unassignedSen={data.unassignedSpentSen} />
      </div>
      <div className={`sm:col-span-2 lg:col-span-3 lg:col-start-10 lg:row-start-1 ${CELL}`}>
        <HealthCard health={data.health} lastMonth={data.healthLastMonth} atRisk={data.envelopes.filter((e) => e.atRisk)} />
      </div>
      {data.due.length > 0 && (
        <div className={`sm:col-span-2 lg:col-span-4 lg:col-start-9 lg:row-start-4 ${CELL}`}>
          <DueList items={data.due} today={todayKL()} />
        </div>
      )}
      <div className={`sm:col-span-2 lg:col-span-8 lg:col-start-1 lg:row-span-2 lg:row-start-3 ${CELL}`}>
        <RecentList items={data.recent} envelopes={envelopesById} />
      </div>
    </div>
  );
}
