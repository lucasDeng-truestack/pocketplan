import type { Sen } from "./types";

/**
 * Parse user input like "12", "12.5", "1,250.00" into integer sen.
 * String-based: never multiplies a float. Returns null for anything invalid.
 */
export function parseSen(input: string): Sen | null {
  const s = input.trim().replace(/,/g, "").replace(/^RM\s*/i, "");
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const whole = Number(m[1]);
  const frac = Number((m[2] ?? "").padEnd(2, "0"));
  const sen = whole * 100 + frac;
  return Number.isSafeInteger(sen) ? sen : null;
}

/** 123456 -> "1,234.56"; -1200 -> "−12.00". For prefilling inputs; parseSen reads it back. */
export function formatSenPlain(sen: Sen): string {
  if (!Number.isInteger(sen)) throw new Error(`formatSen: not integer sen: ${sen}`);
  const abs = Math.abs(sen);
  const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = (abs % 100).toString().padStart(2, "0");
  return `${sen < 0 ? "−" : ""}${whole}.${frac}`;
}

/** 123456 -> "RM 1,234.56"; -1200 -> "−RM 12.00" */
export function formatSen(sen: Sen): string {
  const plain = formatSenPlain(sen);
  return sen < 0 ? `−RM ${plain.slice(1)}` : `RM ${plain}`;
}
