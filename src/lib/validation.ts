import * as z from "zod";
import { addDays, isISODate, todayKL } from "./dates";
import { MAX_SEN } from "./money";
import { COLOR_MODES, ENVELOPE_COLOURS, ENVELOPE_ICONS, THEMES } from "./types";

// ---- envelopes ----

export const envelopeNameSchema = z
  .string()
  .trim()
  .min(1, "Give the envelope a name")
  .max(40, "Keep it under 40 characters");
export const envelopeColourSchema = z.enum(ENVELOPE_COLOURS).nullable();
export const envelopeIconSchema = z.enum(ENVELOPE_ICONS).nullable();
/** Postgres Int column: anything above this fails in the database, so reject it at the boundary. */
export { MAX_SEN };
export const senSchema = z.number().int().positive().max(MAX_SEN, "That amount is too large");
export const targetSenSchema = senSchema.nullable();
export const createEnvelopeSchema = z.object({
  name: envelopeNameSchema,
  colour: envelopeColourSchema.default(null),
  icon: envelopeIconSchema.default(null),
  targetSen: targetSenSchema.default(null),
});
export const updateEnvelopeSchema = z.object({
  id: z.string().min(1),
  name: envelopeNameSchema.optional(),
  colour: envelopeColourSchema.optional(),
  icon: envelopeIconSchema.optional(),
  targetSen: targetSenSchema.optional(),
});
export const reorderEnvelopesSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(1000) });
export const envelopeIdSchema = z.object({ id: z.string().min(1) });

// ---- ledger ----

export const isoDateSchema = z.string().refine(isISODate, "Enter a valid date");
/** Date of a new entry: no future dates (filters keep plain isoDateSchema). */
export const entryDateSchema = isoDateSchema.refine((d) => d <= todayKL(), "Pick today or an earlier date");
export const noteSchema = z.string().trim().max(140, "Keep it under 140 characters").optional();
export const merchantSchema = z.string().trim().max(140, "Keep it under 140 characters").optional();
const idSchema = z.string().min(1);

export const recordIncomeSchema = z.object({ amountSen: senSchema, occurredOn: entryDateSchema, note: noteSchema });
export const recordExpenseSchema = z.object({
  amountSen: senSchema,
  /** omitted = no envelope: the expense comes out of Unallocated */
  envelopeId: idSchema.optional(),
  occurredOn: entryDateSchema,
  merchant: merchantSchema,
  note: noteSchema,
});
export const allocateSchema = z.object({
  items: z.array(z.object({ envelopeId: idSchema, amountSen: senSchema })).min(1).max(100),
  occurredOn: entryDateSchema,
});
export const transferSchema = z
  .object({
    fromEnvelopeId: idSchema.nullable(),
    toEnvelopeId: idSchema.nullable(),
    amountSen: senSchema,
    occurredOn: entryDateSchema,
    note: noteSchema,
  })
  .refine((t) => t.fromEnvelopeId !== t.toEnvelopeId, "Choose two different envelopes");
