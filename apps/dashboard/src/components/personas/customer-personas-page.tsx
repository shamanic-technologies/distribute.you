"use client";

import { useState } from "react";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { MaturityBadge } from "@/components/maturity-badge";

/**
 * Customer Personas — PURE-UI MOCKUP (beta).
 *
 * Apollo-style targeting cards: each persona is a short name (≤4 words) plus a
 * set of B2B targeting filters (industry, headcount, revenue, location, …) shown
 * as deletable / addable chips. Create / edit / delete are all client-side state
 * — there is NO backend wiring. A refresh resets to the seeded examples. This is
 * a first visual draft; the data layer comes later.
 */

// ---------------------------------------------------------------------------
// Filter vocabulary — Apollo-inspired targeting dimensions. `suggestions` feed
// the add-chip datalist so the mockup feels populated; users can type anything.
// ---------------------------------------------------------------------------
type CategoryKey =
  | "industry"
  | "employeeRange"
  | "revenueRange"
  | "location"
  | "jobTitles"
  | "seniority"
  | "department"
  | "keywords"
  | "technologies"
  | "fundingStage";

interface FilterCategory {
  key: CategoryKey;
  label: string;
  /** Soft tag color (bg / text / border). */
  tone: string;
  suggestions: string[];
}

const FILTER_CATEGORIES: FilterCategory[] = [
  {
    key: "industry",
    label: "Industry",
    tone: "bg-indigo-50 text-indigo-700 border-indigo-200",
    suggestions: ["SaaS", "Fintech", "E-commerce", "Healthcare", "Marketing & Advertising", "Manufacturing", "Real Estate", "Education"],
  },
  {
    key: "employeeRange",
    label: "Employee range",
    tone: "bg-sky-50 text-sky-700 border-sky-200",
    suggestions: ["1-10", "11-50", "51-200", "201-500", "501-1,000", "1,001-5,000", "5,001+"],
  },
  {
    key: "revenueRange",
    label: "Revenue range",
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
    suggestions: ["<$1M", "$1M-$10M", "$10M-$50M", "$50M-$100M", "$100M-$500M", "$500M+"],
  },
  {
    key: "location",
    label: "Location (HQ)",
    tone: "bg-amber-50 text-amber-700 border-amber-200",
    suggestions: ["United States", "United Kingdom", "France", "Germany", "Canada", "EMEA", "APAC", "Remote"],
  },
  {
    key: "jobTitles",
    label: "Job titles",
    tone: "bg-rose-50 text-rose-700 border-rose-200",
    suggestions: ["Founder", "CEO", "VP Sales", "Head of Growth", "CMO", "CTO", "Product Manager", "Head of Marketing"],
  },
  {
    key: "seniority",
    label: "Seniority",
    tone: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
    suggestions: ["C-Suite", "VP", "Director", "Head / Lead", "Manager", "Senior", "Entry"],
  },
  {
    key: "department",
    label: "Department",
    tone: "bg-violet-50 text-violet-700 border-violet-200",
    suggestions: ["Sales", "Marketing", "Engineering", "Product", "Operations", "Finance", "HR", "Founders"],
  },
  {
    key: "keywords",
    label: "Keywords",
    tone: "bg-teal-50 text-teal-700 border-teal-200",
    suggestions: ["product-led growth", "outbound", "AI", "developer tools", "B2B", "marketplace"],
  },
  {
    key: "technologies",
    label: "Technologies",
    tone: "bg-cyan-50 text-cyan-700 border-cyan-200",
    suggestions: ["Salesforce", "HubSpot", "Stripe", "Shopify", "Segment", "Snowflake", "AWS", "Webflow"],
  },
  {
    key: "fundingStage",
    label: "Funding stage",
    tone: "bg-lime-50 text-lime-700 border-lime-200",
    suggestions: ["Bootstrapped", "Pre-seed", "Seed", "Series A", "Series B", "Series C+", "Public"],
  },
];

