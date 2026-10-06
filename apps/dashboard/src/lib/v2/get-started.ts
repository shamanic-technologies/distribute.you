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
 * audience) whose proposals are prepared in the background; then what a client is worth
 * and the offer's sales path, as the dashboard's Sales path page builds it (owner
 * 2026-10-06): its steps, the legs between them, the channels, the paths ticked, then the
 * campaigns those paths use with a budget each; then the six offer points and what is
 * given away; then the audience's companies with one person each, and the first emails,
 * written only once the questions are answered, since they are written from the answers.
 */
import { COUNTRIES } from "../../components/onboarding/phone-countries";
import { stepPlural } from "./crews";

export const GET_STARTED_STEPS = [
  { key: "company", label: "Read your company" },
  { key: "competitors", label: "Find your competitors" },
  { key: "offer", label: "Pick your offer" },
  { key: "audience", label: "Pick who to write to" },
  { key: "value", label: "What a client is worth" },
  { key: "salesSteps", label: "Your sales steps" },
  { key: "legs", label: "How leads move" },
  { key: "channels", label: "Your channels" },
  { key: "paths", label: "Your sales paths" },
  { key: "campaigns", label: "Your campaigns" },
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

/** A campaign the sales paths use, as the campaigns step reads it off features-service. */
export interface PlanSource {
  featureSlug: string;
  legKey: string;
  /** Out of a step a lead reached (its budget is a max), not run by the daily budget. */
  reactive: boolean;
  /** We run this channel today. */
  managed: boolean | undefined;
  roi: number | null;
}

/** One campaign as the visitor sets it at the campaigns step; the launch starts the ones on. */
export interface PlannedCampaign {
  featureSlug: string;
  legKey: string;
  reactive: boolean;
  on: boolean;
  /** Whole dollars a day: the budget of a proactive one, the max of a reactive one. */
  budgetUsd: number;
}

/** The identity billing and campaign-service share for one campaign of an offer. */
export function plannedKey(c: { featureSlug: string; legKey: string }): string {
  return `${c.featureSlug}:${c.legKey}`;
}

/**
 * The campaigns step as it opens (owner 2026-10-06, the dashboard's Campaigns rules): the
 * proactive campaign with the best return is on (one proactive at a time, the others off),
 * every reactive one is on (it only spends when leads reach its step). A proactive budget
 * starts on the recommended one, a reactive max on its channel's floor; neither is under
 * the floor. What the visitor already set survives a re-read. A channel we do not run is
 * left out: nothing of it can start.
 */
export function campaignPlan(
  served: readonly PlanSource[],
  floorUsd: (featureSlug: string) => number,
  recommendedUsd: number | null,
  previous: readonly PlannedCampaign[] = [],
): PlannedCampaign[] {
  const held = new Map(previous.map((c) => [plannedKey(c), c]));
  const roi = (c: PlanSource) => (c.roi == null || !Number.isFinite(c.roi) ? -Infinity : c.roi);
  const runnable = served.filter((c) => c.managed !== false);
  const best = runnable.filter((c) => !c.reactive).sort((a, b) => roi(b) - roi(a))[0] ?? null;
  const keptProactiveOn = runnable.some((c) => !c.reactive && held.get(plannedKey(c))?.on);
  const out = runnable.map((c) => {
    const kept = held.get(plannedKey(c));
    if (kept) return { ...kept, reactive: c.reactive };
    const floor = floorUsd(c.featureSlug);
    return {
      featureSlug: c.featureSlug,
      legKey: c.legKey,
      reactive: c.reactive,
      on: c.reactive ? true : !keptProactiveOn && c === best,
      budgetUsd: c.reactive ? floor : Math.max(recommendedUsd ?? floor, floor),
    };
  });
  return out.sort((a, b) => Number(a.reactive) - Number(b.reactive));
}

/** Turn one campaign on or off. A proactive one turned on takes the place of the one that was on. */
export function setPlannedOn(plan: readonly PlannedCampaign[], key: string, on: boolean): PlannedCampaign[] {
  const target = plan.find((c) => plannedKey(c) === key);
  if (!target) return [...plan];
  return plan.map((c) => {
    if (plannedKey(c) === key) return { ...c, on };
    if (on && !target.reactive && !c.reactive) return { ...c, on: false };
    return c;
  });
}

/** A typed campaign budget: whole dollars a day, at least the channel's floor. */
export function parseCampaignBudget(input: string, floorUsd: number): { usd: number } | { problem: string } {
  const t = input.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+$/.test(t) || Number(t) < 1) return { problem: "Whole dollars a day." };
  const n = Number(t);
  if (n < floorUsd) return { problem: `At least $${Math.ceil(floorUsd)} a day.` };
  return { usd: n };
}

