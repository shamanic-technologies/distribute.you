"use client";

import type { ReactNode } from "react";
import { ScoreCard } from "@/components/visibility/score-card";
import { LearningTag } from "@/components/learning-tag";
import { isLearning, LEARNING_NOTE } from "@/lib/learning-threshold";
import { outcomeStepFor, stepsFor } from "@/lib/goal-steps";
import type { SalesFunnelKeyWire } from "@/lib/sales-funnels";
import { formatUsdAdaptive } from "@/lib/format-number";
import { formatRoi } from "@/lib/format-roi";
import type { BrandOptimizationGoal } from "@/lib/api";
import type { CostEconomics, Spend } from "@/lib/revenue-view";

function formatCount(n: number): string {
  return Number(n).toLocaleString("en-US");
}

function formatPct(pct: number | null | undefined): string {
  return pct == null ? "—" : `${Math.round(pct)}%`;
}

/**
 * A share of the contacted base, as the producer served it (0-100).
 *
 * One decimal under 10% because the interesting shares live there — 0.1% and 0.9% are
 * different answers about a campaign and both round to "0%" — and whole numbers above,
 * where a decimal is noise. Same adaptive shape as `formatUsdAdaptive` / `formatRoi`.
 */
function formatSharePct(pct: number): string {
  const decimals = pct < 10 ? 1 : 0;
  return `${pct.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;
}

function formatUsd(usd: number | null | undefined): string {
  return usd == null ? "—" : formatUsdAdaptive(usd);
}

/**
 * The four money cards a BRAND is judged on: what the outreach produced, what it
 * cost to produce one customer, and what the two divide into.
 *
 * They are deliberately the same words the staff Campaigns table already uses for
 * the same four numbers, so a brand and its campaigns cannot describe one result
 * two ways.
 */
const ECONOMICS_INFO = {
  pipeline:
    "Expected pipeline revenue: the outcomes produced so far, valued with the conversion rates and customer lifetime revenue set in Brand Settings. It is a projection of what this pipeline is worth, not money already collected.",
  roi: "What a customer is worth over their lifetime, divided by what it costs to win one. 11.7× means every $1 spent is projected to return $11.70.",
  cacUsd:
    "What winning one customer costs, in dollars: the money already billed divided by the customers this pipeline is expected to produce.",
  cacPct:
    "What winning a customer costs, as a share of what that customer is worth over their lifetime. 9% means $9 spent for every $100 earned. Lower is better, and it is the inverse of ROI.",
} as const;

// Render a server-computed cost metric (USD cents) verbatim. features-service is
// the single source — the dashboard no longer divides spend by a unit count in
// the browser (that diverged from the displayed Total spent). Null cents (no
// usable denominator / spend basis) → "—", never a false $0.
function formatCostCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  // <$10 → cents ($X.XX), ≥$10 → whole dollars ($X). Dashboard-wide rule.
  const usd = cents / 100;
  const decimals = Math.abs(usd) < 10 ? 2 : 0;
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

/**
 * Shared closing sentence for every cost-per-outcome tooltip on this row.
 *
 * At zero outcomes features-service no longer returns null: it floors the aggregate to
 * `max(committed net spend, the expected cost from the brand's best model)` — the SAME
 * cascade it already applies to each audience, lifted to the brand/campaign aggregate.
 * So the card shows the Strategy page's expected price until the brand has outspent it,
 * and only then reports the spend. One constant so the three tooltips cannot drift into
 * describing two different rules.
 */
const EXPECTED_COST_NOTE =
  "Until the first one lands it shows what it is expected to cost, or your spend so far once that is higher.";

// Each card is a fixed-min-width flex item so the whole set stays on ONE strict
// row (CLAUDE.md "wide legit content scrolls internally" → overflow-x-auto on
// mobile rather than wrapping to multiple rows).
function Cell({ children }: { children: ReactNode }) {
  return <div className="flex-1 min-w-[120px]">{children}</div>;
}

/**
 * Top-of-page outreach stat cards, shared across every brand- and campaign-scoped
 * surface (one source → no drift, CLAUDE.md "keep surfaces in lockstep").
 *
 * Cards: Outreach / Clicks / CPC, regardless of the brand's optimization goal.
 *
 * The goal's TERMINAL outcome pair (Sales Meetings/CPSM, Signups/CPS, Form
 * submissions/CPFS, Sales/CP Sale) is deliberately NOT here. It depended on the
 * brand's conversion tracker, so for a brand that never set one up it rendered a
 * "set this up" CTA in place of both values — a pair of cards stating nothing but
 * a chore. The reply-terminal funnel keeps its Sales Interests pair, which is
 * inbox-sourced and always has a real value.
 *
 * The COUNTS derive from already-fetched featureStats; the COST metrics (CPC /
 * CPS / CPSM) are read VERBATIM from the features-service `/revenue` `spend`
 * block — the dashboard no longer divides spend by a unit count (that diverged
 * from the displayed Total spent). `spend` is absent on entity pages that carry
 * no `/revenue` payload → the cost cards render "—". Static-shell-first: labels
 * paint instantly, values skeleton until `pending` clears.
 */
export function OutreachStatCards({
  stats,
  spend,
  pending,
  optimizationGoal,
  funnelKey,
  outreachOverride,
  contactedOverride,
  signalSharePct,
  outreachLabel = "Outreach",
  economics,
  totalPipelineUsd,
  showEconomics = false,
  economicsLearning = false,
  showFunnelMetrics = true,
  showOutreach = true,
}: {
  stats: Record<string, number>;
  /**
   * features-service `/revenue` spend block — the single source for the CPC /
   * CPS / CPSM cost cards (rendered verbatim). Absent/null on a page with no
   * `/revenue` payload (entity pages) or a cold payload → cost cards show "—".
   */
  spend?: Spend | null;
  pending: boolean;
  optimizationGoal?: BrandOptimizationGoal;
  /**
   * The SALES FUNNEL this surface is scoped to, when it is scoped to one.
   *
   * A campaign sells exactly one funnel and states which on its own row, so it passes
   * this and the funnel decides which steps appear. The goal cannot: `reply_meeting` and
   * `visit_meeting` both answer to `sales_meetings`, so a goal-keyed row prints "Website
   * Visits / Cost per website visit" on a campaign whose funnel starts at a positive
   * reply — the wrong funnel's steps under the campaign's own name.
   *
   * Absent on a brand-level surface (a brand runs several funnels at once, so no single
   * funnel's steps describe it) and on a pre-funnel campaign → the goal keys the row exactly as
   * before.
   */
  funnelKey?: SalesFunnelKeyWire | null;
  /**
   * When set, the Outreach count comes from this value (the brand Overview passes
   * the number of `contacted` leads on the SAME `/revenue` payload the table +
   * graph read, so all three move together). Absent → the legacy
   * `/stats`-sourced count (entity pages that don't fetch `/revenue`).
   */
  outreachOverride?: number | null;
  /**
   * What the first card is CALLED, because two surfaces count two different things
   * under it and the word has to say which.
   *
   * The brand Overview counts email SEQUENCES sent (undeduped by lead, so it tracks
   * the spend beside it) and keeps "Outreach". The Leads page counts the PEOPLE its
   * tabs can reach — one row per lead however many follow-ups they received — so it
   * says "Contacted". Prod, one brand, one moment: 9,915 against 7,895. Neither is
   * wrong; printing both under one word is.
   */
  outreachLabel?: string;
  /**
   * DISTINCT leads this scope contacted — `funnelSteps.contactedRecipients`, the base
   * the funnel's first rung converts from.
   *
   * When present the row states TWO outreach cards, because a lead is contacted once and
   * outreached several times: "Leads contacted" (people) then `outreachLabel` (actions).
   * Printing one number under one word was the whole reason the two grains kept reading
   * as one broken figure. Absent → the single card, exactly as before.
   */
  contactedOverride?: number | null;
  /**
   * What share of the contacted leads reached the funnel's FIRST rung, SERVED as
   * `funnelSteps.steps[0].conversionFromPreviousPct` (0-100).
   *
   * Rendered as the sales-interest card's subtitle. Read verbatim: dividing the two
   * counts in the browser is the compute-a-stat-in-the-browser bug, and it would drift
   * from the producer the moment either side changed scope. Null is "we could not
   * measure this" (either side unmeasured, or a base of 0) → no subtitle, never a 0%.
   */
  signalSharePct?: number | null;
  /**
   * features-service `/revenue` `costEconomics` block — the money cards (ROI,
   * $ CAC, % CAC), rendered verbatim. Absent on a surface that carries no
   * `/revenue` payload → those cards render "—".
   */
  economics?: CostEconomics | null;
  /** `/revenue` `headline.totalPipelineUsd` — the Pipeline revenue card. */
  totalPipelineUsd?: number | null;
  /** Render the four money cards (Pipeline revenue / ROI / $ CAC / % CAC). */
  showEconomics?: boolean;
  /**
   * Whether this scope's RATIOS rest on too little evidence to state — every campaign
   * selling it is still learning.
   *
   * It gates ROI, $ CAC and % CAC and NOT Pipeline revenue: the first three divide by the
   * outcome count, so at a low count they are decided by whichever outcome landed, while a
   * total simply GROWS with each one — a thin scope has a small pipeline, not an unreliable
   * one.
   */
  economicsLearning?: boolean;
  /**
   * Whether to render the FUNNEL-specific pairs (Website Visits + cost per visit,
   * and the goal's outcome pair). A brand runs several sales funnels at once, so
   * at brand level those name one funnel's steps while the row above them sums
   * every funnel — the money cards are the honest brand-level statement. A
   * campaign sells exactly ONE funnel, so it keeps them.
   */
  showFunnelMetrics?: boolean;
  /**
   * Whether to state the OUTREACH count.
   *
   * True everywhere a scope has one. A SALES FUNNEL does not: outreach is what a
   * channel does, counted per channel and per brand, and a funnel carrying several
   * channels has no outreach of its own to state. A zero there would read as "nobody
   * was contacted", which is false.
   */
  showOutreach?: boolean;
}) {
  // No default goal. The brand one is retired — `NOT NULL` with a server default, so it
  // reads "website purchases" for a brand that stated nothing — and defaulting to it put
  // a funnel's steps on a surface that never named one. Absent goal AND absent funnel
  // means the step helpers return the Outreach floor and no funnel pair renders.
  const goal = optimizationGoal ?? null;
  // Which steps this row states, keyed on the FUNNEL when the surface is scoped to one and
  // on the goal otherwise. Every pair below is decided from this list rather than from a
  // `goal === "x"` test, so a funnel that does not buy a click cannot be given the
  // Website-Visits pair (the reply→meeting funnel is exactly that case).
  const steps = stepsFor(goal, funnelKey);
  const hasStep = (key: string) => steps.some((s) => s.key === key);
  // The goal's downstream OUTCOME step (Signups / Sales Meetings / Form submissions /
  // Sales), or null for a 1-step goal whose outcome IS its signal. goal-steps.ts is
  // the single source, so form_submissions/website_purchase/sales no longer borrow the
  // Signups/Sales-Meetings surfaces (the "half-wired goal" trap).
  const outcomeStep = outcomeStepFor(goal, funnelKey);
  // A reply that is the TERMINAL step (the `positive_replies` goal: reply → paid). Clicks /
  // website visits aren't in that funnel, and there is no downstream outcome step, so the
  // outcome pair becomes Sales Interests + Cost per sales interest — the ONLY outcome pair
  // this row still states, because it is inbox-sourced and never needs a conversion tracker.
  const isPositiveReplies = hasStep("positive_replies") && outcomeStep === null;
  const outreach =
    outreachOverride ?? stats.leadsContacted ?? stats.recipientsContacted ?? 0;
  const clicks = stats.recipientsClicked ?? 0;

  const clickMetric = {
    label: "Website Visits",
    tooltip:
      "Number of visits on your website via a click in the link shared in the conversation with the lead.",
    value: formatCount(clicks),
    costLabel: "Cost per website visit",
    costTooltip: `Cost per website visit: committed spend (billed plus reserved for scheduled follow-ups) divided by website visits. It can dip when a reserved follow-up sends or gets cancelled. ${EXPECTED_COST_NOTE}`,
    // Committed CPC (= actual + provisioned / clicks). Prefer the new `totalCpcCents`,
    // fall back to the legacy `cpcCents` until features-service lands. Server-provided
    // either way — no client division, including the zero-click case where the server
    // floors it to the expected cost per visit rather than returning null.
    costValue: formatCostCents(spend?.totalCpcCents ?? spend?.cpcCents),
    // Too few visits behind the ratio to state it as a price — the count card beside
    // this one still shows the real number, so nothing is hidden.
    costLearning: isLearning(clicks),
  };

  // The Website Visits pair renders only when a click onto the site is actually on the
  // funnel. It is for the reply→meeting funnel, whose first step is a positive reply.
  const showVisitPair = hasStep("website_visits");
  // The reply pair as a MID-funnel signal, beside its own outcome below: the reply→meeting
  // funnel (reply → meeting booked) and the combined `sales` goal (which wins a paying
  // client via EITHER the visit→paid or the reply→paid path, so it shows both signals).
  // Reply attribution is inbox-sourced, so no conversion-tracker CTA.
  const showReplyPair = hasStep("positive_replies") && !isPositiveReplies;

  // The ONE outcome pair this row states. positive_replies is a 1-step goal (its outcome
  // step is null) but the reply IS the outcome — Sales Interests + Cost per sales interest,
  // attributed from the inbox, so it always carries a real value.
  //
  // A goal whose terminal outcome is TRACKER-sourced (Sales Meetings, Signups, Form
  // submissions, Sales) states NO pair here: without a live tracker both cards showed a
  // "set this up" CTA instead of a value, which is a chore wearing the shape of a metric.
  const outcomeCard: {
    label: string;
    countValue: string;
    /** Small grey line under the count (the sales-interest share of contacted). */
    countSubtitle?: string;
    costLabel: string;
    costTooltip: string;
    costValue: string;
    /** Fewer than the bar's worth of this outcome → the cost reads `Learning`. */
    costLearning: boolean;
  } | null = isPositiveReplies
    ? {
        label: "Sales Interests",
        countValue:
          spend?.positiveRepliesCount != null
            ? formatCount(spend.positiveRepliesCount)
            : "—",
        countSubtitle:
          signalSharePct != null ? `${formatSharePct(signalSharePct)} of contacted` : undefined,
        costLabel: "Cost per sales interest",
        costTooltip: `Cost per sales interest: committed spend divided by the real sales interests attributed to your outreach. ${EXPECTED_COST_NOTE}`,
        // features-service owns the zero-reply case: it floors the aggregate to
        // max(committed net spend, the expected cost from the brand's best model), the same
        // cascade it applies per audience, so this card and the Strategy page print ONE
        // price instead of restating "Total spent" under a second label.
        //
        // Rendered VERBATIM, with no client fallback to spend. That fallback (the old
        // `costSoFarFloorCents` call) is what produced "Cost per sales interest $29"
        // directly above "Total spent $29". features-service's projection read is
        // deliberately fail-soft: on a blip it returns null, meaning "we could not
        // estimate this" — and the honest render for that is "—", not the nearest real
        // number we happen to hold. Re-adding a spend fallback here reintroduces the bug
        // one layer down, on exactly the branch no fixture covers.
        costValue: formatCostCents(spend?.cpprCents),
        costLearning: isLearning(spend?.positiveRepliesCount),
      }
    : null;

  return (
    <div className="mb-6">
    <div className="flex flex-nowrap gap-3 overflow-x-auto">
      {/* People, then actions. A lead is contacted ONCE and outreached as many times as
          the sequence has steps, so the two grains are different numbers and each says
          which it is. The second card only explains itself when the first is beside it —
          alone, "Outreach" is the only figure on screen and needs no disambiguation. */}
      {showOutreach && contactedOverride != null && (
        <Cell>
          <ScoreCard
            label="Leads contacted"
            tooltip="Distinct people this campaign reached. Each one is counted once, however many emails they received."
            value={formatCount(contactedOverride)}
            pending={pending}
          />
        </Cell>
      )}
      {showOutreach && (
        <Cell>
          <ScoreCard
            label={outreachLabel}
            tooltip={
              contactedOverride != null
                ? "Email sequences sent. A lead can be outreached several times over their lifetime."
                : undefined
            }
            value={formatCount(outreach)}
            pending={pending}
          />
        </Cell>
      )}
      {/* The brand-level money cards. A brand sells through SEVERAL sales funnels at
          once, so the only figures that describe the whole brand are what the pipeline
          is worth and what it cost — the per-funnel step counts beside them would each
          name one funnel while the row sums them all.

          Every value is read VERBATIM off features-service; there is no browser math
          here. `$ CAC` rides `costPerAcquisitionUsd` — the field served on the DEFAULT
          un-lensed read (the Overview is the whole brand, every funnel), NOT the
          lens-only `costPerConversionUsd`, which is absent here and left the card on a
          dash. The two are equal for the same scope by construction. */}
      {showEconomics && (
        <>
          <Cell>
            <ScoreCard
              label="Pipeline revenue"
              tooltip={ECONOMICS_INFO.pipeline}
              value={formatUsd(totalPipelineUsd)}
              pending={pending}
            />
          </Cell>
          {/* The three RATIOS. They divide by the outcome count, so they move together
              and they state `Learning` together — Pipeline revenue above does not, being
              a total that grows with each outcome rather than a price decided by it. */}
          <Cell>
            <ScoreCard
              label="ROI"
              tooltip={economicsLearning ? LEARNING_NOTE : ECONOMICS_INFO.roi}
              value={formatRoi(economics?.roiMultiple)}
              action={economicsLearning ? <LearningTag withInfo={false} /> : undefined}
              pending={pending}
            />
          </Cell>
          <Cell>
            <ScoreCard
              label="$ CAC"
              tooltip={economicsLearning ? LEARNING_NOTE : ECONOMICS_INFO.cacUsd}
              value={formatUsd(economics?.costPerAcquisitionUsd)}
              action={economicsLearning ? <LearningTag withInfo={false} /> : undefined}
              pending={pending}
            />
          </Cell>
          <Cell>
            <ScoreCard
              label="% CAC"
              tooltip={economicsLearning ? LEARNING_NOTE : ECONOMICS_INFO.cacPct}
              value={formatPct(economics?.costOfAcquisitionPct)}
              action={economicsLearning ? <LearningTag withInfo={false} /> : undefined}
              pending={pending}
            />
          </Cell>
        </>
      )}

      {/* Only when a click onto the site is on the funnel. The `positive_replies` goal
          (reply→paid) and the reply→meeting FUNNEL both start at a reply, so neither
          buys a website visit and neither gets these two cards. */}
      {showFunnelMetrics && showVisitPair && (
        <>
          <Cell>
            <ScoreCard
              label={clickMetric.label}
              tooltip={clickMetric.tooltip}
              value={clickMetric.value}
              pending={pending}
            />
          </Cell>
          <Cell>
            <ScoreCard
              label={clickMetric.costLabel}
              tooltip={clickMetric.costLearning ? LEARNING_NOTE : clickMetric.costTooltip}
              value={clickMetric.costValue}
              action={clickMetric.costLearning ? <LearningTag withInfo={false} /> : undefined}
              pending={pending}
            />
          </Cell>
        </>
      )}

      {/* The reply as a mid-funnel signal, above its own outcome: the reply→meeting funnel
          (where it takes the slot the Website Visits pair holds on the website funnels),
          and the combined `sales` goal (which shows both signals).
          Inbox-sourced attribution → no conversion-tracker CTA. */}
      {showFunnelMetrics && showReplyPair && (
        <>
          <Cell>
            <ScoreCard
              label="Sales Interests"
              value={
                spend?.positiveRepliesCount != null
                  ? formatCount(spend.positiveRepliesCount)
                  : "—"
              }
              subtitle={
                signalSharePct != null ? `${formatSharePct(signalSharePct)} of contacted` : undefined
              }
              pending={pending}
            />
          </Cell>
          <Cell>
            <ScoreCard
              label="Cost per sales interest"
              tooltip={
                isLearning(spend?.positiveRepliesCount)
                  ? LEARNING_NOTE
                  : `Cost per sales interest: committed spend divided by the real sales interests attributed to your outreach. ${EXPECTED_COST_NOTE}`
              }
              value={formatCostCents(spend?.cpprCents)}
              action={
                isLearning(spend?.positiveRepliesCount) ? (
                  <LearningTag withInfo={false} />
                ) : undefined
              }
              pending={pending}
            />
          </Cell>
        </>
      )}

      {/* Outcome pair — the reply for positive_replies (its 1-step outcome), and nothing
          else. website_visits stays 1-step with no card (its outcome IS the Website Visits
          card above); a tracker-sourced outcome states no pair at all. */}
      {showFunnelMetrics && outcomeCard && (
        <>
          <Cell>
            <ScoreCard
              label={outcomeCard.label}
              value={outcomeCard.countValue}
              subtitle={outcomeCard.countSubtitle}
              pending={pending}
            />
          </Cell>
          <Cell>
            <ScoreCard
              label={outcomeCard.costLabel}
              tooltip={outcomeCard.costLearning ? LEARNING_NOTE : outcomeCard.costTooltip}
              value={outcomeCard.costValue}
              action={outcomeCard.costLearning ? <LearningTag withInfo={false} /> : undefined}
              pending={pending}
            />
          </Cell>
        </>
      )}
    </div>
    </div>
  );
}
