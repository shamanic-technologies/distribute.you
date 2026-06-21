/**
 * Audience filter → labeled, color-toned tag groups.
 *
 * Shared by the onboarding audience-candidate cards AND the Audiences page
 * detail panel so both read the same way (colored, category-grouped pills).
 * A loose provider-shaped filters object (apollo/apify use different keys) is
 * grouped into labeled categories; unknown keys still render (humanized +
 * neutral tone), so nothing is silently dropped.
 */

const NEUTRAL_TONE = "bg-gray-100 text-gray-600 border-gray-200";

// Category vocabulary borrowed from PersonaCard's FILTER_CATEGORIES so audience
// cards read like the persona cards (colored, category-grouped pills).
export const AUDIENCE_CATEGORY_MAP: { keys: string[]; label: string; tone: string }[] = [
  { keys: ["industries", "industry"], label: "Industry", tone: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { keys: ["roles", "seniority", "seniorities"], label: "Seniority", tone: "bg-purple-50 text-purple-700 border-purple-200" },
  {
    keys: ["titles", "personTitles", "jobTitles", "departments", "personDepartments"],
    label: "Job titles",
    tone: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    keys: ["employeeMin", "employeeMax", "employeeRange", "employeeRanges", "headcount"],
    label: "Employee range",
    tone: "bg-sky-50 text-sky-700 border-sky-200",
  },
  {
    keys: ["revenueMin", "revenueMax", "revenueRange", "revenue"],
    label: "Revenue",
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    keys: ["location", "locations", "country", "countries", "region", "regions"],
    label: "Location",
    tone: "bg-rose-50 text-rose-700 border-rose-200",
  },
  { keys: ["technologies", "tech", "technology"], label: "Technology", tone: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  { keys: ["keywords", "keyword"], label: "Keywords", tone: "bg-gray-100 text-gray-600 border-gray-200" },
];

export function humanizeFilterKey(key: string): string {
  const s = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export type AudienceFilterGroup = { label: string; tone: string; values: string[] };

export function audienceFilterGroups(filters: Record<string, unknown>): AudienceFilterGroup[] {
  const order: string[] = [];
  const byLabel = new Map<string, AudienceFilterGroup>();
  const push = (label: string, tone: string, raw: unknown) => {
    const value = String(raw ?? "").trim();
    if (!value) return;
    let g = byLabel.get(label);
    if (!g) {
      g = { label, tone, values: [] };
      byLabel.set(label, g);
      order.push(label);
    }
    if (!g.values.includes(value)) g.values.push(value);
  };
  for (const [key, val] of Object.entries(filters ?? {})) {
    const cat = AUDIENCE_CATEGORY_MAP.find((c) => c.keys.includes(key));
    const label = cat ? cat.label : humanizeFilterKey(key);
    const tone = cat ? cat.tone : NEUTRAL_TONE;
    if (Array.isArray(val)) {
      for (const v of val) push(label, tone, v);
    } else if (val != null && typeof val !== "object") {
      // Scalar (e.g. employeeMin: 20) — prefix with its key so min/max stay distinct.
      push(label, tone, `${humanizeFilterKey(key)}: ${val}`);
    }
  }
  return order.map((l) => {
    const g = byLabel.get(l)!;
    return { ...g, values: g.values.slice(0, 10) };
  });
}
