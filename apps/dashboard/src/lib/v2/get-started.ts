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
 * The live steps. 1 and 2 are read off the site; 3 and 4 are PICKS (one offer, one
 * audience) whose proposals are prepared in the background; 5 to 8 are QUESTIONS the
 * visitor answers about the offer (what they want to buy, what a client is worth, the
 * six offer points, what they give away and never give), each prefilled from the site;
 * 9 is the audience's companies with one person each; 10 is the first emails, written
 * only once 5 to 8 are answered, since they are written from those answers.
 */
import { COUNTRIES } from "../../components/onboarding/phone-countries";

export const GET_STARTED_STEPS = [
  { key: "company", label: "Read your company" },
  { key: "competitors", label: "Find your competitors" },
  { key: "offer", label: "Pick your offer" },
  { key: "audience", label: "Pick who to write to" },
  { key: "value", label: "What a client is worth" },
  { key: "salesSteps", label: "Your sales steps" },
  { key: "legs", label: "How leads move" },
  { key: "paths", label: "Your most profitable opportunity" },
  { key: "levers", label: "Sharpen your offer" },
  { key: "gives", label: "What you give away" },
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

/** Index of a step in `GET_STARTED_STEPS`. */
export function stepIndex(key: GetStartedStepKey): number {
  return GET_STARTED_STEPS.findIndex((s) => s.key === key);
}

/**
 * The sales path (owner-decided 2026-10-01): we know the visitor wants sales, so the
 * question is what they let us do. They tick the STEPS their sales go through today
 * (drafted off the site), then the LEGS between them, and features-service ranks every
 * path those legs make by expected ROI (`GET /offers/:offerId/sales-paths`). One daily
 * budget then goes to the best path first (billing's global mode, spent by
 * campaign-service): nothing here ranks, divides or splits money.
 */

/** The channels we run, with the words a visitor reads for each. */
export const SALES_PATH_CHANNEL_LABEL: Readonly<Record<string, string>> = {
  "sales-cold-email-outreach": "Cold email",
  "ai-meeting-booking": "Meeting booking",
  "ai-instant-call": "Instant call",
};

/**
 * The step every offer is ticked on, whatever the site says (owner 2026-10-03): a
 * positive reply to our cold email is the base of every sales meeting, and no website
 * can show it, so asking the site read about it dropped it on 8 drafts of 11 (Legistai
 * launched on website visits only while the reply path was ~40% cheaper per client).
 */
export const ALWAYS_TICKED_STEP = "conversation";

/** The site read that drafts the steps: ONE field, answered with step keys from the catalogue. */
export function salesStepsDraftField(steps: ReadonlyArray<{ key: string; label: string }>): { key: "salesSteps"; description: string } {
  const list = steps
    .filter((s) => s.key !== ALWAYS_TICKED_STEP)
    .map((s) => `${s.key} (${s.label})`)
    .join(", ");
  return {
    key: "salesSteps",
    description:
      "Which of these steps does this company's sales process go through today, judging from its website (how a prospect becomes a paying client: do they book a demo or a call, sign up for a trial, fill a form, buy online, talk to a sales rep)? " +
      "Tick purchase ONLY when the site sells online with a checkout and no sales conversation (an online shop); a payment after a signup, a trial or a call is NOT a purchase. " +
      `Answer ONLY with keys from this list, one per line, no other words: ${list}.`,
  };
}

/** The drafted steps, kept only when the catalogue offers them, in catalogue order. */
export function parseDraftedSteps(value: unknown, offered: readonly string[]): string[] {
  const raw = Array.isArray(value) ? value.map(String) : typeof value === "string" ? value.split(/[\n,]/) : [];
  const said = new Set(
    raw
      .map((x) => x.trim().replace(/^[-*\s]+/, "").split(/[\s(]/)[0])
      .filter(Boolean),
  );
  return offered.filter((k) => said.has(k));
}

/** The steps the screen opens ticked on: the drafted ones plus the positive reply, in catalogue order. */
export function initialSalesSteps(drafted: unknown, offered: readonly string[]): string[] {
  const keys = new Set(parseDraftedSteps(drafted, offered));
  keys.add(ALWAYS_TICKED_STEP);
  return offered.filter((k) => keys.has(k));
}

/** A path as this flow reads it: what features-service served, narrowed to what we use. */
export interface PlanPath {
  pathKey: string;
  entryChannelSlug: string | null;
  legs: ReadonlyArray<{
    legKey: string;
    fromStep: { key: string } | null;
    /** The step the leg reaches: names the campaign working it. */
    toStep: { label: string };
    workedBy: string;
    channel: { slug: string | null; name: string | null } | null;
  }>;
}

/**
 * The path we launch first: the best-ranked one whose entry leg a channel of ours runs.
 * campaign-service's global budget goes to exactly that one (a path no channel of ours
 * enters buys nothing it can run), so the highlight and the money agree.
 */
export function firstLaunchedPath<P extends PlanPath>(paths: readonly P[]): P | null {
  return paths.find((p) => !!p.entryChannelSlug) ?? null;
}

/** One campaign the launch creates: a channel on one leg. `reactive` = set off by a step, not by the daily budget. */
export interface PlanCampaign {
  featureSlug: string;
  legKey: string;
  label: string;
  /** The step the leg reaches ("Website visit"): two legs of one channel are told apart by it. */
  outcome: string;
  reactive: boolean;
  /** On the path launched first: its campaign must be created or the launch fails. */
  required: boolean;
}

/**
 * Every campaign the launch creates: each leg a channel of ours works, on every path,
 * the path launched first first. The global budget then decides which runs; a path
 * whose campaigns do not exist could never take the money when a better one cannot.
 */
export function launchPlan(paths: readonly PlanPath[]): PlanCampaign[] {
  const first = firstLaunchedPath(paths);
  const ordered = first ? [first, ...paths.filter((p) => p !== first)] : [...paths];
  const out: PlanCampaign[] = [];
  const seen = new Set<string>();
  for (const p of ordered) {
    if (!p.entryChannelSlug) continue;
    for (const l of p.legs) {
      const slug = l.channel?.slug;
      if (l.workedBy !== "platform" || !slug) continue;
      const key = `${slug}|${l.legKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        featureSlug: slug,
        legKey: l.legKey,
        label: SALES_PATH_CHANNEL_LABEL[slug] ?? l.channel?.name ?? slug,
        outcome: l.toStep.label,
        reactive: l.fromStep !== null,
        required: p === first,
      });
    }
  }
  return out;
}

/**
 * The margin for replies (owner-decided 2026-10-01, Google Ads' way): the daily budget
 * goes to finding new leads, and on top of it UP TO half of it may be spent answering the
 * leads who reply (every campaign set off by a step: meeting booking, calls). The visitor
 * ticks a box saying so before paying.
 */
export const REPLY_MARGIN_SHARE = 0.5;

/** Whole dollars a day each reply campaign may spend: the margin shared between them. */
export function replyCeilingUsd(budgetUsd: number, replyCampaigns: number): number {
  if (replyCampaigns <= 0) return 0;
  return Math.floor((budgetUsd * REPLY_MARGIN_SHARE) / replyCampaigns);
}

/** The whole-dollar margin for replies on a budget. */
export function replyMarginUsd(budgetUsd: number): number {
  return Math.floor(budgetUsd * REPLY_MARGIN_SHARE);
}

/**
 * The smallest daily budget the plan can run on: every lead-finding campaign must clear
 * its channel's floor at the full budget, and every reply campaign at its share of the
 * margin (billing refuses a ceiling under the floor).
 */
export function planFloorUsd(plan: readonly PlanCampaign[], floorCentsBySlug: ReadonlyMap<string, number>, fallbackUsd: number): number {
  let floor = fallbackUsd;
  const replies = plan.filter((c) => c.reactive).length;
  for (const c of plan) {
    const cents = floorCentsBySlug.get(c.featureSlug);
    if (cents == null) continue;
    const need = c.reactive ? Math.ceil((cents / 100) * replies / REPLY_MARGIN_SHARE) : Math.ceil(cents / 100);
    if (need > floor) floor = need;
  }
  return floor;
}

/** What a client is worth, drafted off the site. A key of our own: it prefills nothing stored. */
export const VALUE_FIELDS = [
  {
    key: "clientLifetimeRevenueUsd",
    description:
      "Best estimate, in US dollars, of the total revenue ONE new client brings this company over the whole relationship (price times how long a client typically stays or how often they buy again). Use the prices on the site when stated, else a sensible estimate for this kind of business. Answer with one number only, no currency sign, no words.",
  },
] as const;

/** A drafted dollar amount as a whole number of dollars, or null when none can be read. */
export function parseUsdEstimate(value: unknown): number | null {
  const text = Array.isArray(value) ? value.join(" ") : typeof value === "number" ? String(value) : typeof value === "string" ? value : "";
  const m = text.replace(/,/g, "").match(/\d+(?:\.\d+)?\s*[kKmM]?/);
  if (!m) return null;
  const raw = m[0].trim();
  const mult = /[kK]$/.test(raw) ? 1000 : /[mM]$/.test(raw) ? 1_000_000 : 1;
  const n = Math.round(parseFloat(raw) * mult);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** A typed lifetime revenue: whole dollars, above zero. */
export function parseLifetimeRevenue(input: string): { usd: number } | { problem: string } {
  const t = input.replace(/[$,\s]/g, "");
  if (!t) return { problem: "Enter what one client brings you." };
  if (!/^\d+(\.\d+)?$/.test(t)) return { problem: "Enter an amount in dollars, digits only." };
  const usd = Math.round(parseFloat(t));
  if (usd <= 0) return { problem: "Enter an amount above zero." };
  return { usd };
}

/**
 * The six offer points (Hormozi), drafted as SHORT bullets so they fit six boxes. The
 * keys are the stored lever keys, so a confirmed value overlays the draft.
 */
export const LEVER_DRAFT_FIELDS = [
  { key: "dreamOutcome", label: "Dream outcome", question: "What does your customer get, in their words?", description: "Dream outcome: the concrete result the customer most wants from this offer. Two or three short bullet points, each under twelve words." },
  { key: "perceivedLikelihood", label: "Why it works", question: "What makes them believe it will work for them?", description: "Perceived likelihood: why a buyer believes it will work for them (track record, method, named results). Two or three short bullet points, each under twelve words." },
  { key: "socialProof", label: "Proof", question: "Which clients, results or testimonials can you show?", description: "Social proof: clients, results and testimonials the site shows. Two or three short bullet points, each under twelve words. Facts from the site only." },
  { key: "riskReversal", label: "Guarantee", question: "What happens if it does not work?", description: "Risk reversal: trial, guarantee or refund that removes the buyer's risk. Two or three short bullet points, each under twelve words." },
  { key: "urgency", label: "Why now", question: "Why should they start this week?", description: "Urgency: why the buyer should act now rather than later. Two or three short bullet points, each under twelve words." },
  { key: "scarcity", label: "Why it is limited", question: "What is capped: seats, slots, a deadline?", description: "Scarcity: what is limited (capacity, slots, a deadline). Two or three short bullet points, each under twelve words." },
] as const;

export type LeverDraftKey = (typeof LEVER_DRAFT_FIELDS)[number]["key"];

/**
 * "Services sold" of the picked offer, drafted in the same site read as the levers and
 * saved on the offer without a screen of its own: the offer page shows it, and it was
 * left empty on every offer this flow created.
 */
export const SERVICES_DRAFT_FIELD = {
  key: "services",
  description:
    "Services sold: what a buyer pays for in this offer, as the site names it (product, package or service). One to three short phrases, each under eight words. Facts from the site only.",
} as const;

/** What is given away to whoever replies, and what is never promised (brand-service #584 keys). */
export const GIVE_DRAFT_FIELDS = [
  {
    key: "giveForFree",
    label: "What we can give for free",
    question: "What could you give, for free, to someone who replies?",
    description:
      "What this company actually gives for free to a prospect who replies to a cold email, as its site or offer states it. Only things it says it gives; never a generic idea it did not state. None stated means no bullet. Up to five short bullet points, each under ten words.",
  },
  {
    key: "neverGive",
    label: "What we will never give",
    question: "What should an email never promise?",
    description:
      "Things this company's site or offer explicitly says it does not give or do. Most sites say none: then return no bullet, never a guess. Each item is a whole thing it never gives in any form, never a limit on something it gives (a limit reads as a promise of everything below it): drop the item's size, duration or scope word (full, full-scale, permanent, unlimited, unbounded, long-term, above, beyond, a date, a number); if what is left is something the company gives, do not list it. Up to four short bullet points, each under ten words.",
  },
] as const;

export type GiveDraftKey = (typeof GIVE_DRAFT_FIELDS)[number]["key"];

/** Bullet lines of an answer: one per line, list markers dropped. */
export function answerLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((l) => l.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}

/** The six questions and their answers, as a prompt to paste into an LLM. */
export function leversLLMPrompt(offerName: string, answers: Partial<Record<LeverDraftKey, string>>): string {
  const blocks = LEVER_DRAFT_FIELDS.map((f) => {
    const lines = answerLines(answers[f.key] ?? "");
    const body = lines.length ? lines.map((l) => `- ${l}`).join("\n") : "- (not answered yet)";
    return `${f.label}: ${f.question}\n${body}`;
  });
  return [
    `I sell "${offerName}". Below are my answers to the six questions of Alex Hormozi's value equation.`,
    "Improve each answer: make it concrete, specific and credible, two or three short bullet points each, and tell me what is missing.",
    "",
    ...blocks.flatMap((b) => [b, ""]),
  ]
    .join("\n")
    .trim();
}

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
  /** The steps and legs ticked for the offer (saved on it); null until ticked. Absent on an older snapshot. */
  salesPath?: { steps: string[]; legs: string[] } | null;
  /** The ranked paths were seen and accepted. */
  pathsDone?: boolean;
  /** What one client is worth, whole dollars; null until answered. */
  lifetimeRevenueUsd?: number | null;
  /** Whether the offer points and the give lists were answered (and saved on the offer). */
  answered?: boolean;
  /** Who the brand sells to (the ICP text the audiences were split from); the launch builds every audience from it. Absent on an older snapshot. */
  icp?: string | null;
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
    salesPath: parseSalesPath(s.salesPath),
    pathsDone: s.pathsDone === true,
    lifetimeRevenueUsd:
      typeof s.lifetimeRevenueUsd === "number" && Number.isInteger(s.lifetimeRevenueUsd) && s.lifetimeRevenueUsd > 0 ? s.lifetimeRevenueUsd : null,
    answered: s.answered === true,
    icp: typeof s.icp === "string" && s.icp.trim() ? s.icp : null,
  };
}

function parseSalesPath(v: unknown): { steps: string[]; legs: string[] } | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const strs = (x: unknown) => (Array.isArray(x) ? x.filter((y): y is string => typeof y === "string" && y.length > 0) : null);
  const steps = strs(o.steps);
  const legs = strs(o.legs);
  return steps && legs ? { steps, legs } : null;
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

/**
 * The words of the wall, per arm. The landing's `subscription` arm (`lp_variant`,
 * `lib/subscription-plan.ts`) walks the same `/get-started` but buys the monthly plan:
 * a 3-day free trial that starts with the plan's credit, then the monthly amount.
 * Every other visitor claims the $30 free credit and pays as the campaign spends.
 */
export interface WallCopy {
  /** The credit the visitor starts on, in dollars (what the left panel counts). */
  creditUsd: number;
  creditLine: string;
  bannerTitle: string;
  bannerCta: string;
  timerLabel: string;
  timerExtendedLabel: string;
  formTitle: string;
  formSub: string;
  emailCta: string;
  codeCta: string;
  cardTitle: string;
  cardNote: string;
  cardCta: string;
}

export function wallCopy(arm: { subscription: false } | { subscription: true; monthlyCents: number; creditCents: number }): WallCopy {
  if (!arm.subscription) {
    const c = WALL_FREE_CREDIT_USD;
    return {
      creditUsd: c,
      creditLine: "free credit",
      bannerTitle: "of free credit to start",
      bannerCta: `Start outreach with $${c} free`,
      timerLabel: `Time left to claim your $${c} free trial`,
      timerExtendedLabel: `We're giving you more time to lock in your $${c}`,
      formTitle: `Claim your $${c} and start`,
      formSub: "One minute. No charge today.",
      emailCta: `Claim my $${c} and start`,
      codeCta: `Unlock my $${c}`,
      cardTitle: "You will not be charged yet",
      cardNote: `The card only confirms you are real. Once your $${c} runs out, it pays what the campaign spends, never more than your daily budget.`,
      cardCta: "Add card and start",
    };
  }
  const credit = Math.round(arm.creditCents / 100);
  const monthly = `$${Math.round(arm.monthlyCents / 100).toLocaleString("en-US")}`;
  return {
    creditUsd: credit,
    creditLine: "of credit, free for 3 days",
    bannerTitle: "of credit, free for 3 days",
    bannerCta: "Start my free trial",
    timerLabel: "Time left to claim your free trial",
    timerExtendedLabel: "We're giving you more time to start your free trial",
    formTitle: "Start your 3-day free trial",
    formSub: "One minute. Nothing charged for 3 days.",
    emailCta: "Start my free trial",
    codeCta: "Start my free trial",
    cardTitle: "Nothing charged for 3 days",
    cardNote: `Your campaign starts with $${credit} of credit when you add your card. After 3 days, ${monthly} a month. Cancel anytime.`,
    cardCta: "Add card and start my trial",
  };
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

/**
 * A market size as a big figure: "14K leads", "3.4K leads", "820 leads", "1.2M leads".
 * No "~": the count is the people search's own (human-service's free dry-run).
 */
export function leadCountLabel(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n < 0) return null;
  const fmt = (v: number, unit: string) => `${v < 10 ? (Math.round(v * 10) / 10).toString() : Math.round(v).toString()}${unit}`;
  if (n >= 1_000_000) return `${fmt(n / 1_000_000, "M")} leads`;
  if (n >= 1000) return `${fmt(n / 1000, "K")} leads`;
  return `${Math.round(n)} leads`;
}

/** The step before this one, or null for the first. */
export function previousStep(key: GetStartedStepKey): GetStartedStepKey | null {
  const i = stepIndex(key);
  return i > 0 ? GET_STARTED_STEPS[i - 1].key : null;
}

/** The question steps: going back reopens them to be answered again. Others are only shown. */
export const REOPENABLE_STEPS: ReadonlySet<GetStartedStepKey> = new Set<GetStartedStepKey>([
  "value",
  "salesSteps",
  "legs",
  "paths",
  "levers",
  "gives",
]);

/**
 * A company's country as a flag and a name, off the name the companies read carries
 * (Apollo's English name, "United States"; a bare ISO code also resolves). A name we
 * cannot map keeps its words with no flag; no country gives null (the row shows none).
 */
export function countryFlag(country: string | null | undefined): { flag: string | null; name: string } | null {
  const name = (country ?? "").trim();
  if (!name) return null;
  const code = /^[A-Za-z]{2}$/.test(name) ? name.toUpperCase() : countryCodeByName().get(name.toLowerCase()) ?? null;
  if (!code) return { flag: null, name };
  const flag = String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65)));
  const shown = name.length === 2 ? (regionNames()?.of(code) ?? name) : name;
  return { flag, name: shown };
}

