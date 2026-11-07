/**
 * OUTCOMES (owner 2026-10-10): a step a RUNNING campaign produces (Leads, Website
 * visits, Positive replies, Meetings booked...). The sidebar lists one entry per step the
 * brand's ON campaigns land on; its page lists the items that reached it, each
 * read from the service that serves them. Nothing is counted or listed here, and no step
 * is named here: its plural is features-service's `pluralLabel` (owner 2026-10-15).
 *
 * Alias-free so it carries real unit tests.
 */
import { canonicalStepKey } from "../step-marks";
import { EMAIL_SENT_STEP, LEAD_FOUND_STEP } from "../outbound-leg-key";
import { stepPluralLabel, type LegCatalogue } from "../legs";

/** Where an outcome's items are served. */
export type OutcomeItems =
  /**
   * The people who reached the step: lead-service's Unibox filtered on `reachedStep` = `step` (the
   * catalogue key, never mapped), and crm-service's every-source list keyed on its own `crmStep` token.
   */
  | { kind: "people"; step: string; crmStep: string }
  /** The people a source found, per list (human-service lists, the Targeting Lists tab). */
  | { kind: "leads-found" }
  /** The brand's LinkedIn posts (social-service, a staff read today). */
  | { kind: "posts" }
  /** No service serves this step's items yet: the page says so, nothing is guessed. */
  | { kind: "unavailable" };

export interface Outcome {
  /** The producer's step key, canonical (`conversation`, `website_visit`, `lead_found`). */
  key: string;
  /** The step in the plural, as the sidebar reads it ("Positive replies"). */
  label: string;
  items: OutcomeItems;
}

/** crm-service's outcome token for each step it states people for (`/orgs/people/outcomes`). */
const CRM_STEP_FOR_STEP: Record<string, string> = {
  conversation: "positive_reply",
  website_visit: "website_visit",
  meeting_booked: "meeting_booked",
  meeting_attended: "meeting_attended",
  signup: "signup",
  form_submitted: "form_submission",
  paid_client: "sale",
  booking_call: "booking_call",
  // A paying client's positive message, judged by crm-service (CLIENT-SATISFIED-1107).
  client_satisfied: "client_satisfied",
};

/** A publishing campaign's outcome is its posts: not a catalogue step, so it is named here. */
const POSTS_LABEL = "Posts";

/**
 * The steps from the most advanced (a satisfied paid client) to the least (a lead found): the
 * Outcomes list reads in this order (owner 2026-10-12). A step not listed goes last.
 */
const DEPTH: readonly string[] = [
  // A paying client who wrote the brand something positive: past the sale (CLIENT-SATISFIED-1107).
  "client_satisfied",
  "paid_client",
  "meeting_attended",
  "meeting_booked",
  "signup",
  "form_submitted",
  "booking_call",
  "conversation",
  "website_visit",
  LEAD_FOUND_STEP,
  "posts",
];

/** Outcomes sorted most advanced first; steps of equal rank keep their order. */
export function byDepth<T extends { outcome: Outcome }>(list: readonly T[]): T[] {
  const rank = (key: string) => {
    const i = DEPTH.indexOf(key);
    return i === -1 ? DEPTH.length : i;
  };
  return [...list].sort((a, b) => rank(a.outcome.key) - rank(b.outcome.key));
}

/** The step a publishing campaign produces: what it posts. */
export const POSTS_STEP = "posts";

/** A publishing channel (`organic-linkedin-publishing`): its outcome is the posts themselves. */
export function isPublishingChannel(featureSlug: string | null | undefined): boolean {
  return !!featureSlug && /-publishing$/.test(featureSlug);
}

/** The catalogue's steps, as `outcomeOf` reads them (the served singular and plural). */
export type OutcomeSteps = Pick<LegCatalogue, "steps">;

/**
 * The outcome one campaign produces: the step its leg lands on, named by the catalogue's
 * served plural. Null for a campaign with no known leg.
 */
export function outcomeOf(
  catalogue: OutcomeSteps,
  featureSlug: string | null | undefined,
  toKey: string | null | undefined,
  toLabel?: string | null,
): Outcome | null {
  if (isPublishingChannel(featureSlug)) return { key: POSTS_STEP, label: POSTS_LABEL, items: { kind: "posts" } };
  if (!toKey) return null;
  const key = canonicalStepKey(toKey);
  const crmStep = CRM_STEP_FOR_STEP[key];
  const items: OutcomeItems = crmStep
    ? { kind: "people", step: key, crmStep }
    : key === LEAD_FOUND_STEP
      ? { kind: "leads-found" }
      : { kind: "unavailable" };
  const singular = toLabel ?? catalogue.steps.get(key)?.label ?? key;
  return { key, label: stepPluralLabel(catalogue, key, singular), items };
}

/** The outcome a crm-service outcome token names. Null for a token no step maps to. */
export function outcomeOfCrmStep(catalogue: OutcomeSteps, crmStep: string): Outcome | null {
  const key = Object.keys(CRM_STEP_FOR_STEP).find((k) => CRM_STEP_FOR_STEP[k] === crmStep);
  return key ? outcomeOf(catalogue, null, key) : null;
}

/** One entry per step, in the order the campaigns come (the sidebar's campaign order). */
export function outcomesOf(
  catalogue: OutcomeSteps,
  campaigns: readonly { featureSlug: string | null | undefined; toKey: string | null | undefined; toLabel?: string | null }[],
): Outcome[] {
  const seen = new Map<string, Outcome>();
  for (const c of campaigns) {
    const o = outcomeOf(catalogue, c.featureSlug, c.toKey, c.toLabel);
    if (o && !seen.has(o.key)) seen.set(o.key, o);
  }
  return [...seen.values()];
}

/**
 * The catalogue step whose reached-people count says "contacted by us" for an outcome: its own step
 * for a people outcome, the first email for Leads (a lead found we wrote to). Null = nobody to count.
 */
export function reachedStepOf(outcome: Outcome): string | null {
  if (outcome.items.kind === "people") return outcome.items.step;
  if (outcome.items.kind === "leads-found") return EMAIL_SENT_STEP;
  return null;
}
