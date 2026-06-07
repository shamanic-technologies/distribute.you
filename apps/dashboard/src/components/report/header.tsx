import type { ReactNode } from "react";
import type { Brand } from "@/lib/api";
import { GeneratedAt } from "./generated-at";

interface ReportHeaderProps {
  brand: Brand | null;
  brandId: string;
  orgName: string;
  featureSlug: string;
  generatedAt: Date;
  /** Optional mobile-only slot rendered at the very left of the header
   *  (e.g. a hamburger trigger). Hidden on md+ via the slot's own classes. */
  leftSlot?: ReactNode;
}

const FEATURE_LABELS: Record<string, string> = {
  "sales-cold-email-outreach": "Sales Cold Email Outreach",
  "pr-expert-quote-opportunities": "PR Expert Quote Opportunities",
  "pr-expert-quote-outreach": "PR Expert Quote Outreach",
};

export function ReportHeader({ brand, brandId, orgName, featureSlug, generatedAt, leftSlot }: ReportHeaderProps) {
  const featureLabel = FEATURE_LABELS[featureSlug] ?? featureSlug;
  const brandName = brand?.name || brand?.domain || "this brand";
  void brandId;

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 sm:px-6 sm:py-5">
      <div className="flex items-start justify-between gap-3 sm:gap-6 flex-wrap">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          {leftSlot}
          {brand?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logoUrl}
              alt={`${brandName} logo`}
              width={56}
              height={56}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg border border-gray-200 bg-white object-contain flex-shrink-0"
            />
          ) : (
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 text-lg sm:text-xl font-semibold flex-shrink-0">
              {brandName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-display text-lg sm:text-2xl font-bold text-gray-800 truncate">{brandName}</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5 truncate">{featureLabel} report</p>
          </div>
        </div>
        <div className="text-left sm:text-right text-xs text-gray-500 w-full sm:w-auto">
          <div>
            Generated <GeneratedAt iso={generatedAt.toISOString()} />
          </div>
          <div className="text-gray-500 mt-0.5">Prepared by {orgName}</div>
        </div>
      </div>
    </header>
  );
}
