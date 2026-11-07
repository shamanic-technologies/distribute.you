"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { useOrgQueryGate } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getOfferEnginePicks } from "@/lib/api";
import { picksNewestFirst, pickStateWords } from "@/lib/engine-picks";
import { timeAgo } from "@/lib/friendly-datetime";
import { useClientClock } from "@/lib/use-client-clock";
import { v2CampaignHref } from "@/lib/v2/routes";
import { CatalogueObjectMark } from "@/components/v2/catalogue-name";
import { EmptyNote, SectionTitle, Shimmer } from "@/components/v2/ui";

/** Picks shown before "Show N more". */
const SHOWN = 8;

/**
 * "Why each one was picked" (the GTM Factory Today page, FACTORY-USER-DASHBOARD-1102): for every offer the brand's
 * campaigns sell (served per offer, one read each, the lists joined newest first), the latest pick of each Engine of each live campaign, newest first: the outcome, the script picked, the campaign, and the
 * sentence features-service writes for the client. Opens the campaign, where the whole Plan is.
 */
export function EnginePicksSection({ orgId, brandId, offerIds }: { orgId: string; brandId: string; offerIds: readonly string[] | null }) {
  const gate = useOrgQueryGate();
  const qs = useQueries({
    queries: (offerIds ?? []).map((offerId) => ({
      queryKey: ["offerEnginePicks", brandId, offerId],
      queryFn: () => getOfferEnginePicks(brandId, offerId),
      ...pollOptions,
      enabled: gate,
    })),
  });
  const clock = useClientClock();
  const stamp = qs.map((x) => x.dataUpdatedAt).join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const picks = useMemo(() => picksNewestFirst(qs.flatMap((x) => x.data?.picks ?? [])), [stamp]);
  const answered = qs.every((x) => x.data !== undefined || x.isFetchedAfterMount);
  const settled = offerIds !== null && answered;
  const failed = qs.length > 0 && qs.every((x) => x.isError && !x.data);
  return (
    <section>
      <SectionTitle count={settled && !failed ? picks.length : null} right={<span>Newest first</span>}>
        Why each one was picked
      </SectionTitle>
      <div className="k-card divide-y divide-[var(--line-subtle)]">
        {!settled ? (
          <div className="space-y-2 p-4">
            <Shimmer className="h-12 w-full" />
            <Shimmer className="h-12 w-full" />
          </div>
        ) : failed ? (
          <EmptyNote>Could not read your Engines&apos; picks. Retrying.</EmptyNote>
        ) : picks.length === 0 ? (
          <EmptyNote>No pick yet. Each Engine picks a script for your campaigns every 3 hours.</EmptyNote>
        ) : (
          picks.slice(0, SHOWN).map((p) => {
            const state = pickStateWords(p.state);
            const name = p.workflowName ?? p.channelName ?? p.workflowDynastySlug;
            return (
              <Link
                key={`${p.campaignId}-${p.outcome}`}
                href={v2CampaignHref(orgId, brandId, p.campaignId)}
                className="k-hover flex items-start gap-3 px-4 py-3 first:rounded-t-[12px] last:rounded-b-[12px]"
              >
                <CatalogueObjectMark kind="workflow" name={name} icon={p.icon} color={p.color} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-1.5 text-[13px]">
                    <span className="k-fg2">{p.outcomeName} · script:</span>
                    <span className="font-medium">{name}</span>
                    {state && (
                      <span className="k-chip" style={{ color: "var(--data-amber)" }}>
                        {state}
                      </span>
                    )}
                  </span>
                  <span className="k-fg2 mt-0.5 block text-[12px] leading-[18px]">
                    {p.campaignName}: {p.why}
                  </span>
                </span>
                <span className="k-mono k-fg3 shrink-0 text-[12px]">{p.pickedAt && clock ? timeAgo(p.pickedAt, clock) : ""}</span>
              </Link>
            );
          })
        )}
      </div>
    </section>
  );
}
