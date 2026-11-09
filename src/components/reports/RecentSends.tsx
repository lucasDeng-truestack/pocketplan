import { cn } from "@/lib/cn";
import { formatISODate, formatRange, toISODate } from "@/lib/dates";
import type { ReportSendView } from "@/server/reports/send";

// Time of day in Kuala Lumpur; lib/dates has no time formatter, and the zone is fixed so the output is stable.
const timeKL = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit" });

export function RecentSends({ sends }: { sends: ReportSendView[] }) {
  return (
    <section className="flex flex-col gap-2" aria-labelledby="recent-sends">
      <h2 id="recent-sends" className="text-lg font-semibold">
        Recent sends
      </h2>
      {sends.length === 0 ? (
        <p className="text-muted-foreground">No reports sent yet.</p>
      ) : (
        <ul className="rounded-xl border border-border bg-card px-3">
          {sends.map((s) => {
            const at = new Date(s.sentAt);
            return (
              <li key={s.id} className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{formatRange(s.start, s.end)}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-xs",
                      s.status === "ACCEPTED" ? "border-border text-muted-foreground" : "border-destructive text-destructive",
                    )}
                  >
                    {s.status === "ACCEPTED" ? "Accepted by email provider" : "Failed"}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatISODate(toISODate(at))}, {timeKL.format(at)} · {s.recipientCount} {s.recipientCount === 1 ? "recipient" : "recipients"}
                </span>
                {s.status === "FAILED" && s.error && <span className="text-xs text-destructive">{s.error}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
