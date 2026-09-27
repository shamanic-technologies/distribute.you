/**
 * The "New organization" modal of dashboard v2: the rules it decides on, kept
 * alias-free so they carry real unit tests. The modal itself
 * (`components/v2/new-org-modal.tsx`) renders and calls the api; nothing here
 * reads the network.
 */

/** The two things a new brand can ask us for, and the acquisition channel that buys them. */
export const NEW_ORG_CHANNEL_SLUG = "sales-cold-email-outreach";

export type NewOrgLegKey = "start_to_website_visit" | "start_to_conversation";

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
    key: "start_to_website_visit",
    label: "Website visits",
    unit: "website visit",
    unitPlural: "website visits",
    recommendedPerDay: 10,
  },
  {
    key: "start_to_conversation",
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

/** The brand name we prefill for a brand with no website: "Kevin Lourd's brand". */
export function suggestNoWebsiteBrandName(personName: string | null | undefined): string {
  const name = (personName ?? "").trim();
  return name ? `${name}'s brand` : "My brand";
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

/** Prepaid amounts offered, in cents. */
export const PREPAID_PRESETS_CENTS = [5000, 20000, 50000] as const;
export const PREPAID_MIN_CENTS = 100;

export type PaymentMode = "prepaid" | "postpaid";

/**
 * Parse the custom prepaid amount a person typed. Returns cents, or a sentence
 * saying what is wrong. A blank field is its own answer (nothing chosen yet),
 * never zero: `Number("")` is 0 and would read as a valid free amount.
 */
export function parseCustomAmountCents(input: string): { cents: number } | { problem: string } | null {
  const trimmed = input.trim().replace(/^\$/, "");
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return { problem: "Enter an amount in dollars." };
  const cents = Math.round(n * 100);
  if (cents < PREPAID_MIN_CENTS) return { problem: "The minimum is $1." };
  return { cents };
}

/**
 * Whether the payment step may be skipped. Only while the org holds free credit it
 * can spend: an org whose first credit is still to come must fund its campaign,
 * or the campaign would be created and never run.
 */
export function canSkipPayment(spendableFreeCreditCents: number | null): boolean {
  return spendableFreeCreditCents != null && spendableFreeCreditCents > 0;
}

/** The modal's screens, in order. `offerPick` is skipped when one offer is detected. */
export const NEW_ORG_STEPS = [
  "org",
  "brand",
  "offerText",
  "offerPick",
  "audienceText",
  "audiencePick",
  "levers",
  "leg",
  "budget",
  "payment",
  "launching",
] as const;
export type NewOrgStep = (typeof NEW_ORG_STEPS)[number];

export function nextStep(step: NewOrgStep, ctx: { offerCount: number }): NewOrgStep {
  const i = NEW_ORG_STEPS.indexOf(step);
  const next = NEW_ORG_STEPS[i + 1];
  if (!next) return step;
  if (next === "offerPick" && ctx.offerCount <= 1) return NEW_ORG_STEPS[i + 2];
  return next;
}

export function previousStep(step: NewOrgStep, ctx: { offerCount: number }): NewOrgStep {
  const i = NEW_ORG_STEPS.indexOf(step);
  const prev = NEW_ORG_STEPS[i - 1];
  if (!prev) return step;
  if (prev === "offerPick" && ctx.offerCount <= 1) return NEW_ORG_STEPS[i - 2];
  return prev;
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
