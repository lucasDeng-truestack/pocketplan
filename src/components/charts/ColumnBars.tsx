import Link from "next/link";
import { formatSenCompact, niceCeil } from "@/components/charts/format";
import { cn } from "@/lib/cn";
import { formatSen } from "@/lib/money";
import type { Sen } from "@/lib/types";

export type Column = {
  key: string;
  /** axis label under the column; "" leaves it blank */
  label: string;
  /** full name for the tooltip and the text table, e.g. "Nov 2026" */
  name: string;
  sen: Sen;
  href?: string;
};

/**
 * Columns from one baseline with 3 gridlines; negative values hang below a zero line.
 * The highlighted column wears the accent, the rest are muted. Columns with href are links.
 */
export function ColumnBars({
  columns,
  highlight,
  caption,
  emptyText,
  height = "h-40",
}: {
  columns: Column[];
  highlight: string | null;
  caption: string;
  emptyText: string;
  height?: string;
}) {
  const values = columns.map((c) => c.sen);
  const hi = niceCeil(Math.max(0, ...values));
  const lo = -niceCeil(-Math.min(0, ...values));
  if (columns.length === 0 || hi === lo) {
    return <p className={cn("flex items-center justify-center text-sm text-muted-foreground", height)}>{emptyText}</p>;
  }
  const pos = (v: number) => ((hi - v) / (hi - lo)) * 100; // % from the top
  const ticks = lo < 0 && hi > 0 ? [hi, 0, lo] : [hi, Math.round((hi + lo) / 2), lo];
  const zero = pos(0);

  return (
    <div>
      <div className="flex gap-2">
        <div aria-hidden="true" className={cn("relative w-12 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums", height)}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${pos(t)}%` }}>
              {formatSenCompact(t)}
            </span>
          ))}
        </div>
        <div className={cn("relative flex-1", height)}>
          {ticks.map((t) => (
            <div key={t} aria-hidden="true" className={cn("absolute inset-x-0 h-px", t === 0 ? "bg-muted-foreground/40" : "bg-muted-foreground/20")} style={{ top: `${pos(t)}%` }} />
          ))}
          <div className="absolute inset-0 flex gap-0.5">
            {columns.map((c) => {
              const bar = (
                <div
                  className={cn(
                    "absolute inset-x-0 mx-auto max-w-6",
                    c.sen >= 0 ? "rounded-t-[4px]" : "rounded-b-[4px]",
                    c.key === highlight ? "bg-primary" : "bg-muted-foreground/30",
                  )}
                  style={{ top: `${c.sen >= 0 ? pos(c.sen) : zero}%`, height: `${Math.abs(pos(c.sen) - zero)}%` }}
                />
              );
              const tip = `${c.name}: ${formatSen(c.sen)}`;
              return c.href ? (
                <Link
                  key={c.key}
                  href={c.href}
                  scroll={false}
                  title={tip}
                  aria-label={tip}
                  aria-current={c.key === highlight ? "true" : undefined}
                  className="relative flex-1 rounded-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {bar}
                </Link>
              ) : (
                <div key={c.key} title={tip} aria-hidden="true" className="relative flex-1">
                  {bar}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div aria-hidden="true" className="mt-1 flex gap-2 text-center text-[11px] text-muted-foreground">
        <div className="w-12 shrink-0" />
        <div className="flex flex-1 gap-0.5">
          {columns.map((c) => (
            <span key={c.key} className={cn("flex-1 whitespace-nowrap", c.key === highlight && "font-semibold text-foreground")}>
              {c.label}
            </span>
          ))}
        </div>
      </div>
      {/* sr-only on a wrapper: a <caption> escapes a clipped sr-only <table> and paints on screen */}
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <tbody>
            {columns.map((c) => (
              <tr key={c.key}>
                <th scope="row">{c.name}</th>
                <td>{formatSen(c.sen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
