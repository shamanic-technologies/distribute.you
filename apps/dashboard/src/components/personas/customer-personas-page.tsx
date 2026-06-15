"use client";

import { useState } from "react";
import { SparklesIcon } from "@heroicons/react/20/solid";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { MaturityBadge } from "@/components/maturity-badge";
import { EditWithAIPanel, type AiTurn } from "@/components/ai-edit/edit-with-ai-panel";
import {
  SEED_PERSONAS,
  type CategoryKey,
  type Filters,
  type Persona,
} from "@/lib/mock-personas";

// Default "here's what I can do" turn for the Edit-with-AI mockup.
function helpTurn(prefix?: string): AiTurn {
  return {
    reply:
      (prefix ? prefix + "\n\n" : "") +
      "I can create, fork, pause/resume and archive personas. Try:\n• Create a persona named Mid-market RevOps\n• Fork Scaling SaaS Founders\n• Pause Early Marketing Buyers\n• Archive Enterprise Growth Leaders",
  };
}

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
// The persona type + seed data live in `@/lib/mock-personas` (shared with the
// signups "Cost by persona" card so names stay in sync).
// ---------------------------------------------------------------------------
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
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [aiOpen, setAiOpen] = useState(false);

  if (!isBeta || !revenueOk) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          This view isn&apos;t available yet.
        </div>
      </div>
    );
  }

  const addPersona = (name = "New Persona") => {
    const created = { id: nextId(), name: capWords(name), filters: {}, status: "active" as const };
    setPersonas((prev) => [created, ...prev]);
    return created;
  };

  const updatePersona = (id: string, next: Partial<Persona>) => {
    setPersonas((prev) => prev.map((p) => (p.id === id ? { ...p, ...next } : p)));
  };

  const setStatus = (id: string, status: Persona["status"]) =>
    updatePersona(id, { status });

  // Fork is the ONLY way to "edit" a persona in the backend model — produce a
  // fresh active copy, never mutate the source. (The inline chip editing on a
  // card is the mockup stand-in for opening that fork to edit.)
  const forkPersona = (id: string) => {
    setPersonas((prev) => {
      const src = prev.find((p) => p.id === id);
      if (!src) return prev;
      const filters: Filters = {};
      for (const [k, v] of Object.entries(src.filters)) filters[k as CategoryKey] = [...(v ?? [])];
      return [{ id: nextId(), name: capWords(`${src.name} copy`), filters, status: "active" }, ...prev];
    });
  };

  const findByName = (q: string): Persona | undefined => {
    const needle = q.trim().toLowerCase();
    if (!needle) return undefined;
    return (
      personas.find((p) => p.name.toLowerCase() === needle) ??
      personas.find((p) => p.name.toLowerCase().includes(needle))
    );
  };

  // Client-side "AI" interpreter for the Edit-with-AI mockup. Keyword-based, no
  // LLM — maps obvious phrasings to the same operations the buttons expose.
  const runAiCommand = (raw: string): AiTurn => {
    const text = raw.trim();
    const lower = text.toLowerCase();
    const after = (kw: RegExp) => text.replace(kw, "").replace(/^(the|a|persona|named|called)\s+/i, "").replace(/["']/g, "").replace(/\bpersona\b/i, "").trim();

    if (/\b(create|add|new)\b/.test(lower)) {
      const name = after(/.*?\b(create|add|new)\b/i) || "New Persona";
      const p = addPersona(name);
      return { reply: `Created the persona “${p.name}”. Add targeting filters on its card.`, toolCalls: [{ tool: "create_persona", summary: `Created “${p.name}” (active)` }] };
    }
    if (/\b(fork|duplicate|clone|copy)\b/.test(lower)) {
      const p = findByName(after(/.*?\b(fork|duplicate|clone|copy)\b/i));
      if (!p) return helpTurn("Which persona should I fork? Try: fork Scaling SaaS Founders");
      forkPersona(p.id);
      return { reply: `Forked “${p.name}” into a new active copy.`, toolCalls: [{ tool: "fork_persona", summary: `Forked “${p.name}”` }] };
    }
    if (/\b(archive|hide|remove|delete)\b/.test(lower)) {
      const p = findByName(after(/.*?\b(archive|hide|remove|delete)\b/i));
      if (!p) return helpTurn("Which persona should I archive? Personas are never deleted — only archived.");
      setStatus(p.id, "archived");
      return { reply: `Archived “${p.name}”. It’s in the Archived tab — nothing is ever hard-deleted.`, toolCalls: [{ tool: "archive_persona", summary: `Archived “${p.name}”` }] };
    }
    if (/\b(restore|unarchive|reactivate)\b/.test(lower)) {
      const p = findByName(after(/.*?\b(restore|unarchive|reactivate)\b/i));
      if (!p) return helpTurn("Which persona should I restore?");
      setStatus(p.id, "active");
      return { reply: `Restored “${p.name}” to Active.`, toolCalls: [{ tool: "restore_persona", summary: `Restored “${p.name}”` }] };
    }
    if (/\b(pause|stop)\b/.test(lower)) {
      const p = findByName(after(/.*?\b(pause|stop)\b/i));
      if (!p) return helpTurn("Which persona should I pause?");
      setStatus(p.id, "paused");
      return { reply: `Paused “${p.name}” — kept, just not running.`, toolCalls: [{ tool: "pause_persona", summary: `Paused “${p.name}”` }] };
    }
    if (/\b(resume|unpause|activate)\b/.test(lower)) {
      const p = findByName(after(/.*?\b(resume|unpause|activate)\b/i));
      if (!p) return helpTurn("Which persona should I resume?");
      setStatus(p.id, "active");
      return { reply: `Resumed “${p.name}”.`, toolCalls: [{ tool: "resume_persona", summary: `Resumed “${p.name}”` }] };
    }
    if (/\b(list|show|what)\b/.test(lower)) {
      const active = personas.filter((p) => p.status !== "archived");
      return { reply: active.length ? `You have ${active.length} active persona(s):\n${active.map((p) => `• ${p.name}${p.status === "paused" ? " (paused)" : ""}`).join("\n")}` : "No active personas yet.", toolCalls: [{ tool: "list_personas", summary: `Read ${active.length} active persona(s)` }] };
    }
    return helpTurn();
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
                onChange={(next) => updatePersona(persona.id, next)}
                onFork={() => forkPersona(persona.id)}
                onSetStatus={(s) => setStatus(persona.id, s)}
              />
            ))}
          </div>
        );
      })()}

      <EditWithAIPanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        title="Edit personas with AI"
        intro="Hi — I can create, fork, pause, resume and archive your personas. What would you like to change?"
        suggestions={["Create a persona named Mid-market RevOps", "Fork Scaling SaaS Founders", "Archive Early Marketing Buyers"]}
        onSend={runAiCommand}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Persona card — name (editable, ≤4 words) + per-category chip rows.