const CATEGORY_BY_KEY: Record<CategoryKey, FilterCategory> = Object.fromEntries(
  FILTER_CATEGORIES.map((c) => [c.key, c]),
) as Record<CategoryKey, FilterCategory>;

type Filters = Partial<Record<CategoryKey, string[]>>;

interface Persona {
  id: string;
  name: string;
  filters: Filters;
}

// ---------------------------------------------------------------------------
// Seed data — three example personas so the page looks alive on first paint.
// ---------------------------------------------------------------------------
const SEED_PERSONAS: Persona[] = [
  {
    id: "seed-1",
    name: "Scaling SaaS Founders",
    filters: {
      industry: ["SaaS", "Developer Tools"],
      employeeRange: ["11-50", "51-200"],
      revenueRange: ["$1M-$10M"],
      location: ["United States", "United Kingdom"],
      jobTitles: ["Founder", "CEO"],
      seniority: ["C-Suite"],
      fundingStage: ["Seed", "Series A"],
    },
  },
  {
    id: "seed-2",
    name: "Enterprise Growth Leaders",
    filters: {
      industry: ["Fintech", "E-commerce"],
      employeeRange: ["501-1,000", "1,001-5,000"],
      revenueRange: ["$100M-$500M"],
      location: ["EMEA"],
      jobTitles: ["VP Sales", "Head of Growth"],
      department: ["Sales", "Marketing"],
      technologies: ["Salesforce", "Segment"],
    },
  },
  {
    id: "seed-3",
    name: "Early Marketing Buyers",
    filters: {
      industry: ["Marketing & Advertising"],
      employeeRange: ["11-50"],
      location: ["Remote"],
      jobTitles: ["CMO", "Head of Marketing"],
      keywords: ["product-led growth", "outbound"],
      technologies: ["HubSpot"],
    },
  },
];

let idCounter = 0;
const nextId = () => `persona-${++idCounter}`;

/** Cap a name at 4 words while still allowing a trailing space mid-typing. */
function capWords(value: string, max = 4): string {
  const words = value.split(" ").filter((w, i, arr) => w !== "" || i === arr.length - 1);
  return words.slice(0, max).join(" ");
}

