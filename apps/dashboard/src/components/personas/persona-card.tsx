"use client";

import { useState } from "react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { type CategoryKey, type Filters, type Persona } from "@/lib/mock-personas";

// ---------------------------------------------------------------------------
// Filter vocabulary — Apollo-inspired targeting dimensions. `suggestions` feed
// the add-chip datalist so the editor feels populated; users can type anything.
// The persona type + seed data live in `@/lib/mock-personas` (shared with the
// signups "Cost by persona" card so names stay in sync).
// ---------------------------------------------------------------------------
export interface FilterCategory {
  key: CategoryKey;
  label: string;
  /** Soft tag color (bg / text / border). */
  tone: string;
  suggestions: string[];
}

export const FILTER_CATEGORIES: FilterCategory[] = [
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

/** Cap a name at 4 words while still allowing a trailing space mid-typing. */
export function capWords(value: string, max = 4): string {
  const words = value.split(" ").filter((w, i, arr) => w !== "" || i === arr.length - 1);
  return words.slice(0, max).join(" ");
}

function cloneFilters(f: Filters): Filters {
  const out: Filters = {};
  for (const [k, v] of Object.entries(f)) out[k as CategoryKey] = [...(v ?? [])];
  return out;
}

function filtersEqual(a: Filters, b: Filters): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<CategoryKey>;
  for (const k of keys) {
    const av = a[k] ?? [];
    const bv = b[k] ?? [];
    if (av.length !== bv.length || av.some((x, i) => x !== bv[i])) return false;
  }
  return true;
}

const AVATAR_TONES = [
  "bg-indigo-50 text-indigo-700 border-indigo-100",
  "bg-emerald-50 text-emerald-700 border-emerald-100",
  "bg-amber-50 text-amber-700 border-amber-100",
  "bg-rose-50 text-rose-700 border-rose-100",
  "bg-sky-50 text-sky-700 border-sky-100",
  "bg-violet-50 text-violet-700 border-violet-100",
];

function hashIndex(value: string, modulo: number): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (Math.imul(hash, 31) + value.charCodeAt(i)) | 0;
  return Math.abs(hash) % modulo;
}

function personaInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "P";
  return words.slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}

