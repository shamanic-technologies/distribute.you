"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getBrand,
  listCampaignsByBrand,
  getCampaignBatchStats,
  listBrandOutlets,
  listJournalistsEnriched,
  listBrandLeads,
  listBrandEmails,
  listBrandArticles,
  type Brand,
  type Campaign,
  type CampaignStats,
} from "@/lib/api";
import { BrandLogo } from "@/components/brand-logo";
import { BrandUsageSection } from "@/components/brand-usage";
import { Skeleton } from "@/components/skeleton";
import { formatCount } from "@/lib/format-number";
import { useFeatures } from "@/lib/features-context";
import {
  GlobeAltIcon,
  MegaphoneIcon,
  EnvelopeIcon,
  MagnifyingGlassIcon,
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  DocumentTextIcon,
  PresentationChartBarIcon,
  CursorArrowRaysIcon,
  BoltIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import type { ComponentType, SVGProps } from "react";

const ICON_MAP: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  globe: GlobeAltIcon,
  megaphone: MegaphoneIcon,
  envelope: EnvelopeIcon,
  search: MagnifyingGlassIcon,
  chat: ChatBubbleLeftRightIcon,
  users: UserGroupIcon,
  document: DocumentTextIcon,
  presentation: PresentationChartBarIcon,
  cursor: CursorArrowRaysIcon,
  bolt: BoltIcon,
  cog: Cog6ToothIcon,
};

const POLL_INTERVAL = 5_000;
const pollOptions = { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false };