export const recordRefundSchema = z.object({
  expenseId: idSchema,
  amountSen: senSchema,
  occurredOn: entryDateSchema,
  note: noteSchema,
});
export const transactionIdSchema = z.object({ id: idSchema });
export const undoSplitSchema = z.object({ batchId: z.string().uuid() });
/** moveToEnvelopeId null = the balance goes to Unallocated. */
export const deleteEnvelopeSchema = z.object({ id: idSchema, moveToEnvelopeId: idSchema.nullable() });
export const listTransactionsSchema = z
  .object({
    type: z.enum(["INCOME", "EXPENSE", "REFUND", "TRANSFER"]).optional(),
    envelopeId: idSchema.optional(),
    start: isoDateSchema.optional(),
    end: isoDateSchema.optional(),
    cursor: idSchema.optional(),
    /** Search: merchant/note contains, or an exact amount when it parses as money. */
    q: z.string().trim().min(1).max(60).optional(),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .refine((f) => !f.start || !f.end || f.start <= f.end, "The start date must be on or before the end date");

export const correctTransactionSchema = z.object({
  id: idSchema,
  amountSen: senSchema,
  occurredOn: entryDateSchema,
  /** EXPENSE only; undefined keeps the envelope, null moves it to Unallocated */
  envelopeId: idSchema.nullable().optional(),
  /** TRANSFER only; null = Unallocated */
  fromEnvelopeId: idSchema.nullable().optional(),
  toEnvelopeId: idSchema.nullable().optional(),
  merchant: merchantSchema,
  note: noteSchema,
});

// ---- recurring ----

export const createRecurringSchema = z
  .object({
    kind: z.enum(["INCOME", "EXPENSE"]),
    amountSen: senSchema,
    envelopeId: idSchema.optional(),
    merchant: merchantSchema,
    note: noteSchema,
    cadence: z.enum(["WEEKLY", "MONTHLY"]),
    // Bounded so resume's skip-ahead loop stays small.
    startOn: isoDateSchema.refine((d) => d >= addDays(todayKL(), -366) && d <= addDays(todayKL(), 366), "Pick a start date within a year of today"),
  });
export const updateRecurringSchema = z.object({
  id: idSchema,
  amountSen: senSchema,
  /** EXPENSE only; undefined keeps the envelope, null = none (comes out of Unallocated) */
  envelopeId: idSchema.nullable().optional(),
  merchant: merchantSchema,
  note: noteSchema,
});
export const recurringIdSchema = z.object({ id: idSchema });
export const recurringOccurrenceSchema = z.object({ id: idSchema, dueOn: isoDateSchema, amountSen: senSchema.optional() });

// ---- insights ----

/** "YYYY-MM", not after the current month (Kuala Lumpur). */
export const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pick a month")
  .refine((m) => m <= todayKL().slice(0, 7), "Pick this month or an earlier one");
export const monthInsightsSchema = z.object({ month: monthSchema, envelopeId: idSchema.optional() });

// ---- preferences ----

export const preferencesSchema = z.object({ theme: z.enum(THEMES), mode: z.enum(COLOR_MODES) });

// ---- reports ----

const DAY_MS = 86_400_000;
const reportFields = {
  start: isoDateSchema,
  end: isoDateSchema,
  envelopeIds: z
    .array(idSchema)
    .min(1, "Choose at least one envelope")
    .max(50, "Choose up to 50 envelopes")
    .refine((ids) => new Set(ids).size === ids.length, "Each envelope can appear only once"),
  includeNotes: z.boolean(),
};
const startOnOrBeforeEnd = (r: { start: string; end: string }) => r.start <= r.end;
const withinAYear = (r: { start: string; end: string }) => (Date.parse(r.end) - Date.parse(r.start)) / DAY_MS <= 366;
const RANGE_ORDER = "The start date must be on or before the end date";
const RANGE_LENGTH = "Choose a range of a year or less";

export const reportParamsSchema = z.object(reportFields).refine(startOnOrBeforeEnd, RANGE_ORDER).refine(withinAYear, RANGE_LENGTH);
export const recipientSchema = z.string().trim().toLowerCase().pipe(z.email("Enter valid email addresses"));
/** Unverified accounts may only send reports to themselves. */
export const SELF_ONLY_MESSAGE = "Verify your email to send reports to other people. For now you can send them to yourself.";
/** Shown when the report changed between preview and send; the client then shows a fresh preview. */
export const PREVIEW_STALE_MESSAGE = "Your data changed since the preview. Preview again before sending.";
export const sendReportSchema = z
  .object({
    ...reportFields,
    recipients: z.array(recipientSchema).min(1, "Add at least one recipient").max(10, "Send to 10 people or fewer"),
    /** sha256 hex of the preview HTML the person looked at (X-Report-Hash). */
    previewHash: z.string().regex(/^[0-9a-f]{64}$/, "Preview the report before sending"),
  })
  .refine(startOnOrBeforeEnd, RANGE_ORDER)
  .refine(withinAYear, RANGE_LENGTH);
