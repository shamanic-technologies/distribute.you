"use client";

import { useEffect } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getSalesFunnelCampaignPlanChanges } from "@/lib/api";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { stepLabel } from "@/lib/legs";
import { pathChangeSentence, pathChangedAt, shortUtcDay } from "@/lib/campaign-path-change";
import type { FunnelCampaignCopy, SalesFunnelCampaign } from "@/lib/sales-funnel-campaigns";
import { BriefField } from "@/components/v2/campaign-brief-field";
import { FunnelPathLine, TypeTag } from "@/components/v2/funnel-campaigns";
import { SectionTitle, Shimmer } from "@/components/v2/ui";

/**
 * WHAT A CAMPAIGN AIMS AT, for EVERY customer (P5.1, owner 2026-10-31): the campaign page opens on it.
 * - its Target (campaign-service `target`, named by the served step label) and its Type (📅 Daily / ⚡ trigger);
 * - its brief, the client's own words on how to run it, edited in place (blur saves, no Save button);
 * - the path it runs NOW (features-service serves `path` for the RUNNING funnel, each pipe by its served name and
 *   mark), and one sentence when that path last changed (campaign-service's plan changes).
 * Staff concepts (plays, strategies, Jev, the best path the factory would pick) never show here: they stay on the
 * staff card below it.
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
  // Shared key with the staff card: one read for both.
  const changesQ = useAuthQuery(["salesFunnelPlanChanges", campaign.id], () => getSalesFunnelCampaignPlanChanges(campaign.id), { ...pollOptions, retry: false });
  const changedAt = pathChangedAt(changesQ.data?.changes ?? [], copy?.runningSalesFunnelId ?? campaign.runningSalesFunnelId);
  const catalogueReady = catalogue.steps.size > 0;
  useEffect(() => {
    if (!campaign.target) console.error("[campaign-aim] campaign-service serves no target for this campaign", { id: campaign.id });
    else if (catalogueReady && !targetLabel) console.error("[campaign-aim] the step catalogue names no step for this target", { id: campaign.id, target: campaign.target });
  }, [campaign.id, campaign.target, catalogueReady, targetLabel]);
  useEffect(() => {
    if (copySettled && copy && !copy.path) console.error("[campaign-aim] features-service serves no path for this campaign", { id: campaign.id, reason: copy.copyUnavailableReason ?? null });
  }, [copySettled, copy, campaign.id]);
  const dash = <span className="k-fg4">—</span>;
  return (
    <section>
      <SectionTitle>What this campaign aims at</SectionTitle>
      <div className="k-card divide-y divide-[var(--line-subtle)]">
        <div className="grid gap-4 px-4 py-3.5 md:grid-cols-[240px_minmax(0,1fr)]">
          <div className="min-w-0">
            <p className="k-label">Target</p>
            <p className="mt-1.5 text-[14px] font-medium">{targetLabel ?? (campaign.target && !catalogueReady ? <Shimmer className="h-5 w-24" /> : dash)}</p>
            <div className="mt-2">{copy ? <TypeTag row={copy} /> : copySettled ? dash : <Shimmer className="h-5 w-24" />}</div>
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
        <div className="grid gap-4 px-4 py-3.5 md:grid-cols-[240px_minmax(0,1fr)]">
          <div className="min-w-0">
            <p className="k-label">Path</p>
            <p className="k-fg3 mt-1 text-[12px]">What runs now</p>
          </div>
          <div className="min-w-0">
            {copy?.path ? <FunnelPathLine items={copy.path.items} /> : copySettled ? dash : <Shimmer className="h-5 w-2/3" />}
            {changedAt && <p className="k-fg2 mt-1.5 text-[13px]">{pathChangeSentence(changedAt, targetLabel)}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
