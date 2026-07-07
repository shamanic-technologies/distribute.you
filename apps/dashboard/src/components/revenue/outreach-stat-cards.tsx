"use client";

import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { ScoreCard } from "@/components/visibility/score-card";
import { ConversionTrackerButton } from "@/components/revenue/conversion-tracker-button";
import { MaturityBadge } from "@/components/maturity-badge";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getBrandConversionToken } from "@/lib/api";
import { goalOutcomeStep } from "@/lib/goal-steps";
import type { BrandOptimizationGoal } from "@/lib/api";
import type { Spend } from "@/lib/revenue-view";

function formatCount(n: number): string {
  return Number(n).toLocaleString("en-US");
}

// Render a server-computed cost metric (USD cents) verbatim. features-service is
// the single source — the dashboard no longer divides spend by a unit count in
// the browser (that diverged from the displayed Total spent). Null cents (no
// usable denominator / spend basis) → "—", never a false $0.
function formatCostCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  const usd = cents / 100;
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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
 * GA cards (everyone): Outreach / Clicks / CPC, regardless of the
 * brand's optimization goal.
 * Beta cards (allowlist only — `useIsBetaUser`): the goal outcome pair
 * (Signups/CPS or Sales Meetings/CPSM), each badged `beta`.
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
  outreachOverride,
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
   * When set, the Outreach count comes from this value (the brand Overview passes
   * the number of `contacted` leads on the SAME `/revenue` payload the table +
   * graph read, so all three move together). Absent → the legacy
   * `/stats`-sourced count (entity pages that don't fetch `/revenue`).
   */
  outreachOverride?: number | null;
}) {
  const params = useParams();
  const orgId = params.orgId as string | undefined;
  const brandId = params.brandId as string | undefined;
  // Deep-link to the Conversion Tracking section of Brand Settings. The outcome
  // counts (Signups / Meetings) only populate once the client's site fires the
  // conversion snippet — so the beta cards carry a one-tap setup CTA. Built from
  // the route params (both cards render only on brand-scoped pages).
  const setupHref =
    orgId && brandId
      ? `/orgs/${orgId}/brands/${brandId}/settings#conversion-tracking`
      : null;

  // The conversion tracker's live status is server-owned (lead-service derives it
  // from received pings/events). Once the client's site fires its first ping the
  // tracker is proven alive (`live_waiting`) — or already receiving conversions
  // (`live`) — so the "Set up conversion tracker" CTA must STOP showing, otherwise
  // the stat cards nag "set up" while Brand Settings shows "Tracker live" (an
  // incoherent secondary surface). Same query key as the settings card → the
  // React Query cache is shared/deduped, no extra network. Gated on brandId.
  const { data: conversionToken } = useAuthQuery(
    ["brandConversionToken", brandId],
    () => getBrandConversionToken(brandId as string),
    { enabled: !!brandId },
  );
  const trackerLive =
    conversionToken?.status === "live" ||
    conversionToken?.status === "live_waiting";
  const goal = optimizationGoal ?? "sales_meetings";
  // positive_replies is a SINGLE-STEP goal (reply IS the outcome; reply → paid). Clicks /
  // website visits aren't in that funnel, so the Website Visits + Cost-per-visit cards are
  // hidden and the outcome pair becomes Positive Replies + Cost per positive reply (GA, no
  // beta badge — the goal itself is GA).
  const isPositiveReplies = goal === "positive_replies";
  const outreach =
    outreachOverride ?? stats.leadsContacted ?? stats.recipientsContacted ?? 0;
  const clicks = stats.recipientsClicked ?? 0;
  const beta = <MaturityBadge level="beta" />;

  // Until the client's site fires the conversion snippet, the outcome cards have
  // no value to show — so they render a discreet ghost button IN PLACE OF the
  // value (transparent, 1px border, near-black text) that deep-links to setup.
  // One shared button on every untracked outcome card, next to the metric it
  // unblocks. Only built when the brand-scoped href resolves AND the tracker is
  // not yet live — a live/live_waiting tracker no longer needs setup, so the
  // cards fall back to a plain "—" until the first conversion produces a value.
  const trackerButton =
    setupHref && !trackerLive ? <ConversionTrackerButton href={setupHref} /> : null;

  const clickMetric = {
    label: "Website Visits",
    tooltip:
      "Number of visits on your website via a click in the link shared in the conversation with the lead.",
    value: formatCount(clicks),
    costLabel: "Cost per website visit",
    costTooltip:
      "Cost per website visit: committed spend (billed plus reserved for scheduled follow-ups) divided by website visits. It can dip when a reserved follow-up sends or gets cancelled.",
    // Committed CPC (= actual + provisioned / clicks). Prefer the new `totalCpcCents`,
    // fall back to the legacy `cpcCents` until features-service lands. Server-provided
    // either way — no client division.
    costValue: formatCostCents(spend?.totalCpcCents ?? spend?.cpcCents),
  };

  // The goal's downstream OUTCOME step (Signups / Sales Meetings / Form submissions /
  // Purchases), or null for a 1-step goal whose outcome IS its signal. goal-steps.ts is
  // the single source, so form_submissions/purchase no longer borrow the Signups/
  // Sales-Meetings surfaces (the "half-wired goal" trap).
  const outcomeStep = goalOutcomeStep(goal);
  const outcome = outcomeStep?.outcome ?? null;
  // The outcome COUNT + its cost are REAL tracker values, server-provided by
  // features-service (sourced from the brand's live conversion tracker). `countField`/
  // `costField` are null when even the brand-level aggregate is not on the wire yet
  // (purchase) → the card renders "—" + the setup CTA. No projection, no client math.
  const outcomeCount =
    outcome?.countField != null ? spend?.[outcome.countField] : undefined;
  const outcomeCost = outcome?.costField != null ? spend?.[outcome.costField] : null;
  const outcomeCountValue = outcomeCount != null ? formatCount(outcomeCount) : "—";
  // Badge the outcome pair `beta` only while the GOAL itself is beta (purchase) — the
  // GA goals (signups/sales_meetings/form_submissions) show their outcome ungated.
  const goalIsBeta = goal === "purchase";

  // Unified outcome card. positive_replies is a 1-step goal (goalOutcomeStep is null) but
  // the reply IS the outcome — surface it as Positive Replies + Cost per positive reply
  // (GA, no badge, no conversion-tracker CTA: reply attribution is inbox-sourced, not the
  // site tracker). Every other multi-step goal uses its goal-steps outcome step verbatim.
  const outcomeCard: {
    label: string;
    countValue: string;
    costLabel: string;
    costTooltip: string;
    costValue: string;
    badge: ReactNode | undefined;
    showAction: boolean;
  } | null = isPositiveReplies
    ? {
        label: "Positive Replies",
        countValue:
          spend?.positiveRepliesCount != null
            ? formatCount(spend.positiveRepliesCount)
            : "—",
        costLabel: "Cost per positive reply",
        costTooltip:
          "Cost per positive reply: committed spend divided by the real positive replies attributed to your outreach.",
        costValue: formatCostCents(spend?.cpprCents),
        badge: undefined,
        showAction: false,
      }
    : outcomeStep && outcome
      ? {
          label: outcomeStep.label,
          countValue: outcomeCountValue,
          costLabel: outcome.costLabel,
          costTooltip: `Cost per ${outcomeStep.label.toLowerCase()}: committed spend divided by the real ${outcomeStep.label.toLowerCase()} your conversion tracker recorded.`,
          costValue: formatCostCents(outcomeCost),
          badge: goalIsBeta ? beta : undefined,
          showAction: true,
        }
      : null;

  return (
    <div className="mb-6">
    <div className="flex flex-nowrap gap-3 overflow-x-auto">
      <Cell>
        <ScoreCard
          label="Outreach"
          value={formatCount(outreach)}
          pending={pending}
        />
      </Cell>
      {/* positive_replies: reply→paid single-step — clicks/website visits aren't in the
          funnel, so hide the Website Visits count + Cost-per-visit cards entirely. */}
      {!isPositiveReplies && (
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
              tooltip={clickMetric.costTooltip}
              value={clickMetric.costValue}
              pending={pending}
            />
          </Cell>
        </>
      )}

      {/* Outcome pair — the goal's outcome step, or the reply for positive_replies (its
          1-step outcome). website_visits stays 1-step with no card (its outcome IS the
          Website Visits card above). */}
      {outcomeCard && (
        <>
          <Cell>
            <ScoreCard
              label={outcomeCard.label}
              badge={outcomeCard.badge}
              value={outcomeCard.countValue}
              action={outcomeCard.showAction ? (trackerButton ?? undefined) : undefined}
              pending={pending}
            />
          </Cell>
          <Cell>
            <ScoreCard
              label={outcomeCard.costLabel}
              badge={outcomeCard.badge}
              tooltip={outcomeCard.costTooltip}
              value={outcomeCard.costValue}
              action={outcomeCard.showAction ? (trackerButton ?? undefined) : undefined}
              pending={pending}
            />
          </Cell>
        </>
      )}
    </div>
    </div>
  );
}
