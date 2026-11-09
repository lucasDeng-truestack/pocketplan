import "server-only";
import { formatISODate, formatRange } from "@/lib/dates";
import { formatSen } from "@/lib/money";
import type { ReportData, ReportRow, TransactionView } from "@/lib/types";

// Email-safe: tables, inline styles, system fonts, no images, scripts, classes or <style>.
// Deterministic for the same data (no timestamps): the duplicate-send hash depends on it.

const BG = "#faf7f2";
const INK = "#4a3b2f";
const LINE = "#c9a96e";
const MUTED = "#8a7a6a";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const NO_COLOUR = "#bbbbbb";

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const safeColour = (c: string | null) => (c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : NO_COLOUR);
const amount = (sen: number) => (sen === 0 ? "—" : escapeHtml(formatSen(sen)));

const cell = (extra = "") => `border:1px solid ${LINE};padding:6px 8px;${extra}`;
const num = cell("text-align:right;white-space:nowrap;");
const head = cell(`font-weight:600;background:#f1e9dc;`);

function swatch(colour: string | null): string {
  return `<span style="display:inline-block;width:10px;height:10px;border-radius:5px;background:${safeColour(colour)};margin-right:6px;vertical-align:middle;"></span>`;
}

function row(r: ReportRow, opts: { swatch: boolean; bold?: boolean }): string {
  const weight = opts.bold ? "font-weight:700;border-top:2px solid " + LINE + ";" : "";
  const td = (style: string, content: string) => `<td style="${style}${weight}">${content}</td>`;
  return `<tr>${[
    td(cell(), `${opts.swatch ? swatch(r.colour) : ""}${escapeHtml(r.name)}`),
    td(num, amount(r.openingSen)),
    td(num, amount(r.allocatedInSen)),
    td(num, amount(r.movedOutSen)),
    td(num, amount(r.spentSen)),
    td(num, amount(r.refundsSen)),
    td(num, amount(r.closingSen)),
    td(num, r.targetSen === null ? "—" : amount(r.targetSen)),
  ].join("")}</tr>`;
}

function signed(t: TransactionView): string {
  const abs = formatSen(t.amountSen);
  if (t.type === "INCOME" || t.type === "REFUND") return `+${abs}`;
  if (t.type === "EXPENSE") return `−${abs}`;
  return abs; // transfers move money; the total does not change
}

function entryEnvelope(t: TransactionView, names: Record<string, string>): string {
  const name = (id: string | null) => (id ? (names[id] ?? "Envelope") : "Unallocated");
  if (t.type === "TRANSFER") return `${name(t.fromEnvelopeId)} → ${name(t.toEnvelopeId)}`;
  return t.type === "INCOME" ? "Income" : name(t.envelopeId);
}

function transactionsTable(list: TransactionView[], count: number | null, names: Record<string, string>): string {
  const body = list
    .map((t) => {
      const text = [t.merchant, t.note].filter(Boolean).join(" · ");
      return `<tr><td style="${cell("white-space:nowrap;")}">${escapeHtml(formatISODate(t.occurredOn))}</td><td style="${cell()}">${escapeHtml(
        entryEnvelope(t, names),
      )}</td><td style="${cell()}">${escapeHtml(text) || "—"}</td><td style="${num}">${escapeHtml(signed(t))}</td></tr>`;
    })
    .join("");
  const more = count !== null && count > list.length ? `<p style="margin:6px 0 0;color:${MUTED};font-size:12px;">Showing ${list.length} of ${count} entries.</p>` : "";
  const empty = list.length === 0 ? `<tr><td colspan="4" style="${cell(`color:${MUTED};`)}">No entries in this period.</td></tr>` : "";
  return `<h2 style="font-size:16px;margin:24px 0 8px;">Entries</h2>
<div style="overflow-x:auto;"><table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px;">
<tr><td style="${head}">Date</td><td style="${head}">Envelope</td><td style="${head}">Merchant / note</td><td style="${head}text-align:right;">Amount</td></tr>
${body}${empty}</table></div>${more}`;
}

export function renderReport(data: ReportData & { transactionCount?: number | null; envelopeNames?: Record<string, string> }, meta: { senderEmail: string }): string {
  const { start, end } = data.params;
  const range = escapeHtml(formatRange(start, end));
  const endText = escapeHtml(formatISODate(end));
  const headers = ["Envelope", "Opening", "+ Allocated", "− Moved out", "− Spent", "+ Refunds", "Closing", "Target"]
    .map((h, i) => `<td style="${head}${i > 0 ? "text-align:right;white-space:nowrap;" : ""}">${escapeHtml(h)}</td>`)
    .join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PocketPlan report</title></head>
<body style="margin:0;padding:0;background:${BG};">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${BG};"><tr><td align="center" style="padding:16px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;font-family:${FONT};color:${INK};">
<tr><td>
<h1 style="font-size:22px;margin:0 0 4px;">PocketPlan report</h1>
<p style="margin:0 0 16px;color:${MUTED};">${range}</p>
<div style="overflow-x:auto;"><table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px;">
<tr><td style="${head}"></td><td colspan="5" style="${head}text-align:center;">Activity ${range}</td><td colspan="2" style="${head}text-align:center;">As of ${endText}</td></tr>
<tr>${headers}</tr>
${data.rows.map((r) => row(r, { swatch: true })).join("\n")}
${row(data.unallocated, { swatch: false })}
${row(data.total, { swatch: false, bold: true })}
</table></div>
${data.transactions ? transactionsTable(data.transactions, data.transactionCount ?? null, data.envelopeNames ?? {}) : ""}
<p style="margin:24px 0 0;font-size:12px;color:${MUTED};overflow-wrap:anywhere;">Sent from PocketPlan by ${escapeHtml(meta.senderEmail)}. Balances in RM. Activity covers ${range}; Closing is the balance at the end of ${endText}.</p>
</td></tr></table>
</td></tr></table>
</body></html>`;
}
