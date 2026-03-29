"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import {
  listBrandMediaKits,
  editMediaKit,
  validateMediaKit,
  updateMediaKitStatus,
  cancelDraftMediaKit,
  getMediaKitViewStats,
  type MediaKitSummary,
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

const STATUS_LABELS: Record<MediaKitStatus, string> = {
  generating: "Generating",
  drafted: "Draft",
  validated: "Published",
  denied: "Denied",
  archived: "Archived",
};

/* ─── Stats Card ──────────────────────────────────────────────────────── */

function StatsBar({ brandId }: { brandId: string }) {
  const { data: stats } = useAuthQuery(
    ["mediaKitViewStats", brandId],
    () => getMediaKitViewStats({ brandId }),
  );

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div className="bg-white border border-gray-100 rounded-lg p-3">
        <div className="text-xs text-gray-500 mb-1">Total Views</div>
        <div className="text-xl font-semibold text-gray-900">{stats.totalViews}</div>
      </div>
      <div className="bg-white border border-gray-100 rounded-lg p-3">
        <div className="text-xs text-gray-500 mb-1">Unique Visitors</div>
        <div className="text-xl font-semibold text-gray-900">{stats.uniqueVisitors}</div>
      </div>
      <div className="bg-white border border-gray-100 rounded-lg p-3">
        <div className="text-xs text-gray-500 mb-1">Last Viewed</div>
        <div className="text-sm font-medium text-gray-900">
          {stats.lastViewedAt
            ? new Date(stats.lastViewedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            : "—"}
        </div>
      </div>
      <div className="bg-white border border-gray-100 rounded-lg p-3">
        <div className="text-xs text-gray-500 mb-1">First Viewed</div>
        <div className="text-sm font-medium text-gray-900">
          {stats.firstViewedAt
            ? new Date(stats.firstViewedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            : "—"}
        </div>
      </div>
    </div>
  );
}

/* ─── Generate Form ───────────────────────────────────────────────────── */

function GenerateForm({ brandId, onSuccess }: { brandId: string; onSuccess: () => void }) {
  const [instruction, setInstruction] = useState("");

  const mutation = useMutation({
    mutationFn: () => editMediaKit({ instruction, brandId }),
    onSuccess: () => {
      setInstruction("");
      onSuccess();
    },
  });

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <h3 className="text-sm font-medium text-gray-900 mb-2">Generate a new press kit</h3>
      <div className="flex gap-2">
        <input
          type="text"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="e.g. Focus on our AI products and recent Series B funding..."
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          onKeyDown={(e) => {
            if (e.key === "Enter" && instruction.trim() && !mutation.isPending) {
              mutation.mutate();
            }
          }}
        />
        <button
          onClick={() => mutation.mutate()}
          disabled={!instruction.trim() || mutation.isPending}
          className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
        >
          {mutation.isPending ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generating...
            </>
          ) : (
            "Generate"
          )}
        </button>
      </div>
      {mutation.isError && (
        <p className="text-xs text-red-600 mt-2">
          Failed to start generation. {mutation.error?.message}
        </p>
      )}
    </div>
  );
}

/* ─── Latest Validated Kit Preview ────────────────────────────────────── */

