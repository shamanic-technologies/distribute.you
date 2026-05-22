import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportSidebar } from "@/components/report/sidebar";
import { ReportHeader } from "@/components/report/header";
import { HeaderSkeleton } from "@/components/report/skeletons";
import { fetchBrand, fetchOrgName } from "@/lib/report-api";

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

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <Suspense fallback={<HeaderSkeleton />}>
        <BrandHeader orgId={orgId} brandId={brandId} featureSlug={featureSlug} generatedAt={generatedAt} />
      </Suspense>
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden md:flex h-full">
          <ReportSidebar basePath={basePath} />
        </div>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

async function BrandHeader({ orgId, brandId, featureSlug, generatedAt }: { orgId: string; brandId: string; featureSlug: string; generatedAt: Date }) {
  const [brand, orgName] = await Promise.all([
    fetchBrand(orgId, brandId),
    fetchOrgName(orgId),
  ]);
  return <ReportHeader brand={brand} brandId={brandId} orgName={orgName} featureSlug={featureSlug} generatedAt={generatedAt} />;
}
