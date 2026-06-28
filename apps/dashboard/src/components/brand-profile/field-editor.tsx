"use client";

import { useState } from "react";

// ---------------------------------------------------------------------------
// Field model — each brand-profile field is either free `text` (textarea) or a
// `list` of short strings (chip editor, same affordance as Audiences).
// Grouped into sections for a calmer layout. Mirrors SALES_PROFILE_FIELDS minus
// the audience cluster (targetAudience / customerPainPoints → Personas).
// Shared by the Brand Profile page AND the beta onboarding brand-profile step.
// ---------------------------------------------------------------------------
export type FieldKind = "text" | "list";

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  placeholder: string;
}

export interface FieldSection {
  title: string;
  fields: FieldDef[];
}

export const SECTIONS: FieldSection[] = [
  {
    title: "Positioning",
    fields: [
      { key: "companyOverview", label: "Company overview", kind: "text", placeholder: "What the company does, in a sentence or two." },
      { key: "services", label: "Services sold", kind: "list", placeholder: "Add a service / product you sell…" },
      { key: "valueProposition", label: "Value proposition", kind: "text", placeholder: "The core promise to customers (the dream outcome)." },
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
      { key: "perceivedLikelihood", label: "Perceived likelihood of success", kind: "text", placeholder: "Proof it works: track record, data, guarantees, named results." },
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

export const ALL_FIELDS: FieldDef[] = SECTIONS.flatMap((s) => s.fields);

export type ProfileFields = Record<string, string | string[]>;

// Normalize a fields map to every known field key with the right empty type, and
// clone arrays so edits never mutate the saved baseline.
export function cloneFields(fields: ProfileFields): ProfileFields {
  const out: ProfileFields = {};
  for (const f of ALL_FIELDS) {
    const v = fields[f.key];
    out[f.key] = Array.isArray(v) ? [...v] : (v ?? (f.kind === "list" ? [] : ""));
  }
  return out;
}

export function fieldsEqual(a: ProfileFields, b: ProfileFields): boolean {
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

// ---------------------------------------------------------------------------
// Field editor — textarea for `text`, chip editor for `list`.
// ---------------------------------------------------------------------------
export function FieldEditor({
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
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">{field.label}</label>
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
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");

  const commit = () => {
    onAdd(draft);
    setDraft("");
  };

  if (!editing) {
    const preview = values.slice(0, 3);
    const hiddenCount = Math.max(0, values.length - preview.length);

    return (
      <div className="rounded-lg border border-transparent px-3 py-2 transition hover:border-gray-200 hover:bg-gray-50">
        {values.length > 0 ? (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-800">
                {preview.join(", ")}
                {hiddenCount > 0 && !expanded ? (
                  <>
                    {" "}
                    <button
                      type="button"
                      onClick={() => setExpanded(true)}
                      className="font-medium text-gray-500 hover:text-brand-600"
                    >
                      +{hiddenCount} more
                    </button>
                  </>
                ) : null}
              </p>
              {expanded && hiddenCount > 0 ? (
                <ul className="mt-2 space-y-1 text-sm text-gray-700">
                  {values.slice(3).map((v) => (
                    <li key={v} className="flex gap-2">
                      <span className="mt-2 h-1 w-1 rounded-full bg-gray-300 shrink-0" />
                      <span>{v}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-brand-600 shrink-0"
            >
              <PencilIcon className="w-3.5 h-3.5" />
              Edit
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft("");
              setEditing(true);
              setAdding(true);
            }}
            className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-brand-600"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            {placeholder.replace("…", "")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border bg-white text-gray-700 border-gray-200"
          >
            {v}
            <button
              type="button"
              onClick={() => onRemove(v)}
              aria-label={`Remove ${v}`}
              className="text-gray-400 hover:text-gray-700"
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
            className="inline-flex items-center gap-0.5 text-xs text-gray-500 hover:text-brand-600 border border-dashed border-gray-300 hover:border-brand-300 rounded-full px-2 py-0.5 transition"
          >
            <PlusIcon className="w-3 h-3" />
            {values.length === 0 ? "Add" : ""}
          </button>
        )}
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={() => {
            commit();
            setAdding(false);
            setEditing(false);
          }}
          className="text-xs font-medium text-gray-500 hover:text-gray-800"
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons (mirrors the Audiences mockup)
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
