"use client";

import { useMemo, useState } from "react";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { MaturityBadge } from "@/components/maturity-badge";

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

interface ProfileVersion {
  version: number;
  savedAt: number;
  fields: ProfileFields;
}

// Deep-clone field values so a forked version never shares array references with
// the working draft (forks must be immutable snapshots).
function cloneFields(fields: ProfileFields): ProfileFields {
  const out: ProfileFields = {};
  for (const f of ALL_FIELDS) {
    const v = fields[f.key];
    out[f.key] = Array.isArray(v) ? [...v] : (v ?? (f.kind === "list" ? [] : ""));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Seed — a believable v1 so the page looks alive on first paint.
// ---------------------------------------------------------------------------
const SEED_FIELDS: ProfileFields = {
  companyOverview:
    "Distribute is a done-for-you growth platform that runs cold-email, PR and ads on autopilot for solo builders and small teams.",
  valueProposition:
    "Give us a URL and a budget — we handle lead finding, outreach and reporting, with variable cost per outcome.",
  keyFeatures: ["Automated lead sourcing", "AI-written outreach", "Per-channel reporting", "Bring-your-own-keys"],
  productDifferentiators: ["Pay per outcome, not per seat", "No agency retainer", "Multi-channel from one budget"],
  competitors: ["Clay", "Instantly", "Apollo", "Smartlead"],
  leadership: ["Kevin Lourd — Founder", "Adam — Growth"],
  funding: "Bootstrapped.",
  awardsAndRecognition: [],
  revenueMilestones: ["First $1k MRR", "100 active brands"],
  socialProof: ["3.4% avg reply rate across 40 brands", "“Replaced our $4k/mo agency” — beta user"],
  callToAction: "Start your first campaign in under 5 minutes.",
  urgency: "Launch slots are limited while we scale infrastructure.",
  scarcity: "Onboarding capped at 50 new brands per week.",
  riskReversal: "No contract — pause or stop any campaign anytime.",
  additionalContext: "Thin wrapper over Apollo, Anthropic, Resend and LinkedIn — borrows trust from the providers.",
};

const SEED_VERSION: ProfileVersion = { version: 1, savedAt: 0, fields: cloneFields(SEED_FIELDS) };

function timeAgo(ts: number): string {
  if (!ts) return "—";
  const s = Math.floor((Date.now() - ts) / 1000);
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

  const [versions, setVersions] = useState<ProfileVersion[]>([SEED_VERSION]);
  const [draft, setDraft] = useState<ProfileFields>(() => cloneFields(SEED_FIELDS));

  const latest = versions[versions.length - 1];
  const dirty = useMemo(() => !fieldsEqual(draft, latest.fields), [draft, latest]);

  if (!isBeta || !revenueOk) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          This view isn&apos;t available yet.
        </div>
      </div>
    );
  }

  const setText = (key: string, value: string) => setDraft((prev) => ({ ...prev, [key]: value }));

  const addItem = (key: string, raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setDraft((prev) => {
      const current = Array.isArray(prev[key]) ? (prev[key] as string[]) : [];
      if (current.some((v) => v.toLowerCase() === value.toLowerCase())) return prev;
      return { ...prev, [key]: [...current, value] };
    });
  };

  const removeItem = (key: string, value: string) => {
    setDraft((prev) => {
      const current = Array.isArray(prev[key]) ? (prev[key] as string[]) : [];
      return { ...prev, [key]: current.filter((v) => v !== value) };
    });
  };

  // Save = fork the working draft into a new immutable version. Never mutate a
  // prior version — that is what lets a campaign pin a specific version later.
  const save = () => {
    if (!dirty) return;
    setVersions((prev) => [
      ...prev,
      { version: prev[prev.length - 1].version + 1, savedAt: Date.now(), fields: cloneFields(draft) },
    ]);
  };

  const discard = () => setDraft(cloneFields(latest.fields));

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-900">Brand Profile</h1>
            <MaturityBadge level="beta" />
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
              v{latest.version}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Your brand’s own info — the audience lives in{" "}
            <span className="font-medium text-gray-600">Customer Personas</span>. Saving forks a new version.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {dirty ? (
            <span className="text-xs text-amber-600">Unsaved changes</span>
          ) : (
            <span className="text-xs text-gray-400">Saved {timeAgo(latest.savedAt)}</span>
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
            Save as v{latest.version + 1}
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
                  value={draft[field.key]}
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
              <li key={v.version} className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">v{v.version}</span>
                <span className="text-xs text-gray-400">{v.savedAt ? timeAgo(v.savedAt) : "initial"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
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
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onText(e.target.value)}
          placeholder={field.placeholder}
          rows={2}
          className="w-full text-sm text-gray-800 rounded-lg border border-gray-200 px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-300"
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
