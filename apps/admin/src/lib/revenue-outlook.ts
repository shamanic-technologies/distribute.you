/**
 * THE SaaS BUSINESS IN THREE FIGURES — billing-service's fleet revenue read, parsed
 * and made readable. Nothing here computes money: every amount is billing's.
 *
 *  1. RECURRING — DRR / MRR / ARR. An org counts when it is postpaid with a
 *     chargeable card, or prepaid with auto top-up AND a chargeable card. Its DRR is
 *     the daily budget of its PROACTIVE campaigns (daily entry legs) that are
 *     running and still have people to contact. Reactive campaigns never count.
 *  2. ONE-OFF — a prepaid org without auto top-up (or without a card) spends what it
 *     holds and stops. Not MRR. Billing states what is left and when it runs out.
 *  3. CASH — when money lands in the bank, a different question from revenue:
 *     postpaid pays after it spends, prepaid before. Billing's charge schedule,
 *     summed per week.
 *
 * Vocabularies (class, reason, cash state) are read as PLAIN STRINGS: billing owns
 * them and may widen them, and a reader that closes the set would throw the whole
 * page the day it does. An unknown token is rendered verbatim.
 *
 * `null` is "billing could not measure this" (a sibling read failed, a burn was
 * unmeasurable) and is rendered as such, never as $0.
 *
 * Alias-free on purpose (zod only), so it carries real unit tests.
 */
import { z } from "zod";

const cents = z.string();
const nullableCents = z.string().nullable();

const OneOffSchema = z.object({
  remainingCents: cents,
  dailyPaceCents: nullableCents,
  runOutAt: z.string().nullable(),
  runOutUnknownReason: z.string().nullable(),
});

const ProjectionSchema = z.object({
  horizonDays: z.number(),
  recurringCents: nullableCents,
  oneOffCents: nullableCents,
  totalCents: nullableCents,
});

const CashEventSchema = z.object({
  at: z.string(),
  trigger: z.string().nullable().optional(),
  expectedAmountCents: nullableCents,
});

const FleetRowSchema = z.object({
  orgId: z.string(),
  paymentMode: z.string(),
  revenueClass: z.string(),
  classReason: z.string(),
  chargeableCard: z.boolean(),
  autoTopupEnabled: z.boolean(),
  balanceCents: cents,
  proactiveDailyBudgetCents: nullableCents,
  proactiveDailyBudgetUnknownReason: z.string().nullable(),
  drrCents: nullableCents,
  mrrCents: nullableCents,
  arrCents: nullableCents,
  oneOff: OneOffSchema.nullable(),
  projections: z.array(ProjectionSchema),
  cashState: z.string(),
  cashBlockedReason: z.string().nullable(),
  cashEvents: z.array(CashEventSchema),
});

const WindowSchema = z.object({
  horizonDays: z.number(),
  projectedRevenueCents: cents,
  recurringCents: cents,
  oneOffCents: cents,
  unknownOrgIds: z.array(z.string()),
  cashCents: cents,
  cashEventCount: z.number(),
  unknownAmountCashEventCount: z.number(),
});

const CashBucketSchema = z.object({
  start: z.string(),
  amountCents: cents,
  eventCount: z.number(),
  unknownAmountEventCount: z.number(),
});

export const FleetRevenueOutlookSchema = z.object({
  asOf: z.string(),
  cashHorizonDays: z.number(),
  accountCount: z.number(),
  classCounts: z.record(z.string(), z.number()),
  totals: z.object({
    drrCents: cents,
    mrrCents: cents,
    arrCents: cents,
    drrUnknownOrgIds: z.array(z.string()),
    oneOffRemainingCents: cents,
    windows: z.array(WindowSchema),
  }),
  cashFlow: z.object({ byDay: z.array(CashBucketSchema), byWeek: z.array(CashBucketSchema) }),
  orgs: z.array(FleetRowSchema),
  unreadableOrgs: z.array(z.object({ orgId: z.string(), error: z.string() })),
});

export type FleetRevenueOutlook = z.infer<typeof FleetRevenueOutlookSchema>;
export type FleetRevenueRow = z.infer<typeof FleetRowSchema>;
export type FleetTotalWindow = z.infer<typeof WindowSchema>;
export type CashBucket = z.infer<typeof CashBucketSchema>;

export function parseFleetRevenueOutlook(raw: unknown): FleetRevenueOutlook {
  const parsed = FleetRevenueOutlookSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[revenue-outlook] billing fleet revenue: response shape mismatch", parsed.error.issues);
    throw new Error("Billing revenue read: response shape mismatch");
  }
  return parsed.data;
}

