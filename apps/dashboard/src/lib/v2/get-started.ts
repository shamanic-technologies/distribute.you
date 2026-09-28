/**
 * The signed-out "get started" flow of dashboard v2 (`/get-started`), modelled on
 * Explee: a founder types their website and SEES real output before the account
 * (their company read, competitors, the offer and the audience they pick, 100 real
 * companies with the right person at each, the first emails), then gives account and
 * card on ONE screen.
 *
 * This module holds the rules the page decides on, alias-free so they carry real
 * unit tests. The page itself (`components/v2/get-started/`) renders and calls the api.
 */

/**
 * The six live steps. Steps 1 and 2 are read off the site; 3 and 4 are PICKS (one
 * offer, one audience) whose proposals are prepared in the background from the
 * moment the website is known, so they are ready when the stage reaches them; 5 is
 * the audience's companies with one person each; 6 is the first emails.
 */
export const GET_STARTED_STEPS = [
  { key: "company", label: "Read your company" },
  { key: "competitors", label: "Find your competitors" },
  { key: "offer", label: "Pick your offer" },
  { key: "audience", label: "Pick who to write to" },
  { key: "companies", label: "Find 100 companies" },
  { key: "email", label: "Write the first emails" },
] as const;

export type GetStartedStepKey = (typeof GET_STARTED_STEPS)[number]["key"];

/**
 * Steps whose backend is not live. The page STATES that on the step rather than
 * showing invented rows (owner rule: never fake data). Kept so a step whose producer
 * is withdrawn goes back to saying so in one line.
 */
export const STEPS_NOT_LIVE: ReadonlySet<GetStartedStepKey> = new Set<GetStartedStepKey>([]);

/** Emails written before the account exists: the first rows are written ahead, the rest on click, up to the cap. */
export const PREWRITTEN_EMAILS = 3;
export const EMAIL_CAP = 10;

/** Whether one more email may be written before the wall. */
export function canWriteAnother(requested: number, cap = EMAIL_CAP): boolean {
  return requested < cap;
}

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

/**
 * Step 3's source: what the company sells, one line per distinct offer, read in the
 * SAME extraction as steps 1 and 2 (one site read). brand-service then splits it into
 * offer proposals. A key of our own, so it prefills no user field.
 */
export const OFFER_FIELDS = [
  {
    key: "offerLines",
    description:
      "Every distinct thing this company sells, one line each: what it is, who it is for, and how it is bought (self-serve signup, sales call, custom quote). A SaaS with a self-serve plan and a sales-led enterprise plan is two lines; an agency lists one line per service line. Facts from the site only.",
  },
] as const;

/** What brand-service's offer proposal reads: the offer lines, else the overview. */
export function offerSourceText(lines: string[], overview: string): string {
  const joined = lines.map((l) => l.trim()).filter(Boolean).join("\n");
  return joined || overview.trim();
}

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

/** The offer picked at step 3, confirmed on the brand. */
export interface GetStartedOffer {
  offerId: string;
  name: string;
  description: string;
}

/** The audience picked at step 4, created on the brand under the picked offer. */
export interface GetStartedAudience {
  audienceId: string;
  name: string;
  description: string;
}

/** A company's size as a short figure ("27", "1.2K"), or null when Apollo gave none. */
export function employeesLabel(n: number | null | undefined): string | null {
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return null;
  return compactCount(n);
}

/** How many of the 5 size dots a company fills: 1 person, 10, 50, 250, 1000+. */
export function sizeDots(n: number | null | undefined): number {
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return 0;
  return n >= 1000 ? 5 : n >= 250 ? 4 : n >= 50 ? 3 : n >= 10 ? 2 : 1;
}

// ── The stage: which step is on screen ────────────────────────────────────────

/**
 * `choose` is a pick step whose proposals are on screen and waiting for the visitor:
 * begun (the stage may hand over to it) but not settled (it does not hand on).
 */
export type StepPhase = "waiting" | "running" | "choose" | "done" | "failed" | "notLive";

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

/**
 * How long a finished step stays on the stage. When the next step is still being
 * prepared, the finished result is held longer (up to `holdMs`) so the visitor reads
 * it rather than a spinner; the moment the next one is ready, the base dwell applies.
 */
