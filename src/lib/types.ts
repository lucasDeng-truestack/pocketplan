/** Integer sen. Never a float. */
export type Sen = number;
/** "YYYY-MM-DD" in Asia/Kuala_Lumpur. */
export type ISODate = string;

export type ErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "INSUFFICIENT"
  | "ARCHIVED"
  | "RATE_LIMIT"
  | "DUPLICATE"
  | "EMAIL_FAILED"
  | "UNAUTHORIZED";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; message: string };

export const ENVELOPE_COLOURS = [
  "#E07A5F",
  "#F2CC8F",
  "#81B29A",
  "#3D405B",
  "#6A994E",
  "#BC4749",
  "#8E7DBE",
  "#4A90A4",
] as const;
export type EnvelopeColour = (typeof ENVELOPE_COLOURS)[number];
/** Icon keys an envelope may carry (rendered with Lucide in components/ui/envelopeIcons). Stored as text; never rename a key. */
export const ENVELOPE_ICONS = [
  "utensils",
  "shopping-cart",
  "coffee",
  "car",
  "fuel",
  "bus",
  "home",
  "zap",
  "wifi",
  "smartphone",
  "receipt",
  "heart-pulse",
  "shield",
  "graduation-cap",
  "baby",
  "paw-print",
  "shirt",
  "gift",
  "film",
  "gamepad",
  "dumbbell",
  "plane",
  "piggy-bank",
  "landmark",
] as const;
export type EnvelopeIcon = (typeof ENVELOPE_ICONS)[number];

export type TransactionType = "INCOME" | "EXPENSE" | "REFUND" | "TRANSFER";

export type EnvelopeView = {
  id: string;
  name: string;
  colour: string | null;
  icon: EnvelopeIcon | null;
  targetSen: Sen | null;
  sortOrder: number;
  archivedAt: string | null;
  balanceSen: Sen;
};

export type Balances = {
  totalSen: Sen;
  unallocatedSen: Sen;
  envelopes: Record<string, Sen>;
};

export type TransactionView = {
  id: string;
  type: TransactionType;
  amountSen: Sen;
  envelopeId: string | null;
  fromEnvelopeId: string | null;
  toEnvelopeId: string | null;
  refundOfId: string | null;
  occurredOn: ISODate;
  merchant: string | null;
  note: string | null;
  voidedAt: string | null;
  /** Sum of non-voided refunds against this expense; 0 for other types. */
  refundedSen: Sen;
  /** This row replaces correctsId (the original was voided in the same transaction). */
  correctsId: string | null;
  /** Id of the non-voided row that corrects this one, else null. */
  correctedById: string | null;
  /** Recorded from this recurring item. */
  recurringId: string | null;
};

export type ReportParams = {
  start: ISODate;
  end: ISODate;
  envelopeIds: string[];
  includeNotes: boolean;
};

export type ReportRow = {
  envelopeId: string | null;
  name: string;
  colour: string | null;
  openingSen: Sen;
  allocatedInSen: Sen;
  movedOutSen: Sen;
  spentSen: Sen;
  refundsSen: Sen;
  closingSen: Sen;
  targetSen: Sen | null;
};

export type ReportData = {
  params: ReportParams;
  generatedAt: string;
  rows: ReportRow[];
  unallocated: ReportRow;
  total: ReportRow;
  /** null unless includeNotes */
  transactions: TransactionView[] | null;
};

// ---- preferences ----

export const THEMES = ["modern", "premium", "retro", "pixel"] as const;
export type ThemeName = (typeof THEMES)[number];
export const COLOR_MODES = ["system", "light", "dark"] as const;
export type ColorMode = (typeof COLOR_MODES)[number];
export type Preferences = { theme: ThemeName; mode: ColorMode };

// ---- recurring ----

export type RecurringCadence = "WEEKLY" | "MONTHLY";
export type RecurringView = {
  id: string;
  kind: "INCOME" | "EXPENSE";
  amountSen: Sen;
  envelopeId: string | null;
  merchant: string | null;
  note: string | null;
  cadence: RecurringCadence;
  startOn: ISODate;
  /** occurrenceDate(startOn, cadence, handledCount) */
  nextDueOn: ISODate;
  /** Occurrences dated on or before today, capped at 12. */
  dueCount: number;
  pausedAt: string | null;
};

// ---- insights ----

export type HealthBand = "healthy" | "watch" | "atRisk";
export type HealthPartKey = "runway" | "envelopesAtRisk" | "buffer" | "spendVsIncome";
/** score: integer 0–25 */
export type HealthPart = { key: HealthPartKey; label: string; score: number; detail: string };
/** score: integer 0–100. Bands: healthy >= 75, watch 50–74, atRisk < 50. */
export type HealthScore = { score: number; band: HealthBand; parts: HealthPart[] };

