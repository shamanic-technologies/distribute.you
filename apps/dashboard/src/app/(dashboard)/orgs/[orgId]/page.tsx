"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useFeatures } from "@/lib/features-context";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listBrands, listCampaigns, fetchGlobalStats } from "@/lib/api";
import { BrandLogo } from "@/components/brand-logo";
import { OrgUsageSection } from "@/components/org-usage";

const POLL_INTERVAL = 5_000;
const pollOptions = { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false };

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-semibold text-gray-800">{value}</p>
    </div>
  );
}

export default function OrgOverviewPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const { features } = useFeatures();

  const { data: brandsData, isLoading: brandsLoading } = useAuthQuery(
    ["brands"],
    () => listBrands(),
    pollOptions,
  );
  const brands = brandsData?.brands ?? [];

  const { data: campaignsData, isLoading: campaignsLoading } = useAuthQuery(
    ["campaigns"],
    () => listCampaigns(),
    pollOptions,
  );
  const campaigns = campaignsData?.campaigns ?? [];

  const recentCampaigns = useMemo(
    () =>
      [...campaigns]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
    [campaigns]
  );

  const { data: globalStats } = useAuthQuery(
    ["globalStats", "overview"],
    () => fetchGlobalStats(),
    pollOptions,
  );

  const totals = useMemo(() => ({
    emailsSent: globalStats?.stats?.emailsSent ?? 0,
    repliesPositive: globalStats?.stats?.repliesPositive ?? 0,
    totalCostCents: globalStats?.systemStats?.totalCostInUsdCents ?? 0,
  }), [globalStats]);

  const isLoading = brandsLoading || campaignsLoading;

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Overview</h1>

      {/* Quick Stats */}
      <div data-testid="overview-stats" className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Brands" value={brands.length} />
        <StatCard label="Campaigns" value={campaigns.length} />
        <StatCard label="Emails Sent" value={totals.emailsSent} />
        <StatCard label="Positive Replies" value={totals.repliesPositive} />
      </div>

      {/* Brands Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Brands</h2>
          <div className="flex items-center gap-3">
            {brands.length > 4 && (
              <Link
                href={`/orgs/${orgId}/brands`}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                View all →
              </Link>
            )}
            <Link
              href={`/orgs/${orgId}/brands`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Brand
            </Link>
          </div>
        </div>
        {brands.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 mb-3">No brands yet. Set up your first brand to get started.</p>
            <Link
              href={`/features/sales-email-cold-outreach/new`}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Launch your first campaign
            </Link>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto">
            {brands.slice(0, 4).map((brand) => (
              <Link
                key={brand.id}
                href={`/orgs/${orgId}/brands/${brand.id}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:border-brand-300 transition min-w-0 shrink-0"
              >
                <BrandLogo domain={brand.domain} size={24} fallbackClassName="h-5 w-5 text-gray-400" />
                <span className="text-sm font-medium text-gray-700 truncate">{brand.name || brand.domain}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Features Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Features</h2>
          <div className="flex items-center gap-3">
            {features.length > 6 && (
              <Link
                href={`/features`}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                View all →
              </Link>
            )}
            {brands.length > 0 ? (
              <Link
                href={`/orgs/${orgId}/brands/${brands[0].id}/features/new`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create
              </Link>
            ) : (
              <span
                title="Create a brand first"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-200 text-gray-400 cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {features.map((f) => (
            <Link
              key={f.dynastySlug ?? f.slug}
              href={f.implemented ? `/features/${f.dynastySlug ?? f.slug}` : "#"}
              className={`flex items-center gap-3 p-3 rounded-lg border transition ${
                f.implemented
                  ? "border-gray-200 hover:border-brand-300 hover:shadow-sm"
                  : "border-gray-100 opacity-60 cursor-default"
              }`}
            >
              <span className="text-sm font-medium text-gray-700">{f.dynastyName ?? f.name}</span>
              {!f.implemented && (
                <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full whitespace-nowrap ml-auto">
                  Coming soon
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Usage */}
      <div className="mb-6">
        <OrgUsageSection brands={brands} />
      </div>

      {/* Recent Campaigns */}
      {recentCampaigns.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Campaigns</h2>
          <div className="space-y-1 overflow-x-auto">
            {recentCampaigns.map((campaign) => {
              const featureSlug = campaign.featureSlug ?? null;
              const primaryBrandId = campaign.brandIds[0] ?? null;
              const brand = primaryBrandId ? brands.find((b) => b.id === primaryBrandId) : undefined;
              const feature = featureSlug ? (features.find((f) => f.dynastySlug === featureSlug) ?? features.find((f) => f.slug === featureSlug)) : null;
              const href = featureSlug && primaryBrandId
                ? `/orgs/${orgId}/brands/${primaryBrandId}/features/${featureSlug}/campaigns/${campaign.id}`
                : null;

              const row = (
                <div className="flex items-center gap-3 py-2 px-3">
                  {/* Brand */}
                  <div className="flex items-center gap-2 min-w-0 w-36 shrink-0">
                    {brand ? (
                      <>
                        <BrandLogo domain={brand.domain} size={20} fallbackClassName="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-700 truncate">{brand.name || brand.domain}</span>
                      </>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </div>
                  {/* Feature */}
                  <span className="text-xs text-gray-500 truncate w-32 shrink-0">
                    {feature?.name ?? featureSlug ?? "—"}
                  </span>
                  {/* Date */}
                  <span className="text-xs text-gray-400 w-20 shrink-0">
                    {new Date(campaign.createdAt).toLocaleDateString()}
                  </span>
                  {/* Status */}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ml-auto shrink-0 ${
                      campaign.status === "ongoing"
                        ? "bg-blue-100 text-blue-700"
                        : campaign.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {campaign.status}
                  </span>
                </div>
              );

              return href ? (
                <Link key={campaign.id} href={href} className="block rounded-lg hover:bg-gray-50 transition">
                  {row}
                </Link>
              ) : (
                <div key={campaign.id} className="rounded-lg">
                  {row}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
