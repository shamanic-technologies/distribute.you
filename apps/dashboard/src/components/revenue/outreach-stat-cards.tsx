"use client";

import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { ScoreCard } from "@/components/visibility/score-card";
import { ConversionTrackerButton } from "@/components/revenue/conversion-tracker-button";
import { MaturityBadge } from "@/components/maturity-badge";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { isVisitDrivenGoal } from "@/lib/api";
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
  const isBeta = useIsBetaUser();
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
  const goal = optimizationGoal ?? "sales_meetings";
  const outreach =
    outreachOverride ?? stats.leadsContacted ?? stats.recipientsContacted ?? 0;
  const clicks = stats.recipientsClicked ?? 0;
  const beta = <MaturityBadge level="beta" />;

  // Until the client's site fires the conversion snippet, the outcome cards have
  // no value to show — so they render a discreet ghost button IN PLACE OF the
  // value (transparent, 1px border, near-black text) that deep-links to setup.
  // One shared button on every untracked outcome card, next to the metric it
  // unblocks. Only built when the brand-scoped href resolves.
  const trackerButton = setupHref ? (
    <ConversionTrackerButton href={setupHref} />
  ) : null;

  const clickMetric = {
    label: "Clicks",
    tooltip:
      "Number of visits on your website via a click in the link shared in the conversation with the lead.",
    value: formatCount(clicks),
    costLabel: "CPC",
    costTooltip:
      "Cost per click: committed spend (billed plus reserved for scheduled follow-ups) divided by link clicks. It can dip when a reserved follow-up sends or gets cancelled.",
    // Committed CPC (= actual + provisioned / clicks). Prefer the new `totalCpcCents`,
    // fall back to the legacy `cpcCents` until features-service lands. Server-provided
    // either way — no client division.
    costValue: formatCostCents(spend?.totalCpcCents ?? spend?.cpcCents),
  };

  const outcomeMetric =
    !isVisitDrivenGoal(goal)
      ? {
          label: "Sales Meetings",
          costLabel: "CPSM",
          costTooltip: "Cost per Sales Meetings.",
          costValue: formatCostCents(spend?.cpsmCents),
        }
      : {
          label: "Signups",
          costLabel: "CPS",
          costTooltip: "Cost per signup — total spent divided by signups. Coming soon.",
          costValue: formatCostCents(spend?.cpsCents),
        };

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

      {isBeta && (
        <>
          <Cell>
            <ScoreCard
              label={outcomeMetric.label}
              badge={beta}
              value="—"
              action={trackerButton}
              pending={pending}
            />
          </Cell>
          <Cell>
            <ScoreCard
              label={outcomeMetric.costLabel}
              badge={beta}
              tooltip={outcomeMetric.costTooltip}
              value={outcomeMetric.costValue}
              action={outcomeMetric.costValue === "—" ? trackerButton : undefined}
              pending={pending}
            />
          </Cell>
        </>
      )}
    </div>
    </div>
  );
}
