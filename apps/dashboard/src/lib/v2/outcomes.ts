/**
 * OUTCOMES (owner 2026-10-10): a step a RUNNING campaign produces (Leads found, Website
 * visits, Positive replies, Meetings booked...). The sidebar lists one entry per step the
 * selected offer's ON campaigns land on; its page lists the items that reached it, each
 * read from the service that serves them. Nothing is counted or listed here.
 *
 * Alias-free so it carries real unit tests.
 */
import { canonicalStepKey } from "../step-marks";
import { LEAD_FOUND_STEP } from "../outbound-leg-key";
import type { LeadBucket } from "../leads-server-page";

/** Where an outcome's items are served. */
export type OutcomeItems =
  /** The people in one of lead-service's engagement buckets. */
  | { kind: "people"; bucket: LeadBucket }
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

/** lead-service's bucket for each step it files people under. */
const BUCKET_FOR_STEP: Record<string, LeadBucket> = {
  conversation: "positive_reply",
  website_visit: "website_visit",
  meeting_booked: "meeting_booked",
  meeting_attended: "meeting_attended",
  signup: "signup",
  form_submitted: "form_submission",
  paid_client: "sale",
};

const PLURAL: Record<string, string> = {
  [LEAD_FOUND_STEP]: "Leads found",
  conversation: "Positive replies",
  website_visit: "Website visits",
  meeting_booked: "Meetings booked",
  meeting_attended: "Meetings attended",
  signup: "Signups",
  form_submitted: "Form submissions",
  paid_client: "Paid clients",
  posts: "Posts",
};

/** The step a publishing campaign produces: what it posts. */
export const POSTS_STEP = "posts";

/** A publishing channel (`organic-linkedin-publishing`): its outcome is the posts themselves. */
export function isPublishingChannel(featureSlug: string | null | undefined): boolean {
  return !!featureSlug && /-publishing$/.test(featureSlug);
}

/** The outcome one campaign produces: the step its leg lands on. Null for a campaign with no known leg. */
export function outcomeOf(
  featureSlug: string | null | undefined,
  toKey: string | null | undefined,
  toLabel?: string | null,
): Outcome | null {
  if (isPublishingChannel(featureSlug)) return { key: POSTS_STEP, label: PLURAL[POSTS_STEP], items: { kind: "posts" } };
  if (!toKey) return null;
  const key = canonicalStepKey(toKey);
  const bucket = BUCKET_FOR_STEP[key];
  const items: OutcomeItems = bucket
    ? { kind: "people", bucket }
    : key === LEAD_FOUND_STEP
      ? { kind: "leads-found" }
      : { kind: "unavailable" };
  return { key, label: PLURAL[key] ?? toLabel ?? key, items };
}

/** One entry per step, in the order the campaigns come (the sidebar's campaign order). */
export function outcomesOf(
  campaigns: readonly { featureSlug: string | null | undefined; toKey: string | null | undefined; toLabel?: string | null }[],
): Outcome[] {
  const seen = new Map<string, Outcome>();
  for (const c of campaigns) {
    const o = outcomeOf(c.featureSlug, c.toKey, c.toLabel);
    if (o && !seen.has(o.key)) seen.set(o.key, o);
  }
  return [...seen.values()];
}
