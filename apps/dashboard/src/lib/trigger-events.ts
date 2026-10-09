import { campaignModeFor, type LegCatalogue, type TriggerDef } from "./legs";

/**
 * TRIGGER EVENTS under an offer's campaign rows (owner 2026-10-09): one line per trigger a
 * reactive campaign of the offer waits on, "Positive reply fired 12 · ran 9 · skipped 3
 * (campaign off) · since Oct 9". campaign-service records every occurrence and serves the
 * counts per trigger (`/v1/offers/:offerId/trigger-events/summary`); the trigger words and
 * icon are features-service's catalogue. The window is the WHOLE history (stats are since
 * inception, never 7 or 30 days): `recordedSince` dates it, before it nothing was recorded.
 *
 * Alias-free so it carries real unit tests.
 */

/** One trigger type's counts, as campaign-service serves them. */
export interface TriggerSummaryRow {
  triggerId: string | null;
  events: number;
  ran: number;
  skipped: number;
  pending: number;
  skippedByReason: ReadonlyArray<{ reason: string; count: number }>;
  lastOccurredAt: string | null;
}

/** One line under the campaign rows: the trigger and its served counts (null = no event yet: fired 0). */
export interface TriggerLine {
  trigger: TriggerDef;
  counts: TriggerSummaryRow | null;
}

/**
 * The triggers this table's campaigns wait on, in the catalogue's order: every trigger an
 * ON reactive campaign names (at zero when it has no event yet, never omitted), and every
 * trigger an OFF one names that did fire (its events read "skipped (campaign off)"). A
 * trigger no listed campaign names belongs to the other table (Sourcing vs Sales path).
 */
export function triggerLinesFor(
  campaigns: ReadonlyArray<{ featureSlug: string; legKey: string; on: boolean }>,
  catalogue: LegCatalogue,
  summary: ReadonlyArray<TriggerSummaryRow>,
): TriggerLine[] {
  const counts = new Map<string, TriggerSummaryRow>();
  for (const r of summary) if (r.triggerId) counts.set(r.triggerId, r);
  const waitedOn = new Set<string>();
  const named = new Set<string>();
  for (const c of campaigns) {
    const m = campaignModeFor(catalogue, c.featureSlug, c.legKey);
    if (m?.mode !== "reactive" || !m.trigger) continue;
    named.add(m.trigger.id);
    if (c.on) waitedOn.add(m.trigger.id);
  }
  const out: TriggerLine[] = [];
  for (const t of catalogue.triggers.values()) {
    const row = counts.get(t.id) ?? null;
    if (waitedOn.has(t.id) || (named.has(t.id) && row && row.events > 0)) out.push({ trigger: t, counts: row });
  }
  return out;
}

/** campaign-service's skip codes in plain words (a display lookup; the codes are the producer's). */
const SKIP_REASON_WORDS: Record<string, string> = {
  campaign_off: "campaign off",
  no_campaign: "no campaign",
  no_leg: "no step answers it",
  trigger_not_declared: "trigger retired",
  unfunded: "no funds",
  run_in_flight: "already running",
  cohort_run_in_flight: "a sibling campaign was running",
  no_workflow: "run by your team",
  global_sales_budget_reached: "daily budget reached",
  item_budget_reached: "campaign budget reached",
  budgets_unreadable: "budget could not be read",
  incomplete_campaign: "campaign incomplete",
  dispatch_refused: "start refused",
  failure_backoff: "waiting after failed runs",
  unknown: "no reason recorded",
};

/** A skip code in plain words; an unknown code is shown as is (`known: false`, the caller logs it), never dropped. */
export function skipReasonWords(code: string): { text: string; known: boolean } {
  const text = SKIP_REASON_WORDS[code];
  return text ? { text, known: true } : { text: code, known: false };
}

/** How many skip reasons a line names before "+N more". */
export const TOP_SKIP_REASONS = 2;

/**
 * The words in brackets after "skipped N": one reason alone ("campaign off"), several with
 * their served counts, the most frequent first as served ("campaign off 2, no funds 1").
 */
export function skipReasonsText(reasons: ReadonlyArray<{ reason: string; count: number }>): string | null {
  if (reasons.length === 0) return null;
  if (reasons.length === 1) return skipReasonWords(reasons[0].reason).text;
  const shown = reasons.slice(0, TOP_SKIP_REASONS).map((r) => `${skipReasonWords(r.reason).text} ${r.count}`);
  const more = reasons.length - TOP_SKIP_REASONS;
  return more > 0 ? `${shown.join(", ")}, +${more} more` : shown.join(", ");
}

/** "Oct 9" (this year) or "Oct 9, 2025": the day recording began. */
export function recordedSinceText(at: string, now: Date = new Date()): string {
  const d = new Date(at);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}
