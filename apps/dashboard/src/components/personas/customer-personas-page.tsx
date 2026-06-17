"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SparklesIcon } from "@heroicons/react/20/solid";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { useAuthQuery } from "@/lib/use-auth-query";
import { DashboardPage } from "@/components/dashboard-page";
import { EditWithAIChat } from "@/components/ai-edit/edit-with-ai-chat";
import { listPersonas, createPersona, setPersonaStatus, regeneratePersonaAvatar } from "@/lib/api";
import {
  type Filters,
  type Persona,
  personaMockCost,
} from "@/lib/mock-personas";
import { PersonaAvatar, PersonaCard, capWords, PlusIcon } from "./persona-card";

/**
 * Customer Personas (beta).
 *
 * Personas are listed as a stats table. Selecting a row opens the existing
 * Apollo-style targeting editor in a right panel, so lifecycle and edit behavior
 * stay in one component.
 */

let idCounter = 0;
const nextId = () => `persona-${++idCounter}`;

function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

function formatUsdDecimal(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function totalFilters(persona: Persona): number {
  return Object.values(persona.filters).reduce((sum, values) => sum + (values?.length ?? 0), 0);
}

function statusPill(persona: Persona) {
  if (persona.unsaved) {
    return {
      label: "Draft",
      className: "border-brand-200 bg-brand-50 text-brand-600",
    };
  }
  if (persona.status === "paused") {
    return {
      label: "Paused",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }
  if (persona.status === "archived") {
    return {
      label: "Archived",
      className: "border-gray-200 bg-gray-100 text-gray-500",
    };
  }
  return {
    label: "Active",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
}

export function CustomerPersonasPage() {
  const featureSlug = useSoleFeatureSlug();
  const isBeta = useIsBetaUser();
  const revenueOk = isRevenueFeature(featureSlug);

  const params = useParams();
  const brandId = params.brandId as string;
  const queryClient = useQueryClient();

  // Unsaved new personas live in client state until Saved (then POSTed) or
  // Cancelled. Persisted personas come from the backend query.
  const [drafts, setDrafts] = useState<Persona[]>([]);
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [aiOpen, setAiOpen] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const requestedAvatarIds = useRef<Set<string>>(new Set());

  const { data, isPending } = useAuthQuery(["personas", brandId], () => listPersonas(brandId));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["personas", brandId] });
  const createMut = useMutation({
    mutationFn: (i: { name: string; filters: Filters }) =>
      createPersona(brandId, { name: i.name, filters: i.filters as Record<string, string[]> }),
    onSuccess: invalidate,
  });
  const statusMut = useMutation({
    mutationFn: (i: { id: string; status: Persona["status"] }) => setPersonaStatus(brandId, i.id, i.status),
    onSuccess: invalidate,
  });
  const {
    mutate: regenerateAvatar,
    isPending: avatarRegenerating,
    variables: regeneratingAvatarId,
  } = useMutation({
    mutationFn: (personaId: string) => regeneratePersonaAvatar(brandId, personaId),
    onSuccess: invalidate,
  });

  const serverPersonas: Persona[] = (data?.personas ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    filters: p.filters,
    status: p.status,
    avatarUrl: p.avatarUrl ?? null,
  }));
  // Drafts first (top of the list), then persisted personas.
  const personas: Persona[] = [...drafts, ...serverPersonas];
  const missingAvatarId = serverPersonas.find((p) => !p.avatarUrl && !requestedAvatarIds.current.has(p.id))?.id;
  const selectedPersona = selectedPersonaId
    ? personas.find((p) => p.id === selectedPersonaId) ?? null
    : null;

  useEffect(() => {
    if (!missingAvatarId || avatarRegenerating) return;
    requestedAvatarIds.current.add(missingAvatarId);
    regenerateAvatar(missingAvatarId);
  }, [missingAvatarId, avatarRegenerating, regenerateAvatar]);

  useEffect(() => {
    if (selectedPersonaId && !selectedPersona) setSelectedPersonaId(null);
  }, [selectedPersonaId, selectedPersona]);

  // A brand-new persona starts as an UNSAVED draft card — Saved (POST) or
  // Cancelled away before it's ever persisted.
  const addPersona = (name = "New Persona") => {
    const created = { id: nextId(), name: uniqueName(capWords(name)), filters: {}, status: "active" as const, unsaved: true };
    setDrafts((prev) => [created, ...prev]);
    setSelectedPersonaId(created.id);
    return created;
  };

  // Cancel an unsaved draft (only drafts call this — persisted personas archive).
  const removePersona = (id: string) => setDrafts((prev) => prev.filter((p) => p.id !== id));

  const setStatus = (id: string, status: Persona["status"]) => statusMut.mutate({ id, status });

  // Persona names are UNIQUE at all times (case-insensitive, across active +
  // paused + archived + unsaved drafts). `exceptId` lets a draft compare against
  // everyone else.
  const isNameTaken = (name: string, exceptId?: string) => {
    const needle = name.trim().toLowerCase();
    return personas.some((p) => p.id !== exceptId && p.name.trim().toLowerCase() === needle);
  };

  // Append " 2", " 3", … until the name is free — used when duplicating locally.
  const uniqueName = (base: string) => {
    const trimmed = base.trim() || "Persona";
    if (!isNameTaken(trimmed)) return trimmed;
    for (let i = 2; ; i++) {
      const candidate = `${trimmed} ${i}`;
      if (!isNameTaken(candidate)) return candidate;
    }
  };

  // Commit a draft (new) persona → POST, drop the local draft on success.
  const commitNew = (id: string, name: string, filters: Filters) =>
    createMut.mutate({ name: capWords(name), filters }, { onSuccess: () => removePersona(id) });

  // Save edits as a NEW persona — every edit is a duplicate at save time, the
  // source is never mutated.
  const saveAsNew = (name: string, filters: Filters) =>
    createMut.mutate({ name: capWords(name), filters });

  if (!isBeta || !revenueOk) {
    return (
      <DashboardPage width="wide">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          This view isn&apos;t available yet.
        </div>
      </DashboardPage>
    );
  }

  if (isPending && personas.length === 0) {
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
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">Customer Personas</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Define who you sell to. Each persona is a set of Apollo-style targeting
            filters we&apos;ll use to find and prioritize leads.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setAiOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700 transition hover:bg-brand-100 focus:outline-none focus:ring-2 focus:ring-brand-300"
          >
            <SparklesIcon className="w-4 h-4" />
            Edit with AI
          </button>
          <button
            type="button"
            onClick={() => addPersona()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
          >
            <PlusIcon />
            New persona
          </button>
        </div>
      </div>

      {/* Active / Archived tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["active", "archived"] as const).map((t) => {
          const count = personas.filter((p) => (t === "archived" ? p.status === "archived" : p.status !== "archived")).length;
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

      {/* Personas table */}
      {(() => {
        const visible = personas.filter((p) =>
          tab === "archived" ? p.status === "archived" : p.status !== "archived",
        );
        if (visible.length === 0) {
          return (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
              <p className="text-sm text-gray-500">
                {tab === "archived" ? "No archived personas." : "No personas yet."}
              </p>
              {tab === "active" && (
                <button
                  type="button"
                  onClick={() => addPersona()}
                  className="mt-3 text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  + Create your first persona
                </button>
              )}
            </div>
          );
        }
        return (
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="min-w-[760px] w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                  <th className="px-4 py-3 font-medium">Persona</th>
                  <th className="px-4 py-3 text-right font-medium">Clicks</th>
                  <th className="px-4 py-3 text-right font-medium">Cost per click</th>
                  <th className="px-4 py-3 text-right font-medium">Signups</th>
                  <th className="px-4 py-3 text-right font-medium">Cost per signup</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((persona) => {
                  const stats = personaMockCost(persona.id);
                  const pill = statusPill(persona);
                  const selected = selectedPersonaId === persona.id;
                  const filterCount = totalFilters(persona);
                  return (
                    <tr
                      key={persona.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open ${persona.name || "Untitled"} persona details`}
                      onClick={() => setSelectedPersonaId(persona.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedPersonaId(persona.id);
                        }
                      }}
                      className={`cursor-pointer border-t border-gray-100 transition hover:bg-gray-50/70 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-300 ${
                        selected ? "bg-brand-50/60" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <PersonaAvatar
                            name={persona.name}
                            avatarUrl={persona.avatarUrl}
                            onRegenerate={!persona.unsaved ? () => regenerateAvatar(persona.id) : undefined}
                            regenerating={avatarRegenerating && regeneratingAvatarId === persona.id}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900">{persona.name || "Untitled"}</p>
                              <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${pill.className}`}>
                                {pill.label}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-gray-400">
                              {filterCount} {filterCount === 1 ? "targeting filter" : "targeting filters"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">{formatCount(stats.clicks)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatUsdDecimal(stats.cpcUsd)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">{formatCount(stats.signups)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatUsdDecimal(stats.costPerSignupUsd)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}

      <PersonaDetailPanel
        persona={selectedPersona}
        onClose={() => setSelectedPersonaId(null)}
        onSaveAsNew={(name, filters) => saveAsNew(name, filters)}
        onCommitNew={(name, filters) => {
          if (!selectedPersona) return;
          commitNew(selectedPersona.id, name, filters);
          setSelectedPersonaId(null);
        }}
        onCancelNew={() => {
          if (!selectedPersona) return;
          removePersona(selectedPersona.id);
          setSelectedPersonaId(null);
        }}
        onSetStatus={(status) => {
          if (!selectedPersona) return;
          setStatus(selectedPersona.id, status);
        }}
        onRegenerateAvatar={
          selectedPersona && !selectedPersona.unsaved ? () => regenerateAvatar(selectedPersona.id) : undefined
        }
        regeneratingAvatar={Boolean(
          selectedPersona && avatarRegenerating && regeneratingAvatarId === selectedPersona.id,
        )}
        checkNameTaken={(name) => isNameTaken(name, selectedPersona?.unsaved ? selectedPersona.id : undefined)}
      />

      <EditWithAIChat
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        title="Edit personas with AI"
        intro="Hi — I can review, create, duplicate, pause, resume and archive your personas. What would you like to change?"
        suggestions={["Create a persona named Mid-market RevOps", "Duplicate Scaling SaaS Founders", "Archive Early Marketing Buyers"]}
        configKey="persona-editor"
        brandId={brandId}
        sessionVersion="live-context-v1"
        context={{
          personaCount: personas.length,
          activePersonaCount: personas.filter((p) => p.status !== "archived").length,
          personas: personas.map((p) => ({
            id: p.id,
            name: p.name,
            status: p.status,
            filters: p.filters,
            persisted: !p.unsaved,
          })),
        }}
        invalidateKeys={[["personas", brandId]]}
      />
    </DashboardPage>
  );
}

function PersonaDetailPanel({
  persona,
  onClose,
  onSaveAsNew,
  onCommitNew,
  onCancelNew,
  onSetStatus,
  onRegenerateAvatar,
  regeneratingAvatar,
  checkNameTaken,
}: {
  persona: Persona | null;
  onClose: () => void;
  onSaveAsNew: (name: string, filters: Filters) => void;
  onCommitNew: (name: string, filters: Filters) => void;
  onCancelNew: () => void;
  onSetStatus: (status: Persona["status"]) => void;
  onRegenerateAvatar?: () => void;
  regeneratingAvatar?: boolean;
  checkNameTaken: (name: string) => boolean;
}) {
  useEffect(() => {
    if (!persona) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [persona, onClose]);

  if (!persona) return null;

  const stats = personaMockCost(persona.id);
  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-gray-900/30" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-gray-200 bg-gray-50 shadow-xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Persona details</p>
            <h2 className="mt-1 truncate text-base font-semibold text-gray-900">{persona.name || "Untitled"}</h2>
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <PersonaStat label="Clicks" value={formatCount(stats.clicks)} />
            <PersonaStat label="Cost per click" value={formatUsdDecimal(stats.cpcUsd)} />
            <PersonaStat label="Signups" value={formatCount(stats.signups)} />
            <PersonaStat label="Cost per signup" value={formatUsdDecimal(stats.costPerSignupUsd)} />
          </div>
          <PersonaCard
            key={persona.id}
            persona={persona}
            onSaveAsNew={onSaveAsNew}
            onCommitNew={onCommitNew}
            onCancelNew={onCancelNew}
            onSetStatus={onSetStatus}
            onRegenerateAvatar={onRegenerateAvatar}
            regeneratingAvatar={regeneratingAvatar}
            checkNameTaken={checkNameTaken}
          />
        </div>
      </aside>
    </div>
  );
}

function PersonaStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}
