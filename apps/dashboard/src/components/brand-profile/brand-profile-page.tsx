"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDownIcon, SparklesIcon } from "@heroicons/react/20/solid";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { useAuthQuery } from "@/lib/use-auth-query";
import { DashboardPage } from "@/components/dashboard-page";
import { EditWithAIChat } from "@/components/ai-edit/edit-with-ai-chat";
import { MaturityBadge } from "@/components/maturity-badge";
import { getBrandProfile, saveBrandProfileVersion } from "@/lib/api";
import { ALL_FIELDS, SECTIONS, cloneFields, fieldsEqual, FieldEditor, type FieldDef, type FieldSection, type ProfileFields } from "./field-editor";

/**
 * Brand Profile — PURE-UI MOCKUP (beta).
 *
 * The brand's OWN info as collected at campaign creation — company overview,
 * value proposition, product, market, company facts, conversion levers. The
 * TARGET AUDIENCE is deliberately NOT here: it lives in Audiences
 * (the "Customer Profile" surface). All editing is client-side state — there is
 * NO backend wiring, a refresh resets to the seeded v1.
 *
 * Versioning: every Save forks the working draft into a new immutable version
 * (v1 → v2 → …) and retains the full history. The history panel is BUILT but
 * hidden this round (`SHOW_HISTORY = false`); later it surfaces inside Brand
 * Settings. Future: each campaign will be attached to a specific brand-profile
 * version + persona — which is why versions are kept immutable and forked, never
 * mutated in place.
 */

// Hidden for now — flip to surface the version-history panel (will move into
// Brand Settings). Kept wired so the data shape is already version-aware.
const SHOW_HISTORY = false;
const CORE_FIELD_KEYS = ["companyOverview", "valueProposition", "callToAction"];
const CORE_FIELDS = CORE_FIELD_KEYS.map((key) => ALL_FIELDS.find((field) => field.key === key)).filter((field): field is FieldDef => Boolean(field));
const SECONDARY_SECTIONS: FieldSection[] = SECTIONS.map((section) => ({
  ...section,
  fields: section.fields.filter((field) => !CORE_FIELD_KEYS.includes(field.key)),
})).filter((section) => section.fields.length > 0);

