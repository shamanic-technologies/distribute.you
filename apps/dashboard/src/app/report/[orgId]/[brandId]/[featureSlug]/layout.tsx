import type { Metadata } from "next";
import { ReportSidebar } from "@/components/report/sidebar";
import { ReportHeader } from "@/components/report/header";
import { fetchBrand } from "@/lib/report-api";

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
  const brand = await fetchBrand(orgId, brandId);
  const generatedAt = new Date();

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <ReportHeader brand={brand} brandId={brandId} orgId={orgId} featureSlug={featureSlug} generatedAt={generatedAt} />
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden md:flex h-full">
          <ReportSidebar basePath={basePath} />
        </div>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
