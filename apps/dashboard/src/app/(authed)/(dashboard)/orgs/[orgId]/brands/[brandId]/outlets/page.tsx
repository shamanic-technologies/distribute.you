"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import {
  listBrandOutlets,
  requestOutletPurchasePrices,
  getOutletStatsCosts,
  getDomainTrafficHistories,
  computeDomainTraffic,
  computeDomainTrafficHistories,
  getDomainDrStatuses,
  computeDomainDr,
  computeDomainDrStatuses,
  type DomainTrafficHistory,
  type DomainDrStatus,
  type DeduplicatedOutlet,
  type OutletListResponse,
  type OutletCampaign,
  type OutletStatusCounts,
} from "@/lib/api";
import { BrandLogo } from "@/components/brand-logo";
import { Skeleton } from "@/components/skeleton";
import { EntitySearchBar } from "@/components/entity-search-bar";
import { STATUS_PRIORITY, statusBadgeColor, statusLabel, deriveDisplayStatusFromCounts } from "@/lib/outlet-status";
import { useMonotonicStatuses } from "@/lib/use-monotonic-status";
import { pollOptions } from "@/lib/query-options";
import { CsvDownloadButton } from "@/components/report/csv-button";
import { buildOutletCsv } from "@/lib/outlet-csv";
import { TablePager, usePaginated } from "@/components/table-pagination";
import { markOutletPriceRequestsOngoing } from "@/lib/outlet-price-requests";

type Tab = string | "all";

function formatCost(cents: string | number | null | undefined): string | null {
  if (cents == null) return null;
  const n = typeof cents === "string" ? parseFloat(cents) : cents;
  if (isNaN(n) || n === 0) return null;
  const usd = n / 100;
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPurchasePrice(outlet: DeduplicatedOutlet): string | null {
  const priceCents = outlet.pricing?.sellPriceCents;
  if (priceCents == null) return null;
  const currency = outlet.pricing?.currency;
  if (!currency) {
    console.error("[dashboard] outlet pricing missing currency", { outletId: outlet.id, pricing: outlet.pricing });
    throw new Error("[dashboard] outlet pricing missing currency");
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(priceCents / 100);
}

function formatMonthlyVisits(visits: number): string {
  return Math.round(visits).toLocaleString("en-US");
}

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^www\./, "");
}

