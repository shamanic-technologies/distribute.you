"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { useAuthQuery } from "@/lib/use-auth-query";
import { SparklesIcon } from "@heroicons/react/20/solid";
import { DashboardPage } from "@/components/dashboard-page";
import { EditWithAIChat } from "@/components/ai-edit/edit-with-ai-chat";
import { listAudiences, setAudienceStatus, type AudienceStatus, type AudienceWire } from "@/lib/api";

/**
 * Audiences (beta).
 *
 * A read-only listing of the brand's human-service audiences with a lifecycle
 * status toggle (pause / resume / archive / restore). Audiences are CREATED and
 * their filters EDITED only via the AI chat / onboarding — this page does NOT
 * offer a manual create or a filter editor (the filters are provider-shaped and
 * owned by human-service). Selecting a row opens a read-only detail with the
 * status actions.
 */

function audienceInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "A";
  return words.slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}

function AudienceAvatar({ name }: { name: string }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand-100 bg-brand-50 text-[10px] font-semibold text-brand-700">
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
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"active" | "archived">("active");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  const { data, isPending } = useAuthQuery(["audiences", brandId], () => listAudiences(brandId));

  const statusMut = useMutation({
    mutationFn: (i: { id: string; status: AudienceStatus }) => setAudienceStatus(i.id, i.status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["audiences", brandId] }),
  });

  // "suggested" candidates are inactive pre-activation rows — not shown on the
  // page (they belong to the onboarding/AI suggest flow until activated).
  const audiences: AudienceWire[] = (data?.audiences ?? []).filter((a) => a.status !== "suggested");
  const selected = selectedId ? audiences.find((a) => a.id === selectedId) ?? null : null;

  useEffect(() => {
    if (selectedId && !selected) setSelectedId(null);
  }, [selectedId, selected]);

  const setStatus = (id: string, status: AudienceStatus) => statusMut.mutate({ id, status });

  if (!isBeta || !revenueOk) {
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
          onClick={() => setAiOpen(true)}
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
                  <th className="px-4 py-3 text-right font-medium">Clicks</th>
                  <th className="px-4 py-3 text-right font-medium">Cost per click</th>
                  <th className="px-4 py-3 text-right font-medium">Signups</th>
                  <th className="px-4 py-3 text-right font-medium">Cost per signup</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((audience) => {
                  const isSelected = selectedId === audience.id;
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
                          <AudienceAvatar name={audience.name} />
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
                      <td className="px-4 py-3 text-right font-medium text-gray-500">-</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-500">-</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-500">-</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-500">-</td>
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
        onClose={() => setSelectedId(null)}
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
        intro="Hi — I can create a new audience from a description, rename one, pause / resume / archive it, or refresh its counts. What would you like to do?"
        suggestions={[
          "Create an audience of heads of marketing at Series A SaaS",
          "Pause the lowest-performing audience",
          "Refresh counts on all audiences",
        ]}
        configKey="audience-editor"
        brandId={brandId}
        invalidateKeys={[["audiences", brandId]]}
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

function AudienceDetailPanel({
  audience,
  onClose,
  onSetStatus,
  statusActionPending,
  statusActionTarget,
}: {
  audience: AudienceWire | null;
  onClose: () => void;
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

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-gray-900/30" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-gray-200 bg-gray-50 shadow-xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Audience details</p>
            <h2 className="mt-1 truncate text-base font-semibold text-gray-900">{audience.name || "Untitled"}</h2>
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
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3 text-sm">
            <DetailRow label="Status" value={<span className="capitalize">{audience.status}</span>} />
            {audience.nlPrompt && <DetailRow label="Described as" value={audience.nlPrompt} />}
            {audience.provider && <DetailRow label="Provider" value={<span className="capitalize">{audience.provider}</span>} />}
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
