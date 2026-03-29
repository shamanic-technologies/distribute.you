"use client";

import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  listBrandJournalists,
  type BrandJournalist,
} from "@/lib/api";

const POLL_INTERVAL = 10_000;
const pollOptions = { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false };

function relevanceColor(score: number): string {
  if (score >= 70) return "bg-green-100 text-green-700 border-green-200";
  if (score >= 40) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-red-100 text-red-600 border-red-200";
}

function JournalistRow({ journalist: j }: { journalist: BrandJournalist }) {
  const score = parseFloat(j.relevanceScore);

  return (
    <div className="flex items-start gap-3 p-4 rounded-lg border border-gray-100 hover:border-gray-200 transition bg-white">
      <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex-shrink-0 flex items-center justify-center">
        <span className="text-gray-400 text-xs font-medium">
          {j.journalistName.charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-medium text-sm text-gray-800 truncate">{j.journalistName}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${
            j.entityType === "individual"
              ? "bg-blue-50 text-blue-600 border-blue-200"
              : "bg-purple-50 text-purple-600 border-purple-200"
          }`}>
            {j.entityType}
          </span>
        </div>
        {j.whyRelevant && (
          <p className="text-xs text-gray-500 line-clamp-2">{j.whyRelevant}</p>
        )}
      </div>
      {!isNaN(score) && (
        <span className={`text-xs font-medium px-2 py-1 rounded-full border flex-shrink-0 ${relevanceColor(score)}`}>
          {score}%
        </span>
      )}
    </div>
  );
}

export default function JournalistsToolPage() {
  const params = useParams();
  const brandId = params.brandId as string;

  const { data, isLoading } = useAuthQuery(
    ["brandJournalists", brandId],
    () => listBrandJournalists(brandId),
    pollOptions,
  );
  const journalists = data?.campaignJournalists ?? [];
  const sorted = [...journalists].sort((a, b) => parseFloat(b.relevanceScore) - parseFloat(a.relevanceScore));

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center text-brand-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Journalists</h1>
          <p className="text-sm text-gray-500">Discovered journalists and their outlet affiliations</p>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : journalists.length === 0 ? (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-8 text-center">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No journalists yet</h3>
          <p className="text-gray-500 text-sm">
            Journalists will be discovered when you run a journalist pitch campaign.
          </p>
        </div>
      ) : (
        <>
          <div className="text-sm text-gray-500 mb-4">{journalists.length} journalist{journalists.length !== 1 ? "s" : ""}</div>
          <div className="space-y-2">
            {sorted.map((j) => (
              <JournalistRow key={j.id} journalist={j} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