/** week = Monday of this week to today; month = 1st of this month to today; year = last 12 calendar months incl. this one. */
export type DashboardRange = "week" | "month" | "year";
/** One point per day (week, month) or per month (year, dated the month's last day or today). */
export type CashFlowPoint = { date: ISODate; cumulativeNetSen: Sen };
export type EnvelopeInsight = {
  envelopeId: string;
  name: string;
  colour: string | null;
  balanceSen: Sen;
  targetSen: Sen | null;
  spent30Sen: Sen;
  /** null = no spending in the last 30 days */
  daysLeft: number | null;
  atRisk: boolean;
};
export type DashboardData = {
  range: DashboardRange;
  start: ISODate;
  end: ISODate;
  balances: Balances;
  health: HealthScore | null;
  /** Score as of 30 days ago, for "▲ 4 this month"; null when not computable. */
  healthLastMonth: number | null;
  /** For the range. outSen = expenses − refunds; netFlowSen = inSen − outSen. */
  netFlowSen: Sen;
  inSen: Sen;
  outSen: Sen;
  cashFlow: CashFlowPoint[];
  /** For the range, descending, only envelopes with spentSen > 0. */
  spentByEnvelope: { envelopeId: string; name: string; colour: string | null; spentSen: Sen }[];
  /** For the range: spending with no envelope (it came out of Unallocated), expenses − refunds. */
  unassignedSpentSen: Sen;
  /** Active envelopes in sortOrder. */
  envelopes: EnvelopeInsight[];
  /** Not paused, nextDueOn <= today + 7, soonest first. */
  due: RecurringView[];
  /** 5 newest transactions, voided included. */
  recent: TransactionView[];
};

export type InsightsView = "spending" | "income" | "cashflow";
export type EnvelopesInsights = {
  view: InsightsView;
  /** 12 calendar months, oldest first; sen = spent (expenses − refunds), income, or net, per view. */
  months: { month: string; label: string; sen: Sen }[];
  thisMonthSen: Sen;
  /** vs last month, rounded integer percent; null when last month is 0. */
  changePct: number | null;
  /** Spending per active envelope this month, descending. */
  movement: { envelopeId: string; name: string; colour: string | null; thisMonthSen: Sen; changePct: number | null }[];
  /** Weekday with the highest average spending over the last 90 days; 0 = Monday. */
  priciestWeekday: { weekday: number; avgSen: Sen } | null;
  /** Non-voided expenses under 2000 sen this month. */
  smallSpends: { countThisMonth: number; sumSen: Sen };
};
export type EnvelopeGrid = {
  /** 8 weeks Monday–Sunday, oldest first; the last one contains today. */
  weeks: { start: ISODate; end: ISODate; label: string }[];
  /** Active envelopes in sortOrder; spentSen per week (expenses − refunds). */
  rows: { envelopeId: string; name: string; colour: string | null; targetSen: Sen | null; spentSen: Sen[] }[];
};

/** /insights?month=YYYY-MM[&envelope=id]. Spent = non-voided expenses − refunds. */
export type MonthInsights = {
  /** "YYYY-MM"; never after the current month */
  month: string;
  /** "November 2026" */
  label: string;
  start: ISODate;
  /** min(last day of month, today) */
  end: ISODate;
  spentSen: Sen;
  incomeSen: Sen;
  netSen: Sen;
  compare: {
    lastMonthSpentSen: Sen;
    /** average spent of the 3 months before this one (integer sen, rounded) */
    avg3SpentSen: Sen;
    /** vs last month, rounded integer percent; null when last month is 0 */
    changePct: number | null;
    /** vs avg3; null when avg3 is 0 */
    vsAvg3Pct: number | null;
  };
  /** One entry per day start..end. */
  daily: { date: ISODate; spentSen: Sen }[];
  /** Envelopes with spending this month, last month, or a target (archived included only when they have spending); spentSen desc. */
  /** This month's spending with no envelope (it came out of Unallocated), expenses − refunds. */
  unassignedSpentSen: Sen;
  byEnvelope: {
    envelopeId: string;
    name: string;
    colour: string | null;
    targetSen: Sen | null;
    spentSen: Sen;
    lastMonthSen: Sen;
    avg3Sen: Sen;
    changePct: number | null;
  }[];
  /** Up to 10 largest non-voided expenses in the month, amount desc. */
  topExpenses: TransactionView[];
  /** Up to 5 merchants by spending (grouped case-insensitively, trimmed; expenses without merchant excluded). */
  topMerchants: { merchant: string; spentSen: Sen; count: number }[];
  /** Present when ?envelope= is a user-owned envelope. */
  envelope: null | {
    envelopeId: string;
    name: string;
    colour: string | null;
    targetSen: Sen | null;
    balanceSen: Sen;
    spentSen: Sen;
    /** 6 months ending with this month, oldest first */
    sixMonths: { month: string; label: string; sen: Sen }[];
    /** Up to 50 newest non-voided expenses in this envelope this month. */
    expenses: TransactionView[];
  };
};
