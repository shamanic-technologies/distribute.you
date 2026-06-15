/**
 * Mock persona data — shared between the Customer Personas page (the editable
 * cards) and the signups "Cost by persona" card, so both show the SAME persona
 * names. PURE MOCKUP: personas aren't persisted or attributed in the backend
 * yet, so the per-persona cost numbers below are deterministic placeholders.
 * Replace with real per-persona attribution once the data layer lands.
 */

export type CategoryKey =
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

export type Filters = Partial<Record<CategoryKey, string[]>>;

/** Per-category label + soft chip tone, shared by the Personas page and the
 *  Run-Campaign modal recap so chips look identical on both surfaces. */
export const CATEGORY_META: Record<CategoryKey, { label: string; tone: string }> = {
  industry: { label: "Industry", tone: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  employeeRange: { label: "Employee range", tone: "bg-sky-50 text-sky-700 border-sky-200" },
  revenueRange: { label: "Revenue range", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  location: { label: "Location (HQ)", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  jobTitles: { label: "Job titles", tone: "bg-rose-50 text-rose-700 border-rose-200" },
  seniority: { label: "Seniority", tone: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" },
  department: { label: "Department", tone: "bg-violet-50 text-violet-700 border-violet-200" },
  keywords: { label: "Keywords", tone: "bg-teal-50 text-teal-700 border-teal-200" },
  technologies: { label: "Technologies", tone: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  fundingStage: { label: "Funding stage", tone: "bg-lime-50 text-lime-700 border-lime-200" },
};

/** Stable category render order. */
export const CATEGORY_ORDER: CategoryKey[] = [
  "industry",
  "employeeRange",
  "revenueRange",
  "location",
  "jobTitles",
  "seniority",
  "department",
  "keywords",
  "technologies",
  "fundingStage",
];

// Personas are never hard-edited or deleted in the backend — only forked. The
// user can pause one (kept but not running) or archive it (hidden to the
// Archived tab). `status` drives the Active / Archived split on the page.
export type PersonaStatus = "active" | "paused" | "archived";

export interface Persona {
  id: string;
  name: string;
  filters: Filters;
  status: PersonaStatus;
}

export const SEED_PERSONAS: Persona[] = [
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
    status: "active",
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
    status: "active",
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
    status: "active",
  },
];

/** Stable hash of a string → 0..1, so mock numbers don't change between renders. */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // >>> 0 → unsigned; divide by max uint32 → [0, 1).
  return (h >>> 0) / 0xffffffff;
}

/**
 * Deterministic mock signups economics for a persona (placeholder until the
 * backend attributes real spend + conversions per persona). Plausible
 * cold-email ranges: CPC ~$0.04–$0.16, cost per signup ~$9–$45, a few hundred
 * clicks, a single-digit-to-low-double-digit expected signups, and the signup
 * pipeline revenue that implies.
 */
export function personaMockCost(personaId: string): {
  cpcUsd: number;
  costPerSignupUsd: number;
  clicks: number;
  signups: number;
  expectedRevenueUsd: number;
} {
  const a = hash01(personaId);
  const b = hash01(`${personaId}:signup`);
  const c = hash01(`${personaId}:clicks`);
  const cpcUsd = 0.04 + a * 0.12;
  const costPerSignupUsd = 9 + b * 36;
  const clicks = Math.round(120 + c * 680); // ~120–800 clicks
  // ~2.5%–7% click→signup, so signups scales off clicks.
  const signups = Math.max(1, Math.round(clicks * (0.025 + a * 0.045)));
  // Signup worth ~$120–$320 LTR (mock), pipeline = signups × value.
  const signupValueUsd = 120 + b * 200;
  return {
    cpcUsd,
    costPerSignupUsd,
    clicks,
    signups,
    expectedRevenueUsd: signups * signupValueUsd,
  };
}