export function CustomerPersonasPage() {
  const featureSlug = useSoleFeatureSlug();
  const isBeta = useIsBetaUser();
  const revenueOk = isRevenueFeature(featureSlug);

  const [personas, setPersonas] = useState<Persona[]>(SEED_PERSONAS);

  if (!isBeta || !revenueOk) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          This view isn&apos;t available yet.
        </div>
      </div>
    );
  }

  const addPersona = () => {
    setPersonas((prev) => [
      { id: nextId(), name: "New Persona", filters: {} },
      ...prev,
    ]);
  };

  const updatePersona = (id: string, next: Partial<Persona>) => {
    setPersonas((prev) => prev.map((p) => (p.id === id ? { ...p, ...next } : p)));
  };

  const deletePersona = (id: string) => {
    setPersonas((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">Customer Personas</h1>
            <MaturityBadge level="beta" />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Define who you sell to. Each persona is a set of Apollo-style targeting
            filters we&apos;ll use to find and prioritize leads.
          </p>
        </div>
        <button
          type="button"
          onClick={addPersona}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
        >
          <PlusIcon />
          New persona
        </button>
      </div>

      {/* Cards grid */}
      {personas.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <p className="text-sm text-gray-500">No personas yet.</p>
          <button
            type="button"
            onClick={addPersona}
            className="mt-3 text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            + Create your first persona
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {personas.map((persona) => (
            <PersonaCard
              key={persona.id}
              persona={persona}
              onChange={(next) => updatePersona(persona.id, next)}
              onDelete={() => deletePersona(persona.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Persona card — name (editable, ≤4 words) + per-category chip rows.
// ---------------------------------------------------------------------------
function PersonaCard({
  persona,
  onChange,
  onDelete,
}: {
  persona: Persona;
  onChange: (next: Partial<Persona>) => void;
  onDelete: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** Which category currently has its add-input open. */
  const [adding, setAdding] = useState<CategoryKey | null>(null);
  const [draft, setDraft] = useState("");

  const wordCount = persona.name.trim() === "" ? 0 : persona.name.trim().split(/\s+/).length;

  const addChip = (key: CategoryKey, raw: string) => {
    const value = raw.trim();
    if (!value) return;
    const current = persona.filters[key] ?? [];
    if (current.some((v) => v.toLowerCase() === value.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange({ filters: { ...persona.filters, [key]: [...current, value] } });
    setDraft("");
  };

  const removeChip = (key: CategoryKey, value: string) => {
    const current = persona.filters[key] ?? [];
    const next = current.filter((v) => v !== value);
    const filters = { ...persona.filters };
    if (next.length) filters[key] = next;
    else delete filters[key];
    onChange({ filters });
  };

  const totalFilters = Object.values(persona.filters).reduce((n, arr) => n + (arr?.length ?? 0), 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-4">
      {/* Card header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editingName ? (
            <div>
              <input
                autoFocus
                value={persona.name}
                onChange={(e) => onChange({ name: capWords(e.target.value) })}
                onBlur={() => setEditingName(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape") setEditingName(false);
                }}
                placeholder="Persona name"
                className="w-full text-base font-semibold text-gray-900 border-b border-brand-300 pb-0.5 focus:outline-none focus:border-brand-500"
              />
              <p className="mt-1 text-[10px] text-gray-400">{wordCount}/4 words</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="group flex items-center gap-1.5 text-left"
            >
              <span className="text-base font-semibold text-gray-900 truncate">{persona.name || "Untitled"}</span>
              <PencilIcon className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 shrink-0" />
            </button>
          )}
          <p className="mt-0.5 text-[11px] text-gray-400">
            {totalFilters} {totalFilters === 1 ? "filter" : "filters"}
          </p>
        </div>

        {/* Delete */}
        {confirmDelete ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded-md px-2 py-1 text-[11px] text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete persona"
            className="shrink-0 rounded-md p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition"
          >
            <TrashIcon />
          </button>
        )}
      </div>

      {/* Filter rows */}
      <div className="space-y-2.5">
        {FILTER_CATEGORIES.map((cat) => {
          const values = persona.filters[cat.key] ?? [];
          const isAdding = adding === cat.key;
          return (
            <div key={cat.key} className="grid grid-cols-[7.5rem_1fr] gap-2 items-start">
              <span className="pt-1 text-[11px] font-medium text-gray-400">{cat.label}</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {values.map((v) => (
                  <span
                    key={v}
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cat.tone}`}
                  >
                    {v}
                    <button
                      type="button"
                      onClick={() => removeChip(cat.key, v)}
                      aria-label={`Remove ${v}`}
                      className="opacity-60 hover:opacity-100"
                    >
                      <XIcon />
                    </button>
                  </span>
                ))}

                {isAdding ? (
                  <span className="inline-flex items-center">
                    <input
                      autoFocus
                      list={`sugg-${cat.key}`}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => {
                        addChip(cat.key, draft);
                        setAdding(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addChip(cat.key, draft);
                        } else if (e.key === "Escape") {
                          setDraft("");
                          setAdding(null);
                        }
                      }}
                      placeholder={`Add ${cat.label.toLowerCase()}…`}
                      className="text-xs px-2 py-0.5 rounded-full border border-brand-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 w-36"
                    />
                    <datalist id={`sugg-${cat.key}`}>
                      {cat.suggestions.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setDraft("");
                      setAdding(cat.key);
                    }}
                    className="inline-flex items-center gap-0.5 text-xs text-gray-400 hover:text-brand-600 border border-dashed border-gray-300 hover:border-brand-300 rounded-full px-2 py-0.5 transition"
                  >
                    <PlusIcon className="w-3 h-3" />
                    {values.length === 0 ? "Add" : ""}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
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

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}