function timeAgo(ts: number | string): string {
  const ms = typeof ts === "string" ? new Date(ts).getTime() : ts;
  if (!ms || Number.isNaN(ms)) return "—";
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function BrandProfilePage() {
  const featureSlug = useSoleFeatureSlug();
  const isBeta = useIsBetaUser();
  const revenueOk = isRevenueFeature(featureSlug);

  const params = useParams();
  const brandId = params.brandId as string;
  const queryClient = useQueryClient();
  const [aiOpen, setAiOpen] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>([]);
  // null = following the saved baseline; an object = the user's working edits.
  const [draft, setDraft] = useState<ProfileFields | null>(null);

  const { data, isPending } = useAuthQuery(["brandProfile", brandId], () => getBrandProfile(brandId));

  const saveMut = useMutation({
    mutationFn: (fields: ProfileFields) => saveBrandProfileVersion(brandId, fields),
    onSuccess: () => {
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["brandProfile", brandId] });
    },
  });

  if (!revenueOk) {
    return (
      <DashboardPage width="narrow">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          This view isn&apos;t available yet.
        </div>
      </DashboardPage>
    );
  }

  if (isPending) {
    return (
      <DashboardPage width="narrow">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
      </DashboardPage>
    );
  }

  const baseline = cloneFields((data?.current?.fields ?? {}) as ProfileFields);
  const fields = draft ?? baseline;
  const dirty = draft !== null && !fieldsEqual(draft, baseline);
  const savedAt = data?.current?.createdAt ?? null;
  const versions = data?.versions ?? [];

  const setText = (key: string, value: string) =>
    setDraft((prev) => ({ ...(prev ?? baseline), [key]: value }));

  const addItem = (key: string, raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setDraft((prev) => {
      const cur = prev ?? baseline;
      const arr = Array.isArray(cur[key]) ? (cur[key] as string[]) : [];
      if (arr.some((v) => v.toLowerCase() === value.toLowerCase())) return cur;
      return { ...cur, [key]: [...arr, value] };
    });
  };

  const removeItem = (key: string, value: string) => {
    setDraft((prev) => {
      const cur = prev ?? baseline;
      const arr = Array.isArray(cur[key]) ? (cur[key] as string[]) : [];
      return { ...cur, [key]: arr.filter((v) => v !== value) };
    });
  };

  // Save = POST a new immutable version. Prior versions are never mutated — that
  // is what lets a campaign pin a specific version later.
  const save = () => {
    if (!dirty || saveMut.isPending) return;
    saveMut.mutate(fields);
  };

  const discard = () => setDraft(null);
  const renderField = (field: FieldDef) => (
    <FieldEditor
      key={field.key}
      field={field}
      value={fields[field.key]}
      onText={(v) => setText(field.key, v)}
      onAdd={(v) => addItem(field.key, v)}
      onRemove={(v) => removeItem(field.key, v)}
    />
  );

  const fieldHasValue = (field: FieldDef) => {
    const value = fields[field.key];
    if (Array.isArray(value)) return value.length > 0;
    return typeof value === "string" && value.trim().length > 0;
  };

  const fieldChanged = (field: FieldDef) => {
    const current = fields[field.key];
    const saved = baseline[field.key];
    if (Array.isArray(current) || Array.isArray(saved)) {
      const currentArr = Array.isArray(current) ? current : [];
      const savedArr = Array.isArray(saved) ? saved : [];
      return currentArr.length !== savedArr.length || currentArr.some((value, index) => value !== savedArr[index]);
    }
    return (current ?? "") !== (saved ?? "");
  };

  const toggleSection = (title: string) => {
    setOpenSections((prev) => (prev.includes(title) ? prev.filter((item) => item !== title) : [...prev, title]));
  };

  return (
    <DashboardPage width="wide">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-6 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-900">Brand Profile</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Your brand’s own info — the audience lives in{" "}
            <span className="font-medium text-gray-600">Audiences</span>.
          </p>
          <p className={`mt-2 text-xs ${dirty ? "text-amber-600" : "text-gray-400"}`}>
            {dirty ? "Unsaved changes" : savedAt ? `Last saved ${timeAgo(savedAt)}` : "Not saved yet"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isBeta && (
            <button
              type="button"
              onClick={() => setAiOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100 focus:outline-none focus:ring-2 focus:ring-brand-300"
            >
              <SparklesIcon className="w-4 h-4" />
              Edit with AI
              <MaturityBadge level="beta" />
            </button>
          )}
          {dirty && (
            <button
              type="button"
              onClick={discard}
              className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Discard
            </button>
          )}
          {dirty && (
            <button
              type="button"
              onClick={save}
              disabled={saveMut.isPending}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {saveMut.isPending ? "Saving..." : "Save"}
            </button>
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="mt-8 space-y-8">
        <section>
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Core story</h2>
            <p className="mt-1 text-sm text-gray-500">The few brand facts most workflows need first.</p>
          </div>
          <div className="space-y-5">{CORE_FIELDS.map(renderField)}</div>
        </section>

        <section className="divide-y divide-gray-200 border-y border-gray-200">
          {SECONDARY_SECTIONS.map((section) => {
            const open = openSections.includes(section.title);
            const filledCount = section.fields.filter(fieldHasValue).length;
            const changed = section.fields.some(fieldChanged);

            return (
              <div key={section.title}>
                <button
                  type="button"
                  onClick={() => toggleSection(section.title)}
                  className="flex w-full items-center justify-between gap-4 py-4 text-left"
                >
                  <span>
                    <span className="block text-sm font-semibold text-gray-900">{section.title}</span>
                    <span className="mt-1 block text-xs text-gray-400">
                      {filledCount}/{section.fields.length} fields filled
                      {changed ? " · edited" : ""}
                    </span>
                  </span>
                  <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition ${open ? "rotate-180" : ""}`} />
                </button>
                {open && <div className="space-y-5 pb-6">{section.fields.map(renderField)}</div>}
              </div>
            );
          })}
        </section>
      </div>

      {/* Version history — hidden this round (SHOW_HISTORY=false); moves into
          Brand Settings later. Kept wired so the version-aware data shape is
          already in place. */}
      {SHOW_HISTORY && (
        <div className="mt-8 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Version history</h2>
          <ul className="space-y-2">
            {[...versions].reverse().map((v) => (
              <li key={v.id} className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">v{v.version}</span>
                <span className="text-xs text-gray-400">{timeAgo(v.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <EditWithAIChat
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        title="Edit brand profile with AI"
        intro="Hi — I can edit any field of your brand profile and save a new version. What would you like to change?"
        suggestions={["Set Value proposition to …", "Add Stripe to Competitors", "Save"]}
        configKey="brand-profile-editor"
        brandId={brandId}
        sessionVersion="live-context-v1"
        context={{
          currentBrandProfile: fields,
          savedBrandProfile: baseline,
          fieldDefinitions: SECTIONS.flatMap((section) =>
            section.fields.map((field) => ({
              key: field.key,
              label: field.label,
              kind: field.kind,
              description: field.placeholder,
            })),
          ),
          versionCount: versions.length,
          savedAt,
        }}
        invalidateKeys={[["brandProfile", brandId]]}
      />
    </DashboardPage>
  );
}
