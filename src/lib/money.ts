import type { Sen } from "./types";

/** Largest amount a ledger row can hold (Postgres int column): RM 21,474,836.47. */
export const MAX_SEN = 2_147_483_647;

// "12", "1,250", "12.5", "1,250.50", or a decimal comma "20,50" (1–2 digits after it). A comma followed by
// three digits is a thousands separator, so "1,000" is RM 1,000.00, and grouping must be exact ("12,34,5" fails).
const AMOUNT = /^(\d+|\d{1,3}(?:,\d{3})+)(?:\.(\d{1,2}))?$|^(\d+),(\d{1,2})$/; // 1 whole, 2 dot decimals | 3 whole, 4 comma decimals

/**
 * The one parser for every money input (keypad, envelope targets, split, edits, search). Integer sen, string-based,
 * never a float. Returns null for anything that is not a plain non-negative amount up to MAX_SEN: callers show
 * "Enter an amount like 12.50" and the server re-validates the integer with senSchema.
 */
export function parseSen(input: string): Sen | null {
  const m = AMOUNT.exec(input.trim().replace(/^RM\s*/i, ""));
  if (!m) return null;
  const whole = Number((m[1] ?? m[3]).replace(/,/g, ""));
  const frac = Number((m[2] ?? m[4] ?? "").padEnd(2, "0"));
  const sen = whole * 100 + frac;
  return Number.isSafeInteger(sen) && sen <= MAX_SEN ? sen : null;
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
