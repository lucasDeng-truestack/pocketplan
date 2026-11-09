import type { Metadata } from "next";
import { requireUser } from "@/server/auth";
import { listEnvelopeNames } from "@/server/envelopes/service";
import { canSendReportsToOthers, listReportSends, usingTestSender } from "@/server/reports/send";
import { ReportBuilder } from "@/components/reports/ReportBuilder";
import { EnvelopesTabs } from "@/components/envelopes/EnvelopesTabs";
import { RecentSends } from "@/components/reports/RecentSends";
import { todayKL } from "@/lib/dates";

export const metadata: Metadata = { title: "Reports · PocketPlan" };

export default async function ReportsPage() {
  const user = await requireUser();
  const [names, sends, canSendToOthers] = await Promise.all([
    listEnvelopeNames(user.id),
    listReportSends(user.id),
    canSendReportsToOthers(user.id),
  ]);
  const envelopes = [...names.filter((e) => !e.archivedAt), ...names.filter((e) => e.archivedAt)].map((e) => ({
    id: e.id,
    name: e.name,
    colour: e.colour,
    archived: e.archivedAt !== null,
  }));
  const today = todayKL();

  return (
    <div className="flex flex-col gap-8">
      <EnvelopesTabs current="reports" />
      <ReportBuilder
        envelopes={envelopes}
        defaultStart={`${today.slice(0, 8)}01`}
        defaultEnd={today}
        senderEmail={user.email}
        testSender={usingTestSender()}
        canSendToOthers={canSendToOthers}
      />
      <RecentSends sends={sends} />
    </div>
  );
}
