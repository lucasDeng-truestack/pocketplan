import type { Sen } from "@/lib/types";

/** Axis/cell labels only: 123456 -> "RM 1.2K", 4500 -> "RM 45", -250000 -> "−RM 2.5K". Display scaling, never stored. */
export function formatSenCompact(sen: Sen): string {
  const rm = Math.abs(sen) / 100;
  const short = (n: number, unit: string) => `${n.toFixed(1).replace(/\.0$/, "")}${unit}`;
  // Under RM 1,000 the exact amount fits, so show cents when there are any (RM 30.25, not RM 30).
  const text = rm >= 1e6 ? short(rm / 1e6, "M") : rm >= 1000 ? short(rm / 1000, "K") : Number.isInteger(rm) ? `${rm}` : rm.toFixed(2);
  return `${sen < 0 ? "−" : ""}RM ${text}`;
}

/** Smallest 1/2/5 × 10^k (in sen) at or above `sen`, for a clean top gridline. */
export function niceCeil(sen: Sen): Sen {
  if (sen <= 0) return 0;
  const mag = 10 ** Math.floor(Math.log10(sen));
  const step = [1, 2, 5, 10].find((s) => s * mag >= sen)!;
  return Math.round(step * mag);
}

/** Envelope colour from data; envelopes without a colour are grey everywhere, matching EnvelopeSwatch. Names and amounts beside every mark carry identity. */
export function envelopeColour(colour: string | null): string {
  return colour ?? "var(--muted-foreground)";
}

/** Spending with no envelope (it came out of Unallocated): a neutral step between an uncoloured envelope and "Everything else". */
export const UNALLOCATED_COLOUR = "color-mix(in srgb, var(--muted-foreground) 70%, transparent)";

/** "▲ 12%" / "▼ 3%" / "0%"; changePct is in percentage points. */
export function formatChange(pct: number): string {
  const r = Math.round(pct);
  return r > 0 ? `▲ ${r}%` : r < 0 ? `▼ ${-r}%` : "0%";
}

/** Rounded percent change from base to now, for display; null when base is 0. */
export function pctChange(now: Sen, base: Sen): number | null {
  return base === 0 ? null : Math.round(((now - base) * 100) / base);
}