export function stageDwellMs(nextPhase: StepPhase | undefined, baseMs: number, holdMs: number): number {
  return nextPhase === "running" ? Math.max(baseMs, holdMs) : baseMs;
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
  version: 2;
  website: string;
  brandId: string;
  brandName: string | null;
  domain: string | null;
  overview: string;
  facts: string[];
  competitors: Competitor[];
  offer: GetStartedOffer | null;
  audience: GetStartedAudience | null;
  /** Whole dollars a day, or null when none was chosen. */
  budgetUsd: number | null;
  /** An email written during the preview, so the wall still shows it after the Google round trip. */
  email: GetStartedEmail | null;
}

function parseOffer(v: unknown): GetStartedOffer | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.offerId !== "string" || !o.offerId || typeof o.name !== "string") return null;
  return { offerId: o.offerId, name: o.name, description: typeof o.description === "string" ? o.description : "" };
}

function parseAudience(v: unknown): GetStartedAudience | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.audienceId !== "string" || !o.audienceId || typeof o.name !== "string") return null;
  return { audienceId: o.audienceId, name: o.name, description: typeof o.description === "string" ? o.description : "" };
}

/** Read a stored snapshot; anything malformed, or an older version, is null (the flow starts over). */
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
  if (s.version !== 2 || typeof s.website !== "string" || typeof s.brandId !== "string" || !s.brandId) return null;
  const strOrNull = (x: unknown) => (typeof x === "string" ? x : null);
  const competitors = Array.isArray(s.competitors)
    ? s.competitors.filter((c): c is Competitor => !!c && typeof c === "object" && typeof (c as Competitor).name === "string")
    : [];
  return {
    version: 2,
    website: s.website,
    brandId: s.brandId,
    brandName: strOrNull(s.brandName),
    domain: strOrNull(s.domain),
    overview: typeof s.overview === "string" ? s.overview : "",
    facts: Array.isArray(s.facts) ? s.facts.filter((f): f is string => typeof f === "string") : [],
    competitors,
    offer: parseOffer(s.offer),
    audience: parseAudience(s.audience),
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

// ── Step 6: each row's person, found and verified live ──────────────────────────
// human-service reveals ONE row per call and returns that row's state. These rules
// only NAME what it returned: nothing here decides that an address was found.

/** A provider's name as a person reads it. Unknown names are shown as given, capitalised. */
export function providerLabel(name: string | null | undefined): string | null {
  if (!name) return null;
  const known: Record<string, string> = { apollo: "Apollo", bounceverify: "BounceVerify" };
  return known[name.toLowerCase()] ?? name.charAt(0).toUpperCase() + name.slice(1);
}

/** The verifier's verdict in plain words. */
export function verdictLabel(verdict: string | null | undefined): string | null {
  if (!verdict) return null;
  const known: Record<string, string> = {
    valid: "valid",
    catch_all: "catch-all domain",
    invalid: "invalid",
    risky: "risky",
    unknown: "could not be judged",
  };
  return known[verdict] ?? verdict.replace(/_/g, " ");
}

export interface EmailHighlight {
  text: string;
  start: number;
  end: number;
  kind: string;
  sourceLabel: string;
  sourceValue: string | null;
  reason: string;
}

export type EmailPiece = { text: string; highlight: EmailHighlight | null };

/**
 * Splits the email body into plain runs and the sentences the writer explained. A
 * highlight is used only when its offsets still point at its own text, and never when
 * it overlaps one already placed: the producer checks this too, and a stored email can
 * outlive the check. Joining the pieces always gives back `body` exactly.
 */
export function emailPieces(body: string, highlights: EmailHighlight[] | null | undefined): EmailPiece[] {
  const usable = (highlights ?? [])
    .filter((h) => h.start >= 0 && h.end > h.start && h.end <= body.length && body.slice(h.start, h.end) === h.text)
    .sort((a, b) => a.start - b.start);
  const pieces: EmailPiece[] = [];
  let at = 0;
  for (const h of usable) {
    if (h.start < at) continue;
    if (h.start > at) pieces.push({ text: body.slice(at, h.start), highlight: null });
    pieces.push({ text: h.text, highlight: h });
    at = h.end;
  }
  if (at < body.length) pieces.push({ text: body.slice(at), highlight: null });
  return pieces;
}

/** Where a sentence's reason comes from, as a short tag. */
export function highlightKindLabel(kind: string): string {
  const known: Record<string, string> = {
    prospect: "About them",
    brand: "From your site",
    audience: "From the segment",
    instruction: "Writing rule",
  };
  return known[kind] ?? kind;
}