export function PersonaAvatar({
  name,
  avatarUrl,
  onRegenerate,
  regenerating,
}: {
  name: string;
  avatarUrl?: string | null;
  onRegenerate?: () => void;
  regenerating?: boolean;
}) {
  const tone = AVATAR_TONES[hashIndex(name || "Audience", AVATAR_TONES.length)];
  return (
    <div className="group/avatar relative h-11 w-11 shrink-0">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-11 w-11 rounded-xl border border-gray-200 bg-white object-cover"
        />
      ) : (
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl border text-sm font-semibold ${tone}`}>
          {personaInitials(name)}
        </div>
      )}
      {onRegenerate && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRegenerate();
          }}
          disabled={regenerating}
          aria-label={`Regenerate ${name || "audience"} avatar`}
          title="Regenerate avatar"
          className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:cursor-wait disabled:opacity-70 sm:opacity-0 sm:group-hover/avatar:opacity-100 sm:focus:opacity-100"
        >
          {regenerating ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          ) : (
            <ArrowPathIcon className="h-3.5 w-3.5" />
          )}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Persona card — edits NEVER mutate the saved persona. A brand-new persona is
// an unsaved draft you Save or Cancel; editing an existing persona surfaces
// "Unsaved changes" + "Save as new audience" (the edit becomes a duplicate at
// save), with Cancel to revert. Both can always be undone before Save.
//
// EMBEDDED MODE (onboarding): pass `onChange` to drive a parent-controlled flow
// — the save bar + lifecycle actions are hidden and every name/filter edit is
// reported live via `onChange`. `onRemove` renders a small remove (X) instead.
// ---------------------------------------------------------------------------
export function PersonaCard({
  persona,
  onSaveAsNew,
  onCommitNew,
  onCancelNew,
  onSetStatus,
  checkNameTaken,
  onChange,
  onRemove,
  onRegenerateAvatar,
  regeneratingAvatar = false,
  showLifecycleActions = true,
}: {
  persona: Persona;
  onSaveAsNew?: (name: string, filters: Filters) => void;
  onCommitNew?: (name: string, filters: Filters) => void;
  onCancelNew?: () => void;
  onSetStatus?: (status: Persona["status"]) => void;
  checkNameTaken?: (name: string) => boolean;
  /** Embedded/controlled mode — report edits live, hide the save bar. */
  onChange?: (name: string, filters: Filters) => void;
  /** Embedded remove affordance (X in the header). */
  onRemove?: () => void;
  /** Persisted personas can replace their generated avatar. */
  onRegenerateAvatar?: () => void;
  regeneratingAvatar?: boolean;
  /** Hide pause/archive/restore actions where the lifecycle has not been explained. */
  showLifecycleActions?: boolean;
}) {
  const embedded = !!onChange;
  const isNew = persona.unsaved === true;
  const isArchived = persona.status === "archived";
  const editable = !isArchived;

  const [editingName, setEditingName] = useState(false);
  const [adding, setAdding] = useState<CategoryKey | null>(null);
  const [chipDraft, setChipDraft] = useState("");

  // Local working copy. The saved persona (props) is the baseline and is never
  // mutated in place — Save commits a new draft or duplicates the edits.
  const [name, setName] = useState(persona.name);
  const [filters, setFilters] = useState<Filters>(() => cloneFilters(persona.filters));

  const wordCount = name.trim() === "" ? 0 : name.trim().split(/\s+/).length;
  const totalFilters = Object.values(filters).reduce((n, arr) => n + (arr?.length ?? 0), 0);
  const dirty = name !== persona.name || !filtersEqual(filters, persona.filters);
  const showSaveBar = !embedded && editable && (isNew || dirty);
  // Names are unique at all times — block Save on a collision (a saved-as-new
  // persona must also differ from its source, forcing a rename).
  const nameTaken = checkNameTaken?.(name) ?? false;
  const nameInvalid = !name.trim() || nameTaken;

  const updateName = (raw: string) => {
    const v = capWords(raw);
    setName(v);
    onChange?.(v, filters);
  };

  const addChip = (key: CategoryKey, raw: string) => {
    const value = raw.trim();
    setChipDraft("");
    if (!value) return;
    const current = filters[key] ?? [];
    if (current.some((v) => v.toLowerCase() === value.toLowerCase())) return;
    const next: Filters = { ...filters, [key]: [...current, value] };
    setFilters(next);
    onChange?.(name, next);
  };

  const removeChip = (key: CategoryKey, value: string) => {
    const current = filters[key] ?? [];
    const remaining = current.filter((v) => v !== value);
    const next: Filters = { ...filters };
    if (remaining.length) next[key] = remaining;
    else delete next[key];
    setFilters(next);
    onChange?.(name, next);
  };

  const resetDraft = () => {
    setName(persona.name);
    setFilters(cloneFilters(persona.filters));
    setEditingName(false);
    setAdding(null);
  };

  const handleSave = () => {
    if (nameInvalid) return;
    if (isNew) onCommitNew?.(name, filters);
    else {
      onSaveAsNew?.(name, filters);
      resetDraft();
    }
  };

  const handleCancel = () => {
    if (isNew) onCancelNew?.();
    else resetDraft();
  };

  return (
    <div className={`bg-white rounded-xl border p-5 flex flex-col gap-4 ${showSaveBar ? "border-brand-300 ring-1 ring-brand-200" : "border-gray-200"}`}>
      {/* Card header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <PersonaAvatar
            name={name}
            avatarUrl={persona.avatarUrl}
            onRegenerate={!isNew ? onRegenerateAvatar : undefined}
            regenerating={regeneratingAvatar}
          />
          <div className="min-w-0 flex-1">
            {editingName && editable ? (
              <div>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => updateName(e.target.value)}
                  onBlur={() => setEditingName(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") setEditingName(false);
                  }}
                  placeholder="Audience name"
                  className="w-full text-base font-semibold text-gray-900 border-b border-brand-300 pb-0.5 focus:outline-none focus:border-brand-500"
                />
                <p className="mt-1 text-[10px] text-gray-400">{wordCount}/4 words</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => editable && setEditingName(true)}
                disabled={!editable}
                className="group flex items-center gap-1.5 text-left"
              >
                <span className="text-base font-semibold text-gray-900 truncate">{name || "Untitled"}</span>
                {editable && <PencilIcon className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 shrink-0" />}
              </button>
            )}
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
              <span>{totalFilters} {totalFilters === 1 ? "filter" : "filters"}</span>
              {!embedded && isNew && (
                <span className="rounded-full bg-brand-50 text-brand-600 border border-brand-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                  Draft
                </span>
              )}
              {!isNew && persona.status === "paused" && (
                <span className="rounded-full bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                  Paused
                </span>
              )}
              {persona.status === "archived" && (
                <span className="rounded-full bg-gray-100 text-gray-500 border border-gray-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                  Archived
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Lifecycle actions — never hard-delete. New drafts have none (Save /
            Cancel live in the save bar). Archived cards only offer Restore.
            Embedded cards offer a single remove (X). */}
        {embedded ? (
          onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label="Remove audience"
              className="rounded-md p-1.5 text-gray-300 hover:bg-gray-100 hover:text-gray-600 transition shrink-0"
            >
              <XIcon />
            </button>
          )
        ) : showLifecycleActions && !isNew ? (
          <div className="flex items-center gap-1 shrink-0">
            {isArchived ? (
              <button
                type="button"
                onClick={() => onSetStatus?.("active")}
                className="rounded-md px-2 py-1 text-[11px] font-medium text-brand-600 hover:bg-brand-50 transition"
              >
                Restore
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onSetStatus?.(persona.status === "paused" ? "active" : "paused")}
                  className="rounded-md px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition"
                >
                  {persona.status === "paused" ? "Resume" : "Pause"}
                </button>
                <button
                  type="button"
                  onClick={() => onSetStatus?.("archived")}
                  aria-label="Archive audience"
                  className="rounded-md p-1.5 text-gray-300 hover:bg-gray-100 hover:text-gray-600 transition"
                >
                  <ArchiveIcon />
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>

      {/* Filter rows */}
      <div className="space-y-2.5">
        {FILTER_CATEGORIES.map((cat) => {
          const values = filters[cat.key] ?? [];
          const isAdding = adding === cat.key;
          return (
            <div key={cat.key} className="grid grid-cols-1 items-start gap-1 sm:grid-cols-[7.5rem_1fr] sm:gap-2">
              <span className="text-[11px] font-medium text-gray-400 sm:pt-1">{cat.label}</span>
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {values.map((v) => (
                  <span
                    key={v}
                    className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cat.tone}`}
                  >
                    <span className="min-w-0 break-words">{v}</span>
                    {editable && (
                      <button
                        type="button"
                        onClick={() => removeChip(cat.key, v)}
                        aria-label={`Remove ${v}`}
                        className="opacity-60 hover:opacity-100"
                      >
                        <XIcon />
                      </button>
                    )}
                  </span>
                ))}

                {!editable ? (
                  values.length === 0 && <span className="text-xs text-gray-300">—</span>
                ) : isAdding ? (
                  <span className="inline-flex items-center">
                    <input
                      autoFocus
                      list={`sugg-${cat.key}`}
                      value={chipDraft}
                      onChange={(e) => setChipDraft(e.target.value)}
                      onBlur={() => {
                        addChip(cat.key, chipDraft);
                        setAdding(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addChip(cat.key, chipDraft);
                        } else if (e.key === "Escape") {
                          setChipDraft("");
                          setAdding(null);
                        }
                      }}
                      placeholder={`Add ${cat.label.toLowerCase()}…`}
                      className="w-36 max-w-full rounded-full border border-brand-300 bg-white px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300"
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
                      setChipDraft("");
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

      {/* Save bar — appears for an unsaved draft, or once an existing persona is
          edited. Every edit is saved as a duplicate; both are cancellable. */}
      {showSaveBar && (
        <div className="flex flex-col items-stretch gap-2 border-t border-gray-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <span className={`text-[11px] ${nameTaken ? "text-red-600" : "text-amber-600"}`}>
            {nameTaken
              ? "Name already used — pick a unique name"
              : !name.trim()
                ? "Name required"
                : isNew
                  ? "Draft — not saved yet"
                  : "Unsaved changes"}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={nameInvalid}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {isNew ? "Save audience" : "Save as new audience"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
export function PlusIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
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

function ArchiveIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25-2.25m-2.25 2.25V3.75M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}