function formatCost(cents: string | null | undefined): string | null {
  if (!cents) return null;
  const val = parseFloat(cents);
  if (isNaN(val) || val === 0) return null;
  const usd = val / 100;
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function FeatureIcon({ featureSlug, icon, className }: { featureSlug: string; icon?: string; className?: string }) {
  if (icon) {
    const IconComponent = ICON_MAP[icon];
    if (IconComponent) return <IconComponent className={className} />;
  }
  // Fallback to slug-based icons
  if (featureSlug.startsWith("sales") || featureSlug.startsWith("welcome")) {
    return (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    );
  }
  if (featureSlug.startsWith("journalists")) {
    return (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
      </svg>
    );
  }
  if (featureSlug.startsWith("press-kit")) {
    return (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }
  if (featureSlug.startsWith("outlets")) {
    return (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    );
  }
  if (featureSlug.startsWith("webinar")) {
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
  featureSlug: string;
  label: string;
  campaigns: Campaign[];
}

export default function BrandOverviewPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const orgId = params.orgId as string;
  const { features, getFeature: getFeatureDef } = useFeatures();

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

  // Brand-level outcome counts
  const { data: outletsData, isLoading: outletsLoading } = useAuthQuery(
    ["brandOutlets", brandId],
    () => listBrandOutlets(brandId),
    pollOptions,
  );
  const { data: journalistsData, isLoading: journalistsLoading } = useAuthQuery(
    ["enrichedJournalists", brandId],
    () => listJournalistsEnriched(brandId),
    pollOptions,
  );
  const { data: leadsData, isLoading: leadsLoading } = useAuthQuery(
    ["brandLeads", brandId],
    () => listBrandLeads(brandId),
    pollOptions,
  );
  const { data: emailsData, isLoading: emailsLoading } = useAuthQuery(
    ["brandEmails", brandId],
    () => listBrandEmails(brandId),
    pollOptions,
  );
  const { data: articlesData, isLoading: articlesLoading } = useAuthQuery(
    ["brandArticles", brandId],
    () => listBrandArticles(brandId),
    pollOptions,
  );

  const outcomeLoading: Record<string, boolean> = {
    outlets: outletsLoading,
    journalists: journalistsLoading,
    articles: articlesLoading,
    leads: leadsLoading,
    emails: emailsLoading,
  };

  const outcomeCounts = useMemo(() => ({
    outlets: outletsData?.outlets?.length ?? 0,
    journalists: journalistsData?.journalists?.length ?? 0,
    articles: articlesData?.discoveries?.length ?? 0,
    leads: leadsData?.leads?.length ?? 0,
    emails: emailsData?.emails?.length ?? 0,
  }), [outletsData, journalistsData, articlesData, leadsData, emailsData]);

  // Build workflow sections from actual campaigns, grouped by feature slug
  const workflowSections = useMemo(() => {
    const map = new Map<string, Campaign[]>();
    for (const c of campaigns) {
      const fSlug = c.featureSlug ?? "unknown";
      if (!map.has(fSlug)) map.set(fSlug, []);
      map.get(fSlug)!.push(c);
    }
    const sections: WorkflowSection[] = [];
    for (const [fSlug, sectionCampaigns] of map) {
      sections.push({
        featureSlug: fSlug,
        label: getFeatureDef(fSlug)?.name ?? fSlug,
        campaigns: sectionCampaigns,
      });
    }
    return sections;
  }, [campaigns, getFeatureDef]);

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
        {brand.brandUrl && (
          <a
            href={brand.brandUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-brand-600 hover:underline"
          >
            {brand.brandUrl}
          </a>
        )}
      </div>

      {/* Brand Info Card */}
      <Link
        href={`/orgs/${orgId}/brands/${brandId}/brand-info`}
        className="block bg-white rounded-lg border border-gray-200 p-5 mb-6 hover:border-brand-300 hover:shadow-sm transition group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-lg">
              &#8505;&#65039;
            </div>
            <div>
              <h3 className="font-medium text-gray-900 group-hover:text-brand-600 transition">Brand Info</h3>
              <p className="text-sm text-gray-500">Company details, value proposition, sales profile</p>
            </div>
          </div>
          <svg className="w-5 h-5 text-gray-400 group-hover:text-brand-600 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </Link>

      {/* Outcomes Section */}
      <div className="mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Outcomes</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {([
            { key: "outlets", label: "Outlets", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
            { key: "journalists", label: "Journalists", icon: "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" },
            { key: "articles", label: "Articles", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
            { key: "leads", label: "Leads", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
            { key: "emails", label: "Emails", icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
          ] as const).map(({ key, label, icon }) => (
            <Link
              key={key}
              href={`/orgs/${orgId}/brands/${brandId}/${key}`}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:border-brand-300 hover:shadow-sm transition group text-center"
            >
              <svg className="w-6 h-6 text-gray-400 group-hover:text-brand-600 transition mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
              </svg>
              <p className="text-sm font-medium text-gray-700 group-hover:text-brand-600 transition">{label}</p>
              {outcomeLoading[key] ? (
                <Skeleton className="h-6 w-8 mx-auto mt-1" />
              ) : (
                <p className="text-lg font-semibold text-gray-900 mt-1">{formatCount(outcomeCounts[key])}</p>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Features Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Features</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map((f) => {
            const section = workflowSections.find(s => s.featureSlug === f.slug);
            const activeCampaigns = section?.campaigns.filter(c => c.status === "ongoing") ?? [];

            if (f.implemented) {
              return (
                <Link
                  key={f.slug}
                  href={`/orgs/${orgId}/brands/${brandId}/features/${f.slug}`}
                  className="bg-white rounded-lg border border-gray-200 p-5 hover:border-brand-300 hover:shadow-sm transition group"
                >
                  <div className="flex items-start gap-3">
                    <FeatureIcon featureSlug={f.slug} icon={f.icon} className="w-8 h-8 text-brand-600" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 group-hover:text-brand-600 transition">{f.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{f.description}</p>
                      {section && (
                        <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                            {activeCampaigns.length.toLocaleString("en-US")} active
                          </span>
                          <span>{section.campaigns.length.toLocaleString("en-US")} total</span>
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
                key={f.slug}
                className="bg-gray-50 rounded-lg border border-gray-200 p-5 opacity-60"
              >
                <div className="flex items-start gap-3">
                  <FeatureIcon featureSlug={f.slug} icon={f.icon} className="w-8 h-8 text-gray-300" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-400">{f.name}</h3>
                      <span className="text-[10px] bg-gray-200 text-gray-400 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        Coming soon
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{f.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Usage Section */}
      <BrandUsageSection brandId={brandId} />
    </div>
  );
}
