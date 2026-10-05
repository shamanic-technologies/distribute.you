"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getOfferCampaignBudgets, getOfferSalesPaths, type OfferCampaignBudgetItem } from "@/lib/api";
import { formatCount, formatUsdAdaptive } from "@/lib/format-number";
import { campaignKey } from "@/lib/offer-campaigns";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { useStatBasis } from "@/lib/use-stat-basis";
import { useRoutePrefetch } from "@/lib/use-route-prefetch";
import { v2OfferHref } from "@/lib/v2/routes";
import { budgetLabel } from "@/components/v2/offer-campaigns";
import { PathAvatar } from "@/components/v2/offer-sales-paths";
import { costPerResult, outcomeCount } from "@/components/v2/mission-results";
import { useMissions, type Mission } from "@/components/v2/use-missions";
import { V2Page, useOfferName } from "@/components/v2/setup-pages";
import { EmptyNote, Shimmer, StateDot } from "@/components/v2/ui";

const TH = "k-label px-3 py-2.5 font-normal";

/**
 * Every campaign this offer has run (owner 2026-10-05), running or stopped, read only:
 * status, budget, money in, value out, outcomes and what one outcome cost. Each figure is
 * a served field (campaign-service status, billing budget, features-service money per
 * campaign); nothing is computed here. Status and budget change on the Sales path page.
 */
export function V2OfferCampaignsPage() {
  const { orgId, brandId, offerId } = useParams<{ orgId: string; brandId: string; offerId: string }>();
  const name = useOfferName(brandId, offerId);
  const router = useRouter();
  const prefetch = useRoutePrefetch();
  const { basis } = useStatBasis();
  const catalogue = useLegCatalogue();
  const { missions, settled } = useMissions(orgId, brandId, { allOffers: true });
  const budgetsQ = useAuthQuery(["offerCampaignBudgets", brandId, offerId], () => getOfferCampaignBudgets(brandId, offerId), {
    enabled: !!offerId,
  });
  const budgetByKey = useMemo(() => {
    const m = new Map<string, OfferCampaignBudgetItem>();
    for (const i of budgetsQ.data?.items ?? []) m.set(campaignKey(i.featureSlug, i.legKey), i);
    return m;
  }, [budgetsQ.data]);
  // Proactive or reactive is features-service's word on each campaign (the Sales path page's own read).
  const pathsQ = useAuthQuery(["offerSalesPaths", brandId, offerId, "catalogue"], () => getOfferSalesPaths(brandId, offerId, "catalogue"), {
    enabled: !!offerId,
  });
  const reactiveByKey = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const c of pathsQ.data?.campaigns ?? []) m.set(campaignKey(c.channelSlug, c.legKey), c.reactive);
    return m;
  }, [pathsQ.data]);
  const budgetSettled = budgetsQ.isFetchedAfterMount || budgetsQ.data !== undefined;

  // Running first, then the most money put in.
  const rows = useMemo(
    () =>
      missions
        .filter((m) => m.offerId === offerId)
        .sort((a, b) => Number(b.running) - Number(a.running) || (b.row.revenue?.committedCostUsd ?? -1) - (a.row.revenue?.committedCostUsd ?? -1)),
    [missions, offerId],
  );
  const salesPathHref = v2OfferHref(orgId, brandId, offerId, "sales-path");

  const budgetCell = (m: Mission) => {
    if (!budgetSettled) return <Shimmer className="ml-auto h-4 w-20 rounded" />;
    if (budgetsQ.isError && !budgetsQ.data) return <span className="k-fg3 text-[12px]">Could not load</span>;
    const c = m.row.campaign;
    const key = campaignKey(c.featureSlug ?? "", c.legKey ?? "");
    const item = budgetByKey.get(key);
    const period = item?.period ?? budgetsQ.data?.period ?? "day";
    const label = budgetLabel({ reactive: reactiveByKey.get(key) ?? false }, item?.budgetCents ?? null, period);
    return <span className={item ? "" : "k-fg4"}>{label}</span>;
  };

  return (
    <V2Page
      crumbs={[{ label: name ?? " ", href: v2OfferHref(orgId, brandId, offerId) }, { label: "Campaigns" }]}
      title={name ?? " "}
      sub="Every campaign this offer has run."
      width="max-w-[1280px]"
    >
      <div className="k-card overflow-hidden">
        <div className="k-scroll overflow-x-auto">
          <table className="w-full min-w-[1020px] text-[13px]">
            <thead>
              <tr className="k-line-subtle border-b">
                <th className={`${TH} pl-4 text-left`}>Campaign</th>
                <th className={`${TH} text-left`}>Status</th>
                <th className={`${TH} text-right`}>Budget</th>
                <th className={`${TH} text-right`}>$ Invested</th>
                <th className={`${TH} text-right`}>$ Value</th>
                <th className={`${TH} text-right`}># Outcomes</th>
                <th className={`${TH} pr-4 text-right`}>$ / Outcome</th>
              </tr>
            </thead>
            <tbody>
              {!settled ? (
                [0, 1, 2].map((i) => (
                  <tr key={i} className="k-row h-12">
                    <td colSpan={7} className="px-4 py-3">
                      <Shimmer className="h-6 w-full" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyNote>No campaign has run for this offer yet.</EmptyNote>
                  </td>
                </tr>
              ) : (
                rows.map((m) => {
                  const c = m.row.campaign;
                  const g = m.row.revenue;
                  const campaignName = catalogue.campaignNames.get(`${c.featureSlug}|${c.legKey}`) ?? null;
                  const outcome = outcomeCount(m);
                  const cost = costPerResult(m, basis);
                  return (
                    <tr
                      key={c.id}
                      className="k-row k-line-subtle h-12 cursor-pointer border-b last:border-b-0"
                      onClick={() => router.push(m.href)}
                      onMouseEnter={() => prefetch(m.href)}
                    >
                      <td className="py-2 pl-4 pr-3">
                        <span className="flex min-w-0 items-center gap-2.5">
                          {campaignName && <PathAvatar name={campaignName} size={28} />}
                          <span className="min-w-0">
                            <span className="block truncate font-semibold">{campaignName ?? m.crew.name}</span>
                            <span className="k-fg3 block truncate text-[12px]">{m.leg?.label ?? "—"}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <StateDot running={m.running} label={m.running ? "On" : "Off"} hold={m.running ? null : m.paymentHold} />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{budgetCell(m)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {g?.committedCostUsd != null ? formatUsdAdaptive(g.committedCostUsd) : <span className="k-fg4">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {g?.totalPipelineUsd != null ? formatUsdAdaptive(g.totalPipelineUsd) : <span className="k-fg4">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {outcome ? (
                          <>
                            {formatCount(outcome.count)} <span className="k-fg3 text-[12px]">{outcome.unit}</span>
                          </>
                        ) : (
                          <span className="k-fg4">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 pr-4 text-right tabular-nums">
                        {cost ? (
                          cost.unit ? (
                            cost.value
                          ) : (
                            <span className="k-chip">{cost.value}</span>
                          )
                        ) : (
                          <span className="k-fg4">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="k-fg3 k-line-subtle border-t px-4 py-2.5 text-[12px]">
          Status and budget change on the{" "}
          <Link href={salesPathHref} className="text-[var(--accent)] hover:underline">
            Sales path page
          </Link>
          .
        </div>
      </div>
    </V2Page>
  );
}
