"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  listMediaKits,
  getMediaKit,
  editMediaKit,
  validateMediaKit,
  cancelDraftMediaKit,
  getShareToken,
  upsertPressKitOrg,
  getBrand,
  type MediaKit,
  type MediaKitStatus,
} from "@/lib/api";

const POLL_INTERVAL = 5_000;
const pollOptions = {
  refetchInterval: POLL_INTERVAL,
  refetchIntervalInBackground: false,
};

const STATUS_STYLES: Record<MediaKitStatus, string> = {
  drafted: "bg-yellow-100 text-yellow-700 border-yellow-200",
  generating: "bg-blue-100 text-blue-700 border-blue-200",
  validated: "bg-green-100 text-green-700 border-green-200",
  denied: "bg-red-100 text-red-600 border-red-200",
  archived: "bg-gray-100 text-gray-500 border-gray-200",
};

const STATUS_LABELS: Record<MediaKitStatus, string> = {
  drafted: "Draft",
  generating: "Generating",
  validated: "Validated",
  denied: "Denied",
  archived: "Archived",
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  const days = Math.floor(seconds / 86400);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function PressKitPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const orgId = params.orgId as string;
  const queryClient = useQueryClient();

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [selectedKit, setSelectedKit] = useState<MediaKit | null>(null);
  const [loadingKit, setLoadingKit] = useState(false);
  const [orgReady, setOrgReady] = useState(false);

  // Ensure org exists in press-kits-service before querying
  const orgUpserted = useRef(false);
  useEffect(() => {
    if (orgUpserted.current) return;
    orgUpserted.current = true;
    upsertPressKitOrg(orgId)
      .then(() => setOrgReady(true))
      .catch(() => setOrgReady(true)); // proceed anyway — org may already exist
  }, [orgId]);

  const { data: brandData } = useAuthQuery(
    ["brand", brandId],
    () => getBrand(brandId),
  );
  const brand = brandData?.brand ?? null;

  const { data: mediaKits, isLoading } = useAuthQuery(
    ["mediaKits", orgId],
    () => listMediaKits(orgId),
    { ...pollOptions, enabled: orgReady },
  );
  const kits = mediaKits ?? [];

  const { data: shareTokenData } = useAuthQuery(
    ["shareToken", orgId],
    () => getShareToken(orgId),
    { enabled: orgReady },
  );
  const shareToken = shareTokenData?.shareToken ?? null;

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const existingKit = kits[0];
      if (existingKit) {
        await editMediaKit({
          mediaKitId: existingKit.id,
          instruction: "Generate a comprehensive press kit based on the brand information.",
          organizationUrl: brand?.brandUrl,
        });
      } else {
        await editMediaKit({
          orgId,
          instruction: "Generate a comprehensive press kit based on the brand information.",
          organizationUrl: brand?.brandUrl,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["mediaKits", orgId] });
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleValidate = async (kit: MediaKit) => {
    try {
      await validateMediaKit(kit.id);
      await queryClient.invalidateQueries({ queryKey: ["mediaKits", orgId] });
      // Refresh the selected kit
      const updated = await getMediaKit(kit.id);
      setSelectedKit(updated);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Validation failed");
    }
  };

  const handleCancelDraft = async (kit: MediaKit) => {
    try {
      await cancelDraftMediaKit(kit.id);
      await queryClient.invalidateQueries({ queryKey: ["mediaKits", orgId] });
      setSelectedKit(null);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Cancellation failed");
    }
  };

  const handleViewKit = async (kit: MediaKit) => {
    setLoadingKit(true);
    try {
      const fullKit = await getMediaKit(kit.id);
      setSelectedKit(fullKit);
    } catch {
      setSelectedKit(kit);
    } finally {
      setLoadingKit(false);
    }
  };

  const API_URL = process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";
  const publicPressKitUrl = shareToken ? `${API_URL}/press-kits/public/${shareToken}` : null;

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      {/* Main list panel */}
      <div className={`flex-1 overflow-y-auto p-4 md:p-8 ${selectedKit ? "hidden md:block md:w-1/2" : ""}`}>
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-800">Press Kit</h1>
            <p className="text-gray-600 text-sm">
              Generate and manage press kits for journalist outreach.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {publicPressKitUrl && (
              <a
                href={publicPressKitUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Public Link
              </a>
            )}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {generating ? "Generating..." : kits.length > 0 ? "Regenerate" : "Generate Press Kit"}
            </button>
          </div>
        </div>

        {generateError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
            <p className="text-sm text-red-600">{generateError}</p>
            <button
              onClick={() => setGenerateError(null)}
              className="text-red-400 hover:text-red-600 text-sm ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Kits list */}
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl" />
            ))}
          </div>
        ) : kits.length === 0 ? (
          <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-8 text-center">
            <svg
              className="w-12 h-12 text-gray-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No press kit yet</h3>
            <p className="text-gray-500 text-sm mb-4">
              Generate a press kit from your brand information to share with journalists.
            </p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 transition"
            >
              {generating ? "Generating..." : "Generate Press Kit"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {kits.map((kit) => {
              const statusStyle = STATUS_STYLES[kit.status] || "bg-gray-100 text-gray-500 border-gray-200";
              const statusLabel = STATUS_LABELS[kit.status] || kit.status;
              const isSelected = selectedKit?.id === kit.id;

              return (
                <button
                  key={kit.id}
                  onClick={() => handleViewKit(kit)}
                  className={`w-full text-left bg-white rounded-xl border p-4 hover:border-brand-300 hover:shadow-md transition-all cursor-pointer ${
                    isSelected ? "border-brand-400 shadow-md ring-1 ring-brand-200" : "border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-800">
                        {kit.title || "Press Kit"}
                      </h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${statusStyle}`}>
                        {kit.status === "generating" && (
                          <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse mr-1 align-middle" />
                        )}
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Updated {timeAgo(kit.updatedAt)}</span>
                    <span>Created {timeAgo(kit.createdAt)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedKit && (
        <div className="w-full md:w-1/2 border-l border-gray-200 bg-white overflow-y-auto flex flex-col">
          <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
            <h2 className="font-medium text-gray-800 truncate">
              {selectedKit.title || "Press Kit"}
            </h2>
            <div className="flex items-center gap-2">
              {selectedKit.status === "drafted" && (
                <>
                  <button
                    onClick={() => handleValidate(selectedKit)}
                    className="text-xs px-2.5 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition"
                  >
                    Validate
                  </button>
                  <button
                    onClick={() => handleCancelDraft(selectedKit)}
                    className="text-xs px-2.5 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition"
                  >
                    Cancel
                  </button>
                </>
              )}
              {publicPressKitUrl && selectedKit.status === "validated" && (
                <a
                  href={publicPressKitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View Public
                </a>
              )}
              <button
                onClick={() => setSelectedKit(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1 p-4 md:p-6">
            {loadingKit ? (
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-full" />
                <div className="h-4 bg-gray-200 rounded w-5/6" />
                <div className="h-4 bg-gray-200 rounded w-2/3" />
              </div>
            ) : selectedKit.mdxPageContent ? (
              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                {selectedKit.mdxPageContent}
              </div>
            ) : selectedKit.status === "generating" ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <svg className="w-8 h-8 text-brand-500 animate-spin mb-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-gray-500 text-sm">Press kit is being generated...</p>
                <p className="text-gray-400 text-xs mt-1">This may take a minute or two.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-gray-400 text-sm">No content available yet.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