/** Why the campaigns cannot start yet, or null: one proactive campaign on, every budget at its floor. */
export function campaignPlanProblem(plan: readonly PlannedCampaign[], floorUsd: (featureSlug: string) => number): string | null {
  if (!plan.some((c) => c.on && !c.reactive)) return "Turn on one campaign that finds new leads.";
  const low = plan.find((c) => c.on && c.budgetUsd < floorUsd(c.featureSlug));
  if (low) return `A budget is under its minimum of $${Math.ceil(floorUsd(low.featureSlug))} a day.`;
  return null;
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

/** Emails written before the account exists: the first row's is written ahead, the rest on click, one per preview company. */
export const PREWRITTEN_EMAILS = 1;
export const EMAIL_CAP = 5;

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

// ── The snapshot that survives the Google sign-up redirect, a reload, a new tab ──

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
  /** An email written during the preview, so the wall still shows it after the Google round trip. */
  email: GetStartedEmail | null;
  /** The steps and legs ticked for the offer (saved on it); null until ticked. Absent on an older snapshot. */
  salesPath?: { steps: string[]; legs: string[] } | null;
  /** The channels ticked for the offer (saved on it); null until ticked. */
  channels?: string[] | null;
  /** The paths ticked (features-service combinationKeys, saved on the offer); null until ticked. */
  selectedPaths?: string[] | null;
  /** The ranked paths were seen and the ticked ones saved. */
  pathsDone?: boolean;
  /** The campaigns as set at the campaigns step; null until set. */
  campaigns?: PlannedCampaign[] | null;
  /** The campaigns step was confirmed. */
  campaignsDone?: boolean;
  /** What one client is worth, whole dollars; null until answered. */
  lifetimeRevenueUsd?: number | null;
  /** Whether the offer points and the give lists were answered (and saved on the offer). */
  answered?: boolean;
  /** Who the brand sells to (the ICP text the audiences were split from); the launch builds every audience from it. Absent on an older snapshot. */
  icp?: string | null;
  /** When it was last written (ms); a reload resumes only a snapshot younger than the anonymous session. */
  savedAt?: number;
}

/** The anonymous session lives 24 h; a walk older than this cannot be resumed (its calls would be refused). */
export const GET_STARTED_RESUME_MAX_AGE_MS = 23 * 60 * 60 * 1000;

/** A plain reload or a new tab resumes the walk only while its anonymous session is alive. */
export function snapshotResumable(s: GetStartedSnapshot, now: number, maxAgeMs: number = GET_STARTED_RESUME_MAX_AGE_MS): boolean {
  return typeof s.savedAt === "number" && now - s.savedAt <= maxAgeMs;
}

/**
 * The same walk run from the dashboard ("Add a brand", "New brand", "Finish setup") keeps
 * its snapshot PER ORG: the brand lives in that org, so nothing ties it to a session's
 * life, and two orgs never share one. Kept 30 days, like any unfinished brand.
 */
export const GET_STARTED_ORG_RESUME_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function getStartedOrgSnapshotKey(orgId: string): string {
  return `distribute:get-started:org:v1:${orgId}`;
}

/** Where a resumed walk lands: the first step not done (the last one when every step is). */
export function firstOpenStepIndex(phases: readonly StepPhase[]): number {
  const i = phases.findIndex((p) => p !== "done");
  return i < 0 ? phases.length - 1 : i;
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
    email: parseSnapshotEmail(s.email),
    salesPath: parseSalesPath(s.salesPath),
    channels: Array.isArray(s.channels) ? s.channels.filter((c): c is string => typeof c === "string" && c.length > 0) : null,
    selectedPaths: Array.isArray(s.selectedPaths) ? s.selectedPaths.filter((c): c is string => typeof c === "string" && c.length > 0) : null,
    pathsDone: s.pathsDone === true,
    campaigns: parsePlannedCampaigns(s.campaigns),
    campaignsDone: s.campaignsDone === true,
    lifetimeRevenueUsd:
      typeof s.lifetimeRevenueUsd === "number" && Number.isInteger(s.lifetimeRevenueUsd) && s.lifetimeRevenueUsd > 0 ? s.lifetimeRevenueUsd : null,
    answered: s.answered === true,
    icp: typeof s.icp === "string" && s.icp.trim() ? s.icp : null,
    savedAt: typeof s.savedAt === "number" ? s.savedAt : undefined,
  };
}