// ---------------------------------------------------------------------------
function PersonaCard({
  persona,
  onChange,
  onFork,
  onSetStatus,
}: {
  persona: Persona;
  onChange: (next: Partial<Persona>) => void;
  onFork: () => void;
  onSetStatus: (status: Persona["status"]) => void;
}) {
  const [editingName, setEditingName] = useState(false);
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
          <p className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-400">
            <span>{totalFilters} {totalFilters === 1 ? "filter" : "filters"}</span>
            {persona.status === "paused" && (
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

        {/* Actions — personas are never hard-deleted, only forked / paused /
            archived. Archived cards offer Restore instead. */}
        <div className="flex items-center gap-1 shrink-0">
          {persona.status === "archived" ? (
            <button
              type="button"
              onClick={() => onSetStatus("active")}
              className="rounded-md px-2 py-1 text-[11px] font-medium text-brand-600 hover:bg-brand-50 transition"
            >
              Restore
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onSetStatus(persona.status === "paused" ? "active" : "paused")}
                className="rounded-md px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition"
              >
                {persona.status === "paused" ? "Resume" : "Pause"}
              </button>
              <button
                type="button"
                onClick={onFork}
                title="Fork — personas are edited by forking, never in place"
                className="rounded-md px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition"
              >
                Fork
              </button>
              <button
                type="button"
                onClick={() => onSetStatus("archived")}
                aria-label="Archive persona"
                className="rounded-md p-1.5 text-gray-300 hover:bg-gray-100 hover:text-gray-600 transition"
              >
                <ArchiveIcon />
              </button>
            </>
          )}
        </div>
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

function ArchiveIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25-2.25m-2.25 2.25V3.75M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}
