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
const HIDDEN_FILTER_KEYS = new Set(["contactEmailStatus", "contact_email_status"]);

// Category vocabulary borrowed from PersonaCard's FILTER_CATEGORIES so audience
// cards read like the persona cards (colored, category-grouped pills).
export const AUDIENCE_CATEGORY_MAP: { keys: string[]; label: string; tone: string }[] = [
  {
    keys: ["industries", "industry", "qOrganizationIndustryTagIds", "q_organization_industry_tag_ids"],
    label: "Industry",
    tone: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  {
    keys: ["roles", "seniority", "seniorities", "personSeniorities", "person_seniorities"],
    label: "Seniority",
    tone: "bg-purple-50 text-purple-700 border-purple-200",
  },
  {
    keys: ["titles", "personTitles", "person_titles", "jobTitles", "departments", "personDepartments"],
    label: "Job titles",
    tone: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    keys: [
      "employeeMin",
      "employeeMax",
      "employeeRange",
      "employeeRanges",
      "headcount",
      "organizationNumEmployeesRanges",
      "organization_num_employees_ranges",
    ],
    label: "Employee range",
    tone: "bg-sky-50 text-sky-700 border-sky-200",
  },
  {
    keys: ["revenueMin", "revenueMax", "revenueRange", "revenue"],
    label: "Revenue",
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    keys: [
      "location",
      "locations",
      "country",
      "countries",
      "region",
      "regions",
      "personLocations",
      "organizationLocations",
      "person_locations",
      "organization_locations",
    ],
    label: "Location",
    tone: "bg-rose-50 text-rose-700 border-rose-200",
  },
  {
    keys: ["technologies", "tech", "technology", "currentlyUsingAnyOfTechnologyUids", "currently_using_any_of_technology_uids"],
    label: "Technology",
    tone: "bg-cyan-50 text-cyan-700 border-cyan-200",
  },
  {
    keys: ["keywords", "keyword", "qKeywords", "qOrganizationKeywordTags"],
    label: "Keywords",
    tone: "bg-gray-100 text-gray-600 border-gray-200",
  },
  {
    keys: ["q_keywords"],
    label: "Search terms",
    tone: "bg-lime-50 text-lime-700 border-lime-200",
  },
];

export function humanizeFilterKey(key: string): string {
  const s = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export type AudienceFilterGroup = { label: string; tone: string; values: string[] };

function titleizeEnumValue(raw: unknown): string {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (value.toLowerCase() === "c_suite") return "C-suite";
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === "vp") return "VP";
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function formatEmployeeRange(raw: unknown): string {
  if (Array.isArray(raw) && raw.length >= 2) {
    return `${String(raw[0]).trim()}-${String(raw[1]).trim()} employees`;
  }
  const value = String(raw ?? "").trim();
  const commaRange = value.match(/^(\d+)\s*,\s*(\d+)$/);
  if (commaRange) return `${commaRange[1]}-${commaRange[2]} employees`;
  if (/^\d+\s*-\s*\d+$/.test(value)) return `${value.replace(/\s+/g, "")} employees`;
  return value;
}

function shouldPrefixScalar(key: string): boolean {
  return /(^|_)(min|max)$/.test(key) || /(Min|Max)$/.test(key);
}

function formatFilterValue(key: string, label: string, raw: unknown, isKnownCategory: boolean): string {
  if (label === "Employee range") return formatEmployeeRange(raw);
  if (label === "Seniority") return titleizeEnumValue(raw);
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (isKnownCategory && !shouldPrefixScalar(key)) return value;
  return `${humanizeFilterKey(key)}: ${value}`;
}

export function audienceFilterGroups(filters: Record<string, unknown>): AudienceFilterGroup[] {
  const order: string[] = [];
  const byLabel = new Map<string, AudienceFilterGroup>();
  const push = (key: string, label: string, tone: string, raw: unknown, isKnownCategory: boolean) => {
    const value = formatFilterValue(key, label, raw, isKnownCategory);
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
    if (HIDDEN_FILTER_KEYS.has(key)) continue;
    const cat = AUDIENCE_CATEGORY_MAP.find((c) => c.keys.includes(key));
    const label = cat ? cat.label : humanizeFilterKey(key);
    const tone = cat ? cat.tone : NEUTRAL_TONE;
    if (Array.isArray(val)) {
      for (const v of val) push(key, label, tone, v, Boolean(cat));
    } else if (val != null && typeof val !== "object") {
      push(key, label, tone, val, Boolean(cat));
    }
  }
  return order.map((l) => {
    const g = byLabel.get(l)!;
    return { ...g, values: g.values.slice(0, 10) };
  });
}
