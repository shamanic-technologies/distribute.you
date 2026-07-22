import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportSidebar } from "@/components/report/sidebar";
import { ReportHeader } from "@/components/report/header";
import { MobileNav } from "@/components/report/mobile-nav";
import { HeaderSkeleton } from "@/components/report/skeletons";
import { fetchBrand, fetchOrgName, fetchQuotePitchesByBrand } from "@/lib/report-api";
import { isExpertQuoteFeature } from "@/lib/expert-quote-feature";
import { countsByTab } from "@/lib/report-pitch-tabs";
import type { PitchTabCounts } from "@/components/report/sidebar";

// Upstream cost-stats endpoint can take ~30s; default 10s Vercel timeout
// kills the request. 60s gives headroom and matches the existing /api/v1
// proxy in this app.
export const maxDuration = 300;

export const metadata: Metadata = {
  title: "Client Report",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
    nosnippet: true,
    notranslate: true,
    noimageindex: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-video-preview": -1,
      "max-image-preview": "none",
      "max-snippet": -1,
    },
  },
};

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ orgId: string; brandId: string; featureSlug: string }>;
}

export default async function ReportLayout({ children, params }: LayoutProps) {
  const { orgId, brandId, featureSlug } = await params;
  const basePath = `/report/${orgId}/${brandId}/${featureSlug}`;
  const generatedAt = new Date();

  // Per-tab pitch counts for the PR-Expert status sidebar. Only fetched for
  // that feature family; other features have no status tabs. Fail-soft (the
  // fetcher returns [] on error) + 4h-cached (shared cache entry with the tab
  // pages) so the shell isn't held on a slow upstream.
  let pitchCounts: PitchTabCounts | undefined;
  if (isExpertQuoteFeature(featureSlug)) {
    const pitches = await fetchQuotePitchesByBrand(orgId, brandId);
    pitchCounts = countsByTab(pitches);
  }

  // Single mobile-nav instance threaded through header. The component is a
  // client component and self-hides on md+ via its own className.
  const mobileNav = (
    <MobileNav basePath={basePath} featureSlug={featureSlug} counts={pitchCounts} />
  );

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <Suspense fallback={<HeaderSkeleton leftSlot={mobileNav} />}>
        <BrandHeader
          orgId={orgId}
          brandId={brandId}
          featureSlug={featureSlug}
          generatedAt={generatedAt}
          leftSlot={mobileNav}
        />
      </Suspense>
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden md:flex h-full">
          <ReportSidebar basePath={basePath} featureSlug={featureSlug} counts={pitchCounts} />
        </div>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

async function BrandHeader({
  orgId,
  brandId,
  featureSlug,
  generatedAt,
  leftSlot,
}: {
  orgId: string;
  brandId: string;
  featureSlug: string;
  generatedAt: Date;
  leftSlot?: React.ReactNode;
}) {
  const [brand, orgName] = await Promise.all([
    fetchBrand(orgId, brandId),
    fetchOrgName(orgId),
  ]);
  return (
    <ReportHeader
      brand={brand}
      brandId={brandId}
      orgName={orgName}
      featureSlug={featureSlug}
      generatedAt={generatedAt}
      leftSlot={leftSlot}
    />
  );
}
