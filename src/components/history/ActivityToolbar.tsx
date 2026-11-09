"use client";

import Link from "next/link";
import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";
import { activityHref, type ActivityFilterValues } from "./activityHref";

const CHIPS: { label: string; type?: string }[] = [
  { label: "All" },
  { label: "Expenses", type: "EXPENSE" },
  { label: "Income", type: "INCOME" },
  { label: "Transfers", type: "TRANSFER" },
];

const SEARCH_DEBOUNCE_MS = 400;

/** Search, type chips (plus Recurring) and the Filters toggle. All state lives in the URL. */
export function ActivityToolbar({
  values,
  recurring,
  filters,
}: {
  values: ActivityFilterValues;
  /** The Recurring view is showing. */
  recurring: boolean;
  /** The envelope and date filters, revealed by "Filters". */
  filters: ReactNode;
}) {
  const router = useRouter();
  const searchId = useId();
  const filtersId = useId();
  const urlQ = values.q ?? "";
  const [text, setText] = useState(urlQ);
  const [seenQ, setSeenQ] = useState(urlQ);
  const hasFilters = Boolean(values.envelopeId || values.start || values.end);
  const [showFilters, setShowFilters] = useState(hasFilters);

  // The URL changed from elsewhere (a chip, "Clear"): follow it, unless it is our own debounced write.
  if (urlQ !== seenQ) {
    setSeenQ(urlQ);
    if (urlQ !== text.trim()) setText(urlQ);
  }

  useEffect(() => {
    const q = text.trim();
    if (recurring || q === urlQ) return;
    const timer = setTimeout(() => router.replace(activityHref({ ...values, q: q || undefined }), { scroll: false }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, urlQ, values, recurring, router]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = text.trim();
    router.replace(activityHref({ ...values, q: q || undefined }), { scroll: false });
  }

  const chip = (active: boolean) =>
    cn(
      "flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
      active ? "border-foreground bg-foreground font-medium text-background" : "border-border bg-card text-foreground",
    );

  return (
    <div className="flex flex-col gap-3">
      {!recurring && (
        <form role="search" onSubmit={onSubmit} className="flex gap-2">
          <label htmlFor={searchId} className="sr-only">
            Search entries
          </label>
          <div className="flex min-h-12 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-ring">
            <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <input
              id={searchId}
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={60}
              autoComplete="off"
              enterKeyHint="search"
              placeholder="Search merchants, notes, amounts"
              className="w-full min-w-0 bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <button
            type="button"
            aria-expanded={showFilters}
            aria-controls={filtersId}
            onClick={() => setShowFilters((s) => !s)}
            className={cn(
              "flex min-h-12 items-center gap-2 rounded-xl border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring",
              hasFilters ? "border-foreground" : "border-border bg-card",
            )}
          >
            <SlidersHorizontal aria-hidden="true" className="size-4" />
            Filters
            {hasFilters && (
              <>
                <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
                <span className="sr-only">(on)</span>
              </>
            )}
          </button>
        </form>
      )}
      <nav aria-label="Entry type" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {CHIPS.map((c) => {
            const active = !recurring && values.type === c.type;
            return (
              <li key={c.label}>
                <Link href={activityHref({ ...values, type: c.type })} aria-current={active ? "page" : undefined} className={chip(active)}>
                  {c.label}
                </Link>
              </li>
            );
          })}
          <li>
            <Link href={activityHref({ view: "recurring" })} aria-current={recurring ? "page" : undefined} className={chip(recurring)}>
              Recurring
            </Link>
          </li>
        </ul>
      </nav>
      {!recurring && showFilters && <div id={filtersId}>{filters}</div>}
    </div>
  );
}
