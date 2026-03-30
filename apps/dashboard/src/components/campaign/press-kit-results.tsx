"use client";

import Link from "next/link";
import { keepPreviousData } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listMediaKitsByCampaign, type MediaKitSummary, type MediaKitStatus } from "@/lib/api";


const STATUS_STYLES: Record<MediaKitStatus, string> = {
  generating: "bg-blue-100 text-blue-700 border-blue-200",
  drafted: "bg-yellow-100 text-yellow-700 border-yellow-200",
  validated: "bg-green-100 text-green-700 border-green-200",
  denied: "bg-red-100 text-red-700 border-red-200",
  failed: "bg-red-100 text-red-600 border-red-200",
  archived: "bg-gray-100 text-gray-500 border-gray-200",
};

interface PressKitResultsProps {
  campaignId: string;
  detailBasePath: string;
}

export function PressKitResults({ campaignId, detailBasePath }: PressKitResultsProps) {
  const { data: kits, isLoading: kitsLoading } = useAuthQuery(
    ["mediaKits", "campaign", campaignId],
    () => listMediaKitsByCampaign(campaignId),
    { refetchInterval: 5_000, refetchIntervalInBackground: false, placeholderData: keepPreviousData },
  );

  if (kitsLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 min-h-[120px]">
        <div className="h-5 w-40 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="h-32 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  if (!kits || kits.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {kits.map((kit) => (
        <PressKitCard key={kit.id} kit={kit} detailBasePath={detailBasePath} />
      ))}
    </div>
  );
}

function PressKitCard({ kit, detailBasePath }: { kit: MediaKitSummary; detailBasePath: string }) {
  const publicUrl = kit.publicUrl;

  return (
    <Link
      href={`${detailBasePath}/${kit.id}`}
      className="block bg-white rounded-xl border border-gray-200 p-4 md:p-6 hover:border-brand-300 hover:shadow-sm transition group"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-display font-bold text-gray-800 group-hover:text-brand-700 transition">
            {kit.title || "Press Kit"}
          </h3>
          <span className={`text-xs px-2 py-1 rounded-full border ${STATUS_STYLES[kit.status]}`}>
            {kit.status}
          </span>
        </div>
        <span className="text-xs text-gray-400">
          {new Date(kit.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
      </div>

      {kit.status === "generating" && (
        <div className="flex items-center gap-2 text-sm text-blue-600 mb-4">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Generating...
        </div>
      )}

      {kit.status === "failed" && (
        <p className="text-sm text-red-600 mb-4">
          Generation failed. Go to Press Kits to retry.
        </p>
      )}

      {kit.contentExcerpt && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-3">{kit.contentExcerpt}</p>
      )}

      {publicUrl && kit.status === "validated" && (
        <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-violet-600 hover:text-violet-700 font-medium underline underline-offset-2"
          >
            View Public Press Kit
          </a>
          <button
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); navigator.clipboard.writeText(publicUrl); }}
            className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
          >
            Copy Link
          </button>
        </div>
      )}
    </Link>
  );
}
