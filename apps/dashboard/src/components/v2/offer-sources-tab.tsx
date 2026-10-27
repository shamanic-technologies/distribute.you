"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getLeadSourcingSources, getOfferSalesPaths } from "@/lib/api";
import { pollOptions } from "@/lib/query-options";
import { campaignKey, sortCampaigns, sourceCampaignsOfOffer } from "@/lib/offer-campaigns";
import { roiUnavailableLabel } from "@/lib/offer-sales-paths";
import { v2OfferHref } from "@/lib/v2/routes";
import { useCampaigns, type V2Campaign } from "@/components/v2/use-campaigns";
import { CampaignLeg } from "@/components/v2/offer-campaigns";
import { ServedPipeMark } from "@/components/v2/served-pipe-mark";
import { featureLegId } from "@/lib/outbound-leg-key";
import { EmptyNote, SectionTitle, Shimmer, StateDot } from "@/components/v2/ui";

/**
 * Targeting > Sources (owner 2026-10-09): where we find the people, read only. One row per
 * source campaign of the offer, off the SAME features-service `sourceCampaigns[]` read (and
 * cache key) the Sourcing page polls, its On/Off off the same campaign-service campaigns.
 * The toggle and the budget stay on the Sourcing page; this tab links there.
 *
 * A source is On when its own pipe runs as part of ANY campaign of the offer (a sales funnel
 * campaign's unit included), or when the offer's Lead Sourcing campaign runs and human-service
 * chose that origin for it (Lead Sourcing picks its origins itself; 2026-10-28 every row read Off
 * while "Wide Email Replies" sourced through Lead Sourcing).
 */
export function OfferSourcesTab({ orgId, brandId, offerId }: { orgId: string; brandId: string; offerId: string }) {
  const paths = useAuthQuery(
    ["offerSalesPaths", brandId, offerId, "catalogue"],
    () => getOfferSalesPaths(brandId, offerId, "catalogue"),
    { enabled: !!offerId },
  );
  const leadSourcing = useAuthQuery(
    ["leadSourcingSources", brandId, offerId],
    () => getLeadSourcingSources(brandId, offerId),
    { enabled: !!offerId, ...pollOptions },
  );
  const { allCampaigns } = useCampaigns(orgId, brandId, { allOffers: true });
  const chosenByLeadSourcing = useMemo(
    () => new Set(leadSourcing.data?.leadSourcingOn ? leadSourcing.data.chosenOriginSlugs : []),
    [leadSourcing.data],
  );
  // Units of a sales funnel campaign included: a source runs whichever campaign carries it.
  const campaignByKey = useMemo(() => {
    const m = new Map<string, V2Campaign>();
    for (const x of allCampaigns) {
      const c = x.row.campaign;
      if (c.offerId !== offerId || !c.featureSlug || !c.legKey) continue;
      const key = campaignKey(c.featureSlug, c.legKey);
      // Several rows can share a pipe (a part of each funnel): the running one speaks for it.
      if (!m.get(key)?.running) m.set(key, x);
    }
    return m;
  }, [allCampaigns, offerId]);
  const isOn = useMemo(
    () => (c: { featureSlug: string; legKey: string }) =>
      (campaignByKey.get(campaignKey(c.featureSlug, c.legKey))?.running ?? false) || chosenByLeadSourcing.has(c.featureSlug),
    [campaignByKey, chosenByLeadSourcing],
  );
  const sources = useMemo(
    () =>
      sortCampaigns(
        sourceCampaignsOfOffer(paths.data?.sourceCampaigns ?? [], roiUnavailableLabel),
        isOn,
      ),
    [paths.data, isOn],
  );
  const pending = (!paths.isFetchedAfterMount && !paths.data) || (!leadSourcing.isFetchedAfterMount && !leadSourcing.data);
  const manage = (
    <Link href={v2OfferHref(orgId, brandId, offerId, "sourcing")} className="k-btn-ghost">
      Manage in Sourcing →
    </Link>
  );

  return (
    <section>
      <SectionTitle count={pending ? null : sources.length} right={manage}>
        Sources
      </SectionTitle>
      {paths.isError && !paths.data ? (
        <p className="text-[13px] text-[var(--data-rose)]">Could not read this offer&apos;s sources.</p>
      ) : leadSourcing.isError && !leadSourcing.data ? (
        <p className="text-[13px] text-[var(--data-rose)]">Could not read which sources Lead Sourcing uses.</p>
      ) : pending ? (
        <div className="space-y-2">
          <Shimmer className="h-10 rounded-[10px]" />
          <Shimmer className="h-10 rounded-[10px]" />
        </div>
      ) : sources.length === 0 ? (
        <div className="k-card">
          <EmptyNote>No source yet for this offer.</EmptyNote>
        </div>
      ) : (
        <div className="k-card overflow-hidden">
          <div className="k-scroll overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead>
                <tr className="k-line-subtle border-b">
                  <th className="k-label px-3 py-2.5 pl-4 text-left font-normal">Source</th>
                  <th className="k-label px-3 py-2.5 text-left font-normal">Finds</th>
                  <th className="k-label w-[140px] px-3 py-2.5 pr-4 text-right font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((c) => {
                  const campaign = campaignByKey.get(campaignKey(c.featureSlug, c.legKey)) ?? null;
                  const on = isOn(c);
                  return (
                    <tr key={campaignKey(c.featureSlug, c.legKey)} className="k-row k-line-subtle h-12 border-b last:border-b-0">
                      <td className="px-3 py-2 pl-4">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <ServedPipeMark pipeId={featureLegId(c.featureSlug, c.legKey)} size={28} />
                          <span className="truncate font-semibold">{c.name ?? c.channelName}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <CampaignLeg campaign={c} />
                      </td>
                      <td className="px-3 py-2 pr-4 text-right">
                        {c.managed === false ? (
                          <StateDot running={false} label="Not run yet" />
                        ) : (
                          <StateDot running={on} label={on ? "On" : "Off"} hold={on ? null : campaign?.paymentHold ?? null} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