function parsePlannedCampaigns(v: unknown): PlannedCampaign[] | null {
  if (!Array.isArray(v)) return null;
  const out: PlannedCampaign[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const c = x as Record<string, unknown>;
    if (typeof c.featureSlug !== "string" || typeof c.legKey !== "string") continue;
    if (typeof c.budgetUsd !== "number" || !Number.isInteger(c.budgetUsd) || c.budgetUsd < 1) continue;
    out.push({ featureSlug: c.featureSlug, legKey: c.legKey, reactive: c.reactive === true, on: c.on === true, budgetUsd: c.budgetUsd });
  }
  return out.length > 0 ? out : null;
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

/**
 * The offer (owner 2026-10-06): prepaid credit, no free trial, and we match the first $100
 * a new org pays, with no end date. The $30 an org holds at creation is an ADVANCE on what
 * it prepays (it runs the setup steps), never a gift: no copy calls it free.
 */
export const MATCH_USD = 100;

/** The served figures of the proactive campaign the visitor turned on, for the wall. */
export interface CampaignOutlook {
  /** The step the campaign reaches, in the plural ("Positive replies"). */
  outcome: string;
  /** Whole outcomes the credit buys (features-service `outcomesForCredit.outcomes`); null = not priced. */
  outcomes: number | null;
  /** The campaign's expected ROI (features-service), the figure the campaigns step shows. */
  roi: number | null;
}

type OutlookStep = { key: string; label: string };
type OutlookLeg = { legKey: string; toStep: OutlookStep };
type OutlookCampaign = {
  channelSlug: string;
  legKey: string;
  roi: number | null;
  outcomesForCredit?: { creditUsd: number; combinationKey: string | null; outcomes: number | null } | undefined;
};

/**
 * The wall's figures come from the campaign the visitor chose at the campaigns step
 * (owner 2026-10-06: "take the campaigns they chose"), never the fleet median: the
 * proactive one that is on, its served ROI and the served count of its outcome the
 * credit buys (features-service works it out; nothing is divided here). The outcome's
 * name is its leg's step on the path that count was read on. Null when no proactive
 * campaign is on or the producer serves nothing for it.
 */
export function chosenCampaignOutlook(
  plan: ReadonlyArray<{ featureSlug: string; legKey: string; reactive: boolean; on: boolean }>,
  campaigns: readonly OutlookCampaign[],
  paths: ReadonlyArray<{ combinationKey: string; legs: readonly OutlookLeg[] }>,
  creditUsd: number = MATCH_USD,
): CampaignOutlook | null {
  const chosen = plan.find((c) => c.on && !c.reactive);
  if (!chosen) return null;
  const served = campaigns.find((c) => c.channelSlug === chosen.featureSlug && c.legKey === chosen.legKey);
  if (!served) {
    console.error("[get-started] the chosen campaign is not served", chosen);
    return null;
  }
  const bought = served.outcomesForCredit ?? null;
  if (bought && bought.creditUsd !== creditUsd) {
    console.error("[get-started] outcomes served for another credit", { served: bought.creditUsd, creditUsd });
  }
  const forCredit = bought && bought.creditUsd === creditUsd ? bought : null;
  const legOf = (key: string | null | undefined) =>
    paths.find((p) => p.combinationKey === key)?.legs.find((l) => l.legKey === chosen.legKey) ?? null;
  const leg = legOf(forCredit?.combinationKey) ?? paths.map((p) => p.legs.find((l) => l.legKey === chosen.legKey) ?? null).find((l) => l) ?? null;
  if (!leg) {
    console.error("[get-started] the chosen campaign is on no served path", chosen);
    return null;
  }
  return {
    outcome: stepPlural(leg.toStep.key, leg.toStep.label),
    outcomes: forCredit?.outcomes != null && forCredit.outcomes >= 1 ? forCredit.outcomes : null,
    roi: served.roi,
  };
}

/** The words of the wall. */
export interface WallCopy {
  /** The match, in dollars (what the left panel counts). */
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

export function wallCopy(): WallCopy {
  const m = MATCH_USD;
  return {
    creditUsd: m,
    creditLine: "matched on your first payment",
    bannerTitle: "matched on your first payment",
    bannerCta: `Get my $${m} match`,
    timerLabel: `Time left to claim your $${m} match`,
    timerExtendedLabel: `We're giving you more time to claim your $${m}`,
    formTitle: `Claim your $${m} match`,
    formSub: "One minute. You add credit at the end.",
    emailCta: "Continue with Email",
    codeCta: "Continue",
    cardTitle: "Add credit",
    cardNote: `Your campaigns spend this credit. We match your first $${m}.`,
    cardCta: "Add credit and launch",
  };
}

/** The billing account fields the match line reads (billing-service's own figures). */
export interface MatchFigures {
  free_credit_offer?: string;
  free_credit_entitlement_cents?: number;
  free_credit_received_cents?: string;
  free_credit_pending_cents?: string;
  free_credit_remaining_to_pay_cents?: string;
}

const wholeUsd = (cents: string | number | undefined): number | null => {
  const n = Number(cents);
  return cents === undefined || !Number.isFinite(n) ? null : Math.floor(n / 100);
};

/**
 * The match in plain words. Never splits it into what the org already holds: the $30 at
 * creation is an advance it pays back, not part of the match (owner 2026-10-06). Said
 * while billing still owes it (or before the account exists); an org created before the
 * offer, or already matched, reads nothing.
 */
export function matchNote(account: MatchFigures | null | undefined): string {
  const offer = `We match your first $${MATCH_USD}.`;
  if (!account) return offer;
  if (account.free_credit_offer !== "match_100") return "";
  const pending = wholeUsd(account.free_credit_pending_cents);
  if (pending === null) {
    console.error("[get-started] match_100 account served without its pending figure", account);
    return offer;
  }
  return pending > 0 ? offer : "";
}

/** billing's refusal of a top-up or reload under its minimum, in words. */
export function topupRefusal(code: string | undefined): string | null {
  if (code === "topup_below_minimum") return `Credit starts at $${MIN_TOPUP_USD}.`;
  if (code === "topup_threshold_below_minimum") return `A reload starts under $${MIN_RELOAD_THRESHOLD_USD} at the lowest.`;
  return null;
}

/** The first credit a new org adds, and the amounts an automatic reload adds (owner 2026-10-06). */
export const TOPUP_CHOICES_USD = [100, 250, 500, 1000] as const;
export const RELOAD_CHOICES_USD = [100, 250, 500] as const;
/** No credit added under $100 (billing refuses it too). */
export const MIN_TOPUP_USD = 100;
/** An automatic reload fires when the credit falls under this, never under $5. */
export const MIN_RELOAD_THRESHOLD_USD = 5;
export const DEFAULT_RELOAD_THRESHOLD_USD = 10;

/** A typed credit amount: whole dollars, at least $100. */
export function parseTopupUsd(input: string): { usd: number } | { problem: string } {
  const t = input.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+$/.test(t)) return { problem: "Whole dollars." };
  const n = Number(t);
  if (n < MIN_TOPUP_USD) return { problem: `At least $${MIN_TOPUP_USD}.` };
  return { usd: n };
}

/** A typed reload threshold: whole dollars, at least $5. */
export function parseReloadThresholdUsd(input: string): { usd: number } | { problem: string } {
  const t = input.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+$/.test(t)) return { problem: "Whole dollars." };
  const n = Number(t);
  if (n < MIN_RELOAD_THRESHOLD_USD) return { problem: `At least $${MIN_RELOAD_THRESHOLD_USD}.` };
  return { usd: n };
}

/** The next slide of a carousel, wrapping. */
export function nextSlide(i: number, count: number): number {
  return count > 0 ? (i + 1) % count : 0;
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
  "channels",
  "paths",
  "campaigns",
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
