"use client";

import Link from "next/link";
import { useId } from "react";
import { useRouter } from "next/navigation";
import { activityHref, type ActivityFilterValues } from "./activityHref";

/**
 * Envelope and date range (the type is chosen with the chips). Uncontrolled: the page re-keys this on
 * every filter change, so defaults always match the URL. Search and type are kept; the cursor is dropped.
 */
export function HistoryFilters({
  values,
  envelopes,
}: {
  values: ActivityFilterValues;
  envelopes: { id: string; name: string; archived: boolean }[];
}) {
  const router = useRouter();
  const id = useId();

  function update(key: "envelopeId" | "start" | "end", value: string) {
    router.replace(activityHref({ ...values, [key]: value || undefined }), { scroll: false });
  }

  const field = "min-h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground";
  const hasFilters = Boolean(values.envelopeId || values.start || values.end);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
        <label htmlFor={`${id}-envelope`} className="text-xs font-medium text-muted-foreground">
          Envelope
        </label>
        <select
          id={`${id}-envelope`}
          defaultValue={values.envelopeId ?? ""}
          onChange={(e) => update("envelopeId", e.target.value)}
          className={field}
        >
          <option value="">All</option>
          {envelopes.map((e) => (
            <option key={e.id} value={e.id}>
              {e.archived ? `${e.name} (archived)` : e.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-start`} className="text-xs font-medium text-muted-foreground">
          From
        </label>
        <input
          id={`${id}-start`}
          type="date"
          defaultValue={values.start ?? ""}
          max={values.end}
          onChange={(e) => update("start", e.target.value)}
          className={field}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-end`} className="text-xs font-medium text-muted-foreground">
          To
        </label>
        <input
          id={`${id}-end`}
          type="date"
          defaultValue={values.end ?? ""}
          min={values.start}
          onChange={(e) => update("end", e.target.value)}
          className={field}
        />
      </div>
      {hasFilters && (
        <Link
          href={activityHref({ q: values.q, type: values.type })}
          className="col-span-2 flex min-h-11 items-center justify-center text-sm font-medium underline sm:col-span-3"
        >
          Clear envelope and dates
        </Link>
      )}
    </div>
  );
}
