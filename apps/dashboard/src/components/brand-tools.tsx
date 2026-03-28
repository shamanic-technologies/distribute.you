"use client";

import { useState } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  listBrandOutlets,
  type DiscoveredOutlet,
} from "@/lib/api";

// --- Shared helpers ---

function relevanceColor(score: number): string {
  if (score >= 70) return "bg-green-100 text-green-700 border-green-200";
  if (score >= 40) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-red-100 text-red-600 border-red-200";
}

function outletStatusStyle(status: string): string {
  switch (status) {
    case "open": return "bg-blue-100 text-blue-700 border-blue-200";
    case "ended": return "bg-gray-100 text-gray-500 border-gray-200";
    case "denied": return "bg-red-100 text-red-600 border-red-200";
    default: return "bg-gray-100 text-gray-500 border-gray-200";
  }
}

// --- Tool card wrapper ---

function ToolCard({
  title,
  description,
  icon,
  disabled,
  disabledReason,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

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
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left p-4 hover:bg-gray-50 transition flex items-center gap-3"
      >
        <div className="w-9 h-9 bg-brand-50 rounded-lg flex items-center justify-center text-brand-600 flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 text-sm">{title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-gray-100 p-4">
          {children}
        </div>
      )}
    </div>
  );
}

// --- Outlets tool ---

function OutletsTool({ brandId }: { brandId: string }) {
  const { data, isLoading } = useAuthQuery(
    ["brandOutlets", brandId],
    () => listBrandOutlets(brandId),
    { refetchInterval: 10_000, refetchIntervalInBackground: false },
  );

  const outlets = data?.outlets ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (outlets.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-4">
        No outlets discovered yet for this brand.
      </p>
    );
  }

  const sorted = [...outlets].sort((a, b) => b.relevanceScore - a.relevanceScore);

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      <div className="text-xs text-gray-400 mb-2">{outlets.length} outlets</div>
      {sorted.map((outlet) => (
        <OutletRow key={outlet.id} outlet={outlet} />
      ))}
    </div>
  );
}

function OutletRow({ outlet }: { outlet: DiscoveredOutlet }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <a
            href={outlet.outletUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-sm text-gray-800 hover:text-brand-600 transition truncate"
          >
            {outlet.outletName}
          </a>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${outletStatusStyle(outlet.status)}`}>
            {outlet.status}
          </span>
        </div>
        <p className="text-xs text-gray-400 truncate">{outlet.outletDomain}</p>
      </div>
      <span className={`text-xs font-medium px-2 py-1 rounded-full border flex-shrink-0 ${relevanceColor(outlet.relevanceScore)}`}>
        {outlet.relevanceScore}%
      </span>
    </div>
  );
}

// --- Main section ---

interface BrandToolsSectionProps {
  brandId: string;
}

export function BrandToolsSection({ brandId }: BrandToolsSectionProps) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Tools</h2>
      <div className="space-y-3">
        <ToolCard
          title="Outlets"
          description="Discovered media outlets for this brand"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
        >
          <OutletsTool brandId={brandId} />
        </ToolCard>

        <ToolCard
          title="Press Kits"
          description="Generated press kits for this brand"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
          disabled
          disabledReason="Needs brand_id filter on GET /media-kits from backend"
        />

        <ToolCard
          title="Journalists"
          description="Discovered journalists and their outlet affiliations"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          }
          disabled
          disabledReason="Needs brand_id filter on GET /campaign-outlet-journalists from backend"
        />
      </div>
    </div>
  );
}
