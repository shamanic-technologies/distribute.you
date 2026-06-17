/**
 * Persona type helpers shared by the Customer Personas page and any embedded
 * persona editor surfaces.
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

// A persona is never edited in place — any edit produces a duplicate at save
// time, so a campaign can keep pointing at the exact version it launched with.
// The user can pause one (kept, not running) or archive it (hidden to the
// Archived tab). `status` drives the Active / Archived split.
export type PersonaStatus = "active" | "paused" | "archived";

export interface Persona {
  id: string;
  name: string;
  filters: Filters;
  status: PersonaStatus;
  avatarUrl?: string | null;
  /** A freshly-created persona not yet saved — shown as a draft card with
   *  Save / Cancel, removable before it's ever persisted. */
  unsaved?: boolean;
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
