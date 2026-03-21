"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getBrand, listCampaignsByBrand, getCampaignBatchStats, type Brand, type Campaign, type CampaignStats } from "@/lib/api";
import { BrandLogo } from "@/components/brand-logo";
import { getSectionKey, getWorkflowDisplayName, SECTION_LABELS, WORKFLOW_DEFINITIONS } from "@distribute/content";

const POLL_INTERVAL = 5_000;
const pollOptions = { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false };

function formatCost(cents: string | null | undefined): string | null {
  if (!cents) return null;
  const val = parseFloat(cents);
  if (isNaN(val) || val === 0) return null;
  const usd = val / 100;
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

function FeatureIcon({ sectionKey, className }: { sectionKey: string; className?: string }) {
  if (sectionKey.startsWith("sales") || sectionKey.startsWith("welcome")) {
    return (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    );
  }
  if (sectionKey.startsWith("journalists")) {
    return (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
      </svg>
    );
  }
  if (sectionKey.startsWith("webinar")) {
    return (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h4v4H4zM10 14h4v4h-4zM16 6h4v4h-4zM6 10v4l4 0M18 10v4l-4 0" />
    </svg>
  );
}

interface WorkflowSection {
  sectionKey: string;
  label: string;
  campaigns: Campaign[];
}

export default function BrandOverviewPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const orgId = params.orgId as string;

  const { data: brandData, isLoading: brandLoading } = useAuthQuery(
    ["brand", brandId],
    () => getBrand(brandId),
    pollOptions,
  );
  const brand = brandData?.brand ?? null;

  const { data: campaignsData } = useAuthQuery(
    ["campaigns", { brandId }],
    () => listCampaignsByBrand(brandId),
    pollOptions,
  );
  const campaigns = campaignsData?.campaigns ?? [];

  const campaignIds = useMemo(() => campaigns.map(c => c.id), [campaigns]);

  const { data: batchStats } = useAuthQuery(
    ["campaignBatchStats", { brandId }, campaignIds],
    () => getCampaignBatchStats(campaignIds, undefined, brandId),
    { enabled: campaignIds.length > 0, ...pollOptions },
  );
  const campaignStats = batchStats ?? {};

  // Build workflow sections from actual campaigns
  const workflowSections = useMemo(() => {
    const map = new Map<string, Campaign[]>();
    for (const c of campaigns) {
      const key = c.workflowName ? getSectionKey(c.workflowName) : null;
      const section = key ?? "unknown";
      if (!map.has(section)) map.set(section, []);
      map.get(section)!.push(c);
    }
    const sections: WorkflowSection[] = [];
    for (const [sectionKey, sectionCampaigns] of map) {
      sections.push({
        sectionKey,
        label: SECTION_LABELS[sectionKey] ?? getWorkflowDisplayName(sectionCampaigns[0]?.workflowName ?? sectionKey),
        campaigns: sectionCampaigns,
      });
    }
    return sections;
  }, [campaigns]);

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
          className="text-sm text-brand-600 hover:underline"
        >
          {brand.brandUrl}
        </a>
      </div>

      {/* Brand Tools */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Link
          href={`/orgs/${orgId}/brands/${brandId}/brand-info`}
          className="bg-white rounded-lg border border-gray-200 p-5 hover:border-brand-300 hover:shadow-sm transition group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-lg">
                &#8505;&#65039;
              </div>
              <div>
                <h3 className="font-medium text-gray-900 group-hover:text-brand-600 transition">Brand Info</h3>
                <p className="text-sm text-gray-500">Company details, value proposition</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-400 group-hover:text-brand-600 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
        <Link
          href={`/orgs/${orgId}/brands/${brandId}/press-kit`}
          className="bg-white rounded-lg border border-gray-200 p-5 hover:border-brand-300 hover:shadow-sm transition group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 group-hover:text-brand-600 transition">Press Kit</h3>
                <p className="text-sm text-gray-500">Generate press kits for media outreach</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-400 group-hover:text-brand-600 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      </div>

      {/* Features Section */}
      <div className="mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {WORKFLOW_DEFINITIONS.map((wf) => {
            const section = workflowSections.find(s => s.sectionKey === wf.sectionKey);
            const activeCampaigns = section?.campaigns.filter(c => c.status === "ongoing") ?? [];

            if (wf.implemented) {
              return (
                <Link
                  key={wf.sectionKey}
                  href={`/orgs/${orgId}/brands/${brandId}/features/${wf.sectionKey}`}
                  className="bg-white rounded-lg border border-gray-200 p-5 hover:border-brand-300 hover:shadow-sm transition group"
                >
                  <div className="flex items-start gap-3">
                    <FeatureIcon sectionKey={wf.sectionKey} className="w-8 h-8 text-brand-600" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 group-hover:text-brand-600 transition">{wf.label}</h3>
                      <p className="text-sm text-gray-500 mt-1">{wf.description}</p>
                      {section && (
                        <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                            {activeCampaigns.length} active
                          </span>
                          <span>{section.campaigns.length} total</span>
                        </div>
                      )}
                    </div>
                    <svg className="w-5 h-5 text-gray-300 group-hover:text-brand-600 transition flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              );
            }

            return (
              <div
                key={wf.sectionKey}
                className="bg-gray-50 rounded-lg border border-gray-200 p-5 opacity-60"
              >
                <div className="flex items-start gap-3">
                  <FeatureIcon sectionKey={wf.sectionKey} className="w-8 h-8 text-gray-300" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-400">{wf.label}</h3>
                      <span className="text-[10px] bg-gray-200 text-gray-400 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        Coming soon
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{wf.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
