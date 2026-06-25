"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { useAuthQuery } from "@/lib/use-auth-query";
import { SparklesIcon } from "@heroicons/react/20/solid";
import { DashboardPage } from "@/components/dashboard-page";
import { Skeleton } from "@/components/skeleton";
import { EditWithAIChat } from "@/components/ai-edit/edit-with-ai-chat";
import { MaturityBadge } from "@/components/maturity-badge";
import { ProviderLogo } from "@/components/provider-logo";
import { PROVIDER_DOMAINS } from "@/lib/api-registry";
import { audienceFilterGroups } from "@/lib/audience-filter-groups";
import { pollOptions } from "@/lib/query-options";
import {
  fetchFeatureAudienceStats,
  generateAudienceAvatar,
  getBrandSalesEconomics,
  listAudiences,
  setAudienceStatus,
  type AudienceStatus,
  type AudienceWire,
  type FeatureAudienceStatsRow,
} from "@/lib/api";

const VISIBLE_AUDIENCE_STATUSES = ["active", "paused", "archived"] as const;

/** Cents → "$X.XX" / "-" / "<$0.01". Mirrors top-audiences-card. */
function formatCents(cents: number | null): string {
  if (cents == null) return "-";
  if (cents <= 0) return "$0.00";
  const usd = cents / 100;
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Audiences (beta).
 *
 * A read-only listing of the brand's human-service audiences with a lifecycle
 * status toggle (pause / resume / archive / restore). Audiences are CREATED and
 * their filters EDITED only via the AI chat / onboarding — this page does NOT
 * offer a manual create or a filter editor (the filters are provider-shaped and
 * owned by human-service). Selecting a row opens a detail panel with the colored
 * targeting tags, the AI-generated avatar (with a (re)generate button), the
 * provider logo, the status actions, and a docked "Edit with AI" chat.
 */

function audienceInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "A";
  return words.slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}

/** Avatar: the AI-generated image (data: URI) when present, else initials badge. */
function AudienceAvatar({
  name,
  avatarUrl,
  size = 28,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  const [error, setError] = useState(false);
  const box = { width: size, height: size };
  if (avatarUrl && !error) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={box}
        onError={() => setError(true)}
        className="shrink-0 rounded-full border border-gray-200 object-cover"
      />
    );
  }
  return (
    <span
      style={{ ...box, fontSize: Math.max(10, Math.round(size * 0.32)) }}
      className="flex shrink-0 items-center justify-center rounded-full border border-brand-100 bg-brand-50 font-semibold text-brand-700"
    >
      {audienceInitials(name)}
    </span>
  );
}

