import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/auth";
import { AppError } from "@/server/errors";
import { listEnvelopeNames } from "@/server/envelopes/service";
import { listTransactions } from "@/server/ledger/service";
import { listRecurring } from "@/server/recurring/service";
import { ActivityToolbar } from "@/components/history/ActivityToolbar";
import { HistoryFilters } from "@/components/history/HistoryFilters";
import { HistoryList } from "@/components/history/HistoryList";
import { RecurringList } from "@/components/history/RecurringList";
import { activityHref, type ActivityFilterValues } from "@/components/history/activityHref";
import type { EnvelopesById } from "@/components/history/labels";
import { listTransactionsSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Activity · PocketPlan" };

const PAGE_SIZE = 50;

const one = (v: string | string[] | undefined) => (typeof v === "string" && v !== "" ? v : undefined);

export default async function ActivityPage({ searchParams }: PageProps<"/activity">) {
  const user = await requireUser();
  const sp = await searchParams;
  const envelopes = await listEnvelopeNames(user.id);
  const byId: EnvelopesById = Object.fromEntries(
    envelopes.map((e) => [e.id, { name: e.name, colour: e.colour, icon: e.icon, archived: e.archivedAt !== null }]),
  );

  if (one(sp.view) === "recurring") {
    const items = await listRecurring(user.id);
    return (
      <div className="flex flex-col gap-4">
        <ActivityToolbar values={{}} recurring filters={null} />
        <RecurringList items={items} envelopes={byId} />
      </div>
    );
  }

  const parsed = listTransactionsSchema.safeParse({
    q: one(sp.q),
    type: one(sp.type),
    envelopeId: one(sp.envelope),
    start: one(sp.start),
    end: one(sp.end),
    cursor: one(sp.cursor),
    limit: PAGE_SIZE,
  });
  // Bad params never crash the page: drop them all and show the unfiltered list.
  const query = parsed.success ? parsed.data : { limit: PAGE_SIZE };

  const page = await listTransactions(user.id, query).catch((e) => {
    // A cursor that no longer resolves (or is not this user's) restarts from the newest page.
    if (e instanceof AppError && e.code === "VALIDATION" && query.cursor) return null;
    throw e;
  });
  const cursor = page ? query.cursor : undefined;
  const result = page ?? (await listTransactions(user.id, { ...query, cursor: undefined }));

  const filters: ActivityFilterValues = {
    q: query.q,
    type: query.type,
    envelopeId: query.envelopeId,
    start: query.start,
    end: query.end,
  };
  const hasFilters = Boolean(filters.q || filters.type || filters.envelopeId || filters.start || filters.end);

  return (
    <div className="flex flex-col gap-4">
      <ActivityToolbar
        values={filters}
        recurring={false}
        filters={
          <HistoryFilters
            key={activityHref(filters)}
            values={filters}
            envelopes={envelopes.map((e) => ({ id: e.id, name: e.name, archived: e.archivedAt !== null }))}
          />
        }
      />
      {!parsed.success && <p className="text-sm text-muted-foreground">Some filters were not valid, so all entries are shown.</p>}

      {cursor && (
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Showing older entries</h2>
          <Link href={activityHref(filters)} className="flex min-h-11 items-center text-sm font-medium underline">
            Back to latest
          </Link>
        </div>
      )}

      {result.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-4 text-muted-foreground">
          {cursor ? (
            "No older entries."
          ) : hasFilters ? (
            <>
              No entries match.{" "}
              <Link href="/activity" className="font-medium text-foreground underline">
                Clear search and filters
              </Link>
            </>
          ) : (
            "Nothing recorded yet. Tap + to add income or spending."
          )}
        </p>
      ) : (
        <HistoryList
          items={result.items}
          envelopes={byId}
          dayTotals
          continuesFromBefore={Boolean(cursor)}
          hasMoreAfter={result.nextCursor !== null}
        />
      )}

      {result.nextCursor && (
        <Link
          href={activityHref({ ...filters, cursor: result.nextCursor })}
          className="flex min-h-12 items-center justify-center rounded-xl border border-border bg-card font-medium"
        >
          Load more
        </Link>
      )}
    </div>
  );
}
