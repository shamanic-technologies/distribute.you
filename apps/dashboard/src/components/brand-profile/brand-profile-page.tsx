"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SparklesIcon } from "@heroicons/react/20/solid";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { useAuthQuery } from "@/lib/use-auth-query";
import { MaturityBadge } from "@/components/maturity-badge";
import { EditWithAIChat } from "@/components/ai-edit/edit-with-ai-chat";
import { getBrandProfile, saveBrandProfileVersion } from "@/lib/api";

/**
 * Brand Profile — PURE-UI MOCKUP (beta).
 *
 * The brand's OWN info as collected at campaign creation — company overview,
 * value proposition, product, market, company facts, conversion levers. The
 * TARGET AUDIENCE is deliberately NOT here: it lives in Customer Personas
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

// ---------------------------------------------------------------------------
// Field model — each brand-profile field is either free `text` (textarea) or a
// `list` of short strings (chip editor, same affordance as Customer Personas).
// Grouped into sections for a calmer layout. Mirrors SALES_PROFILE_FIELDS minus
// the audience cluster (targetAudience / customerPainPoints → Personas).
// ---------------------------------------------------------------------------
type FieldKind = "text" | "list";

interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  placeholder: string;
}

interface FieldSection {
  title: string;
  fields: FieldDef[];
}

const SECTIONS: FieldSection[] = [
  {
    title: "Positioning",
    fields: [
      { key: "companyOverview", label: "Company overview", kind: "text", placeholder: "What the company does, in a sentence or two." },
      { key: "valueProposition", label: "Value proposition", kind: "text", placeholder: "The core promise to customers." },
    ],
  },
  {
    title: "Product",
    fields: [
      { key: "keyFeatures", label: "Key features", kind: "list", placeholder: "Add a feature…" },
      { key: "productDifferentiators", label: "Differentiators", kind: "list", placeholder: "Add a differentiator…" },
    ],
  },
  {
    title: "Market",
    fields: [
      { key: "competitors", label: "Competitors", kind: "list", placeholder: "Add a competitor…" },
    ],
  },
  {
    title: "Company",
    fields: [
      { key: "leadership", label: "Leadership", kind: "list", placeholder: "Add a leader (name — role)…" },
      { key: "funding", label: "Funding", kind: "text", placeholder: "Total raised, rounds, notable investors." },
      { key: "awardsAndRecognition", label: "Awards & recognition", kind: "list", placeholder: "Add an award…" },
      { key: "revenueMilestones", label: "Revenue milestones", kind: "list", placeholder: "Add a milestone…" },
      { key: "socialProof", label: "Social proof", kind: "list", placeholder: "Add a case study / testimonial…" },
    ],
  },
  {
    title: "Conversion levers",
    fields: [
      { key: "callToAction", label: "Call to action", kind: "text", placeholder: "Primary CTA." },
      { key: "urgency", label: "Urgency", kind: "text", placeholder: "Time-pressure elements." },
      { key: "scarcity", label: "Scarcity", kind: "text", placeholder: "Limited-availability elements." },
      { key: "riskReversal", label: "Risk reversal", kind: "text", placeholder: "Trials, guarantees, refund policy." },
    ],
  },
  {
    title: "Other",
    fields: [
      { key: "additionalContext", label: "Additional context", kind: "text", placeholder: "Anything else worth knowing." },
    ],
  },
];

const ALL_FIELDS: FieldDef[] = SECTIONS.flatMap((s) => s.fields);

type ProfileFields = Record<string, string | string[]>;

// Normalize a fields map to every known field key with the right empty type, and
// clone arrays so edits never mutate the saved baseline.
function cloneFields(fields: ProfileFields): ProfileFields {
  const out: ProfileFields = {};
  for (const f of ALL_FIELDS) {
    const v = fields[f.key];
    out[f.key] = Array.isArray(v) ? [...v] : (v ?? (f.kind === "list" ? [] : ""));
  }
  return out;
}

function timeAgo(ts: number | string): string {
  const ms = typeof ts === "string" ? new Date(ts).getTime() : ts;
  if (!ms || Number.isNaN(ms)) return "—";
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fieldsEqual(a: ProfileFields, b: ProfileFields): boolean {
  return ALL_FIELDS.every((f) => {
    const av = a[f.key];
    const bv = b[f.key];
    if (Array.isArray(av) || Array.isArray(bv)) {
      const aa = Array.isArray(av) ? av : [];
      const bb = Array.isArray(bv) ? bv : [];
      return aa.length === bb.length && aa.every((v, i) => v === bb[i]);
    }
    return (av ?? "") === (bv ?? "");
  });
}

export function BrandProfilePage() {
  const featureSlug = useSoleFeatureSlug();
  const isBeta = useIsBetaUser();
  const revenueOk = isRevenueFeature(featureSlug);

  const params = useParams();
  const brandId = params.brandId as string;
  const queryClient = useQueryClient();
  const [aiOpen, setAiOpen] = useState(false);
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

  if (!isBeta || !revenueOk) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          This view isn&apos;t available yet.
        </div>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
      </div>
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

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-900">Brand Profile</h1>
            <MaturityBadge level="beta" />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Your brand’s own info — the audience lives in{" "}
            <span className="font-medium text-gray-600">Customer Personas</span>.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setAiOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100 focus:outline-none focus:ring-2 focus:ring-brand-300"
          >
            <SparklesIcon className="w-4 h-4" />
            Edit with AI
          </button>
          {dirty ? (
            <span className="text-xs text-amber-600">Unsaved changes</span>
          ) : (
            <span className="text-xs text-gray-400">{savedAt ? `Saved ${timeAgo(savedAt)}` : "Not saved yet"}</span>
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
          <button
            type="button"
            onClick={save}
            disabled={!dirty}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Save
          </button>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {SECTIONS.map((section) => (
          <div key={section.title} className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">{section.title}</h2>
            <div className="space-y-5">
              {section.fields.map((field) => (
                <FieldEditor
                  key={field.key}
                  field={field}
                  value={fields[field.key]}
                  onText={(v) => setText(field.key, v)}
                  onAdd={(v) => addItem(field.key, v)}
                  onRemove={(v) => removeItem(field.key, v)}
                />
              ))}
            </div>
          </div>
        ))}
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
        invalidateKeys={[["brandProfile", brandId]]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field editor — textarea for `text`, chip editor for `list`.
// ---------------------------------------------------------------------------
function FieldEditor({
  field,
  value,
  onText,
  onAdd,
  onRemove,
}: {
  field: FieldDef;
  value: string | string[] | undefined;
  onText: (v: string) => void;
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-400 mb-1.5">{field.label}</label>
      {field.kind === "text" ? (
        <TextEditor
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          onText={onText}
        />
      ) : (
        <ListEditor
          values={Array.isArray(value) ? value : []}
          placeholder={field.placeholder}
          onAdd={onAdd}
          onRemove={onRemove}
        />
      )}
    </div>
  );
}

// Long/free text — clean read view by default; click anywhere to drop into an
// edit textarea. Blur or Escape exits edit mode (edits apply live as you type).
function TextEditor({
  value,
  placeholder,
  onText,
}: {
  value: string;
  placeholder: string;
  onText: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <textarea
        autoFocus
        value={value}
        onChange={(e) => onText(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false);
        }}
        placeholder={placeholder}
        rows={Math.max(2, value.split("\n").length)}
        className="w-full text-sm text-gray-800 rounded-lg border border-brand-300 bg-white px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-brand-300"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group w-full text-left rounded-lg border border-transparent hover:border-gray-200 hover:bg-gray-50 px-3 py-2 transition"
    >
      {value.trim() ? (
        <span className="flex items-start gap-2">
          <span className="text-sm text-gray-800 whitespace-pre-line flex-1">{value}</span>
          <PencilIcon className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 shrink-0 mt-0.5" />
        </span>
      ) : (
        <span className="text-sm text-gray-400">{placeholder}</span>
      )}
    </button>
  );
}

function ListEditor({
  values,
  placeholder,
  onAdd,
  onRemove,
}: {
  values: string[];
  placeholder: string;
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const commit = () => {
    onAdd(draft);
    setDraft("");
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {values.map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border bg-brand-50 text-brand-700 border-brand-200"
        >
          {v}
          <button
            type="button"
            onClick={() => onRemove(v)}
            aria-label={`Remove ${v}`}
            className="opacity-60 hover:opacity-100"
          >
            <XIcon />
          </button>
        </span>
      ))}

      {adding ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            commit();
            setAdding(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              setDraft("");
              setAdding(false);
            }
          }}
          placeholder={placeholder}
          className="text-xs px-2 py-0.5 rounded-full border border-brand-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 w-48"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft("");
            setAdding(true);
          }}
          className="inline-flex items-center gap-0.5 text-xs text-gray-400 hover:text-brand-600 border border-dashed border-gray-300 hover:border-brand-300 rounded-full px-2 py-0.5 transition"
        >
          <PlusIcon className="w-3 h-3" />
          {values.length === 0 ? "Add" : ""}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons (mirrors the Customer Personas mockup)
// ---------------------------------------------------------------------------
function PlusIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
    </svg>
  );
}