export function CustomerAudiencesPage() {
  const featureSlug = useSoleFeatureSlug();
  const isBeta = useIsBetaUser();
  const revenueOk = isRevenueFeature(featureSlug);

  const params = useParams();
  const brandId = params.brandId as string;
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // Deep-link seed: `?audienceId=` (e.g. from the brand-overview Top 3 audiences
  // card) opens that audience's detail panel on first paint. Selection is local
  // state thereafter — the param only seeds the initial open.
  const initialAudienceId = searchParams.get("audienceId");

  const [tab, setTab] = useState<"active" | "archived">("active");
  const [selectedId, setSelectedId] = useState<string | null>(initialAudienceId);
  const [aiOpen, setAiOpen] = useState(false);

  const { data: activeData, isPending: activePending } = useAuthQuery(
    ["audiences", brandId, "active"],
    () => listAudiences(brandId, { status: "active" }),
  );
  const { data: pausedData, isPending: pausedPending } = useAuthQuery(
    ["audiences", brandId, "paused"],
    () => listAudiences(brandId, { status: "paused" }),
  );
  const { data: archivedData, isPending: archivedPending } = useAuthQuery(
    ["audiences", brandId, "archived"],
    () => listAudiences(brandId, { status: "archived" }),
  );

  // Brand optimization goal → audience-stats goal (sorts by CPC for signup, CPPR
  // otherwise). Same resolution as the brand Overview.
  const { data: economicsData } = useAuthQuery(
    ["brandSalesEconomics", brandId],
    () => getBrandSalesEconomics(brandId),
    pollOptions,
  );
  const audienceStatsGoal =
    (economicsData?.salesEconomics?.optimizationGoal ?? "sales_meetings") === "signups"
      ? "signup"
      : "meetingBooked";

  // Per-audience outreach / opens / clicks evidence (features-service). Joined to
  // the human-service audience rows by audienceId; audiences with no attributed
  // evidence simply render "-".
  const { data: audienceStatsData, isPending: statsIsPending, isPlaceholderData: statsIsPlaceholder } = useAuthQuery(
    ["featureAudienceStats", featureSlug, brandId, audienceStatsGoal],
    () => fetchFeatureAudienceStats(featureSlug, { brandId, goal: audienceStatsGoal }),
    { enabled: Boolean(featureSlug), ...pollOptions },
  );
  // Skeleton the per-row numbers until the stats query resolves (first load or a
  // goal-key switch), instead of flashing "-" then popping to the real figures.
  const statsLoading = Boolean(featureSlug) && (statsIsPending || statsIsPlaceholder);
  const statsByAudienceId = new Map<string, FeatureAudienceStatsRow>();
  for (const row of audienceStatsData?.audiences ?? []) {
    statsByAudienceId.set(row.audienceId, row);
    statsByAudienceId.set(row.audience.id, row);
  }

  const statusMut = useMutation({
    mutationFn: (i: { id: string; status: AudienceStatus }) => setAudienceStatus(i.id, i.status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["audiences", brandId] }),
  });

  // (Re)generate the audience avatar via chat-service. Write the fresh row into the
  // list cache first (so the avatar appears instantly), then invalidate.
  const avatarMut = useMutation({
    mutationFn: (id: string) => generateAudienceAvatar(id),
    onSuccess: (res) => {
      for (const status of VISIBLE_AUDIENCE_STATUSES) {
        queryClient.setQueryData<{ audiences: AudienceWire[]; total: number }>(
          ["audiences", brandId, status],
          (old) =>
            old
              ? { ...old, audiences: old.audiences.map((a) => (a.id === res.audience.id ? res.audience : a)) }
              : old,
        );
      }
      queryClient.invalidateQueries({ queryKey: ["audiences", brandId] });
    },
  });

  const isPending = activePending || pausedPending || archivedPending;
  // Read only user-visible lifecycle states. human-service keeps suggested and
  // deprecated rows out of these status-specific reads.
  const audiences: AudienceWire[] = [
    ...(activeData?.audiences ?? []),
    ...(pausedData?.audiences ?? []),
    ...(archivedData?.audiences ?? []),
  ];
  const selected = selectedId ? audiences.find((a) => a.id === selectedId) ?? null : null;

  // Clear a stale selection only once the lists have loaded — otherwise a
  // deep-linked `?audienceId=` seed would be wiped during the initial fetch
  // (selected is null until the audience row arrives).
  useEffect(() => {
    if (!isPending && selectedId && !selected) setSelectedId(null);
  }, [isPending, selectedId, selected]);

  const setStatus = (id: string, status: AudienceStatus) => statusMut.mutate({ id, status });

  // The chat docks beside the detail panel (no backdrop, panel stays visible) when
  // an audience is selected, so AI edits show live in the left panel.
  const aiDocked = aiOpen && Boolean(selected);

  const closeInspector = () => {
    setSelectedId(null);
    setAiOpen(false);
  };

  if (!revenueOk) {
    return (
      <DashboardPage width="wide">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          This view isn&apos;t available yet.
        </div>
      </DashboardPage>
    );
  }

  if (isPending && audiences.length === 0) {
    return (
      <DashboardPage width="wide">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-48 bg-gray-200 rounded" />
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="mb-3 h-9 rounded bg-gray-100 last:mb-0" />
            ))}
          </div>
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage width="wide" className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Audiences</h1>
          <p className="text-sm text-gray-500 mt-1">
            The people we&apos;ll find and prioritize leads from. Create or change
            audiences by chatting with the AI — this page lists them and lets you
            pause, resume or archive.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelectedId(null);
            setAiOpen(true);
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100 focus:outline-none focus:ring-2 focus:ring-brand-300"
        >
          <SparklesIcon className="w-4 h-4" />
          Edit with AI
        </button>
      </div>

      {/* Active / Archived tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["active", "archived"] as const).map((t) => {
          const count = audiences.filter((a) => (t === "archived" ? a.status === "archived" : a.status !== "archived")).length;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition capitalize ${
                tab === t ? "border-brand-600 text-brand-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t} <span className="text-xs text-gray-400">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Audiences table */}
      {(() => {
        const visible = audiences.filter((a) =>
          tab === "archived" ? a.status === "archived" : a.status !== "archived",
        );
        if (visible.length === 0) {
          return (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
              <p className="text-sm text-gray-500">
                {tab === "archived" ? "No archived audiences." : "No audiences yet."}
              </p>
            </div>
          );
        }
        return (
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="min-w-[760px] w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                  <th className="px-4 py-3 font-medium">Audience</th>
                  <th className="px-4 py-3 text-right font-medium">Outreach</th>
                  <th className="px-4 py-3 text-right font-medium">Opens</th>
                  <th className="px-4 py-3 text-right font-medium">Clicks</th>
                  <th className="px-4 py-3 text-right font-medium">Cost per click</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((audience) => {
                  const isSelected = selectedId === audience.id;
                  const stats = statsByAudienceId.get(audience.id);
                  return (
                    <tr
                      key={audience.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open ${audience.name || "Untitled"} audience details`}
                      onClick={() => setSelectedId(audience.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedId(audience.id);
                        }
                      }}
                      className={`cursor-pointer border-t border-gray-100 transition hover:bg-gray-50/70 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-300 ${
                        isSelected ? "bg-brand-50/60" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <AudienceAvatar name={audience.name} avatarUrl={audience.avatarUrl} />
                          <div className="min-w-0">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <p className="min-w-0 truncate font-medium text-gray-900">{audience.name || "Untitled"}</p>
                              {audience.status === "paused" && (
                                <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-600">
                                  Paused
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700 tabular-nums">
                        {statsLoading ? (
                          <Skeleton className="ml-auto h-4 w-10" />
                        ) : stats ? (
                          stats.evidence.contacted.toLocaleString("en-US")
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700 tabular-nums">
                        {statsLoading ? (
                          <Skeleton className="ml-auto h-4 w-10" />
                        ) : stats?.evidence.opened != null ? (
                          stats.evidence.opened.toLocaleString("en-US")
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700 tabular-nums">
                        {statsLoading ? (
                          <Skeleton className="ml-auto h-4 w-10" />
                        ) : stats ? (
                          stats.evidence.websiteClicks.toLocaleString("en-US")
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-500 tabular-nums">
                        {statsLoading ? (
                          <Skeleton className="ml-auto h-4 w-12" />
                        ) : stats ? (
                          formatCents(stats.metrics.cpcCents)
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}

      <AudienceDetailPanel
        audience={selected}
        shiftRight={aiDocked}
        onClose={closeInspector}
        onEditWithAI={() => setAiOpen(true)}
        isBeta={isBeta}
        onRegenerateAvatar={() => {
          if (selected) avatarMut.mutate(selected.id);
        }}
        avatarPending={Boolean(
          selected && avatarMut.isPending && avatarMut.variables === selected.id,
        )}
        onSetStatus={(status) => {
          if (!selected) return;
          setStatus(selected.id, status);
        }}
        statusActionPending={Boolean(
          selected && statusMut.isPending && statusMut.variables?.id === selected.id,
        )}
        statusActionTarget={
          selected && statusMut.isPending && statusMut.variables?.id === selected.id
            ? statusMut.variables.status
            : undefined
        }
      />

      <EditWithAIChat
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        title="Edit audiences with AI"
        intro="Hi — I can create a new audience from a description, rename one, pause / resume / archive it, refresh its counts, or regenerate its avatar. What would you like to do?"
        suggestions={[
          "Create an audience of heads of marketing at Series A SaaS",
          "Pause the lowest-performing audience",
          "Refresh counts on all audiences",
        ]}
        configKey="audience-editor"
        brandId={brandId}
        context={selected ? { audienceId: selected.id } : undefined}
        sessionVersion={selected?.id}
        invalidateKeys={[["audiences", brandId]]}
        showBackdrop={!aiDocked}
        panelClassName={
          aiDocked
            ? "fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-[95] flex flex-col border-l border-gray-200 animate-slide-in-right"
            : undefined
        }
      />
    </DashboardPage>
  );
}

function StatusButton({
  label,
  onClick,
  busy,
  variant = "default",
}: {
  label: string;
  onClick: () => void;
  busy?: boolean;
  variant?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-brand-300 ${
        busy ? "cursor-wait opacity-70" : "disabled:opacity-40 disabled:cursor-not-allowed"
      } ${
        variant === "danger"
          ? "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          : "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100"
      }`}
    >
      {busy && <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {label}
    </button>
  );
}

function statusPillTone(status: AudienceStatus): string {
  if (status === "active") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "paused") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "archived") return "bg-gray-100 text-gray-600 border-gray-200";
  return "bg-sky-50 text-sky-700 border-sky-200";
}

function AudienceDetailPanel({
  audience,
  shiftRight,
  onClose,
  onEditWithAI,
  isBeta,
  onRegenerateAvatar,
  avatarPending,
  onSetStatus,
  statusActionPending,
  statusActionTarget,
}: {
  audience: AudienceWire | null;
  shiftRight?: boolean;
  onClose: () => void;
  onEditWithAI: () => void;
  isBeta?: boolean;
  onRegenerateAvatar: () => void;
  avatarPending?: boolean;
  onSetStatus: (status: AudienceStatus) => void;
  statusActionPending?: boolean;
  statusActionTarget?: AudienceStatus;
}) {
  useEffect(() => {
    if (!audience) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [audience, onClose]);

  if (!audience) return null;

  const busy = (target: AudienceStatus) => Boolean(statusActionPending && statusActionTarget === target);
  const count = audience.apolloCount ?? audience.apifyCount;
  const providerDomain = audience.provider ? PROVIDER_DOMAINS[audience.provider.toLowerCase()] ?? null : null;
  const groups = audience.filters ? audienceFilterGroups(audience.filters) : [];

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-gray-900/30" onClick={onClose} />
      <aside
        className={`absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-gray-200 bg-gray-50 shadow-xl transition-[margin] ${
          shiftRight ? "md:mr-[28rem]" : ""
        }`}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <AudienceAvatar name={audience.name} avatarUrl={audience.avatarUrl} size={40} />
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Audience details</p>
              <h2 className="mt-0.5 truncate text-base font-semibold text-gray-900">{audience.name || "Untitled"}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 p-4 md:p-5">
          {/* Edit with AI — stays beta-gated (AI editing), even though the
              Audiences view itself is GA. */}
          {isBeta && (
            <button
              type="button"
              onClick={onEditWithAI}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100 focus:outline-none focus:ring-2 focus:ring-brand-300"
            >
              <SparklesIcon className="w-4 h-4" />
              Edit with AI
              <MaturityBadge level="beta" />
            </button>
          )}

          {/* Avatar — AI-generated image, (re)generate */}
          <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
            <AudienceAvatar name={audience.name} avatarUrl={audience.avatarUrl} size={64} />
            <div className="min-w-0">
              <StatusButton
                label={audience.avatarUrl ? "Regenerate image" : "Generate image"}
                onClick={onRegenerateAvatar}
                busy={avatarPending}
              />
              <p className="mt-1.5 text-xs text-gray-400">
                AI-generated from this audience&apos;s traits.
              </p>
            </div>
          </div>

          {/* Targeting — colored filter-category tags */}
          {groups.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">Targeting</p>
              <div className="flex flex-col gap-2">
                {groups.map((g) => (
                  <div key={g.label} className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-2">
                    <span className="pt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      {g.label}
                    </span>
                    <div className="flex min-w-0 flex-wrap gap-1.5">
                      {g.values.map((v, j) => (
                        <span
                          key={j}
                          className={`inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-[11px] font-medium leading-5 ${g.tone}`}
                        >
                          <span className="min-w-0 whitespace-normal break-words">{v}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3 text-sm">
            <DetailRow
              label="Status"
              value={
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${statusPillTone(audience.status)}`}
                >
                  {audience.status}
                </span>
              }
            />
            {audience.description && <DetailRow label="Described as" value={audience.description} />}
            {audience.provider && (
              <DetailRow
                label="Provider"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <ProviderLogo domain={providerDomain} size={14} />
                    <span className="capitalize">{audience.provider}</span>
                  </span>
                }
              />
            )}
            {count != null && <DetailRow label="Approx. matches" value={count.toLocaleString("en-US")} />}
          </div>

          {/* Lifecycle actions */}
          <div className="flex flex-wrap gap-2">
            {audience.status === "active" && (
              <StatusButton label="Pause" onClick={() => onSetStatus("paused")} busy={busy("paused")} />
            )}
            {audience.status === "paused" && (
              <StatusButton label="Resume" onClick={() => onSetStatus("active")} busy={busy("active")} />
            )}
            {audience.status === "archived" ? (
              <StatusButton label="Restore" onClick={() => onSetStatus("active")} busy={busy("active")} />
            ) : (
              <StatusButton label="Archive" variant="danger" onClick={() => onSetStatus("archived")} busy={busy("archived")} />
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-gray-400">{label}</span>
      <span className="min-w-0 text-right text-gray-800 break-words">{value}</span>
    </div>
  );
}
