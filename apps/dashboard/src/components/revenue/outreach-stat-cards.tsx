"use client";

import type { ReactNode } from "react";
import { ScoreCard } from "@/components/visibility/score-card";
import { MaturityBadge } from "@/components/maturity-badge";
import { useIsBetaUser } from "@/lib/use-beta-user";
import type { BrandFunnelStage } from "@/lib/api";

function formatCount(n: number): string {
  return Number(n).toLocaleString("en-US");
}

// Cost per <unit> = total spent / unit count. No units → no defined cost (show
// "—", never a divide-by-zero / fake $0).
function costPer(totalCostCents: number, denom: number): string {
  if (denom <= 0) return "—";
  const usd = totalCostCents / 100 / denom;
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
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
 * GA cards (everyone): Impressions / Clicks / CPC.
 * Beta cards (allowlist only — `useIsBetaUser`): Meetings / CPM / Signups / CPS
 * / Sales / CAC, each badged `beta`. Four are placeholders (`—`) until the data
 * lands (signups stored in DB, sales tracked); meetings + CPM are live now off
 * `leadsRepliesMeetingBooked`. Gated rather than badged-only because the `—`
 * placeholders would read as broken to a non-beta customer. Drop the gate to GA.
 *
 * Funnel-stage gating: when `funnelStages` is provided (the brand's configured
 * sales funnel), the Meetings/CPM pair shows only if the brand books sales
 * meetings (`sales_meeting`), and the Signups/CPS pair only if it sells
 * self-serve (`website_purchase`). Sales/CAC always show (objective-agnostic).
 * `undefined` → show all beta cards (economics not yet resolved / not gated).
 *
 * All values derive from already-fetched featureStats + systemStats cost — no
 * new query. Static-shell-first: labels paint instantly, values skeleton until
 * `pending` clears.
 */
export function OutreachStatCards({
  stats,
  totalCostCents,
  pending,
  funnelStages,
}: {
  stats: Record<string, number>;
  totalCostCents: number;
  pending: boolean;
  funnelStages?: BrandFunnelStage[];
}) {
  const isBeta = useIsBetaUser();
  const clicks = stats.recipientsClicked ?? 0;
  const meetings = stats.leadsRepliesMeetingBooked ?? 0;
  const beta = <MaturityBadge level="beta" />;

  // No funnel config → show every beta card; otherwise gate each pair on its stage.
  const showMeetings = funnelStages === undefined || funnelStages.includes("sales_meeting");
  const showSignups = funnelStages === undefined || funnelStages.includes("website_purchase");

  return (
    <div className="flex flex-nowrap gap-3 overflow-x-auto mb-6">
      <Cell>
        <ScoreCard
          label="Impressions"
          value={formatCount(stats.recipientsOpened ?? 0)}
          pending={pending}
        />
      </Cell>
      <Cell>
        <ScoreCard label="Clicks" value={formatCount(clicks)} pending={pending} />
      </Cell>
      <Cell>
        <ScoreCard
          label="CPC"
          tooltip="Cost per click — total spent divided by link clicks."
          value={costPer(totalCostCents, clicks)}
          pending={pending}
        />
      </Cell>

      {isBeta && showMeetings && (
        <>
          <Cell>
            <ScoreCard
              label="Meetings"
              badge={beta}
              value={formatCount(meetings)}
              pending={pending}
            />
          </Cell>
          <Cell>
            <ScoreCard
              label="CPM"
              badge={beta}
              tooltip="Cost per attended meeting — total spent divided by meetings booked."
              value={costPer(totalCostCents, meetings)}
              pending={pending}
            />
          </Cell>
        </>
      )}

      {isBeta && showSignups && (
        <>
          <Cell>
            <ScoreCard label="Signups" badge={beta} value="—" pending={pending} />
          </Cell>
          <Cell>
            <ScoreCard
              label="CPS"
              badge={beta}
              tooltip="Cost per signup — total spent divided by signups. Coming soon."
              value="—"
              pending={pending}
            />
          </Cell>
        </>
      )}

      {isBeta && (
        <>
          <Cell>
            <ScoreCard
              label="Sales"
              badge={beta}
              tooltip="Revenue from tracked sales. Coming soon."
              value="—"
              pending={pending}
            />
          </Cell>
          <Cell>
            <ScoreCard
              label="CAC"
              badge={beta}
              tooltip="Cost of acquisition — total spent divided by customers acquired. Coming soon."
              value="—"
              pending={pending}
            />
          </Cell>
        </>
      )}
    </div>
  );
}
