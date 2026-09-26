// Which acquisition channels a customer may FUND.
//
// features-service publishes every channel the agency SELLS; campaign-service runs a
// campaign for a closed set of them. This is that set, and nothing else: which legs a
// channel performs is the published catalogue's answer (`lib/legs.ts`), and what the
// brand funds a campaign at is billing's (`lib/campaign-budget.ts`).
//
// Alias-free on purpose, so it carries real unit tests.

/**
 * The channels a customer may FUND today.
 *
 * A MIRROR of the set campaign-service will provision a campaign for, and it is
 * deliberately narrower than the catalogue. features-service publishes 33
 * channels and marks every one of them bookable, which is a statement about what
 * the agency SELLS; campaign-service provisions a campaign for a closed set of
 * them, which is a statement about what currently RUNS. Offering to fund one
 * outside that set takes a customer's ceiling and produces no campaign at all:
 * nothing errors, nothing is charged, and the channel simply never does
 * anything, which is worse than not offering it.
 *
 * This is NOT the hand-written catalogue this module used to filter. That one
 * decided which channels EXIST, so it went stale the moment the producer
 * published a new one and hid it from every surface. This decides only which are
 * FUNDABLE: a channel outside it still resolves, still carries its name and its
 * mark, and still names a campaign that already runs on it. The two questions
 * were conflated before, which is why one stale list could do so much damage.
 *
 * It is a mirror, so it is temporary by construction: the day campaign-service
 * states which features it can provision, this reads that instead and the list
 * goes. Until then, adding a slug here without adding it there offers a dead
 * channel, and adding it there without adding it here hides a live one.
 *
 * GOOGLE ADS IS DELIBERATELY ABSENT, and the reason is one hop further out than
 * this mirror can see. Everything a Google Ads campaign needs to be created now
 * exists: google-service wraps the Ads API and declares the spend as the org's
 * cost, features-service publishes the channel, billing states its floor, and
 * campaign-service provisions and schedules the campaign. What does not exist is
 * a WORKFLOW for it, and prod holds 553 for cold email against zero here. So a
 * customer funding it would get a campaign that is provisioned, scheduled, and
 * then produces nothing forever, which is the precise failure this whole gate
 * exists to prevent: being able to provision a campaign is not being able to RUN
 * one. Add the slug when a workflow answers for it, not before.
 *
 * `ai-meeting-booking` is that same test answered the other way, and both are worth
 * keeping here: the two channels differ in exactly the one thing this list is about.
 * Everything else was equally true of Google Ads on the day it was left out.
 */
export const PROVISIONABLE_CHANNEL_SLUGS: ReadonlySet<string> = new Set([
  "sales-cold-email-outreach",
  "sales-crm-email-outreach",
  "feedback-request-cold-email-outreach",
  // The one channel here that converts an INTERNAL leg rather than putting a lead
  // onto a step from nothing: it answers a prospect who already replied and turns
  // that into a booked meeting. It passes the test Google Ads above fails — prod
  // holds an active workflow for it, and campaign-service provisions its funded
  // campaigns — which is why it is here and that one is not.
  "ai-meeting-booking",
  // The first EARNED channel: a journalist asks a question on Featured, the brand's
  // expert answers it, and the placement carries a link back — so its one leg puts a
  // lead onto a website visit from nothing, exactly as a paid click does. It is
  // here on the same evidence as the four above and nothing weaker: prod holds EIGHT
  // active workflow dynasties for it, and campaign-service reads it as a channel whose
  // ceiling is billing's (v0.72.2) — so a campaign on it is gated, paced and held by
  // the money rather than by the per-campaign budget columns nothing enforces. Note the
  // SUPERSEDED spelling `pr-expert-quote-opportunities` is deliberately absent —
  // features-service states it is superseded by this one, so offering both would sell
  // one channel twice.
  //
  // ⚠️ MONEY STARTS NOTHING, and that is true of every slug in this set rather than of
  // this one. campaign-service deleted auto-provisioning on 2026-09-06 (the customer
  // owns a campaign's status), so funding a campaign here does NOT bring a campaign into
  // being: it states the ceiling the campaign will be paced on once a person creates
  // it. The only creators are onboarding's terminal launch and the staff console.
  //
  // ⚠️ Being FUNDABLE is not being able to PRODUCE today: the vendor's programmatic
  // feed (Featured's premium questions, the only one carrying a submittable question
  // id) answers `403 Business subscription required` while that plan is lapsed, so a
  // funded campaign provisions, schedules and finds nothing to pitch. That is a
  // commercial gate nobody here can read, and it is deliberately NOT modelled as a
  // slug removal: the channel is sold, its workflows exist, and the subscription is
  // renewed outside this repo.
  "pr-expert-quote-outreach",
]);

/**
 * Whether funding this channel actually produces a campaign.
 *
 * campaign-service runs a funded campaign when the channel has an active workflow
 * to run OR when the CUSTOMER operates it — the legs we do not automate are worked at
 * their side, so there is no DAG and there must not be one. It states neither fact to
 * this app, so the two halves are answered differently on purpose:
 *
 *   - customer-operated is read off the WIRE, so a ninth such channel published
 *     upstream is fundable here with no change;
 *   - platform-operated stays on the list above, which is this app's proxy for "does
 *     it have a workflow", the one thing nothing publishes. It is temporary by
 *     construction: the day campaign-service states what it can provision, both
 *     halves read that and the list goes.
 *
 * Funding a channel nothing provisions states a ceiling and produces no campaign, which is
 * worse than not offering it: nothing errors and nothing ever runs.
 */
export function channelIsFundable(channel: {
  featureSlug: string;
  operatedBy?: string | null;
}): boolean {
  if (channel.operatedBy === "customer") return true;
  return PROVISIONABLE_CHANNEL_SLUGS.has(channel.featureSlug);
}
