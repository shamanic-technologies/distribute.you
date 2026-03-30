"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import {
  getBrand,
  getMediaKit,
  editMediaKit,
  validateMediaKit,
  updateMediaKitStatus,
  cancelDraftMediaKit,
  getMediaKitViewStats,
  listMediaKitsByCampaign,
  type MediaKitStatus,
} from "@/lib/api";
import { PressKitChat } from "@/components/press-kits/press-kit-chat";


const STATUS_STYLES: Record<MediaKitStatus, string> = {
  generating: "bg-blue-100 text-blue-700 border-blue-200",
  drafted: "bg-yellow-100 text-yellow-700 border-yellow-200",
  validated: "bg-green-100 text-green-700 border-green-200",
  denied: "bg-red-100 text-red-700 border-red-200",
  failed: "bg-red-100 text-red-600 border-red-200",
  archived: "bg-gray-100 text-gray-500 border-gray-200",
};

const STATUS_LABELS: Record<MediaKitStatus, string> = {
  generating: "Generating",
  drafted: "Draft",
  validated: "Published",
  denied: "Denied",
  failed: "Generation Failed",
  archived: "Archived",
};

/* ─── Neutral Isolated Preview (iframe) ──────────────────────────────── */

const NEUTRAL_PREVIEW_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #fff; color: #1a1a1a; font-family: Georgia, "Times New Roman", serif; font-size: 17px; line-height: 1.7; }
  body { padding: 40px 48px; max-width: 780px; margin: 0 auto; }
  h1, h2, h3, h4, h5, h6 { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #111; line-height: 1.3; margin-top: 1.8em; margin-bottom: 0.6em; font-weight: 600; }
  h1 { font-size: 2em; margin-top: 0; border-bottom: 1px solid #e5e5e5; padding-bottom: 0.3em; }
  h2 { font-size: 1.5em; }
  h3 { font-size: 1.2em; }
  p { margin-bottom: 1em; }
  a { color: #0066cc; text-decoration: underline; }
  a:hover { color: #004499; }
  ul, ol { margin-bottom: 1em; padding-left: 1.8em; }
  li { margin-bottom: 0.4em; }
  blockquote { border-left: 3px solid #ccc; margin: 1.2em 0; padding: 0.6em 1.2em; color: #555; font-style: italic; }
  code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; background: #f5f5f5; padding: 0.15em 0.4em; border-radius: 3px; font-size: 0.9em; }
  pre { background: #f5f5f5; padding: 1em; border-radius: 6px; overflow-x: auto; margin-bottom: 1em; }
  pre code { background: none; padding: 0; }
  img { max-width: 100%; height: auto; border-radius: 4px; margin: 1em 0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 1em; }
  th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
  th { background: #f9f9f9; font-weight: 600; }
  hr { border: none; border-top: 1px solid #e5e5e5; margin: 2em 0; }
  strong { font-weight: 700; }
  em { font-style: italic; }
`;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Convert basic Markdown to HTML (covers headings, bold, italic, links, lists, blockquotes, code, hr, images, tables) */
function markdownToHtml(md: string): string {
  let html = md;

  // Code blocks (fenced)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => `<pre><code>${escapeHtml(code.trimEnd())}</code></pre>`);

  // Inline code
  html = html.replace(/`([^`]+)`/g, (_m, code) => `<code>${escapeHtml(code)}</code>`);

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Tables (GFM)
  html = html.replace(
    /(?:^|\n)(\|.+\|)\n(\|[\s:|-]+\|)\n((?:\|.+\|\n?)+)/gm,
    (_match, headerRow: string, _sep: string, bodyRows: string) => {
      const headers = headerRow.split("|").filter((c: string) => c.trim()).map((c: string) => `<th>${c.trim()}</th>`).join("");
      const rows = bodyRows.trim().split("\n").map((row: string) => {
        const cells = row.split("|").filter((c: string) => c.trim()).map((c: string) => `<td>${c.trim()}</td>`).join("");
        return `<tr>${cells}</tr>`;
      }).join("");
      return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
    },
  );

  // Horizontal rules
  html = html.replace(/^---+$/gm, "<hr />");

  // Headings
  html = html.replace(/^######\s+(.+)$/gm, "<h6>$1</h6>");
  html = html.replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>");
  html = html.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");

  // Bold & italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Blockquotes (multi-line)
  html = html.replace(/(^>.*(?:\n>.*)*)/gm, (match) => {
    const inner = match.replace(/^>\s?/gm, "");
    return `<blockquote>${inner}</blockquote>`;
  });

  // Unordered lists
  html = html.replace(/((?:^[-*+]\s+.+\n?)+)/gm, (match) => {
    const items = match.trim().split("\n").map((line) => `<li>${line.replace(/^[-*+]\s+/, "")}</li>`).join("");
    return `<ul>${items}</ul>`;
  });

  // Ordered lists
  html = html.replace(/((?:^\d+\.\s+.+\n?)+)/gm, (match) => {
    const items = match.trim().split("\n").map((line) => `<li>${line.replace(/^\d+\.\s+/, "")}</li>`).join("");
    return `<ol>${items}</ol>`;
  });

  // Paragraphs: wrap remaining loose lines
  html = html
    .split("\n\n")
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (/^<(h[1-6]|ul|ol|blockquote|pre|table|hr|img)/i.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, "<br />")}</p>`;
    })
    .join("\n");

  return html;
}

function NeutralPreview({ content }: { content: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const resizeIframe = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument?.body) return;
    iframe.style.height = iframe.contentDocument.body.scrollHeight + 40 + "px";
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const htmlContent = markdownToHtml(content);
    const srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${NEUTRAL_PREVIEW_CSS}</style></head><body>${htmlContent}</body></html>`;
    iframe.srcdoc = srcdoc;

    const handleLoad = () => resizeIframe();
    iframe.addEventListener("load", handleLoad);
    return () => iframe.removeEventListener("load", handleLoad);
  }, [content, resizeIframe]);

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-same-origin"
      title="Press kit preview"
      className="w-full border-0"
      style={{ minHeight: 400 }}
    />
  );
}

/* ─── Version History Sidebar ─────────────────────────────────────────── */

function VersionHistory({
  currentId,
  campaignId,
  basePath,
}: {
  currentId: string;
  campaignId: string;
  basePath: string;
}) {
  const { data: allKits } = useAuthQuery(
    ["campaignMediaKits", campaignId],
    () => listMediaKitsByCampaign(campaignId),
  );

  if (!allKits || allKits.length <= 1) return null;

  const sorted = [...allKits]
    .filter((k) => k.status !== "archived")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
        All Versions
      </h3>
      <div className="space-y-1.5">
        {sorted.map((kit) => (
          <Link
            key={kit.id}
            href={`${basePath}/${kit.id}`}
            className={`block text-xs px-2 py-1.5 rounded transition ${
              kit.id === currentId
                ? "bg-brand-50 text-brand-700 font-medium"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="truncate">{kit.title || "Press Kit"}</span>
              <span className={`text-[9px] px-1 py-0.5 rounded-full border ml-1 flex-shrink-0 ${STATUS_STYLES[kit.status]}`}>
                {STATUS_LABELS[kit.status]}
              </span>
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              {new Date(kit.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Detail Page ────────────────────────────────────────────────── */

export default function CampaignPressKitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const brandId = params.brandId as string;
  const orgId = params.orgId as string;
  const kitId = params.kitId as string;
  const campaignId = params.id as string;
  const featureSlug = params.featureSlug as string;

  const basePath = `/orgs/${orgId}/brands/${brandId}/features/${featureSlug}/campaigns/${campaignId}/press-kits`;

  const [copied, setCopied] = useState(false);
  const [regenerateInstruction, setRegenerateInstruction] = useState("");
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [activeTab, setActiveTab] = useState<"content" | "chat">("content");

  const { data: brandData } = useAuthQuery(
    ["brand", brandId],
    () => getBrand(brandId),
  );
  const brand = brandData?.brand ?? null;

  const { data: kit, isLoading } = useAuthQuery(
    ["mediaKit", kitId],
    () => getMediaKit(kitId),
    { refetchInterval: 5_000, refetchIntervalInBackground: false },
  );

  const { data: stats } = useAuthQuery(
    ["mediaKitViewStats", kitId],
    () => getMediaKitViewStats({ mediaKitId: kitId }),
    { enabled: kit?.status === "validated" },
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["mediaKit", kitId] });
    queryClient.invalidateQueries({ queryKey: ["campaignMediaKits", campaignId] });
  };

  const validateMut = useMutation({
    mutationFn: () => validateMediaKit(kitId),
    onSuccess: invalidate,
  });
  const archiveMut = useMutation({
    mutationFn: () => updateMediaKitStatus(kitId, "archived"),
    onSuccess: invalidate,
  });
  const cancelMut = useMutation({
    mutationFn: () => cancelDraftMediaKit(kitId),
    onSuccess: invalidate,
  });
  const retryMut = useMutation({
    mutationFn: () => editMediaKit({ instruction: "Retry generation", brandId }),
    onSuccess: invalidate,
  });
  const regenerateMut = useMutation({
    mutationFn: () => editMediaKit({ instruction: regenerateInstruction, brandId }),
    onSuccess: (data) => {
      setRegenerateInstruction("");
      setShowRegenerate(false);
      invalidate();
      if (data.mediaKitId) {
        router.push(`${basePath}/${data.mediaKitId}`);
      }
    },
  });

  const publicUrl = kit?.publicUrl ?? null;

  const handleCopy = () => {
    if (publicUrl) {
      navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-6">
        <Link href={`/orgs/${orgId}/brands/${brandId}`} className="hover:text-brand-600 transition truncate">
          {brand?.name ?? brand?.domain ?? "Brand"}
        </Link>
        <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <Link href={basePath} className="hover:text-brand-600 transition">
          Press Kits
        </Link>
        <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-900 font-medium truncate">{kit?.title || "Press Kit"}</span>
      </nav>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-10 w-60 bg-gray-100 rounded animate-pulse" />
          <div className="h-96 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      ) : !kit ? (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-8 text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Press kit not found</h3>
          <Link href={basePath} className="text-brand-600 text-sm hover:underline">
            Back to Press Kits
          </Link>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-semibold text-gray-900">{kit.title || "Press Kit"}</h1>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLES[kit.status]}`}>
                    {STATUS_LABELS[kit.status]}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>
                    Created {new Date(kit.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  {kit.parentMediaKitId && (
                    <span className="text-gray-300">
                      Forked from previous version
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Stats for validated kits */}
            {kit.status === "validated" && stats && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-white border border-gray-100 rounded-lg p-3">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">Views</div>
                  <div className="text-lg font-semibold text-gray-900">{stats.totalViews}</div>
                </div>
                <div className="bg-white border border-gray-100 rounded-lg p-3">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">Unique</div>
                  <div className="text-lg font-semibold text-gray-900">{stats.uniqueVisitors}</div>
                </div>
                <div className="bg-white border border-gray-100 rounded-lg p-3">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">Last View</div>
                  <div className="text-sm font-medium text-gray-900">
                    {stats.lastViewedAt
                      ? new Date(stats.lastViewedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : "—"}
                  </div>
                </div>
              </div>
            )}

            {/* Action bar */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {kit.status === "drafted" && (
                <>
                  <button
                    onClick={() => validateMut.mutate()}
                    disabled={validateMut.isPending}
                    className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition"
                  >
                    {validateMut.isPending ? "Validating..." : "Validate & Publish"}
                  </button>
                  <button
                    onClick={() => cancelMut.mutate()}
                    disabled={cancelMut.isPending}
                    className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
                  >
                    Cancel
                  </button>
                </>
              )}
              {kit.status === "validated" && (
                <>
                  {publicUrl && (
                    <>
                      <a
                        href={publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-3 py-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition"
                      >
                        View Public Page
                      </a>
                      <button
                        onClick={handleCopy}
                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                      >
                        {copied ? "Copied!" : "Copy Link"}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setShowRegenerate(true)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-brand-200 text-brand-700 hover:bg-brand-50 transition"
                  >
                    Regenerate
                  </button>
                  <button
                    onClick={() => archiveMut.mutate()}
                    disabled={archiveMut.isPending}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 transition"
                  >
                    Archive
                  </button>
                </>
              )}
              {kit.status === "generating" && (
                <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  Generation in progress... This page refreshes automatically.
                </div>
              )}
              {kit.status === "failed" && (
                <>
                  <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    Generation failed. You can retry or discard this press kit.
                  </div>
                  <button
                    onClick={() => retryMut.mutate()}
                    disabled={retryMut.isPending}
                    className="text-xs px-3 py-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition"
                  >
                    {retryMut.isPending ? "Retrying..." : "Retry Generation"}
                  </button>
                  <button
                    onClick={() => cancelMut.mutate()}
                    disabled={cancelMut.isPending}
                    className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
                  >
                    Discard
                  </button>
                </>
              )}
              {kit.status === "denied" && kit.denialReason && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  Denied: {kit.denialReason}
                </div>
              )}
            </div>

            {/* Regenerate form */}
            {showRegenerate && (
              <div className="bg-brand-50 border border-brand-200 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Regenerate press kit</h3>
                <p className="text-xs text-gray-500 mb-2">
                  This will create a new version based on the current one.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={regenerateInstruction}
                    onChange={(e) => setRegenerateInstruction(e.target.value)}
                    placeholder="e.g. Make it more corporate, add sustainability section..."
                    className="flex-1 text-sm border border-brand-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && regenerateInstruction.trim() && !regenerateMut.isPending) {
                        regenerateMut.mutate();
                      }
                    }}
                  />
                  <button
                    onClick={() => regenerateMut.mutate()}
                    disabled={!regenerateInstruction.trim() || regenerateMut.isPending}
                    className="px-3 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50 transition"
                  >
                    {regenerateMut.isPending ? "..." : "Go"}
                  </button>
                  <button
                    onClick={() => { setShowRegenerate(false); setRegenerateInstruction(""); }}
                    className="px-3 py-2 border border-gray-200 text-gray-500 text-sm rounded-lg hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Tabs: Content / Edit with AI */}
            <div className="flex items-center gap-1 mb-4 border-b border-gray-200">
              <button
                onClick={() => setActiveTab("content")}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
                  activeTab === "content"
                    ? "border-brand-600 text-brand-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Content
              </button>
              <button
                onClick={() => setActiveTab("chat")}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
                  activeTab === "chat"
                    ? "border-brand-600 text-brand-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Edit with AI
              </button>
            </div>

            {activeTab === "content" ? (
              <>
                {kit.mdxPageContent ? (
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <NeutralPreview content={kit.mdxPageContent} />
                  </div>
                ) : kit.status !== "generating" && kit.status !== "failed" ? (
                  <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <p className="text-gray-500 text-sm">No content yet.</p>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden" style={{ height: "calc(100vh - 320px)", minHeight: 400 }}>
                <PressKitChat
                  kitId={kitId}
                  brandId={brandId}
                  pressKitContext={{
                    mediaKitId: kitId,
                    brandId,
                    brandName: brand?.name ?? brand?.domain ?? undefined,
                    brandDomain: brand?.domain ?? undefined,
                    pressKitTitle: kit.title ?? undefined,
                    pressKitStatus: kit.status,
                    currentMdxContent: kit.mdxPageContent ?? undefined,
                    instruction: [
                      "You are editing a press kit for this brand.",
                      "The user wants to modify the press kit content (MDX).",
                      "When the user asks for changes, update the MDX content via the update_mdx tool.",
                      "Always preserve the existing structure unless the user explicitly asks to restructure.",
                    ].join(" "),
                  }}
                />
              </div>
            )}
          </div>

          {/* Sidebar — version history */}
          <div className="hidden lg:block w-56 flex-shrink-0">
            <VersionHistory currentId={kitId} campaignId={campaignId} basePath={basePath} />
          </div>
        </div>
      )}
    </div>
  );
}
