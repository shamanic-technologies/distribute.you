/**
 * Rules shared by the brand walk's launch (`components/v2/get-started/launch.ts`) and
 * the "New organization" modal (`components/v2/new-organization-modal.tsx`): the
 * channel and legs a new brand starts on, the org-name prefill, the six offer levers.
 * Alias-free so they carry real unit tests; nothing here reads the network.
 */

import { OUTBOUND_LEG_TO_CONVERSATION, OUTBOUND_LEG_TO_WEBSITE_VISIT } from "../outbound-leg-key";

/** The two things a new brand can ask us for, and the acquisition channel that buys them. */
export const NEW_ORG_CHANNEL_SLUG = "sales-cold-email-outreach";

// The NEW outbound spelling (owner 2026-10-09); every backend accepts it.
export type NewOrgLegKey = typeof OUTBOUND_LEG_TO_WEBSITE_VISIT | typeof OUTBOUND_LEG_TO_CONVERSATION;

export interface NewOrgLeg {
  key: NewOrgLegKey;
  /** What the customer asks for, in their words. */
  label: string;
  /** Singular / plural outcome noun, for "$4 per website visit" and "10 website visits a day". */
  unit: string;
  unitPlural: string;
  /** How many of this outcome a day the RECOMMENDED budget buys. */
  recommendedPerDay: number;
}

export const NEW_ORG_LEGS: readonly NewOrgLeg[] = [
  {
    key: OUTBOUND_LEG_TO_WEBSITE_VISIT,
    label: "Website visits",
    unit: "website visit",
    unitPlural: "website visits",
    recommendedPerDay: 10,
  },
  {
    key: OUTBOUND_LEG_TO_CONVERSATION,
    label: "Positive replies",
    unit: "positive reply",
    unitPlural: "positive replies",
    recommendedPerDay: 1,
  },
] as const;

export function newOrgLeg(key: NewOrgLegKey): NewOrgLeg {
  const leg = NEW_ORG_LEGS.find((l) => l.key === key);
  if (!leg) throw new Error(`[new-org] unknown leg ${key}`);
  return leg;
}

/**
 * The org name we prefill: the person's own name, with " (2)", " (3)"... when
 * an org of theirs already carries it. Compared case-insensitively and trimmed,
 * because "Kevin Lourd" and "kevin lourd " read as the same org in a switcher.
 */
export function suggestOrgName(personName: string | null | undefined, existingOrgNames: readonly string[]): string {
  const base = (personName ?? "").trim() || "My organization";
  const taken = new Set(existingOrgNames.map((n) => n.trim().toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base} (${i})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${base} (${existingOrgNames.length + 1})`;
}

/**
 * The recommended daily budget, in WHOLE dollars (a daily budget is a whole-dollar
 * config value everywhere in the dashboard): enough to buy the leg's recommended
 * daily count at the best workflow's price, never below the channel's floor.
 * `null` when we hold no price: a recommendation invented without one is worse than
 * none, and the field then opens empty.
 */
export function recommendedDailyBudgetUsd(
  leg: NewOrgLeg,
  costPerOutcomeUsd: number | null,
  channelFloorUsd: number,
): number | null {
  if (costPerOutcomeUsd == null || !Number.isFinite(costPerOutcomeUsd) || costPerOutcomeUsd <= 0) return null;
  const raw = Math.ceil(leg.recommendedPerDay * costPerOutcomeUsd);
  return Math.max(raw, Math.ceil(channelFloorUsd));
}

export type LeverKey = "dreamOutcome" | "perceivedLikelihood" | "socialProof" | "riskReversal" | "urgency" | "scarcity";

/** The six Hormozi levers, in the order they are asked, with the question each answers. */
export const LEVER_QUESTIONS: ReadonlyArray<{ key: LeverKey; label: string; hint: string; list: boolean }> = [
  { key: "dreamOutcome", label: "Dream outcome", hint: "What your customer gets, in their words.", list: false },
  { key: "perceivedLikelihood", label: "Why it works", hint: "What makes them believe it will work for them.", list: false },
  { key: "socialProof", label: "Proof", hint: "Clients, results and testimonials, one per line.", list: true },
  { key: "riskReversal", label: "Guarantee", hint: "What happens if it does not work.", list: false },
  { key: "urgency", label: "Why now", hint: "Why they should start this week.", list: false },
  { key: "scarcity", label: "Why it is limited", hint: "What is capped: seats, slots, a deadline.", list: false },
];
