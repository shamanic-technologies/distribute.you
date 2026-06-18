"use client";

import type { ReactNode } from "react";
import { ScoreCard } from "@/components/visibility/score-card";
import { MaturityBadge } from "@/components/maturity-badge";
import { useIsBetaUser } from "@/lib/use-beta-user";
import type { BrandOptimizationGoal } from "@/lib/api";

function formatCount(n: number): string {
  return Number(n).toLocaleString("en-US");
}

// Cost per <unit> = total spent / unit count. No units → no defined cost (show
// "—", never a divide-by-zero / fake $0).
function costPer(totalCostCents: number, denom: number): string {
  if (denom <= 0) return "—";
  const usd = totalCostCents / 100 / denom;
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
 * GA cards (everyone): Outreach / Opens / Clicks / CPC, regardless of the
 * brand's optimization goal.
 * Beta cards (allowlist only — `useIsBetaUser`): the goal outcome pair
 * (Signups/CPS or Sales Meetings/CPSM), each badged `beta`.
 *
 * All values derive from already-fetched featureStats + systemStats cost — no
 * new query. Static-shell-first: labels paint instantly, values skeleton until
 * `pending` clears.
 */
export function OutreachStatCards({
  stats,
  totalCostCents,
  pending,
  optimizationGoal,
}: {
  stats: Record<string, number>;
  totalCostCents: number;
  pending: boolean;
  optimizationGoal?: BrandOptimizationGoal;
}) {
  const isBeta = useIsBetaUser();
  const goal = optimizationGoal ?? "sales_meetings";
  const outreach = stats.leadsSent ?? stats.recipientsSent ?? 0;
  const opens = stats.recipientsOpened ?? 0;
  const clicks = stats.recipientsClicked ?? 0;
  const beta = <MaturityBadge level="beta" />;

  const clickMetric = {
    label: "Clicks",
    tooltip:
      "Number of visits on your website via a click in the link shared in the conversation with the lead.",
    value: formatCount(clicks),
    costLabel: "CPC",
    costTooltip: "Cost per click — total spent divided by link clicks.",
    costValue: costPer(totalCostCents, clicks),
  };

  const outcomeMetric =
    goal === "sales_meetings"
      ? {
          label: "Sales Meetings",
          costLabel: "CPSM",
          costTooltip: "Cost per Sales Meetings.",
        }
      : {
          label: "Signups",
          costLabel: "CPS",
          costTooltip: "Cost per signup — total spent divided by signups. Coming soon.",
        };

  return (
    <div className="flex flex-nowrap gap-3 overflow-x-auto mb-6">
      <Cell>
        <ScoreCard
          label="Outreach"
          value={formatCount(outreach)}
          pending={pending}
        />
      </Cell>
      <Cell>
        <ScoreCard label="Opens" value={formatCount(opens)} pending={pending} />
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
              pending={pending}
            />
          </Cell>
          <Cell>
            <ScoreCard
              label={outcomeMetric.costLabel}
              badge={beta}
              tooltip={outcomeMetric.costTooltip}
              value="—"
              pending={pending}
            />
          </Cell>
        </>
      )}
    </div>
  );
}
