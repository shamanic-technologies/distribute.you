"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SparklesIcon } from "@heroicons/react/20/solid";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { useAuthQuery } from "@/lib/use-auth-query";
import { EditWithAIChat } from "@/components/ai-edit/edit-with-ai-chat";
import { listPersonas, createPersona, setPersonaStatus } from "@/lib/api";
import {
  type Filters,
  type Persona,
} from "@/lib/mock-personas";
import { PersonaCard, capWords, PlusIcon } from "./persona-card";

/**
 * Customer Personas — PURE-UI MOCKUP (beta).
 *
 * Apollo-style targeting cards: each persona is a short name (≤4 words) plus a
 * set of B2B targeting filters (industry, headcount, revenue, location, …) shown
 * as deletable / addable chips. Create / edit / delete are all client-side state
 * — there is NO backend wiring. A refresh resets to the seeded examples. This is
 * a first visual draft; the data layer comes later.
 */

let idCounter = 0;
const nextId = () => `persona-${++idCounter}`;

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

  if (!isBeta || !revenueOk) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          This view isn&apos;t available yet.
        </div>
      </div>
    );
  }

  const serverPersonas: Persona[] = (data?.personas ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    filters: p.filters,
    status: p.status,
  }));
  // Drafts first (top of the list), then persisted personas.
  const personas: Persona[] = [...drafts, ...serverPersonas];

  // A brand-new persona starts as an UNSAVED draft card — Saved (POST) or
  // Cancelled away before it's ever persisted.
  const addPersona = (name = "New Persona") => {
    const created = { id: nextId(), name: uniqueName(capWords(name)), filters: {}, status: "active" as const, unsaved: true };
    setDrafts((prev) => [created, ...prev]);
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

  if (isPending && personas.length === 0) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-48 bg-gray-200 rounded" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {[0, 1].map((i) => (
              <div key={i} className="h-56 bg-gray-100 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
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

      {/* Cards grid */}
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {visible.map((persona) => (
              <PersonaCard
                key={persona.id}
                persona={persona}
                onSaveAsNew={(name, filters) => saveAsNew(name, filters)}
                onCommitNew={(name, filters) => commitNew(persona.id, name, filters)}
                onCancelNew={() => removePersona(persona.id)}
                onSetStatus={(s) => setStatus(persona.id, s)}
                checkNameTaken={(n) => isNameTaken(n, persona.unsaved ? persona.id : undefined)}
              />
            ))}
          </div>
        );
      })()}

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
    </div>
  );
}