/** Billing's cents (a decimal string) in USD. `null` stays null: unmeasured, not zero. */
export function centsToUsd(c: string | null): number | null {
  if (c === null) return null;
  const trimmed = c.trim();
  if (trimmed === "") throw new Error("Billing revenue read: blank cents value");
  const n = Number(trimmed);
  if (!Number.isFinite(n)) throw new Error(`Billing revenue read: not a number: ${c}`);
  return n / 100;
}

export function windowFor(outlook: FleetRevenueOutlook, days: number): FleetTotalWindow | null {
  return outlook.totals.windows.find((w) => w.horizonDays === days) ?? null;
}

export function projectionFor(row: FleetRevenueRow, days: number) {
  return row.projections.find((p) => p.horizonDays === days) ?? null;
}

const CLASS_LABEL: Record<string, string> = {
  recurring: "Recurring",
  one_off: "One-off",
  none: "Nothing expected",
};

export function classLabel(c: string): string {
  return CLASS_LABEL[c] ?? c;
}

const REASON_SENTENCE: Record<string, string> = {
  postpaid_chargeable_card: "Postpaid, card on file",
  prepaid_auto_topup: "Prepaid, auto top-up on",
  prepaid_no_auto_topup: "Prepaid, no auto top-up: spends what it holds",
  prepaid_no_chargeable_card: "Prepaid, no chargeable card: spends what it holds",
  postpaid_no_chargeable_card: "Postpaid with no chargeable card: campaigns are stopped",
  prepaid_balance_spent: "Prepaid, balance spent",
  postpaid_idle: "Postpaid, card on file, nothing spending",
  prepaid_auto_topup_idle: "Prepaid, auto top-up on, nothing spending",
  postpaid_charge_retries_exhausted: "Postpaid, card refused: retries exhausted",
};

export function classReasonSentence(reason: string): string {
  return REASON_SENTENCE[reason] ?? reason;
}

const UNKNOWN_SENTENCE: Record<string, string> = {
  campaign_recurrence_unknown: "a campaign's state could not be read",
  no_proactive_spend: "no daily campaign is spending",
};

/** Why billing could not state a figure. Unknown tokens verbatim, never blank. */
export function unknownReasonSentence(reason: string | null): string {
  if (reason === null) return "not measured";
  return UNKNOWN_SENTENCE[reason] ?? reason.replace(/_/g, " ");
}

export function paymentModeLabel(mode: string): string {
  if (mode === "prepaid") return "Prepaid";
  if (mode === "postpaid") return "Postpaid";
  return mode;
}

/**
 * A row carries something worth reading: recurring money, money left to spend,
 * cash expected, or a figure billing could not measure. Everything else is an org
 * with nothing in play today, counted but not listed.
 */
export function rowHasSomething(row: FleetRevenueRow): boolean {
  if (row.revenueClass === "recurring") return true;
  if (row.oneOff !== null) return true;
  if (row.cashEvents.length > 0) return true;
  if (row.drrCents === null || row.proactiveDailyBudgetCents === null) return true;
  return false;
}

const CLASS_ORDER: Record<string, number> = { recurring: 0, one_off: 1, none: 2 };

/** Recurring first (largest MRR first), then one-off (most left first), then the rest. */
export function orderedRows(outlook: FleetRevenueOutlook): FleetRevenueRow[] {
  const money = (r: FleetRevenueRow) =>
    r.revenueClass === "one_off" ? centsToUsd(r.oneOff?.remainingCents ?? null) ?? 0 : centsToUsd(r.mrrCents) ?? 0;
  return outlook.orgs
    .filter(rowHasSomething)
    .sort((a, b) => {
      const ca = CLASS_ORDER[a.revenueClass] ?? 3;
      const cb = CLASS_ORDER[b.revenueClass] ?? 3;
      if (ca !== cb) return ca - cb;
      const d = money(b) - money(a);
      return d !== 0 ? d : a.orgId.localeCompare(b.orgId);
    });
}

/** The first expected charge with a date, and its amount (null = amount not measurable). */
export function nextCashEvent(row: FleetRevenueRow) {
  const sorted = [...row.cashEvents].sort((a, b) => a.at.localeCompare(b.at));
  return sorted[0] ?? null;
}

/**
 * Proves the served totals are the sum of the served rows (billing's own promise).
 * Rows are compared in whole cents so billing's 10-decimal strings do not trip it.
 * A mismatch is STATED on the page, never absorbed.
 */
export function mrrReconciles(outlook: FleetRevenueOutlook): boolean {
  const toCents = (c: string) => Math.round(Number(c));
  const sum = outlook.orgs.reduce((s, r) => (r.mrrCents === null ? s : s + toCents(r.mrrCents)), 0);
  return Math.abs(sum - toCents(outlook.totals.mrrCents)) <= outlook.orgs.length;
}
