"use client";

import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { ScoreCard } from "@/components/visibility/score-card";
import { ConversionTrackerButton } from "@/components/revenue/conversion-tracker-button";
import { MaturityBadge } from "@/components/maturity-badge";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getBrandConversionToken } from "@/lib/api";
import { useIsShareMode } from "@/components/share/share-mode-context";
import { outcomeStepFor, stepsFor } from "@/lib/goal-steps";
import type { SalesFunnelKeyWire } from "@/lib/sales-funnels";
import { formatUsdAdaptive } from "@/lib/format-number";
import type { BrandOptimizationGoal } from "@/lib/api";
import type { CostEconomics, Spend } from "@/lib/revenue-view";

function formatCount(n: number): string {
  return Number(n).toLocaleString("en-US");
}

function formatRoi(multiple: number | null | undefined): string {
  return multiple == null ? "—" : `${multiple.toFixed(1)}×`;
}

function formatPct(pct: number | null | undefined): string {
  return pct == null ? "—" : `${Math.round(pct)}%`;
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
  funnelKey,
  outreachOverride,
  outreachLabel = "Outreach",
  economics,
  totalPipelineUsd,
  showEconomics = false,
  showFunnelMetrics = true,
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
   * Visits / Cost per website visit" on a campaign whose chain starts at a positive
   * reply — the wrong funnel's steps under the campaign's own name.
   *
   * Absent on a brand-level surface (a brand runs several funnels at once, so no single
   * chain describes it) and on a pre-funnel campaign → the goal keys the row exactly as
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
   * Whether to render the FUNNEL-specific pairs (Website Visits + cost per visit,
   * and the goal's outcome pair). A brand runs several sales funnels at once, so
   * at brand level those name one funnel's steps while the row above them sums
   * every funnel — the money cards are the honest brand-level statement. A
   * campaign sells exactly ONE funnel, so it keeps them.
   */
  showFunnelMetrics?: boolean;
}) {
  const params = useParams();
  const orgId = params.orgId as string | undefined;
  const brandId = params.brandId as string | undefined;
  const readOnly = useIsShareMode();
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
  // No default goal. The brand one is retired — `NOT NULL` with a server default, so it
  // reads "website purchases" for a brand that stated nothing — and defaulting to it put
  // a chain's steps on a surface that never named one. Absent goal AND absent funnel
  // means the step helpers return the Outreach floor and no funnel pair renders.
  const goal = optimizationGoal ?? null;
  // Which steps this row states, keyed on the FUNNEL when the surface is scoped to one and
  // on the goal otherwise. Every pair below is decided from this list rather than from a
  // `goal === "x"` test, so a chain that does not buy a click cannot be given the
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
  // outcome pair becomes Positive Replies + Cost per positive reply (GA, no beta badge —
  // the goal itself is GA).
  const isPositiveReplies = hasStep("positive_replies") && outcomeStep === null;
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
  // "Set up conversion tracker" is a job for the account holder, and its target
  // is a settings page a shared link does not reach. Dropped on the share view
  // rather than pointed somewhere else.
  const trackerButton =
    setupHref && !trackerLive && !readOnly ? <ConversionTrackerButton href={setupHref} /> : null;

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
  };

  const outcome = outcomeStep?.outcome ?? null;
  // The outcome COUNT + its cost are server-provided by features-service: the count is a
  // REAL tracker value (sourced from the brand's live conversion tracker), and the cost is
  // that count's real ratio once one lands, or — at zero — the expected cost floored against
  // committed spend, resolved server-side. `countField`/`costField` are null when even the
  // brand-level aggregate is not on the wire yet (purchase) → the card renders "—" + the
  // setup CTA. Rendered verbatim either way: no client math.
  const outcomeCount =
    outcome?.countField != null ? spend?.[outcome.countField] : undefined;
  const outcomeCost = outcome?.costField != null ? spend?.[outcome.costField] : null;
  const outcomeCountValue = outcomeCount != null ? formatCount(outcomeCount) : "—";
  // Badge the outcome pair `beta` only while the GOAL itself is beta (the combined
  // `sales` goal) — the GA goals (signups/sales_meetings/form_submissions/
  // website_purchase) show their outcome ungated.
  const goalIsBeta = goal === "sales";
  // The Website Visits pair renders only when a click onto the site is actually on the
  // chain. It is for the reply→meeting funnel, whose first step is a positive reply.
  const showVisitPair = hasStep("website_visits");
  // The reply pair as a MID-chain signal, beside its own outcome below: the reply→meeting
  // funnel (reply → meeting booked) and the combined `sales` goal (which wins a paying
  // client via EITHER the visit→paid or the reply→paid path, so it shows both signals).
  // Reply attribution is inbox-sourced, so no conversion-tracker CTA.
  const showReplyPair = hasStep("positive_replies") && !isPositiveReplies;

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
        costTooltip: `Cost per positive reply: committed spend divided by the real positive replies attributed to your outreach. ${EXPECTED_COST_NOTE}`,
        // features-service owns the zero-reply case: it floors the aggregate to
        // max(committed net spend, the expected cost from the brand's best model), the same
        // cascade it applies per audience, so this card and the Strategy page print ONE
        // price instead of restating "Total spent" under a second label.
        //
        // Rendered VERBATIM, with no client fallback to spend. That fallback (the old
        // `costSoFarFloorCents` call) is what produced "Cost per positive reply $29"
        // directly above "Total spent $29". features-service's projection read is
        // deliberately fail-soft: on a blip it returns null, meaning "we could not
        // estimate this" — and the honest render for that is "—", not the nearest real
        // number we happen to hold. Re-adding a spend fallback here reintroduces the bug
        // one layer down, on exactly the branch no fixture covers.
        costValue: formatCostCents(spend?.cpprCents),
        badge: undefined,
        showAction: false,
      }
    : outcomeStep && outcome
      ? {
          label: outcomeStep.label,
          countValue: outcomeCountValue,
          costLabel: outcome.costLabel,
          costTooltip: `Cost per ${outcomeStep.label.toLowerCase()}: committed spend divided by the real ${outcomeStep.label.toLowerCase()} your conversion tracker recorded. ${EXPECTED_COST_NOTE}`,
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
          label={outreachLabel}
          value={formatCount(outreach)}
          pending={pending}
        />
      </Cell>
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
          <Cell>
            <ScoreCard
              label="ROI"
              tooltip={ECONOMICS_INFO.roi}
              value={formatRoi(economics?.roiMultiple)}
              pending={pending}
            />
          </Cell>
          <Cell>
            <ScoreCard
              label="$ CAC"
              tooltip={ECONOMICS_INFO.cacUsd}
              value={formatUsd(economics?.costPerAcquisitionUsd)}
              pending={pending}
            />
          </Cell>
          <Cell>
            <ScoreCard
              label="% CAC"
              tooltip={ECONOMICS_INFO.cacPct}
              value={formatPct(economics?.costOfAcquisitionPct)}
              pending={pending}
            />
          </Cell>
        </>
      )}

      {/* Only when a click onto the site is on the chain. The `positive_replies` goal
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
              tooltip={clickMetric.costTooltip}
              value={clickMetric.costValue}
              pending={pending}
            />
          </Cell>
        </>
      )}

      {/* The reply as a mid-chain signal, above its own outcome: the reply→meeting funnel
          (where it takes the slot the Website Visits pair holds on the website funnels),
          and the combined `sales` goal (which shows both signals).
          Inbox-sourced attribution → no conversion-tracker CTA. */}
      {showFunnelMetrics && showReplyPair && (
        <>
          <Cell>
            <ScoreCard
              label="Positive Replies"
              value={
                spend?.positiveRepliesCount != null
                  ? formatCount(spend.positiveRepliesCount)
                  : "—"
              }
              pending={pending}
            />
          </Cell>
          <Cell>
            <ScoreCard
              label="Cost per positive reply"
              tooltip={`Cost per positive reply: committed spend divided by the real positive replies attributed to your outreach. ${EXPECTED_COST_NOTE}`}
              value={formatCostCents(spend?.cpprCents)}
              pending={pending}
            />
          </Cell>
        </>
      )}

      {/* Outcome pair — the goal's outcome step, or the reply for positive_replies (its
          1-step outcome). website_visits stays 1-step with no card (its outcome IS the
          Website Visits card above). */}
      {showFunnelMetrics && outcomeCard && (
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
