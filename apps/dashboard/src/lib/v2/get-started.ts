/**
 * The signed-out "get started" flow of dashboard v2 (`/get-started`), modelled on
 * Explee: a founder types their website and SEES real output before any question
 * or account (their company read, competitors, segments with a market size, real
 * companies, real decision makers, one written email), then gives account and card
 * on ONE screen.
 *
 * This module holds the rules the page decides on, alias-free so they carry real
 * unit tests. The page itself (`components/v2/get-started/`) renders and calls the api.
 */

/** The six live steps, in Explee's order. */
export const GET_STARTED_STEPS = [
  { key: "company", label: "Read your company" },
  { key: "competitors", label: "Find your competitors" },
  { key: "segments", label: "Size your segments" },
  { key: "companies", label: "Find companies" },
  { key: "people", label: "Find decision makers" },
  { key: "email", label: "Write the first email" },
] as const;

export type GetStartedStepKey = (typeof GET_STARTED_STEPS)[number]["key"];

/**
 * Steps whose backend is not live. The page STATES that on the step rather than
 * showing invented rows (owner rule: never fake data). Empty since human-service's
 * audience preview (v0.46.12) and content-generation's preview email (v0.35.6)
 * reached the gateway (api-service v0.112.23); kept so a step whose producer is
 * withdrawn goes back to saying so in one line.
 */
export const STEPS_NOT_LIVE: ReadonlySet<GetStartedStepKey> = new Set<GetStartedStepKey>([]);

/** What we ask brand-service to read off the site for step 1. Keys are our own. */
export const COMPANY_FIELDS = [
  {
    key: "companyOverview",
    description:
      "Company overview: two or three plain sentences saying what the company sells, to whom, and how it is sold.",
  },
  {
    key: "companyFacts",
    description:
      "Four short factual one-liners a salesperson would want to know about this company (what it sells, who buys it, its price or business model if stated, one proof point). Each under twelve words. Facts from the site only.",
  },
] as const;

/** Step 2: competitors, asked with their domains so a logo can be drawn. */
export const COMPETITOR_FIELDS = [
  {
    key: "competitorsWithDomains",
    description:
      "Direct competitors of this company: six to twelve other companies selling the same kind of product to the same buyers. Return a list; each item is 'Company name (domain.com)'.",
  },
] as const;

/** Flatten an extracted field value (string, list, nested object) into lines. */
export function valueLines(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === "string") {
    return value
      .split(/\n+/)
      .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
      .filter((l) => l.length > 0 && l.toLowerCase() !== "unknown");
  }
  if (Array.isArray(value)) return value.flatMap((v) => valueLines(v));
  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;
    // A {name, domain} object reads as "Name (domain)", which parseCompetitors understands.
    const name = typeof rec.name === "string" ? rec.name.trim() : "";
    const domain = typeof rec.domain === "string" ? rec.domain.trim() : typeof rec.website === "string" ? rec.website.trim() : "";
    if (name || domain) return [domain ? `${name || domain} (${domain})` : name];
    return Object.values(rec).flatMap((v) => valueLines(v));
  }
  return [String(value)];
}

/** The text of a field as one paragraph. */
export function valueText(value: unknown): string {
  return valueLines(value).join(" ");
}

export interface Competitor {
  name: string;
  /** Bare host, lower case, or null when the model named none. */
  domain: string | null;
}

const DOMAIN_RE = /(?:https?:\/\/)?(?:www\.)?([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,})/i;

/**
 * Competitors out of whatever the extraction returned. Drops duplicates (by domain,
 * else by name) and the brand's own domain, which a model sometimes lists.
 */
export function parseCompetitors(value: unknown, ownDomain: string | null): Competitor[] {
  const own = (ownDomain ?? "").toLowerCase().replace(/^www\./, "");
  const seen = new Set<string>();
  const out: Competitor[] = [];
  for (const line of valueLines(value)) {
    const m = line.match(DOMAIN_RE);
    const domain = m ? m[1].toLowerCase().replace(/^www\./, "") : null;
    let name = line.replace(/\((?:[^)]*)\)/g, "").replace(DOMAIN_RE, "").replace(/[\s,;:|-]+$/g, "").trim();
    if (!name && domain) name = domain;
    if (!name) continue;
    if (domain && own && domain === own) continue;
    const key = domain ?? name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, domain });
  }
  return out;
}

/** "12.4K", "3.1M", "840": the size of a segment as Explee prints it. */
export function compactCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1000) return String(Math.round(n));
  if (n < 1_000_000) {
    const k = n / 1000;
    return `${k >= 100 ? Math.round(k) : Math.round(k * 10) / 10}K`;
  }
  const m = n / 1_000_000;
  return `${m >= 100 ? Math.round(m) : Math.round(m * 10) / 10}M`;
}