let byName: Map<string, string> | null = null;
function regionNames(): Intl.DisplayNames | null {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return null;
  }
}
/**
 * English region name to ISO code: the curated phone-picker list first (current codes
 * only), then every other two-letter code the runtime names (Bermuda, British Virgin
 * Islands), then Apollo spellings neither knows. First writer wins, so a retired code
 * the runtime still names (DD "Germany", UK "United Kingdom") never takes a live name.
 */
function countryCodeByName(): Map<string, string> {
  if (byName) return byName;
  const map = new Map<string, string>();
  for (const c of COUNTRIES) map.set(c.name.toLowerCase(), c.code);
  const names = regionNames();
  if (names) {
    for (let a = 65; a <= 90; a++) {
      for (let b = 65; b <= 90; b++) {
        const code = String.fromCharCode(a, b);
        const n = names.of(code)?.toLowerCase();
        if (n && n !== code.toLowerCase() && !map.has(n)) map.set(n, code);
      }
    }
  }
  byName = map;
  for (const [n, code] of [
    ["hong kong", "HK"],
    ["macau", "MO"],
    ["czech republic", "CZ"],
    ["turkey", "TR"],
    ["ivory coast", "CI"],
    ["north macedonia", "MK"],
    ["russia", "RU"],
    ["vietnam", "VN"],
    ["south korea", "KR"],
    ["taiwan", "TW"],
    ["palestine", "PS"],
    ["the netherlands", "NL"],
    ["uk", "GB"],
    ["usa", "US"],
  ] as const) {
    if (!map.has(n)) map.set(n, code);
  }
  return map;
}
