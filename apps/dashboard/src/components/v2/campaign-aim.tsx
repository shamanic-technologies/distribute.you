"use client";

import { useEffect } from "react";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { stepLabel } from "@/lib/legs";
import { shortUtcDay } from "@/lib/campaign-path-change";
import type { FunnelCampaignCopy, SalesFunnelCampaign } from "@/lib/sales-funnel-campaigns";
import { BriefField } from "@/components/v2/campaign-brief-field";
import { TypeTag } from "@/components/v2/funnel-campaigns";
import { SectionTitle, Shimmer } from "@/components/v2/ui";

/**
 * WHAT A CAMPAIGN AIMS AT, for EVERY customer (P5.1, owner 2026-10-31; the GTM Factory "Goal" header since
 * FACTORY-USER-DASHBOARD-1102): the campaign page opens on it.
 * - its Target (campaign-service `target`, named by the served step label) and its Type (📅 Daily / ⚡ trigger);
 * - its brief, the client's own words on how to run it, edited in place (blur saves, no Save button);
 * What runs is the Plan below (each outcome's Engine and its scripts, `factory-campaign.tsx`): no pipe line here
 * (owner 2026-11-02: the backend runs Engines per outcome, the pipes are gone from every page).
 */
export function CampaignAimSection({
  campaign,
  copy,
  copySettled,
}: {
  campaign: SalesFunnelCampaign;
  /** features-service's row copy: Type label and the running path. */
  copy: FunnelCampaignCopy | null;
  copySettled: boolean;
}) {
  const catalogue = useLegCatalogue();
  const targetLabel = stepLabel(catalogue, campaign.target);
  const catalogueReady = catalogue.steps.size > 0;
  useEffect(() => {
    if (!campaign.target) console.error("[campaign-aim] campaign-service serves no target for this campaign", { id: campaign.id });
    else if (catalogueReady && !targetLabel) console.error("[campaign-aim] the step catalogue names no step for this target", { id: campaign.id, target: campaign.target });
  }, [campaign.id, campaign.target, catalogueReady, targetLabel]);
  const dash = <span className="k-fg4">—</span>;
  return (
    <section>
      <SectionTitle>Goal</SectionTitle>
      <div className="k-card">
        {/* The GTM Factory campaign header (FACTORY-USER-DASHBOARD-1102): Target, where it starts, its brief (the budget is the top bar's one button, owner 2026-11-02). */}
        <div className="grid gap-4 px-4 py-3.5 md:grid-cols-[minmax(0,180px)_minmax(0,180px)_minmax(0,1fr)]">
          <div className="min-w-0">
            <p className="k-label">Target</p>
            <p className="mt-1.5 text-[14px] font-medium">{targetLabel ?? (campaign.target && !catalogueReady ? <Shimmer className="h-5 w-24" /> : dash)}</p>
            <p className="k-fg3 mt-0.5 text-[12px]">What it orders</p>
          </div>
          <div className="min-w-0">
            <p className="k-label">Starts from</p>
            <div className="mt-1.5">{copy ? <TypeTag row={copy} /> : copySettled ? dash : <Shimmer className="h-5 w-24" />}</div>
            <p className="k-fg3 mt-1 text-[12px]">{copy?.type === "reactive" ? "Pushes each new one up to its Target" : "Pulls new people every day"}</p>
          </div>
          <div className="min-w-0">
            <p className="k-label">Brief</p>
            <p className="k-fg3 mt-1 text-[12px]">Tell us in plain words how to run this campaign. We follow it.</p>
            <div className="mt-1">
              <BriefField
                campaign={campaign}
                placeholder="Who to reach, how to talk to them, what to avoid."
                emptyText="No brief yet. Click to write one."
                updatedNote={(at) => `Updated ${shortUtcDay(at)}.`}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