function LatestValidatedPreview({ kit, orgId, brandId }: { kit: MediaKitSummary; orgId: string; brandId: string }) {
  const publicUrl = kit.shareToken ? `${API_URL}/press-kits/public/${kit.shareToken}` : null;
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (publicUrl) {
      navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg mb-6 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${STATUS_STYLES.validated}`}>
            {STATUS_LABELS.validated}
          </span>
          <h3 className="text-sm font-medium text-gray-900 truncate">
            {kit.title || "Press Kit"}
          </h3>
          <span className="text-[10px] text-gray-400">
            {new Date(kit.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {publicUrl && (
            <>
              <button
                onClick={handleCopy}
                className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
              >
                {copied ? "Copied!" : "Copy Link"}
              </button>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2 py-1 rounded border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 transition"
              >
                View Public Page
              </a>
            </>
          )}
          <Link
            href={`/orgs/${orgId}/brands/${brandId}/tools/press-kits/${kit.id}`}
            className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
          >
            Details
          </Link>
        </div>
      </div>
      <div className="p-4">
        {kit.contentExcerpt ? (
          <p className="text-sm text-gray-700 leading-relaxed">{kit.contentExcerpt}</p>
        ) : (
          <p className="text-sm text-gray-400 italic">No content preview available</p>
        )}
      </div>
    </div>
  );
}

/* ─── Kit Row ─────────────────────────────────────────────────────────── */

function PressKitRow({
  kit,
  orgId,
  brandId,
  onAction,
}: {
  kit: MediaKitSummary;
  orgId: string;
  brandId: string;
  onAction: () => void;
}) {
  const publicUrl = kit.shareToken ? `${API_URL}/press-kits/public/${kit.shareToken}` : null;

  const validateMut = useMutation({
    mutationFn: () => validateMediaKit(kit.id),
    onSuccess: onAction,
  });
  const archiveMut = useMutation({
    mutationFn: () => updateMediaKitStatus(kit.id, "archived"),
    onSuccess: onAction,
  });
  const cancelMut = useMutation({
    mutationFn: () => cancelDraftMediaKit(kit.id),
    onSuccess: onAction,
  });

  return (
    <Link
      href={`/orgs/${orgId}/brands/${brandId}/tools/press-kits/${kit.id}`}
      className="block rounded-lg border border-gray-100 p-4 hover:border-gray-200 hover:shadow-sm transition bg-white group"
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 min-w-0">
          {kit.iconUrl && (
            <img src={kit.iconUrl} alt="" className="w-6 h-6 rounded flex-shrink-0" />
          )}
          <h4 className="font-medium text-sm text-gray-800 truncate group-hover:text-brand-700 transition">
            {kit.title || "Press Kit"}
          </h4>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${STATUS_STYLES[kit.status]}`}>
            {STATUS_LABELS[kit.status]}
          </span>
          <span className="text-[10px] text-gray-400">
            {new Date(kit.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        </div>
      </div>

      {kit.contentExcerpt && (
        <p className="text-xs text-gray-500 line-clamp-2 mt-1">{kit.contentExcerpt}</p>
      )}

      {kit.status === "generating" && (
        <div className="flex items-center gap-1.5 text-xs text-blue-600 mt-2">
          <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Generating...
        </div>
      )}

      {/* Actions — stop propagation to prevent navigation */}
      <div className="flex items-center gap-2 mt-2" onClick={(e) => e.preventDefault()}>
        {kit.status === "drafted" && (
          <>
            <button
              onClick={(e) => { e.preventDefault(); validateMut.mutate(); }}
              disabled={validateMut.isPending}
              className="text-[10px] px-2 py-0.5 rounded border border-green-200 text-green-700 hover:bg-green-50 transition"
            >
              {validateMut.isPending ? "..." : "Validate"}
            </button>
            <button
              onClick={(e) => { e.preventDefault(); cancelMut.mutate(); }}
              disabled={cancelMut.isPending}
              className="text-[10px] px-2 py-0.5 rounded border border-red-200 text-red-600 hover:bg-red-50 transition"
            >
              Cancel
            </button>
          </>
        )}
        {kit.status === "validated" && publicUrl && (
          <button
            onClick={(e) => {
              e.preventDefault();
              navigator.clipboard.writeText(publicUrl);
            }}
            className="text-[10px] px-2 py-0.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
          >
            Copy Link
          </button>
        )}
        {(kit.status === "validated" || kit.status === "drafted") && (
          <button
            onClick={(e) => { e.preventDefault(); archiveMut.mutate(); }}
            disabled={archiveMut.isPending}
            className="text-[10px] px-2 py-0.5 rounded border border-gray-200 text-gray-400 hover:bg-gray-50 transition"
          >
            Archive
          </button>
        )}
      </div>
    </Link>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────────── */

export default function PressKitsToolPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const orgId = params.orgId as string;
  const queryClient = useQueryClient();

  const { data: kits, isLoading } = useAuthQuery(
    ["brandMediaKits", brandId],
    () => listBrandMediaKits(brandId),
    pollOptions,
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["brandMediaKits", brandId] });
  };

  // Sort: generating first, then by date desc
  const sorted = [...(kits ?? [])].sort((a, b) => {
    if (a.status === "generating" && b.status !== "generating") return -1;
    if (b.status === "generating" && a.status !== "generating") return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const latestValidated = sorted.find((k) => k.status === "validated");
  const hasAnyGenerating = sorted.some((k) => k.status === "generating");

  // Active kits (not archived)
  const active = sorted.filter((k) => k.status !== "archived");
  const archived = sorted.filter((k) => k.status === "archived");

  const [showArchived, setShowArchived] = useState(false);

  return (
    <div className="p-4 md:p-8 max-w-5xl">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center text-brand-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Press Kits</h1>
          <p className="text-sm text-gray-500">
            {kits ? `${kits.length} press kit${kits.length !== 1 ? "s" : ""}` : "Generated press kits for this brand"}
          </p>
        </div>
      </div>

      {/* Stats */}
      {kits && kits.length > 0 && <StatsBar brandId={brandId} />}

      {/* Generate */}
      <GenerateForm brandId={brandId} onSuccess={invalidate} />

      {/* Loading */}
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
            Use the form above to generate your first press kit.
          </p>
        </div>
      ) : (
        <>
          {/* Latest validated — hero preview */}
          {latestValidated && (
            <LatestValidatedPreview kit={latestValidated} orgId={orgId} brandId={brandId} />
          )}

          {/* Generating indicator */}
          {hasAnyGenerating && (
            <div className="flex items-center gap-2 text-sm text-blue-600 mb-4 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              A press kit is being generated. This page refreshes automatically.
            </div>
          )}

          {/* Active kits list */}
          <div className="mb-4">
            <h2 className="text-sm font-medium text-gray-700 mb-3">
              All Press Kits
            </h2>
            <div className="space-y-2">
              {active.map((kit) => (
                <PressKitRow key={kit.id} kit={kit} orgId={orgId} brandId={brandId} onAction={invalidate} />
              ))}
            </div>
          </div>

          {/* Archived */}
          {archived.length > 0 && (
            <div>
              <button
                onClick={() => setShowArchived(!showArchived)}
                className="text-xs text-gray-400 hover:text-gray-600 transition flex items-center gap-1 mb-2"
              >
                <svg
                  className={`w-3 h-3 transition-transform ${showArchived ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                {archived.length} archived kit{archived.length !== 1 ? "s" : ""}
              </button>
              {showArchived && (
                <div className="space-y-2 opacity-60">
                  {archived.map((kit) => (
                    <PressKitRow key={kit.id} kit={kit} orgId={orgId} brandId={brandId} onAction={invalidate} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
