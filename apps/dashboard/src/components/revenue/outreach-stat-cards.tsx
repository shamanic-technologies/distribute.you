"use client";

import { ScoreCard } from "@/components/visibility/score-card";
import { MaturityBadge } from "@/components/maturity-badge";
import { useIsBetaUser } from "@/lib/use-beta-user";

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

/**
 * Top-of-page outreach stat cards, shared across the campaigns list, brand
 * overview, and campaign detail surfaces (one source → no drift, CLAUDE.md
 * "keep surfaces in lockstep").
 *
 * GA cards (everyone): Impressions / Clicks / CPC.
 * Beta cards (allowlist only — `useIsBetaUser`): Meetings / CPM / Signups / CPS
 * / Sales / CAC, each badged `beta`. Four are placeholders (`—`) until the data
 * lands (signups stored in DB, sales tracked); meetings + CPM are live now off
 * `leadsRepliesMeetingBooked`. Gated rather than badged-only because the `—`
 * placeholders would read as broken to a non-beta customer. Drop the gate to GA.
 *
 * All values derive from already-fetched featureStats + systemStats cost — no
 * new query. Static-shell-first: labels paint instantly, values skeleton until
 * `pending` clears.
 */
export function OutreachStatCards({
  stats,
  totalCostCents,
  pending,
}: {
  stats: Record<string, number>;
  totalCostCents: number;
  pending: boolean;
}) {
  const isBeta = useIsBetaUser();
  const clicks = stats.recipientsClicked ?? 0;
  const meetings = stats.leadsRepliesMeetingBooked ?? 0;
  const beta = <MaturityBadge level="beta" />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <ScoreCard
        label="Impressions"
        value={formatCount(stats.recipientsOpened ?? 0)}
        pending={pending}
      />
      <ScoreCard label="Clicks" value={formatCount(clicks)} pending={pending} />
      <ScoreCard
        label="CPC"
        tooltip="Cost per click — total spent divided by link clicks."
        value={costPer(totalCostCents, clicks)}
        pending={pending}
      />

      {isBeta && (
        <>
          <ScoreCard
            label="Meetings"
            badge={beta}
            value={formatCount(meetings)}
            pending={pending}
          />
          <ScoreCard
            label="CPM"
            badge={beta}
            tooltip="Cost per attended meeting — total spent divided by meetings booked."
            value={costPer(totalCostCents, meetings)}
            pending={pending}
          />
          <ScoreCard label="Signups" badge={beta} value="—" pending={pending} />
          <ScoreCard
            label="CPS"
            badge={beta}
            tooltip="Cost per signup — total spent divided by signups. Coming soon."
            value="—"
            pending={pending}
          />
          <ScoreCard
            label="Sales"
            badge={beta}
            tooltip="Revenue from tracked sales. Coming soon."
            value="—"
            pending={pending}
          />
          <ScoreCard
            label="CAC"
            badge={beta}
            tooltip="Cost of acquisition — total spent divided by customers acquired. Coming soon."
            value="—"
            pending={pending}
          />
        </>
      )}
    </div>
  );
}