function relevanceColor(score: number): string {
  if (score >= 70) return "bg-green-100 text-green-700 border-green-200";
  if (score >= 40) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-red-100 text-red-600 border-red-200";
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  const days = Math.floor(seconds / 86400);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/* ─── Outlet Row ─────────────────────────────────────────────────────── */

function OutletRow({ outlet, displayStatus, costCents, domainRating, isSelected, onClick }: { outlet: DeduplicatedOutlet; displayStatus: string; costCents: string | null; domainRating: number | null; isSelected: boolean; onClick: () => void }) {
  const cost = formatCost(costCents);
  const purchasePrice = formatPurchasePrice(outlet);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 p-4 rounded-xl border hover:border-brand-300 hover:shadow-sm transition bg-white cursor-pointer ${
        isSelected ? "border-brand-500 ring-1 ring-brand-500" : "border-gray-200"
      }`}
    >
      <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
        <BrandLogo domain={outlet.outletDomain} size={24} className="rounded" fallbackClassName="w-5 h-5 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-medium text-sm text-gray-800 truncate">{outlet.outletName}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${statusBadgeColor(displayStatus)}`}>
            {statusLabel(displayStatus)}
          </span>
          {outlet.campaigns[0]?.statusReason && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200 flex-shrink-0" title={outlet.campaigns[0].statusDetail ?? undefined}>
              {outlet.campaigns[0].statusReason}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-gray-400 truncate">{outlet.outletDomain}</p>
          <span className="text-xs text-gray-300">&middot;</span>
          <span className="text-xs text-gray-400 flex-shrink-0">{outlet.campaigns.length} campaign{outlet.campaigns.length !== 1 ? "s" : ""}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {domainRating != null && (
          <span className="text-xs text-gray-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
            DR {domainRating}
          </span>
        )}
        {purchasePrice && (
          <span className="text-xs text-gray-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
            {purchasePrice}
          </span>
        )}
        {cost && (
          <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
            {cost}
          </span>
        )}
        <span className={`text-xs font-medium px-2 py-1 rounded-full border ${relevanceColor(outlet.relevanceScore)}`}>
          {outlet.relevanceScore}%
        </span>
        <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

/* ─── Campaign Detail Card ──────────────────────────────────────────── */

function CampaignDetailCard({ campaign, counts }: { campaign: OutletCampaign; counts: OutletStatusCounts | null | undefined }) {
  const displayStatus = deriveDisplayStatusFromCounts(counts);
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-0.5 rounded">{campaign.featureSlug}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusBadgeColor(displayStatus)}`}>
            {statusLabel(displayStatus)}
          </span>
          {campaign.statusReason && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
              {campaign.statusReason}
            </span>
          )}
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full border ${relevanceColor(campaign.relevanceScore)}`}>
          {campaign.relevanceScore}%
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm mb-2">
        <div>
          <span className="text-gray-500 text-xs">Campaign ID</span>
          <p className="text-xs font-mono text-gray-700 truncate">{campaign.campaignId}</p>
        </div>
        <div>
          <span className="text-gray-500 text-xs">Updated</span>
          <p className="text-xs text-gray-700">{timeAgo(campaign.updatedAt)}</p>
        </div>
      </div>

      {campaign.statusDetail && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <span className="text-xs font-medium text-gray-500">Status Detail</span>
          <p className="text-sm text-gray-700 mt-0.5">{campaign.statusDetail}</p>
        </div>
      )}
      {campaign.whyRelevant && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <span className="text-xs font-medium text-gray-500">Why Relevant</span>
          <p className="text-sm text-gray-700 mt-0.5">{campaign.whyRelevant}</p>
        </div>
      )}
      {campaign.whyNotRelevant && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <span className="text-xs font-medium text-gray-500">Why Not Relevant</span>
          <p className="text-sm text-gray-700 mt-0.5">{campaign.whyNotRelevant}</p>
        </div>
      )}
      {(campaign.overallRelevance || campaign.relevanceRationale) && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <span className="text-xs font-medium text-gray-500">Relevance Assessment</span>
          {campaign.overallRelevance && (
            <p className="text-sm text-gray-700 mt-0.5"><span className="font-medium">Overall:</span> {campaign.overallRelevance}</p>
          )}
          {campaign.relevanceRationale && (
            <p className="text-sm text-gray-700 mt-0.5">{campaign.relevanceRationale}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Detail Panel ───────────────────────────────────────────────────── */

function OutletDetailPanel({
  outlet,
  displayStatus,
  costCents,
  monthlyVisits,
  domainRating,
  isFetchingMonthlyVisits,
  monthlyVisitsFetchError,
  monthlyVisitsFetchEmpty,
  onFetchMonthlyVisits,
  isFetchingDomainRating,
  domainRatingFetchError,
  domainRatingFetchEmpty,
  onFetchDomainRating,
  isRequestingPurchasePrice,
  purchasePriceRequestError,
  onRequestPurchasePrice,
  onClose,
}: {
  outlet: DeduplicatedOutlet;
  displayStatus: string;
  costCents: string | null;
  monthlyVisits: number | null;
  domainRating: number | null;
  isFetchingMonthlyVisits: boolean;
  monthlyVisitsFetchError: string | null;
  monthlyVisitsFetchEmpty: boolean;
  onFetchMonthlyVisits: () => void;
  isFetchingDomainRating: boolean;
  domainRatingFetchError: string | null;
  domainRatingFetchEmpty: boolean;
  onFetchDomainRating: () => void;
  isRequestingPurchasePrice: boolean;
  purchasePriceRequestError: string | null;
  onRequestPurchasePrice: () => void;
  onClose: () => void;
}) {
  const cost = formatCost(costCents);
  const purchasePrice = formatPurchasePrice(outlet);
  return (
    <div className="absolute inset-0 md:relative md:w-1/2 bg-gray-50 md:border-l border-gray-200 overflow-y-auto z-10">
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <button onClick={onClose} className="md:hidden flex items-center gap-2 text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="hidden md:flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
            <BrandLogo domain={outlet.outletDomain} size={24} className="rounded" fallbackClassName="w-5 h-5 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 truncate">{outlet.outletName}</h2>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hidden md:block">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4 md:p-6 space-y-4">
        {/* High-level outlet info */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-800">{outlet.outletName}</h3>
            <span className={`text-xs font-medium px-2 py-1 rounded-full border ${relevanceColor(outlet.relevanceScore)}`}>
              {outlet.relevanceScore}% relevance
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Domain</span>
              <p className="font-medium">{outlet.outletDomain}</p>
            </div>
            <div>
              <span className="text-gray-500">Status</span>
              <p>
                <span className={`text-xs px-2 py-1 rounded-full border ${statusBadgeColor(displayStatus)}`}>
                  {statusLabel(displayStatus)}
                </span>
              </p>
            </div>
            <div className="sm:col-span-2">
              <span className="text-gray-500">URL</span>
              <p>
                <a href={outlet.outletUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline text-sm break-all">
                  {outlet.outletUrl}
                </a>
              </p>
            </div>
            <div>
              <span className="text-gray-500">Discovered</span>
              <p className="text-gray-700">{new Date(outlet.createdAt).toLocaleDateString()} ({timeAgo(outlet.createdAt)})</p>
            </div>
            {cost && (
              <div>
                <span className="text-gray-500">Total Cost</span>
                <p className="font-medium text-gray-700">{cost}</p>
              </div>
            )}
            {monthlyVisits != null && (
              <div>
                <span className="text-gray-500">Monthly Visits</span>
                <p className="font-medium text-gray-700">{formatMonthlyVisits(monthlyVisits)}</p>
              </div>
            )}
            {monthlyVisits == null && (
              <div>
                <span className="text-gray-500">Monthly Visits</span>
                <div className="mt-1 flex flex-col items-start gap-1">
                  <button
                    type="button"
                    onClick={onFetchMonthlyVisits}
                    disabled={isFetchingMonthlyVisits}
                    className="text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 disabled:opacity-60 disabled:hover:bg-brand-50 px-2 py-1 rounded border border-brand-100"
                  >
                    {isFetchingMonthlyVisits ? "Fetching..." : "Get Monthly Visits"}
                  </button>
                  {monthlyVisitsFetchEmpty && (
                    <p className="text-xs text-gray-400">No visits found</p>
                  )}
                  {monthlyVisitsFetchError && (
                    <p className="text-xs text-red-600">{monthlyVisitsFetchError}</p>
                  )}
                </div>
              </div>
            )}
            {domainRating != null && (
              <div>
                <span className="text-gray-500">DR</span>
                <p className="font-medium text-gray-700">{domainRating}</p>
              </div>
            )}
            {domainRating == null && (
              <div>
                <span className="text-gray-500">DR</span>
                <div className="mt-1 flex flex-col items-start gap-1">
                  <button
                    type="button"
                    onClick={onFetchDomainRating}
                    disabled={isFetchingDomainRating}
                    className="text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 disabled:opacity-60 disabled:hover:bg-brand-50 px-2 py-1 rounded border border-brand-100"
                  >
                    {isFetchingDomainRating ? "Fetching..." : "Fetch DR"}
                  </button>
                  {domainRatingFetchEmpty && (
                    <p className="text-xs text-gray-400">No DR found</p>
                  )}
                  {domainRatingFetchError && (
                    <p className="text-xs text-red-600">{domainRatingFetchError}</p>
                  )}
                </div>
              </div>
            )}
            {purchasePrice && (
              <div>
                <span className="text-gray-500">Purchase Price</span>
                <p className="font-medium text-gray-700">{purchasePrice}</p>
              </div>
            )}
            {!purchasePrice && outlet.priceRequestStatus === "ongoing" && (
              <div>
                <span className="text-gray-500">Purchase Price</span>
                <p className="font-medium text-amber-700">Purchase price request in progress</p>
              </div>
            )}
            {!purchasePrice && outlet.priceRequestStatus !== "ongoing" && (
              <div>
                <span className="text-gray-500">Purchase Price</span>
                <div className="mt-1 flex flex-col items-start gap-1">
                  <button
                    type="button"
                    onClick={onRequestPurchasePrice}
                    disabled={isRequestingPurchasePrice}
                    className="text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 disabled:opacity-60 disabled:hover:bg-brand-50 px-2 py-1 rounded border border-brand-100"
                  >
                    {isRequestingPurchasePrice ? "Requesting..." : "Ask Purchase Price"}
                  </button>
                  {purchasePriceRequestError && (
                    <p className="text-xs text-red-600">{purchasePriceRequestError}</p>
                  )}
                </div>
              </div>
            )}
            <div>
              <span className="text-gray-500">Campaigns</span>
              <p className="font-medium text-gray-700">{outlet.campaigns.length}</p>
            </div>
          </div>
        </div>

        {/* Per-campaign detail */}
        <div>
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Campaign Details ({outlet.campaigns.length})</h4>
          <div className="space-y-3">
            {outlet.campaigns.map((c) => (
              <CampaignDetailCard key={c.campaignId} campaign={c} counts={outlet.status?.byCampaign?.[c.campaignId]} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────── */

export default function BrandOutletsPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<DeduplicatedOutlet | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [purchasePriceRequestScope, setPurchasePriceRequestScope] = useState<"page" | string | null>(null);
  const hasAutoSelectedTab = useRef(false);
  const outletsQueryKey = ["brandOutlets", brandId] as const;

  const { data, isPending } = useAuthQuery(
    outletsQueryKey,
    () => listBrandOutlets(brandId),
    pollOptions,
  );

  const { data: costsByOutlet } = useAuthQuery(
    ["outletStatsCosts", brandId, "outletId"],
    () => getOutletStatsCosts(brandId, "outletId"),
  );

  const outlets = data?.outlets ?? [];
  const selectedOutlet = useMemo(
    () => selected ? outlets.find((outlet) => outlet.id === selected.id) ?? selected : null,
    [outlets, selected],
  );

  const outletDomains = useMemo(
    () => [...new Set(outlets.map((o) => normalizeDomain(o.outletDomain)))].sort(),
    [outlets],
  );
  const domainDrQueryKey = useMemo(
    () => ["outletDomainDrStatuses", outletDomains.join(",")] as const,
    [outletDomains],
  );
  const domainTrafficQueryKey = useMemo(
    () => ["outletDomainTrafficHistories", outletDomains.join(",")] as const,
    [outletDomains],
  );

  const { data: domainTrafficHistories, isPending: isDomainTrafficHistoriesPending } = useAuthQuery(
    domainTrafficQueryKey,
    () => getDomainTrafficHistories(outletDomains),
    { enabled: outletDomains.length > 0 },
  );

  const { data: domainDrStatuses, isPending: isDomainDrStatusesPending } = useAuthQuery(
    domainDrQueryKey,
    () => getDomainDrStatuses(outletDomains),
    { enabled: outletDomains.length > 0 },
  );

  const fetchMonthlyVisitsMutation = useMutation({
    mutationFn: (domain: string) => computeDomainTraffic(domain),
    onSuccess: (result) => {
      if (result == null) return;
      queryClient.setQueryData<DomainTrafficHistory[]>(domainTrafficQueryKey, (prev) => {
        const resultDomain = normalizeDomain(result.domain);
        const next = (prev ?? []).filter((history) => normalizeDomain(history.domain) !== resultDomain);
        return [...next, result];
      });
    },
  });

  const fetchPageMonthlyVisitsMutation = useMutation({
    mutationFn: (domains: string[]) => computeDomainTrafficHistories(domains),
    onSuccess: (results) => {
      queryClient.setQueryData<DomainTrafficHistory[]>(domainTrafficQueryKey, (prev) => {
        const resultDomains = new Set(results.map((result) => normalizeDomain(result.domain)));
        const next = (prev ?? []).filter((history) => !resultDomains.has(normalizeDomain(history.domain)));
        return [...next, ...results];
      });
      void queryClient.invalidateQueries({ queryKey: domainTrafficQueryKey });
    },
  });

  const fetchDomainRatingMutation = useMutation({
    mutationFn: (domain: string) => computeDomainDr(domain),
    onSuccess: (result) => {
      if (result == null) return;
      queryClient.setQueryData<DomainDrStatus[]>(domainDrQueryKey, (prev) => {
        const resultDomain = normalizeDomain(result.domain);
        const next = (prev ?? []).filter((status) => normalizeDomain(status.domain) !== resultDomain);
        return [...next, result];
      });
    },
  });

  const fetchPageDomainRatingsMutation = useMutation({
    mutationFn: (domains: string[]) => computeDomainDrStatuses(domains),
    onSuccess: (results) => {
      queryClient.setQueryData<DomainDrStatus[]>(domainDrQueryKey, (prev) => {
        const resultDomains = new Set(results.map((result) => normalizeDomain(result.domain)));
        const next = (prev ?? []).filter((status) => !resultDomains.has(normalizeDomain(status.domain)));
        return [...next, ...results];
      });
      void queryClient.invalidateQueries({ queryKey: domainDrQueryKey });
    },
  });

  const requestPurchasePricesMutation = useMutation({
    mutationFn: (outletIds: string[]) => requestOutletPurchasePrices(outletIds),
    onSuccess: (result) => {
      queryClient.setQueryData<OutletListResponse>(outletsQueryKey, (prev) =>
        markOutletPriceRequestsOngoing(prev, result.results),
      );
      void queryClient.invalidateQueries({ queryKey: outletsQueryKey });
    },
  });

  const drMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const status of domainDrStatuses ?? []) {
      if (status.latestValidDr != null) map.set(normalizeDomain(status.domain), status.latestValidDr);
    }
    return map;
  }, [domainDrStatuses]);

  const trafficMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const history of domainTrafficHistories ?? []) {
      if (history.trafficMonthlyAvg != null) map.set(normalizeDomain(history.domain), history.trafficMonthlyAvg);
    }
    return map;
  }, [domainTrafficHistories]);

  const costMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of costsByOutlet?.groups ?? []) {
      const id = g.dimensions.outletId;
      if (id) map.set(id, g.totalCostInUsdCents);
    }
    return map;
  }, [costsByOutlet]);

  const totalCost = useMemo(() => {
    let total = 0;
    for (const g of costsByOutlet?.groups ?? []) {
      total += parseFloat(g.totalCostInUsdCents) || 0;
    }
    return total;
  }, [costsByOutlet]);

  const avgCostPerOutlet = outlets.length > 0 ? totalCost / outlets.length : 0;

  // Monotonic status latch — see use-monotonic-status.ts. The outlet status counts
  // are re-fetched on every poll, so a transient dropout would otherwise demote an
  // outlet out of the viewed tab. Keep the most-advanced status seen this mount;
  // `latchedStatuses` is the single source the tabs, row badge, and panel badge all
  // bucket on.
  const outletStatusEntries = useMemo(
    () => outlets.map((o) => ({ id: o.id, status: deriveDisplayStatusFromCounts(o.status?.brand) })),
    [outlets],
  );
  const latchedStatuses = useMonotonicStatuses(outletStatusEntries, STATUS_PRIORITY, "brand-outlets");

  // Full-list CSV (all outlets, ignores the active tab + search filter). Status &
  // cost mirror the card badge/chip via the page's own latched-status + cost maps.
  const csv = useMemo(
    () => buildOutletCsv(
      outlets,
      (o) => latchedStatuses.get(o.id) ?? deriveDisplayStatusFromCounts(o.status?.brand),
      (o) => costMap.get(o.id) ?? null,
      (o) => drMap.get(normalizeDomain(o.outletDomain)),
      (o) => formatPurchasePrice(o),
    ),
    [outlets, latchedStatuses, costMap, drMap],
  );

  // Group outlets by display status
  const groupedByStatus = useMemo(() => {
    const groups = new Map<string, DeduplicatedOutlet[]>();
    for (const status of STATUS_PRIORITY) {
      groups.set(status, []);
    }
    for (const o of outlets) {
      const ds = latchedStatuses.get(o.id) ?? deriveDisplayStatusFromCounts(o.status?.brand);
      groups.get(ds)?.push(o);
    }
    return groups;
  }, [outlets, latchedStatuses]);

  // Auto-select the first non-empty tab on initial data load
  useEffect(() => {
    if (hasAutoSelectedTab.current || outlets.length === 0) return;
    hasAutoSelectedTab.current = true;
    const first = STATUS_PRIORITY.find((s) => (groupedByStatus.get(s)?.length ?? 0) > 0);
    if (first) setActiveTab(first);
  }, [outlets.length, groupedByStatus]);

  // Tab counts: always use client-side grouping so counts match the displayed list.
  // Backend byOutreachStatus counts cumulatively (e.g. "delivered" includes outlets
  // who progressed to "contacted"), causing mismatches with the current-status grouping.
  const tabs: { key: Tab; label: string; count: number }[] = [
    ...STATUS_PRIORITY.map((status) => ({
      key: status as Tab,
      label: statusLabel(status),
      count: groupedByStatus.get(status)?.length ?? 0,
    })),
    { key: "all", label: "All", count: outlets.length },
  ];

  const displayedOutlets = useMemo(() => {
    const list = activeTab === "all"
      ? outlets
      : groupedByStatus.get(activeTab) ?? [];
    return [...list].sort((a, b) => b.relevanceScore - a.relevanceScore);
  }, [activeTab, outlets, groupedByStatus]);

  const filteredOutlets = useMemo(() => {
    if (!search) return displayedOutlets;
    const q = search.toLowerCase();
    return displayedOutlets.filter((o) =>
      o.outletName.toLowerCase().includes(q) || o.outletDomain.toLowerCase().includes(q)
    );
  }, [displayedOutlets, search]);
  const paginatedOutlets = usePaginated(filteredOutlets);
  useEffect(() => {
    paginatedOutlets.setPage(0);
  }, [activeTab, search, paginatedOutlets.setPage]);
  const currentPageDomainsMissingDr = useMemo(
    () => {
      if (isDomainDrStatusesPending) return [];
      return [
        ...new Set(
          paginatedOutlets.pageItems
            .map((outlet) => normalizeDomain(outlet.outletDomain))
            .filter((domain) => !drMap.has(domain)),
        ),
      ];
    },
    [isDomainDrStatusesPending, paginatedOutlets.pageItems, drMap],
  );
  const currentPageDomainsMissingTraffic = useMemo(
    () => {
      if (isDomainTrafficHistoriesPending) return [];
      return [
        ...new Set(
          paginatedOutlets.pageItems
            .map((outlet) => normalizeDomain(outlet.outletDomain))
            .filter((domain) => !trafficMap.has(domain)),
        ),
      ];
    },
    [isDomainTrafficHistoriesPending, paginatedOutlets.pageItems, trafficMap],
  );

  return (
    <div className="flex flex-col md:flex-row h-full relative">
      <div className={`${selected ? "hidden md:block md:w-1/2" : "w-full"} p-4 md:p-8 overflow-y-auto transition-all`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center text-brand-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Outlets</h1>
              {isPending && !data ? (
                <Skeleton className="h-4 w-48 mt-1" />
              ) : (
                <p className="text-sm text-gray-500">
                  {outlets.length.toLocaleString("en-US")} outlet{outlets.length !== 1 ? "s" : ""} across all campaigns
                  {totalCost > 0 && ` \u00b7 Total: $${(totalCost / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  {avgCostPerOutlet > 0 && ` \u00b7 Avg: $${(avgCostPerOutlet / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/outlet`}
                </p>
              )}
            </div>
          </div>
          <CsvDownloadButton filename={`outlets-${brandId}.csv`} csv={csv} isEmpty={outlets.length === 0} />
        </div>

        {/* Status tabs */}
        {!(isPending && !data) && outlets.length > 0 && (
          <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setSelected(null); }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                  activeTab === tab.key
                    ? "border-brand-600 text-brand-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
                <span className="ml-1.5 text-xs font-normal text-gray-400">({tab.count})</span>
              </button>
            ))}
          </div>
        )}

        {/* Outlet list */}
        {isPending && !data ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : outlets.length === 0 ? (
          <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-8 text-center">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No outlets yet</h3>
            <p className="text-gray-500 text-sm">
              Outlets will appear here once discovered by campaigns.
            </p>
          </div>
        ) : (
          <>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1">
              <EntitySearchBar value={search} onChange={setSearch} placeholder="Search by outlet name or domain..." resultCount={filteredOutlets.length} totalCount={displayedOutlets.length} className="" />
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => fetchPageMonthlyVisitsMutation.mutate(currentPageDomainsMissingTraffic)}
                disabled={isDomainTrafficHistoriesPending || fetchPageMonthlyVisitsMutation.isPending || currentPageDomainsMissingTraffic.length === 0}
                className="h-10 shrink-0 rounded-lg border border-brand-200 bg-brand-50 px-3 text-sm font-medium text-brand-700 transition hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-brand-50"
              >
                {fetchPageMonthlyVisitsMutation.isPending ? "Fetching..." : `Get Monthly Visits (${currentPageDomainsMissingTraffic.length})`}
              </button>
              <button
                type="button"
                onClick={() => fetchPageDomainRatingsMutation.mutate(currentPageDomainsMissingDr)}
                disabled={isDomainDrStatusesPending || fetchPageDomainRatingsMutation.isPending || currentPageDomainsMissingDr.length === 0}
                className="h-10 shrink-0 rounded-lg border border-brand-200 bg-brand-50 px-3 text-sm font-medium text-brand-700 transition hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-brand-50"
              >
                {fetchPageDomainRatingsMutation.isPending ? "Fetching..." : `Get Domain Ratings (${currentPageDomainsMissingDr.length})`}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPurchasePriceRequestScope("page");
                  requestPurchasePricesMutation.mutate(paginatedOutlets.pageItems.map((outlet) => outlet.id));
                }}
                disabled={requestPurchasePricesMutation.isPending || paginatedOutlets.pageItems.length === 0}
                className="h-10 shrink-0 rounded-lg border border-brand-200 bg-brand-50 px-3 text-sm font-medium text-brand-700 transition hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-brand-50"
              >
                {requestPurchasePricesMutation.isPending ? "Requesting..." : `Ask Purchase Price (${paginatedOutlets.pageItems.length})`}
              </button>
            </div>
          </div>
          {fetchPageMonthlyVisitsMutation.isError && (
            <p className="mb-3 text-xs text-red-600">{fetchPageMonthlyVisitsMutation.error.message}</p>
          )}
          {fetchPageDomainRatingsMutation.isError && (
            <p className="mb-3 text-xs text-red-600">{fetchPageDomainRatingsMutation.error.message}</p>
          )}
          {requestPurchasePricesMutation.isError && purchasePriceRequestScope === "page" && (
            <p className="mb-3 text-xs text-red-600">{requestPurchasePricesMutation.error.message}</p>
          )}
          <div className="space-y-2">
            {paginatedOutlets.pageItems.map((outlet) => (
              <OutletRow
                key={outlet.id}
                outlet={outlet}
                displayStatus={latchedStatuses.get(outlet.id) ?? deriveDisplayStatusFromCounts(outlet.status?.brand)}
                costCents={costMap.get(outlet.id) ?? null}
                domainRating={drMap.get(normalizeDomain(outlet.outletDomain)) ?? null}
                isSelected={selected?.id === outlet.id}
                onClick={() => setSelected(outlet)}
              />
            ))}
          </div>
          <TablePager
            page={paginatedOutlets.page}
            pageCount={paginatedOutlets.pageCount}
            from={paginatedOutlets.from}
            to={paginatedOutlets.to}
            total={paginatedOutlets.total}
            onPage={paginatedOutlets.setPage}
          />
          </>
        )}
      </div>

      {/* Detail Panel */}
      {selectedOutlet && (
        <OutletDetailPanel
          outlet={selectedOutlet}
          displayStatus={latchedStatuses.get(selectedOutlet.id) ?? deriveDisplayStatusFromCounts(selectedOutlet.status?.brand)}
          costCents={costMap.get(selectedOutlet.id) ?? null}
          monthlyVisits={trafficMap.get(normalizeDomain(selectedOutlet.outletDomain)) ?? null}
          isFetchingMonthlyVisits={fetchMonthlyVisitsMutation.isPending && fetchMonthlyVisitsMutation.variables === normalizeDomain(selectedOutlet.outletDomain)}
          monthlyVisitsFetchError={
            fetchMonthlyVisitsMutation.isError && fetchMonthlyVisitsMutation.variables === normalizeDomain(selectedOutlet.outletDomain)
              ? fetchMonthlyVisitsMutation.error.message
              : null
          }
          monthlyVisitsFetchEmpty={
            fetchMonthlyVisitsMutation.isSuccess &&
            fetchMonthlyVisitsMutation.variables === normalizeDomain(selectedOutlet.outletDomain) &&
            fetchMonthlyVisitsMutation.data?.trafficMonthlyAvg == null
          }
          onFetchMonthlyVisits={() => fetchMonthlyVisitsMutation.mutate(normalizeDomain(selectedOutlet.outletDomain))}
          domainRating={drMap.get(normalizeDomain(selectedOutlet.outletDomain)) ?? null}
          isFetchingDomainRating={fetchDomainRatingMutation.isPending && fetchDomainRatingMutation.variables === normalizeDomain(selectedOutlet.outletDomain)}
          domainRatingFetchError={
            fetchDomainRatingMutation.isError && fetchDomainRatingMutation.variables === normalizeDomain(selectedOutlet.outletDomain)
              ? fetchDomainRatingMutation.error.message
              : null
          }
          domainRatingFetchEmpty={
            fetchDomainRatingMutation.isSuccess &&
            fetchDomainRatingMutation.variables === normalizeDomain(selectedOutlet.outletDomain) &&
            fetchDomainRatingMutation.data == null
          }
          onFetchDomainRating={() => fetchDomainRatingMutation.mutate(normalizeDomain(selectedOutlet.outletDomain))}
          isRequestingPurchasePrice={requestPurchasePricesMutation.isPending && purchasePriceRequestScope === selectedOutlet.id}
          purchasePriceRequestError={
            requestPurchasePricesMutation.isError && purchasePriceRequestScope === selectedOutlet.id
              ? requestPurchasePricesMutation.error.message
              : null
          }
          onRequestPurchasePrice={() => {
            setPurchasePriceRequestScope(selectedOutlet.id);
            requestPurchasePricesMutation.mutate([selectedOutlet.id]);
          }}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
