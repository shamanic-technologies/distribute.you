"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getBrand, listCampaignsByBrand, getCampaignBatchStats, type Brand, type Campaign, type CampaignStats } from "@/lib/api";
import { BrandLogo } from "@/components/brand-logo";

function formatCost(cents: string | null | undefined): string | null {
  if (!cents) return null;
  const val = parseFloat(cents);
  if (isNaN(val) || val === 0) return null;
  const usd = val / 100;
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

// Available MCPs
const MCPS = [
  {
    slug: "sales-outreach",
    name: "Sales Cold Emails",
    description: "Automated cold email campaigns to reach prospects",
    icon: "📧",
  },
];

export default function BrandOverviewPage() {
  const params = useParams();
  const brandId = params.brandId as string;

  const { data: brandData, isLoading: brandLoading } = useAuthQuery(
    ["brand", brandId],
    (token) => getBrand(token, brandId)
  );
  const brand = brandData?.brand ?? null;

  const { data: campaignsData } = useAuthQuery(
    ["campaigns", { brandId }],
    (token) => listCampaignsByBrand(token, brandId)
  );
  const campaigns = campaignsData?.campaigns ?? [];

  const campaignIds = useMemo(() => campaigns.map(c => c.id), [campaigns]);

  const { data: batchStats } = useAuthQuery(
    ["campaignBatchStats", { brandId }, campaignIds],
    (token) => getCampaignBatchStats(token, campaignIds),
    { enabled: campaignIds.length > 0 }
  );
  const campaignStats = batchStats ?? {};

  if (brandLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="p-4 md:p-8">
        <p className="text-gray-500">Brand not found</p>
      </div>
    );
  }

  const ongoingCampaigns = campaigns.filter(c => c.status === "ongoing");

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      {/* Brand Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden">
            <BrandLogo domain={brand.domain} size={28} fallbackClassName="h-6 w-6 text-gray-400" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {brand.name || brand.domain}
          </h1>
        </div>
        <a
          href={brand.brandUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary-600 hover:underline"
        >
          {brand.brandUrl}
        </a>
      </div>

      {/* Brand Info Card */}
      <Link
        href={`/brands/${brandId}/brand-info`}
        className="block bg-white rounded-lg border border-gray-200 p-5 mb-6 hover:border-primary-300 hover:shadow-sm transition group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-lg">
              ℹ️
            </div>
            <div>
              <h3 className="font-medium text-gray-900 group-hover:text-primary-600 transition">Brand Info</h3>
              <p className="text-sm text-gray-500">Company details, value proposition, sales profile</p>
            </div>
          </div>
          <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </Link>

      {/* MCPs Section */}
      <div className="mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">MCPs</h2>
        <div className="space-y-4">
          {MCPS.map(mcp => {
            // For now all campaigns are from sales-outreach MCP
            const mcpCampaigns = mcp.slug === "sales-outreach" ? campaigns : [];
            const activeCampaigns = mcpCampaigns.filter(c => c.status === "ongoing");

            return (
              <div
                key={mcp.slug}
                className="bg-white rounded-lg border border-gray-200 p-5"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center text-lg">
                      {mcp.icon}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{mcp.name}</h3>
                      <p className="text-sm text-gray-500">{mcp.description}</p>
                    </div>
                  </div>
                </div>

                {/* Campaign Stats */}
                {(() => {
                  let mcpTotalCost = 0;
                  for (const c of mcpCampaigns) {
                    const s = campaignStats[c.id];
                    if (s?.totalCostInUsdCents) {
                      mcpTotalCost += parseFloat(s.totalCostInUsdCents) || 0;
                    }
                  }
                  const costStr = mcpTotalCost > 0 ? String(mcpTotalCost) : null;
                  return (
                    <div className="flex items-center gap-6 mb-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        <span className="text-gray-600">{activeCampaigns.length} active</span>
                      </div>
                      <div className="text-gray-400">
                        {mcpCampaigns.length} total campaigns
                      </div>
                      {formatCost(costStr) && (
                        <div className="text-gray-400">
                          Total: {formatCost(costStr)}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Recent Campaigns Preview */}
                {mcpCampaigns.length > 0 && (
                  <div className="border-t border-gray-100 pt-4 mb-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Recent Campaigns</p>
                    <div className="space-y-2">
                      {mcpCampaigns.slice(0, 3).map(campaign => (
                        <Link
                          key={campaign.id}
                          href={`/brands/${brandId}/mcp/${mcp.slug}/campaigns/${campaign.id}`}
                          className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded hover:bg-gray-50 transition"
                        >
                          <span className="text-sm text-gray-700 truncate">{campaign.name}</span>
                          <span className={`
                            px-2 py-0.5 text-xs rounded-full
                            ${campaign.status === "ongoing"
                              ? "bg-green-100 text-green-700"
                              : campaign.status === "failed"
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-600"
                            }
                          `}>
                            {campaign.status}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3">
                  <Link
                    href={`/brands/${brandId}/mcp/${mcp.slug}`}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-medium"
                  >
                    {mcpCampaigns.length > 0 ? "View Campaigns" : "Open MCP"}
                  </Link>
                  <Link
                    href={`/brands/${brandId}/mcp/${mcp.slug}/prompt`}
                    className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm"
                  >
                    Configure Prompt
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
