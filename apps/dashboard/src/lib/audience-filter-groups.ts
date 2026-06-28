/**
 * Audience filter → labeled, color-toned tag groups.
 *
 * Shared by the onboarding audience-candidate cards AND the Audiences page
 * detail panel so both read the same way (colored, category-grouped pills).
 * A loose provider-shaped filters object (apollo/apify use different keys) is
 * grouped into labeled categories. EVERY stored filter renders — scalars,
 * arrays, AND range objects ({min,max}) — so a filter that exists in the data
 * is always visible. The ONLY exception is contact_email_status: it is an
 * internal deliverability flag (always "verified"), not a targeting choice the
 * user made, so it is hidden by key.
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
    keys: ["revenueMin", "revenueMax", "revenueRange", "revenue", "revenue_range"],
    label: "Revenue",
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    keys: ["organizationNumJobsRange", "organization_num_jobs_range", "numJobsRange", "num_jobs_range"],
    label: "Open roles",
    tone: "bg-teal-50 text-teal-700 border-teal-200",
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
    keys: ["keywords", "keyword", "qKeywords", "qOrganizationKeywordTags", "q_organization_keyword_tags"],
    label: "Keywords",
    tone: "bg-gray-100 text-gray-600 border-gray-200",
  },
  {
    keys: ["qOrganizationJobTitles", "q_organization_job_titles"],
    label: "Hiring for",
    tone: "bg-orange-50 text-orange-700 border-orange-200",
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
    .trim()
    // Apollo query keys carry a leading "q" token (q_organization_… → "q organization …");
    // drop it so unmapped keys never render as "Q organization keyword tags".
    .replace(/^q\s+(?=\S)/i, "");
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

function abbreviateCurrency(n: number): string {
  const abs = Math.abs(n);
  const fmt = (v: number, suffix: string) => `$${Number(v.toFixed(1)).toString().replace(/\.0$/, "")}${suffix}`;
  if (abs >= 1e9) return fmt(n / 1e9, "B");
  if (abs >= 1e6) return fmt(n / 1e6, "M");
  if (abs >= 1e3) return fmt(n / 1e3, "K");
  return `$${n}`;
}

function rangeBounds(raw: Record<string, unknown>): { min: number | null; max: number | null } {
  const num = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return { min: num(raw.min ?? (raw as Record<string, unknown>).gte), max: num(raw.max ?? (raw as Record<string, unknown>).lte) };
}

// Format a {min,max} range object per its group. Returns "" if no usable bound.
function formatRangeObject(label: string, key: string, raw: Record<string, unknown>): string {
  const { min, max } = rangeBounds(raw);
  if (min == null && max == null) return "";

  if (label === "Revenue") {
    if (min != null && max != null) return `${abbreviateCurrency(min)}-${abbreviateCurrency(max)}`;
    if (min != null) return `${abbreviateCurrency(min)}+`;
    return `Up to ${abbreviateCurrency(max!)}`;
  }
  if (label === "Open roles") {
    if (min != null && max != null) return `${min}-${max} open roles`;
    if (min != null) return `${min}+ open roles`;
    return `Up to ${max} open roles`;
  }
  if (label === "Employee range") {
    if (min != null && max != null) return `${min}-${max} employees`;
    if (min != null) return `${min}+ employees`;
    return `Up to ${max} employees`;
  }

  // Unknown range key — humanized prefix + plain bounds.
  const body = min != null && max != null ? `${min}-${max}` : min != null ? `${min}+` : `Up to ${max}`;
  return `${humanizeFilterKey(key)}: ${body}`;
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
  const pushValue = (label: string, tone: string, value: string) => {
    if (!value) return;
    let g = byLabel.get(label);
    if (!g) {
      g = { label, tone, values: [] };
      byLabel.set(label, g);
      order.push(label);
    }
    if (!g.values.includes(value)) g.values.push(value);
  };
  const push = (key: string, label: string, tone: string, raw: unknown, isKnownCategory: boolean) => {
    pushValue(label, tone, formatFilterValue(key, label, raw, isKnownCategory));
  };
  for (const [key, val] of Object.entries(filters ?? {})) {
    if (HIDDEN_FILTER_KEYS.has(key)) continue;
    const cat = AUDIENCE_CATEGORY_MAP.find((c) => c.keys.includes(key));
    const label = cat ? cat.label : humanizeFilterKey(key);
    const tone = cat ? cat.tone : NEUTRAL_TONE;
    if (Array.isArray(val)) {
      for (const v of val) push(key, label, tone, v, Boolean(cat));
    } else if (val != null && typeof val === "object") {
      // Range objects ({min,max}) and other nested shapes — render, never drop.
      pushValue(label, tone, formatRangeObject(label, key, val as Record<string, unknown>));
    } else if (val != null) {
      push(key, label, tone, val, Boolean(cat));
    }
  }
  return order.map((l) => byLabel.get(l)!);
}
