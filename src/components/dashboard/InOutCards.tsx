import { formatSen } from "@/lib/money";
import type { Sen } from "@/lib/types";

/** Money in and out for the period, side by side; each bar is its share of the larger of the two. */
export function InOutCards({ periodShort, inSen, outSen }: { periodShort: string; inSen: Sen; outSen: Sen }) {
  const max = Math.max(inSen, outSen, 1);
  const cards = [
    { label: "In", sen: inSen, bar: "bg-success" },
    { label: "Out", sen: outSen, bar: "bg-primary" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((c) => (
        <section key={c.label} aria-label={`Money ${c.label.toLowerCase()}, ${periodShort}`} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {c.label} · {periodShort}
          </p>
          <p className="text-lg font-semibold whitespace-nowrap tabular-nums sm:text-xl lg:text-lg">{formatSen(c.sen)}</p>
          <div aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${Math.round((Math.max(0, c.sen) / max) * 100)}%` }} />
          </div>
        </section>
      ))}
    </div>
  );
}
