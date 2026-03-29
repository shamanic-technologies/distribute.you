"use client";

import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  listBrandMediaKits,
  type MediaKit,
  type MediaKitStatus,
} from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";

const POLL_INTERVAL = 10_000;
const pollOptions = { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false };

const STATUS_STYLES: Record<MediaKitStatus, string> = {
  generating: "bg-blue-100 text-blue-700 border-blue-200",
  drafted: "bg-yellow-100 text-yellow-700 border-yellow-200",
  validated: "bg-green-100 text-green-700 border-green-200",
  denied: "bg-red-100 text-red-700 border-red-200",
  archived: "bg-gray-100 text-gray-500 border-gray-200",
};

function PressKitRow({ kit }: { kit: MediaKit }) {
  const publicUrl = kit.shareToken ? `${API_URL}/press-kits/public/${kit.shareToken}` : null;

  return (
    <div className="rounded-lg border border-gray-100 p-4 hover:border-gray-200 transition bg-white">
      <div className="flex items-center justify-between mb-1">
        <h4 className="font-medium text-sm text-gray-800 truncate">
          {kit.title || "Press Kit"}
        </h4>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${STATUS_STYLES[kit.status]}`}>
            {kit.status}
          </span>
          <span className="text-[10px] text-gray-400">
            {new Date(kit.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        </div>
      </div>
      {kit.status === "generating" && (
        <div className="flex items-center gap-1.5 text-xs text-blue-600 mt-1">
          <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Generating...
        </div>
      )}
      {publicUrl && kit.status === "validated" && (
        <div className="flex items-center gap-2 mt-2">
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-brand-600 hover:text-brand-700 font-medium underline underline-offset-2"
          >
            View Public Press Kit
          </a>
          <button
            onClick={() => navigator.clipboard.writeText(publicUrl)}
            className="text-[10px] px-1.5 py-0.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
          >
            Copy Link
          </button>
        </div>
      )}
    </div>
  );
}

export default function PressKitsToolPage() {
  const params = useParams();
  const brandId = params.brandId as string;

  const { data: kits, isLoading } = useAuthQuery(
    ["brandMediaKits", brandId],
    () => listBrandMediaKits(brandId),
    pollOptions,
  );

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center text-brand-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Press Kits</h1>
          <p className="text-sm text-gray-500">Generated press kits for this brand</p>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !kits || kits.length === 0 ? (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-8 text-center">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No press kits yet</h3>
          <p className="text-gray-500 text-sm">
            Press kits will appear here after they are generated for this brand.
          </p>
        </div>
      ) : (
        <>
          <div className="text-sm text-gray-500 mb-4">{kits.length} press kit{kits.length !== 1 ? "s" : ""}</div>
          <div className="space-y-3">
            {kits.map((kit) => (
              <PressKitRow key={kit.id} kit={kit} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
