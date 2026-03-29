"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

// --- Tool link card ---

function ToolLinkCard({
  title,
  description,
  icon,
  href,
  disabled,
  disabledReason,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  if (disabled) {
    return (
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 opacity-60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center text-gray-300 flex-shrink-0">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-400 text-sm">{title}</h3>
              <span className="text-[10px] bg-gray-200 text-gray-400 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                Coming soon
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{disabledReason ?? description}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-brand-300 hover:shadow-sm transition group"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-brand-50 rounded-lg flex items-center justify-center text-brand-600 flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 text-sm group-hover:text-brand-600 transition">{title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
        <svg className="w-5 h-5 text-gray-300 group-hover:text-brand-600 transition flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

// --- Main section ---

interface BrandToolsSectionProps {
  brandId: string;
}

export function BrandToolsSection({ brandId }: BrandToolsSectionProps) {
  const params = useParams();
  const orgId = params.orgId as string;
  const base = `/orgs/${orgId}/brands/${brandId}/tools`;

  return (
    <div className="mb-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Tools</h2>
      <div className="space-y-3">
        <ToolLinkCard
          title="Outlets"
          description="Discovered media outlets for this brand"
          href={`${base}/outlets`}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
        />

        <ToolLinkCard
          title="Journalists"
          description="Discovered journalists and their outlet affiliations"
          href={`${base}/journalists`}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          }
        />

        <ToolLinkCard
          title="Press Kits"
          description="Generated press kits for this brand"
          href={`${base}/press-kits`}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
      </div>
    </div>
  );
}
