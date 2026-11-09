import { SegmentedLinks } from "@/components/charts/SegmentedLinks";
import { cn } from "@/lib/cn";
import { formatISODate } from "@/lib/dates";
import { formatSen } from "@/lib/money";
import type { CashFlowPoint, DashboardRange, Sen } from "@/lib/types";
import { RANGE_OPTIONS } from "./period";

const PAD = 10; // % of plot height kept clear above and below the line

/** Net cash flow card for the range, cumulative line chart, Week/Month/Year toggle. */
export function CashFlowLine({
  range,
  periodLabel,
  netFlowSen,
  points,
  className,
}: {
  range: DashboardRange;
  periodLabel: string;
  netFlowSen: Sen;
  points: CashFlowPoint[];
  className?: string;
}) {
  const empty = points.every((p) => p.cumulativeNetSen === 0); // also true for []
  const values = points.map((p) => p.cumulativeNetSen);
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const y = (v: Sen) => (hi === lo ? 50 : PAD + ((hi - v) / (hi - lo)) * (100 - 2 * PAD));
  const n = points.length;
  const x = (i: number) => (n > 1 ? (i / (n - 1)) * 100 : 100);
  // One point still draws a flat segment across the plot.
  const coords = empty
    ? [
        [0, 50],
        [100, 50],
      ]
    : n === 1
      ? [
          [0, y(values[0])],
          [100, y(values[0])],
        ]
      : values.map((v, i) => [x(i), y(v)]);
  const line = coords.map(([cx, cy], i) => `${i ? "L" : "M"}${cx},${cy}`).join(" ");
  const zeroY = y(0);
  const area = `${line} L100,${zeroY} L0,${zeroY} Z`;
  const last = points[n - 1];
  const lastY = coords[coords.length - 1][1];
  const dateText = (p: CashFlowPoint) => (range === "year" ? formatISODate(p.date).replace(/^\d+ /, "") : formatISODate(p.date));

  return (
    <section aria-labelledby="cashflow-heading" className={cn("flex flex-col gap-4 rounded-2xl border border-border bg-card p-4", className)}>
      <div>
        <h2 id="cashflow-heading" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Net cash flow · {periodLabel}
        </h2>
        <p className="text-2xl font-semibold tabular-nums">{formatSen(netFlowSen)}</p>
      </div>

      <div className="relative h-36 lg:h-auto lg:min-h-56 lg:flex-1">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full overflow-visible"
          role="img"
          aria-label={
            empty
              ? "Cash flow chart: no money in or out yet"
              : `Cumulative net cash flow, ${dateText(points[0])} to ${dateText(last)}, ending at ${formatSen(last.cumulativeNetSen)}`
          }
        >
          {!empty && lo < 0 && hi > 0 && (
            <line x1="0" x2="100" y1={zeroY} y2={zeroY} className="stroke-muted-foreground/40" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          )}
          {!empty && <path d={area} className="fill-primary" fillOpacity="0.1" />}
          <path
            d={line}
            fill="none"
            className={empty ? "stroke-muted-foreground/40" : "stroke-primary"}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {!empty &&
            points.map((p, i) => (
              <rect key={p.date} x={n > 1 ? x(i) - 50 / (n - 1) : 0} y="0" width={n > 1 ? 100 / (n - 1) : 100} height="100" fill="transparent">
                <title>{`${dateText(p)}: ${formatSen(p.cumulativeNetSen)}`}</title>
              </rect>
            ))}
        </svg>
        {empty ? (
          <p className="absolute inset-x-0 top-[calc(50%+0.75rem)] text-center text-sm text-muted-foreground">No money in or out yet</p>
        ) : (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute size-3 -translate-1/2 rounded-full bg-primary ring-2 ring-card"
              style={{ left: "100%", top: `${lastY}%` }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-0 rounded-md bg-card px-1 text-sm font-medium tabular-nums"
              style={lastY < 30 ? { top: `calc(${lastY}% + 0.75rem)` } : { top: `calc(${lastY}% - 2rem)` }}
            >
              {formatSen(last.cumulativeNetSen)}
            </span>
          </>
        )}
      </div>

      {!empty && (
        <div className="sr-only">
          <table>
            <caption>Cumulative net cash flow</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Cumulative net</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date}>
                  <td>{dateText(p)}</td>
                  <td>{formatSen(p.cumulativeNetSen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SegmentedLinks label="Period" param="range" options={RANGE_OPTIONS} current={range} />
    </section>
  );
}
