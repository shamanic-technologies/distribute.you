"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getBrand,
  listCampaignsByBrand,
  type Campaign,
} from "@/lib/api";
import { BrandLogo } from "@/components/brand-logo";
import { BrandMetricsHeader } from "@/components/brand-metrics-header";
import { useFeatures } from "@/lib/features-context";
import { pollOptions } from "@/lib/query-options";
import { useFeatureFlag } from "@/lib/use-feature-flag";
import { MaturityBadge } from "@/components/maturity-badge";
import { FEATURE_GATES, GA_BRAND_FEATURES } from "@/lib/feature-gates";
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
  // Immature features are alpha (staff-only). Default-hidden until PostHog
  // resolves the flag, so they never flash for a non-staff viewer. Brand Info
  // lives under Brand Settings now — no card on the overview.
  const featuresAlphaOk = useFeatureFlag(FEATURE_GATES["brand-features"].flag);
  const visibleFeatures = useMemo(
    () => features.filter((f) => GA_BRAND_FEATURES.has(f.slug) || featuresAlphaOk),
    [features, featuresAlphaOk],
  );

  // isPending (not isLoading): a query suspended by the org-consistency gate
  // reports isLoading:false while still unresolved, which would flash "Brand
  // not found" during the org-settle window. isPending stays true until the
  // query actually resolves, so not-found shows only on a real empty result.
  const { data: brandData, isPending: brandLoading } = useAuthQuery(
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

  // Per-card campaign stats depend on the campaigns query alone — show a small
  // skeleton on the stats line while it resolves, never blocking the card itself.
  const campaignsPending = campaignsData === undefined;

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

  if (!brandLoading && !brand) {
    // Reached e.g. via a stale last-brand cookie pointing at a deleted brand.
    // Offer an escape back to the brand list (the next brand opened there
    // rewrites the cookie), mirroring Clerk's invalid-active-org recovery.
    return (
      <div className="p-4 md:p-8">
        <p className="text-gray-500 mb-3">Brand not found</p>
        <Link
          href={`/orgs/${orgId}/brands`}
          className="text-sm text-brand-600 hover:underline"
        >
          ← Back to brands
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Brand Header — placeholder while brand loads; inner content renders immediately */}
      <div className="mb-8 min-h-[60px]">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden">
            {brand ? (
              <BrandLogo domain={brand.domain} size={28} fallbackClassName="h-6 w-6 text-gray-400" />
            ) : (
              <div className="w-7 h-7 bg-gray-200 rounded animate-pulse" />
            )}
          </div>
          {brand ? (
            <h1 className="text-2xl font-semibold text-gray-900">
              {brand.name || brand.domain}
            </h1>
          ) : (
            <div className="h-7 w-48 bg-gray-200 rounded animate-pulse" />
          )}
        </div>
        {brand?.url ? (
          <a
            href={brand.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-brand-600 hover:underline"
          >
            {brand.url}
          </a>
        ) : (
          <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
        )}
      </div>

      {/* Brand metrics — visits trend, Domain Rating, est. revenue, AI mention rate.
          Owns its own queries (Ahrefs traffic/DR + AI Visibility Score) and reveals
          its four cards as one latched group. */}
      <BrandMetricsHeader brandId={brandId} domain={brand?.domain} />

      {/* Features Section — skeleton cards until allReady, then real grid in one swap. */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Features</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {visibleFeatures.map((f) => {
            const section = workflowSections.find(s => s.featureSlug === f.slug);
            const activeCampaigns = section?.campaigns.filter(c => c.status === "ongoing") ?? [];
            const isAlpha = !GA_BRAND_FEATURES.has(f.slug);

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
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 group-hover:text-brand-600 transition">{f.name}</h3>
                        {isAlpha && <MaturityBadge level={FEATURE_GATES["brand-features"].maturity} />}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{f.description}</p>
                      {campaignsPending ? (
                        <div className="flex items-center gap-4 mt-3">
                          <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
                          <div className="h-3 w-12 bg-gray-100 rounded animate-pulse" />
                        </div>
                      ) : section ? (
                        <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                            {activeCampaigns.length.toLocaleString("en-US")} active
                          </span>
                          <span>{section.campaigns.length.toLocaleString("en-US")} total</span>
                        </div>
                      ) : null}
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
                      {isAlpha && <MaturityBadge level={FEATURE_GATES["brand-features"].maturity} />}
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

    </div>
  );
}