/** The bare host of a website a visitor typed, or null. */
export function hostOf(website: string): string | null {
  const raw = website.trim();
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/** The website as a URL brand-service accepts. */
export function websiteUrl(website: string): string {
  const raw = website.trim();
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

// ── The snapshot that survives the Google sign-up redirect ────────────────────

export const GET_STARTED_SNAPSHOT_KEY = "distribute:get-started:v1";

export interface GetStartedSegment {
  audienceId: string;
  name: string;
  rationale: string;
  count: number;
  /** What the people search filters on, read off the served filters. Absent on an older snapshot. */
  criteria?: SegmentCriterion[];
}

// ── Segment criteria, read off the people-search filters the producer served ──

export interface SegmentCriterion {
  label: string;
  values: string[];
}

/**
 * The filters a segment's people search runs on (apollo-service's native snake_case,
 * camelCase accepted), stated in words. Only the keys below are read: an id list or a
 * flag a person cannot read is skipped rather than guessed at. Nothing is invented; a
 * segment whose filters carry none of these states no criteria.
 */
const CRITERIA_KEYS: { label: string; keys: string[]; format?: (v: string) => string | null }[] = [
  { label: "Titles", keys: ["person_titles", "personTitles"] },
  { label: "Seniority", keys: ["person_seniorities", "personSeniorities"], format: (v) => v.replace(/_/g, " ") },
  { label: "Industries", keys: ["organization_industries", "organizationIndustries"] },
  { label: "Keywords", keys: ["q_organization_keyword_tags", "qOrganizationKeywordTags", "q_keywords", "qKeywords"] },
  { label: "Company size", keys: ["organization_num_employees_ranges", "organizationNumEmployeesRanges"], format: employeeRange },
  { label: "Where", keys: ["organization_locations", "organizationLocations", "person_locations", "personLocations"] },
];

/** "50,500" reads "50 to 500 employees"; "10001," reads "10,001+ employees". */
function employeeRange(v: string): string | null {
  const m = v.match(/^\s*(\d*)\s*,\s*(\d*)\s*$/);
  if (!m || (!m[1] && !m[2])) return null;
  const n = (x: string) => Number(x).toLocaleString("en-US");
  if (m[1] && m[2]) return `${n(m[1])} to ${n(m[2])} employees`;
  return m[1] ? `${n(m[1])}+ employees` : `Up to ${n(m[2])} employees`;
}

export function segmentCriteria(filters: unknown): SegmentCriterion[] {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) return [];
  const rec = filters as Record<string, unknown>;
  const out: SegmentCriterion[] = [];
  for (const c of CRITERIA_KEYS) {
    const seen = new Set<string>();
    const values: string[] = [];
    for (const k of c.keys) {
      const raw = rec[k];
      const list = typeof raw === "string" ? [raw] : Array.isArray(raw) ? raw : [];
      for (const item of list) {
        if (typeof item !== "string") continue;
        const v = (c.format ? c.format(item) : item.trim()) ?? "";
        if (!v || seen.has(v.toLowerCase())) continue;
        seen.add(v.toLowerCase());
        values.push(v);
      }
    }
    if (values.length) out.push({ label: c.label, values });
  }
  return out;
}

// ── The stage: which step is on screen ────────────────────────────────────────

export type StepPhase = "waiting" | "running" | "done" | "failed" | "notLive";

export const settledPhase = (p: StepPhase) => p === "done" || p === "failed" || p === "notLive";

/**
 * Where the stage goes next, given every step's phase (in order) and the step on
 * screen. A step that starts running BEFORE the one on screen (another segment was
 * picked) is jumped to at once. A step on screen that has settled hands over to the
 * next one after a short dwell, so each result is seen before it moves to the rail,
 * but only once the next step has begun. Otherwise the stage holds.
 */
export function stageMove(phases: StepPhase[], at: number): { to: number; dwell: boolean } | null {
  const running = phases.indexOf("running");
  if (running >= 0 && running < at) return { to: running, dwell: false };
  if (at < phases.length - 1 && settledPhase(phases[at]) && phases[at + 1] !== "waiting") return { to: at + 1, dwell: true };
  return null;
}

/** Explee's three steps after the preview: what the account turns on. Not run here. */
export const NEXT_STEPS = ["Send emails", "Book meetings", "Learn and double down"] as const;

/** The written email, as the wall shows it again at the moment of paying. */
export interface GetStartedEmail {
  subject: string;
  bodyText: string;
  recipient: { firstName: string; lastName: string; title: string; companyName: string };
}

export interface GetStartedSnapshot {
  version: 1;
  website: string;
  brandId: string;
  brandName: string | null;
  domain: string | null;
  overview: string;
  facts: string[];
  competitors: Competitor[];
  segments: GetStartedSegment[];
  /** Whole dollars a day, or null when none was chosen. */
  budgetUsd: number | null;
  /** The email written during the preview, so the wall still shows it after the Google round trip. Optional: an older snapshot has none. */
  email?: GetStartedEmail | null;
}

function validCriteria(raw: unknown): SegmentCriterion[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.filter(
    (c): c is SegmentCriterion =>
      !!c && typeof c === "object" && typeof (c as SegmentCriterion).label === "string" && Array.isArray((c as SegmentCriterion).values) && (c as SegmentCriterion).values.every((v) => typeof v === "string"),
  );
}

/** Read a stored snapshot; anything malformed is null (the flow starts over). */
export function parseGetStartedSnapshot(raw: string | null): GetStartedSnapshot | null {
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object") return null;
  const s = v as Record<string, unknown>;
  if (s.version !== 1 || typeof s.website !== "string" || typeof s.brandId !== "string" || !s.brandId) return null;
  const strOrNull = (x: unknown) => (typeof x === "string" ? x : null);
  const competitors = Array.isArray(s.competitors)
    ? s.competitors.filter(
        (c): c is Competitor =>
          !!c && typeof c === "object" && typeof (c as Competitor).name === "string",
      )
    : [];
  const segments = Array.isArray(s.segments)
    ? s.segments.filter(
        (g): g is GetStartedSegment =>
          !!g &&
          typeof g === "object" &&
          typeof (g as GetStartedSegment).audienceId === "string" &&
          typeof (g as GetStartedSegment).name === "string" &&
          typeof (g as GetStartedSegment).count === "number",
      )
      .map((g) => ({ ...g, criteria: validCriteria(g.criteria) }))
    : [];
  return {
    version: 1,
    website: s.website,
    brandId: s.brandId,
    brandName: strOrNull(s.brandName),
    domain: strOrNull(s.domain),
    overview: typeof s.overview === "string" ? s.overview : "",
    facts: Array.isArray(s.facts) ? s.facts.filter((f): f is string => typeof f === "string") : [],
    competitors,
    segments,
    budgetUsd: typeof s.budgetUsd === "number" && Number.isInteger(s.budgetUsd) && s.budgetUsd > 0 ? s.budgetUsd : null,
    email: parseSnapshotEmail(s.email),
  };
}

function parseSnapshotEmail(v: unknown): GetStartedEmail | null {
  if (!v || typeof v !== "object") return null;
  const e = v as Record<string, unknown>;
  const r = (e.recipient ?? {}) as Record<string, unknown>;
  const str = (x: unknown) => (typeof x === "string" ? x : null);
  const subject = str(e.subject);
  const bodyText = str(e.bodyText);
  if (!subject || !bodyText) return null;
  return {
    subject,
    bodyText,
    recipient: {
      firstName: str(r.firstName) ?? "",
      lastName: str(r.lastName) ?? "",
      title: str(r.title) ?? "",
      companyName: str(r.companyName) ?? "",
    },
  };
}

// ── The wall ──────────────────────────────────────────────────────────────────

/** The free credit every new account starts on, in dollars. */
export const WALL_FREE_CREDIT_USD = 30;

/**
 * What the free credit buys, as a whole count of hot leads: the credit divided by
 * the price the fleet's clients pay for one (a SERVED median, the homepage's figure).
 * Null when no price is held or it buys none: the block is then left out rather than
 * stating a number we do not have.
 */
export function hotLeadsForCredit(medianCostUsd: number | null | undefined, creditUsd = WALL_FREE_CREDIT_USD): number | null {
  if (typeof medianCostUsd !== "number" || !Number.isFinite(medianCostUsd) || medianCostUsd <= 0) return null;
  const n = Math.floor(creditUsd / medianCostUsd);
  return n >= 1 ? n : null;
}

/** The next slide of a carousel, wrapping. */
export function nextSlide(i: number, count: number): number {
  return count > 0 ? (i + 1) % count : 0;
}

/**
 * The daily budget a person typed, as whole dollars, or the reason it cannot be
 * used. A daily budget is a whole-dollar value everywhere in the dashboard.
 */
export function parseDailyBudget(input: string, floorUsd: number): { usd: number } | { problem: string } {
  const t = input.trim().replace(/^\$/, "");
  if (!t) return { problem: "Enter a daily budget." };
  const n = Number(t);
  if (!Number.isInteger(n) || n < 1) return { problem: "Enter a whole number of dollars a day." };
  if (n < floorUsd) return { problem: `Cold email runs from $${Math.ceil(floorUsd)} a day.` };
  return { usd: n };
}
