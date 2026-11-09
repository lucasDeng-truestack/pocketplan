import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { AppError } from "@/server/errors";
import { getEnvelope, listEnvelopeNames } from "@/server/envelopes/service";
import { listTransactions } from "@/server/ledger/service";
import { EnvelopeDetailActions } from "@/components/envelopes/EnvelopeManager";
import { targetProgress } from "@/components/envelopes/EnvelopeRow";
import { EnvelopeSwatch, ProgressBar } from "@/components/ui";
import { HistoryList } from "@/components/history/HistoryList";
import { formatSen } from "@/lib/money";

export const metadata: Metadata = { title: "Envelope · PocketPlan" };

export default async function EnvelopePage({ params }: PageProps<"/envelopes/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const [envelope, recent, all] = await Promise.all([
    getEnvelope(user.id, id).catch((e) => {
      if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
      throw e;
    }),
    listTransactions(user.id, { envelopeId: id, limit: 10 }),
    listEnvelopeNames(user.id), // names for transfer labels
  ]);
  const byId = Object.fromEntries(all.map((e) => [e.id, { name: e.name, colour: e.colour, icon: e.icon, archived: e.archivedAt !== null }]));
  const progress = targetProgress(envelope);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/envelopes" className="-ml-2 inline-flex min-h-11 items-center self-start px-2 text-sm text-muted-foreground">
        ← Envelopes
      </Link>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <EnvelopeSwatch colour={envelope.colour} icon={envelope.icon} className={envelope.icon ? "size-10 [&>svg]:size-5" : "size-4"} />
          <h2 className="truncate text-2xl font-semibold">{envelope.name}</h2>
          {envelope.archivedAt && (
            <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">Archived</span>
          )}
        </div>
        <p className="text-4xl font-semibold tabular-nums">{formatSen(envelope.balanceSen)}</p>
        {envelope.targetSen !== null && progress !== null && (
          <div className="flex flex-col gap-1">
            <ProgressBar value={progress} colour={envelope.colour ?? "var(--muted-foreground)"} label="Target progress" />
            <p className="text-sm text-muted-foreground">Target {formatSen(envelope.targetSen)}</p>
          </div>
        )}
      </div>

      <EnvelopeDetailActions envelope={envelope} />

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Recent transactions</h2>
          {recent.items.length > 0 && (
            <Link href={`/activity?envelope=${envelope.id}`} className="flex min-h-11 items-center text-sm font-medium underline">
              See all
            </Link>
          )}
        </div>
        {recent.items.length === 0 ? (
          <p className="text-muted-foreground">No entries for this envelope yet.</p>
        ) : (
          <HistoryList items={recent.items} envelopes={byId} />
        )}
      </section>
    </div>
  );
}
