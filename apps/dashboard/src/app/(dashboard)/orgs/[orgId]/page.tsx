"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { WORKFLOW_DEFINITIONS, OUTCOME_LABELS } from "@distribute/content";
import type { OutcomeType } from "@distribute/content";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listBrands, listCampaigns, getCampaignBatchStats } from "@/lib/api";
import { BrandLogo } from "@/components/brand-logo";

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

  const { data: brandsData, isLoading: brandsLoading } = useAuthQuery(
    ["brands"],
    () => listBrands()
  );
  const brands = brandsData?.brands ?? [];

  const { data: campaignsData, isLoading: campaignsLoading } = useAuthQuery(
    ["campaigns"],
    () => listCampaigns()
  );
  const campaigns = campaignsData?.campaigns ?? [];

  const recentCampaigns = useMemo(
    () =>
      [...campaigns]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
    [campaigns]
  );

  const campaignIds = useMemo(() => campaigns.map((c) => c.id), [campaigns]);
  const { data: batchStats } = useAuthQuery(
    ["campaignBatchStats", "overview", ...campaignIds],
    () => getCampaignBatchStats(campaignIds),
    { enabled: campaignIds.length > 0 }
  );

  const totals = useMemo(() => {
    if (!batchStats) return { emailsSent: 0, emailsReplied: 0, totalCostCents: 0 };
    return Object.values(batchStats).reduce(
      (acc, s) => ({
        emailsSent: acc.emailsSent + (s.emailsSent || 0),
        emailsReplied: acc.emailsReplied + (s.emailsReplied || 0),
        totalCostCents: acc.totalCostCents + (parseFloat(s.totalCostInUsdCents ?? "0") || 0),
      }),
      { emailsSent: 0, emailsReplied: 0, totalCostCents: 0 }
    );
  }, [batchStats]);

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
        <StatCard label="Replies" value={totals.emailsReplied} />
      </div>

      {/* Brands Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Brands</h2>
          {brands.length > 0 && (
            <Link
              href={`/orgs/${orgId}/brands`}
              className="text-sm text-brand-500 hover:text-brand-600"
            >
              View all →
            </Link>
          )}
        </div>
        {brands.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 mb-3">No brands yet. Set up your first brand to get started.</p>
            <Link
              href={`/outcomes/sales-email-cold-outreach/new`}
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

      {/* Outcomes */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Outcomes</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(() => {
            const seen = new Set<OutcomeType>();
            return WORKFLOW_DEFINITIONS.filter((wf) => {
              const oc = wf.targetOutcomes[0];
              if (!oc || seen.has(oc)) return false;
              seen.add(oc);
              return true;
            }).map((wf) => (
              <Link
                key={wf.sectionKey}
                href={wf.implemented ? `/outcomes/${wf.sectionKey}` : "#"}
                className={`flex items-center gap-3 p-3 rounded-lg border transition ${
                  wf.implemented
                    ? "border-gray-200 hover:border-brand-300 hover:shadow-sm"
                    : "border-gray-100 opacity-60 cursor-default"
                }`}
              >
                <span className="text-sm font-medium text-gray-700">{OUTCOME_LABELS[wf.targetOutcomes[0]]}</span>
                {!wf.implemented && (
                  <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full whitespace-nowrap ml-auto">
                    Coming soon
                  </span>
                )}
              </Link>
            ));
          })()}
        </div>
      </div>

      {/* Recent Campaigns */}
      {recentCampaigns.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Campaigns</h2>
          <div className="space-y-2">
            {recentCampaigns.map((campaign) => (
              <div key={campaign.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition">
                <div>
                  <span className="text-sm font-medium text-gray-700">{campaign.name}</span>
                  <span className="text-xs text-gray-400 ml-2">
                    {new Date(campaign.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
