import "server-only";
import { createHash } from "node:crypto";
import * as z from "zod";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { TX_OPTIONS, lockUser } from "@/server/lock";
import { sendEmail } from "@/server/email/send";
import { dbDateToIso, isoToDbDate } from "@/server/ledger/dates";
import { buildReport } from "@/server/reports/build";
import { renderReport } from "@/server/reports/render";
import { formatRange } from "@/lib/dates";
import { PREVIEW_STALE_MESSAGE, SELF_ONLY_MESSAGE } from "@/lib/validation";
import type { ISODate, ReportParams } from "@/lib/types";

export const PER_MINUTE = 3;
export const PER_DAY = 20;
export const DUPLICATE_WINDOW_MIN = 10;

/**
 * The row is written before the send (inside the lock) so a second tap sees it; this error text marks a send
 * still in flight, and is what stays on the row if the process dies before the provider answers.
 */
const IN_FLIGHT = "Sending did not finish";
const IN_FLIGHT_WINDOW_MIN = 2;

export type ReportSendView = {
  id: string;
  sentAt: string;
  start: ISODate;
  end: ISODate;
  recipientCount: number;
  status: "ACCEPTED" | "FAILED";
  error: string | null;
};

/** Whether RESEND_FROM is Resend's shared test sender (reaches only the account owner). */
export function usingTestSender(): boolean {
  return (process.env.RESEND_FROM ?? "").includes("resend.dev");
}

export const htmlHash = (html: string) => createHash("sha256").update(html).digest("hex");

// shortcut: unverified accounts may only email themselves; this lifts automatically once requireEmailVerification is on
/** Whether this account may send reports to addresses other than its own. */
export async function canSendReportsToOthers(userId: string): Promise<boolean> {
  const row = await db.user.findUnique({ where: { id: userId }, select: { emailVerified: true } });
  return row?.emailVerified === true;
}

function normaliseRecipients(recipients: string[]): string[] {
  const list = [...new Set(recipients.map((r) => r.trim().toLowerCase()).filter(Boolean))];
  if (list.length < 1 || list.length > 10) throw new AppError("VALIDATION", "Send to between 1 and 10 people");
  if (!list.every((r) => z.email().safeParse(r).success)) throw new AppError("VALIDATION", "Enter valid email addresses");
  return list.sort();
}

export async function sendReport(
  user: { id: string; email: string },
  input: ReportParams & { recipients: string[]; previewHash: string },
): Promise<{ status: "ACCEPTED"; id: string }> {
  const recipients = normaliseRecipients(input.recipients);
  const account = await db.user.findUnique({ where: { id: user.id }, select: { emailVerified: true, email: true } });
  if (!account) throw new AppError("NOT_FOUND", "Account not found");
  if (!account.emailVerified && !(recipients.length === 1 && recipients[0] === account.email.toLowerCase())) {
    throw new AppError("VALIDATION", SELF_ONLY_MESSAGE);
  }
  const params: ReportParams = { start: input.start, end: input.end, envelopeIds: input.envelopeIds, includeNotes: input.includeNotes };
  // The same two functions as the preview route, so the email is byte-for-byte what was previewed.
  const html = renderReport(await buildReport(user.id, params), { senderEmail: user.email });
  // The person confirmed what they saw; if the data moved since, make them look again rather than send something else.
  if (htmlHash(html) !== input.previewHash) throw new AppError("VALIDATION", PREVIEW_STALE_MESSAGE);
  const contentHash = createHash("sha256").update(`${html}\n${recipients.join(",")}`).digest("hex");

  const reservationId = await db.$transaction(async (tx) => {
    await lockUser(tx, user.id); // two taps cannot both pass the checks below
    const now = Date.now();
    const recent = (ms: number) => ({ userId: user.id, sentAt: { gte: new Date(now - ms) } });
    if ((await tx.reportSend.count({ where: recent(60_000) })) >= PER_MINUTE) {
      throw new AppError("RATE_LIMIT", "You've sent a lot of reports. Try again in a few minutes.");
    }
    if ((await tx.reportSend.count({ where: recent(86_400_000) })) >= PER_DAY) {
      throw new AppError("RATE_LIMIT", "You've sent a lot of reports. Try again tomorrow.");
    }
    const duplicate = await tx.reportSend.findFirst({
      where: {
        userId: user.id,
        contentHash,
        OR: [
          { status: "ACCEPTED", sentAt: { gte: new Date(now - DUPLICATE_WINDOW_MIN * 60_000) } },
          { status: "FAILED", error: IN_FLIGHT, resendId: null, sentAt: { gte: new Date(now - IN_FLIGHT_WINDOW_MIN * 60_000) } },
        ],
      },
      select: { id: true },
    });
    if (duplicate) throw new AppError("DUPLICATE", "This exact report was already sent to these people a few minutes ago.");
    const row = await tx.reportSend.create({
      data: {
        userId: user.id,
        rangeStart: isoToDbDate(params.start),
        rangeEnd: isoToDbDate(params.end),
        envelopeIds: params.envelopeIds,
        includeNotes: params.includeNotes,
        recipients,
        contentHash,
        status: "FAILED",
        error: IN_FLIGHT,
      },
      select: { id: true },
    });
    return row.id;
  }, TX_OPTIONS);

  // Network call outside the transaction: the lock is never held while waiting on the provider.
  try {
    const { id } = await sendEmail({
      to: recipients,
      subject: `PocketPlan report · ${formatRange(params.start, params.end)}`,
      html,
      // One key per attempt: a deliberate resend after the duplicate window must really send (Resend keeps keys 24 h).
      idempotencyKey: reservationId,
    });
    await db.reportSend.update({ where: { id: reservationId, userId: user.id }, data: { status: "ACCEPTED", resendId: id, error: null } });
    return { status: "ACCEPTED", id };
  } catch (e) {
    const failure = e instanceof AppError ? e : new AppError("EMAIL_FAILED", "Could not reach the email provider. Try again.");
    if (!(e instanceof AppError)) console.error(e);
    await db.reportSend.update({
      where: { id: reservationId, userId: user.id },
      data: { status: "FAILED", error: failure.message.slice(0, 500) },
    });
    throw failure;
  }
}

/** Newest first; bounded. */
export async function listReportSends(userId: string, limit = 10): Promise<ReportSendView[]> {
  const rows = await db.reportSend.findMany({
    where: { userId },
    orderBy: { sentAt: "desc" },
    take: Math.min(Math.max(limit, 1), 50),
  });
  return rows.map((r) => ({
    id: r.id,
    sentAt: r.sentAt.toISOString(),
    start: dbDateToIso(r.rangeStart),
    end: dbDateToIso(r.rangeEnd),
    recipientCount: r.recipients.length,
    status: r.status,
    error: r.error,
  }));
}
