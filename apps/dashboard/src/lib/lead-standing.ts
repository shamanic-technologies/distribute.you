/**
 * WHERE A PERSON STANDS on the campaign they were served under — the answer
 * lead-service serves, mirrored here value for value.
 *
 * "Is this person still a live prospect" is COMMERCIAL POLICY, and it used to be
 * decided in three independent places: this app derived it per lead from the reply
 * signals, features-service counted an aggregate for the campaign's stat card, and
 * instantly-service froze a coarse classification at write time that fed both. That
 * split has already produced a customer-visible contradiction — a referral read as
 * buying interest on one surface and not on the other, for months (instantly-service
 * #649). lead-service is the only service holding BOTH halves (the delivery evidence
 * it joins onto the membership row, and the hand-stated step statements it owns), so
 * it authors the policy now and everything else RENDERS it.
 *
 * It is FUNNEL-AWARE, which is the half this app could never have got right. A
 * campaign selling `form_magnet` sells `visit -> form -> paid`, so somebody landing on
 * the site has reached the step it sells; a campaign selling meetings off a
 * conversation prices a positive REPLY, and the same person visiting the site has done
 * something that campaign does not price. The grain is `(lead, campaign)`, so one
 * person can legitimately stand at `sales_interest` under one campaign and `engaged`
 * under another — which is what is true, and what a reply-signal rule here read as one
 * answer for both.
 *
 * This file holds the VOCABULARY and nothing else. Where each state lands on the board
 * is `lead-board.ts`; the Zod that keeps it off the wire's critical path is `api.ts`.
 *
 * Alias-free on purpose so it carries real unit tests. Keep it that way.
 */

/**
 * The seven states lead-service serves.
 *
 * Typed as a union for the reader's sake, but a consumer must NOT assume the set is
 * closed: lead-service owns it and can widen it before this app ships. Every switch
 * over it carries a default, and the Zod schema reads a plain string, so a state added
 * upstream renders as "we cannot place this" rather than throwing the whole parse.
 *
 *  - `unresolved`    — a signal could not be resolved and is stated as such rather than
 *                      defaulted. Read `reason`.
 *  - `not_contacted` — never written to.
 *  - `contacted`     — written to, nothing since.
 *  - `engaged`       — something happened that is not the step this campaign sells.
 *  - `sales_interest`— they reached the step this campaign's funnel is entered by, or a
 *                      later step of it.
 *  - `customer`      — the funnel's last step (the sale) is reached.
 *  - `opted_out`     — the prospect asked us to stop. Their own act, and legally
 *                      binding, which is why it is a STATE of its own rather than a
 *                      shade of `disqualified`: the board draws it apart, with its own
 *                      copy and its own confirmation on the way out.
 *  - `disqualified`  — a commercial judgement of ours, which we may revisit: bounced,
 *                      wrong person, left the role, or somebody stated they never will.
 */
export type LeadStandingState =
  | "unresolved"
  | "not_contacted"
  | "contacted"
  | "engaged"
  | "sales_interest"
  | "customer"
  | "opted_out"
  | "disqualified";

/**
 * Which single piece of evidence decided the state.
 *
 * The board reads exactly one of these — `unsubscribed` — and it reads it to tell an
 * opt-out apart from every other way of being disqualified, because those two are not
 * the same kind of fact (see `LEAD_BOARD_COLUMNS`). Everything else on the board reads
 * `state` alone.
 */
export type LeadStandingSignal =
  | "none"
  | "not_served"
  | "contacted"
  | "open"
  | "click"
  | "reply"
  | "negative_reply"
  | "positive_reply"
  | "measured_visit"
  | "stated_outcome"
  | "stated_never"
  | "bounced"
  | "unsubscribed";

/** Why the state is `unresolved`, and null for every other state. Never a default. */
export type LeadStandingUnresolvedReason =
  | "delivery_not_queried"
  | "campaign_service_unavailable"
  | "campaign_unknown"
  | "funnel_unstated"
  | "statements_unreadable";

/**
 * Who said it: `stated` = a person (or the website tracker), `implied` = the campaign's
 * funnel implies it from another statement, `measured` = the delivery layer measured it.
 */
export type LeadStandingOrigin = "stated" | "implied" | "measured";

/**
 * The served object, required-and-nullable field for field.
 *
 * Every field is REQUIRED on the wire and most are nullable, so they are spelled
 * `T | null` rather than optional: `.optional()` would accept a body that omits one and
 * reject the null the producer means to send, which is the wrong half of the contract.
 * The object itself is optional in `Lead` — see there.
 */
export interface LeadStanding {
  state: LeadStandingState;
  signal: LeadStandingSignal;
  origin: LeadStandingOrigin | null;
  reason: LeadStandingUnresolvedReason | null;
  /** The sales funnel this campaign sells, as campaign-service states it. */
  funnelKey: string | null;
  /** The step somebody takes to get ONTO this campaign's funnel. */
  entryStep: string | null;
  /** Which signal that entry step is read off. */
  entryMeasure: "delivery_click" | "positive_reply" | null;
  /**
   * Whether this person got onto the campaign's funnel. Answered separately from
   * `state` because both can be true at once: somebody who clicked and then
   * unsubscribed reached the entry step AND is disqualified. null — never false — when
   * the signal for it cannot be resolved (every ads-led funnel, for one).
   */
  reachedEntryStep: boolean | null;
  /** The deepest step of this campaign's funnel known reached, or null. */
  deepestStep: string | null;
  /** When the deciding statement was made, when a statement decided the state. */
  at: string | null;
}
