import type { Metadata } from "next";
import { requireUser } from "@/server/auth";
import { listEnvelopeNames } from "@/server/envelopes/service";
import { getEnvelopesInsights, getMonthInsights } from "@/server/insights/service";
import { RecentList } from "@/components/dashboard/RecentList";
import { ByEnvelope } from "@/components/insights/ByEnvelope";
import { InsightsTabs, parseView } from "@/components/insights/InsightsTabs";
import { InsightTiles } from "@/components/insights/InsightTiles";
import { activitySearchHref, DailySpending, EnvelopeDrill, TopMerchants } from "@/components/insights/MonthSections";
import { MonthSummary } from "@/components/insights/MonthSummary";
import { todayKL } from "@/lib/dates";
import { monthInsightsSchema, monthSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Insights · PocketPlan" };

// shortcut: plain props type because PageProps<"/insights"> only exists after next typegen picks up the new route; switch once it has.
export default async function InsightsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const params = await searchParams;
  const view = parseView(params.view);
  const currentMonth = todayKL().slice(0, 7);
  const month = monthSchema.safeParse(params.month).data ?? currentMonth;
  // A malformed envelope id is dropped; an id the user doesn't own comes back as envelope: null from the service.
  const envelopeId = monthInsightsSchema.safeParse({ month, envelopeId: params.envelope }).data?.envelopeId;

  const [insights, data, names] = await Promise.all([
    getEnvelopesInsights(user.id, view),
    getMonthInsights(user.id, { month, envelopeId }),
    listEnvelopeNames(user.id),
  ]);
  const envelopesById = Object.fromEntries(names.map((e) => [e.id, { name: e.name, colour: e.colour, icon: e.icon, archived: e.archivedAt !== null }]));
  const emptyMonth = data.spentSen === 0 && data.incomeSen === 0 && data.topExpenses.length === 0;
  const drill = data.envelope;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start 2xl:grid-cols-3">
      <div className="flex flex-col gap-4">
        <InsightsTabs insights={insights} selectedMonth={month} />
        <MonthSummary data={data} view={view} currentMonth={currentMonth} />
        {!emptyMonth && <DailySpending daily={data.daily} end={data.end} />}
      </div>

      <div className="flex flex-col gap-4 2xl:col-span-2 2xl:block 2xl:columns-2 2xl:gap-4 2xl:*:mb-4 2xl:*:break-inside-avoid">
        {drill && (
          <>
            <EnvelopeDrill envelope={drill} view={view} month={month} />
            <RecentList
              items={drill.expenses}
              envelopes={envelopesById}
              title={`${drill.name} expenses`}
              action={null}
              emptyText="No expenses in this envelope this month."
              hrefFor={activitySearchHref}
            />
          </>
        )}
        {emptyMonth ? (
          <section className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-border p-6 text-center">
            <p className="font-medium">Nothing recorded in {data.label}</p>
            <p className="text-sm text-muted-foreground">Pick another month, or record spending and income to see where your money goes.</p>
          </section>
        ) : (
          <>
            <ByEnvelope rows={data.byEnvelope} view={view} month={month} selected={drill?.envelopeId ?? null} unassignedSen={data.unassignedSpentSen} />
            <RecentList
              items={data.topExpenses}
              envelopes={envelopesById}
              title="Biggest expenses"
              action={null}
              emptyText="No expenses this month."
              hrefFor={activitySearchHref}
            />
            <TopMerchants merchants={data.topMerchants} />
          </>
        )}
        <InsightTiles priciest={insights.priciestWeekday} small={insights.smallSpends} />
      </div>
    </div>
  );
}
