"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getOfferSalesPaths } from "@/lib/api";
import { campaignKey, sortCampaigns, sourceCampaignsOfOffer } from "@/lib/offer-campaigns";
import { roiUnavailableLabel } from "@/lib/offer-sales-paths";
import { v2OfferHref } from "@/lib/v2/routes";
import { useMissions, type Mission } from "@/components/v2/use-missions";
import { CampaignLeg } from "@/components/v2/offer-campaigns";
import { PathAvatar } from "@/components/v2/offer-sales-paths";
import { EmptyNote, SectionTitle, Shimmer, StateDot } from "@/components/v2/ui";

/**
 * Targeting > Sources (owner 2026-10-09): where we find the people, read only. One row per
 * source campaign of the offer, off the SAME features-service `sourceCampaigns[]` read (and
 * cache key) the Sourcing page polls, its On/Off off the same campaign-service missions.
 * The toggle and the budget stay on the Sourcing page; this tab links there.
 */
export function OfferSourcesTab({ orgId, brandId, offerId }: { orgId: string; brandId: string; offerId: string }) {
  const paths = useAuthQuery(
    ["offerSalesPaths", brandId, offerId, "catalogue"],
    () => getOfferSalesPaths(brandId, offerId, "catalogue"),
    { enabled: !!offerId },
  );
  const { missions } = useMissions(orgId, brandId, { allOffers: true });
  const missionByKey = useMemo(() => {
    const m = new Map<string, Mission>();
    for (const x of missions) {
      const c = x.row.campaign;
      if (c.offerId === offerId && c.featureSlug && c.legKey) m.set(campaignKey(c.featureSlug, c.legKey), x);
    }
    return m;
  }, [missions, offerId]);
  const sources = useMemo(
    () =>
      sortCampaigns(
        sourceCampaignsOfOffer(paths.data?.sourceCampaigns ?? [], roiUnavailableLabel),
        (c) => missionByKey.get(campaignKey(c.featureSlug, c.legKey))?.running ?? false,
      ),
    [paths.data, missionByKey],
  );
  const pending = !paths.isFetchedAfterMount && !paths.data;
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
                  const mission = missionByKey.get(campaignKey(c.featureSlug, c.legKey)) ?? null;
                  const on = mission?.running ?? false;
                  return (
                    <tr key={campaignKey(c.featureSlug, c.legKey)} className="k-row k-line-subtle h-12 border-b last:border-b-0">
                      <td className="px-3 py-2 pl-4">
                        <span className="flex min-w-0 items-center gap-2.5">
                          {c.name && <PathAvatar name={c.name} size={28} />}
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
                          <StateDot running={on} label={on ? "On" : "Off"} hold={on ? null : mission?.paymentHold ?? null} />
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
