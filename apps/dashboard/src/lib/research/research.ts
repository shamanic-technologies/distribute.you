/**
 * Our research, as the staff Research page (dashboard v2) renders it.
 *
 * `research.json` is WRITTEN by `apps/landing/scripts/blog-data/research.mjs` from the same fact
 * table the data blog articles are derived from, so a study and an article can never state two
 * figures for one population. Every study is fleet-wide (all orgs). Nothing here divides or ranks:
 * every value, label and sentence arrives written, and this module only types and looks it up.
 *
 * Refresh: re-run the four commands in `apps/landing/scripts/blog-data/README.md` (Research).
 *
 * The JSON files are served ONLY by the staff route `/api/research/{basis}/{part}` and read through
 * `research-source.tsx`; this module never imports them, so no browser bundle carries a figure.
 *
 * Alias-free so it carries real unit tests.
 */
import { LEAD_FOUND_STEP, OUTBOUND_LEG_TO_CONVERSATION, OUTBOUND_LEG_TO_WEBSITE_VISIT } from "../outbound-leg-key";

/** A PIPE is one leg x one channel: the channel doing the work, the leg (from step -> to step) it buys. */
export type ResearchPipe = "cold-email-positive-reply" | "cold-email-website-visit" | "meeting-booking";
/**
 * An OUTCOME section: a question asked of one outcome across every leg that leads to it (what a
 * booked meeting costs from the first cold email on), where a pipe section is one leg x one channel.
 */
export type ResearchOutcome = "meeting" | "judgment";
export type ResearchTopic = "llm" | "cost" | "followups" | "opens" | "template" | "workflow" | "naming" | "layout" | "opening" | "dash" | "weekday" | "hour" | "judgment" | "launch" | "strategy" | "sourcing-strategy";
export type ResearchGoal = "roi" | "rate";

export interface ResearchPoint {
  /** On a workflow or template study's bars: which one the bar is, so the row opens its page. */
  key?: string;
  label: string;
  value: number;
  display: string;
  /** The counts behind the value, printed beside it so a reader can weigh it. */
  note: string;
  /** LEARNING under features-service's per-leg rule: fewer outcomes than the leg requires.
   *  Drawn at its rank, and marked. (The field keeps its historical name.) */
  thin: boolean;
  /** On a month chart: the month the maturity cutoff falls inside, so only part of its people
   *  count yet and the figure will move. Drawn dotted. */
  partial?: boolean;
}

export interface ResearchChart {
  /** `bars` compares buckets; `months` is one month per bar with the average since inception beside it. */
  kind: "bars" | "months";
  title: string;
  lowerIsBetter: boolean;
  points: ResearchPoint[];
  /** On a `months` chart: the average from the first month to each month, written by research.mjs. */
  cumulative?: { title: string; points: ResearchPoint[] };
  /** The grey methodology line under the chart: which emails were too young to count. */
  note?: string;
}

export interface ResearchStudy {
  id: string;
  /** The pipe section the study sits in; null on an outcome study, which names its `outcome`. */
  pipe: ResearchPipe | null;
  /** Set exactly when `pipe` is null: the outcome section the study sits in. */
  outcome?: ResearchOutcome;
  topic: ResearchTopic;
  goal: ResearchGoal;
  question: string;
  status: "measured" | "not_enough_data";
  /** The key result, in one line. */
  headline: string;
  /** The label of the winning bar, when there is one. */
  winner: string | null;
  /** True only when the verdict is a conclusion. */
  crowned: boolean;
  /**
   * What the data can carry (verdict.mjs, owner 2026-10-02): a conclusion (holds after the
   * multiple-comparison correction AND on the same clients in the same months), a signal (to
   * confirm) or noise. Optional on a snapshot written before verdicts existed.
   */
  verdict?: { kind: "conclusion" | "signal" | "noise"; reason: string };
  /** The figure the card leads with, its unit in words, and the counts behind it. */
  result: { display: string; unit: string; sample: string } | null;
  charts: ResearchChart[];
  conclusion: string[];
}

export interface ResearchFile {
  generatedAt: string;
  allOrgs: true;
  /**
   * `user`: what clients were billed (this bundled file). `actual`: what the vendors charged us
   * before our markup (staff only, served by /api/research/actual/file, never bundled). Absent on a
   * snapshot written before the two bases existed, which is the billed one.
   */
  costBasis?: "user" | "actual";
  /** Actual basis only: billed spend no vendor cost is on record for, left out of every figure. */
  unpricedBilledUsd?: number;
  /** Actual basis only: emails left out because their workflow version's spend is unpriced. */
  unpricedEmails?: number;
  window: { from: string; to: string };
  /** The day the data was read out of production. */
  readOn: string;
  volume: {
    emails: number;
    orgs: number;
    workflows: number;
    linkedEmails: number;
    byMonth: { label: string; emails: number }[];
  };
  /**
   * features-service's MATURITY RULE, per leg (features-service#1196), the one every price in the
   * dashboard is on, read off its channel catalogue and never measured here: only the leads whose
   * serving run STARTED at least `durationDays` before the read (before `cutoff`) count, with every
   * outcome they produced since, and a figure resting on fewer than `outcomesRequired` outcomes is
   * Learning.
   */
  maturation: {
    rule: "run_start";
    /** The longest duration of the two legs, in days. */
    days: number;
    /** The earliest cutoff of the two legs: runs started on or after it wait. */
    cutoff: string;
    windowEnd: string;
    legs: Record<"reply" | "visit", { durationDays: number; outcomesRequired: number; cutoff: string }>;
    /** Emails from runs too recent to count yet. */
    excludedEmails: number;
    /** Emails no record ties to a serving run: in the cohort, as features-service counts them. */
    noRunStart: number;
    note: string;
  };
  pipes: { id: ResearchPipe; channel: string; leg: string; outcome: string; description: string }[];
  /**
   * The outcome sections, each measured across every leg: `population` says which brands the
   * figures rest on. Absent on a snapshot written before outcome sections existed.
   */
  outcomes?: { id: ResearchOutcome; outcome: string; description: string; population: string }[];
  studies: ResearchStudy[];
  /** How many workflows and templates each pipe's pages list (the pages read the catalogue). */
  catalogCounts: Record<ResearchPipe, { workflows: number; templates: number; models: number }>;
}

/** The figures a workflow or a template is listed with, fleet-wide, all written by research.mjs. */
export interface ResearchFigures {
  /** Its place in the ROI order (the study's own), or null when it has no priced outcome yet. */
  rank: number | null;
  emails: string;
  emailsNoun: string;
  outcomes: string;
  spend: string;
  cost: string | null;
  rate: string | null;
  thin: boolean;
  sample: string;
  charts: ResearchChart[];
}

/** A reference to another catalogue page; `linked` when that page exists in this pipe. */
export interface ResearchRef {
  key: string;
  label: string;
  linked: boolean;
}

export interface ResearchWorkflow extends ResearchFigures {
  key: string;
  label: string;
  /** The workflow's own name as workflow-service states it (Maelstrom, ...); null when it states none. */
  name: string | null;
  model: ResearchRef | null;
  /** `linked`: the template has its own page in this pipe. */
  template: ResearchRef | null;
  runs: { when: string; version: string; status: string; duration: string | null; cost: string | null }[];
}

export interface ResearchTemplate extends ResearchFigures {
  key: string;
  label: string;
  hasText: boolean;
  workflows: { key: string; label: string }[];
  runs: { when: string; model: ResearchRef | null; workflow: { key: string; label: string } | null; version: string | null; tokens: string | null }[];
}

export interface ResearchModel extends ResearchFigures {
  key: string;
  label: string;
  workflows: { key: string; label: string }[];
  runs: { when: string; workflow: { key: string; label: string } | null; template: ResearchRef | null; version: string | null; tokens: string | null }[];
}

export type ResearchCatalog = Record<
  ResearchPipe,
  { workflows: ResearchWorkflow[]; templates: ResearchTemplate[]; models: ResearchModel[] }
>;
export type CatalogKind = "workflows" | "templates" | "models";
export const CATALOG_KINDS: CatalogKind[] = ["workflows", "templates", "models"];


export const PIPE_ORDER: ResearchPipe[] = ["cold-email-positive-reply", "cold-email-website-visit", "meeting-booking"];
export const OUTCOME_ORDER: ResearchOutcome[] = ["meeting", "judgment"];

/** Each pipe's channel, the leg it buys (features-service's key) and the step that leg lands on. */
export const PIPE_KEY: Record<ResearchPipe, { channel: string; leg: string; step: string }> = {
  "cold-email-positive-reply": { channel: "sales-cold-email-outreach", leg: OUTBOUND_LEG_TO_CONVERSATION, step: "conversation" },
  "cold-email-website-visit": { channel: "sales-cold-email-outreach", leg: OUTBOUND_LEG_TO_WEBSITE_VISIT, step: "website_visit" },
  "meeting-booking": { channel: "ai-meeting-booking", leg: "conversation_to_meeting_booked", step: "meeting_booked" },
};

/**
 * The sales path an outcome section reads as (its steps in order; the leg catalogue labels them),
 * or null for a section no path reaches: Jev is a judgment the pipes ask, not an outcome.
 */
export const OUTCOME_PATH: Record<ResearchOutcome, string[] | null> = {
  meeting: [LEAD_FOUND_STEP, "conversation", "meeting_booked"],
  judgment: null,
};

export const GOAL_LABEL: Record<ResearchGoal, string> = { roi: "ROI", rate: "Rate" };

export const TOPIC_LABEL: Record<ResearchTopic, string> = {
  llm: "LLM",
  cost: "Cost over time",
  followups: "Follow-ups",
  opens: "Open tracking",
  template: "Template",
  workflow: "Workflow",
  naming: "Naming the client",
  layout: "Email layout",
  opening: "Email opening",
  dash: "Dashes",
  weekday: "Day of the week",
  hour: "Hour of the day",
  judgment: "Typed judgment",
  launch: "Before and after go-live",
  strategy: "Lead strategy",
  "sourcing-strategy": "Sourcing strategy",
};

export function studiesFor(pipe: ResearchPipe, file: ResearchFile): ResearchStudy[] {
  return file.studies.filter((s) => s.pipe === pipe);
}

export function studiesForOutcome(outcome: ResearchOutcome, file: ResearchFile): ResearchStudy[] {
  return file.studies.filter((s) => s.pipe === null && s.outcome === outcome);
}

/** The outcome a study measures, in plain words, read off its section's entry in the file. */
export function studyOutcomeText(study: ResearchStudy, file: ResearchFile): string | null {
  if (study.pipe) return file.pipes.find((p) => p.id === study.pipe)?.outcome ?? null;
  return file.outcomes?.find((o) => o.id === study.outcome)?.outcome ?? null;
}

export function studyById(id: string, file: ResearchFile): ResearchStudy | null {
  return file.studies.find((s) => s.id === id) ?? null;
}

/** A study's standing as one word: its verdict, or no data. */
export type StudyState = "conclusion" | "signal" | "noise" | "no-data";
export function studyState(study: ResearchStudy): StudyState {
  if (study.status !== "measured") return "no-data";
  return study.verdict?.kind ?? "noise";
}

/**
 * The series a card draws small: the winner's average since inception when there is one (it
 * ends on the card's own Result), else the first chart's bars.
 */
export function studySpark(study: ResearchStudy): { kind: "line" | "bars"; points: ResearchPoint[] } | null {
  const months = study.charts.find((c) => c.kind === "months" && c.cumulative?.points.length);
  if (months?.cumulative) return { kind: "line", points: months.cumulative.points };
  const first = study.charts[0];
  return first ? { kind: "bars", points: first.points } : null;
}

export function isResearchPipe(v: string): v is ResearchPipe {
  return (PIPE_ORDER as string[]).includes(v);
}

// Retired section names still live in old links (sent reports, social-service records): each maps to its pipe, never shown.
const LEGACY_SECTION: Record<string, ResearchPipe> = { herald: "cold-email-positive-reply", scout: "cold-email-website-visit", pilot: "meeting-booking" };

/** An old link's path rewritten onto its pipe, or null when it names no retired section. */
function legacyPath(parts: string[]): string | null {
  const [first, ...rest] = parts;
  const enc = (segs: string[]) => segs.map((p) => encodeURIComponent(p)).join("/");
  if (rest.length > 0) return Object.hasOwn(LEGACY_SECTION, first) ? enc([LEGACY_SECTION[first], ...rest]) : null;
  const dash = first.indexOf("-");
  const head = dash > 0 ? first.slice(0, dash) : "";
  return head && Object.hasOwn(LEGACY_SECTION, head) ? enc([`${LEGACY_SECTION[head]}${first.slice(dash)}`]) : null;
}

/** What a path under `/research` shows. Study ids carry no slash, so they never collide. */
export type ResearchView =
  | { view: "hub" }
  | { view: "study"; id: string }
  | { view: "list"; pipe: ResearchPipe; kind: CatalogKind }
  | { view: "item"; pipe: ResearchPipe; kind: CatalogKind; key: string }
  /** An old link: `to` is the same page's path under `/research` today, for a client replace. */
  | { view: "redirect"; to: string }
  | { view: "missing" };
export function parseResearchPath(rest: string): ResearchView {
  const parts = rest.split("/").filter(Boolean).map((p) => decodeURIComponent(p));
  if (parts.length === 0) return { view: "hub" };
  const legacy = legacyPath(parts);
  if (legacy !== null) return { view: "redirect", to: legacy };
  if (parts.length === 1) return { view: "study", id: parts[0] };
  const [pipe, kind, key, ...extra] = parts;
  if (!isResearchPipe(pipe) || !(CATALOG_KINDS as string[]).includes(kind) || extra.length) return { view: "missing" };
  const k = kind as CatalogKind;
  return key ? { view: "item", pipe, kind: k, key } : { view: "list", pipe, kind: k };
}

export function researchCatalogHref(base: string, pipe: ResearchPipe, kind: CatalogKind, key?: string): string {
  return `${base}/${pipe}/${kind}${key ? `/${encodeURIComponent(key)}` : ""}`;
}

/** The page a study's bar opens: its workflow's or template's own, when the bar names one. */
export function pointHref(base: string, study: ResearchStudy, point: ResearchPoint): string | null {
  if (!point.key || !study.pipe) return null;
  if (study.topic === "workflow") return researchCatalogHref(base, study.pipe, "workflows", point.key);
  if (study.topic === "template") return researchCatalogHref(base, study.pipe, "templates", point.key);
  if (study.topic === "llm") return researchCatalogHref(base, study.pipe, "models", point.key);
  return null;
}

export function researchWorkflow(c: ResearchCatalog, pipe: ResearchPipe, key: string): ResearchWorkflow | null {
  return c[pipe].workflows.find((w) => w.key === key) ?? null;
}
export function researchTemplate(c: ResearchCatalog, pipe: ResearchPipe, key: string): ResearchTemplate | null {
  return c[pipe].templates.find((t) => t.key === key) ?? null;
}
export function researchModel(c: ResearchCatalog, pipe: ResearchPipe, key: string): ResearchModel | null {
  return c[pipe].models.find((m) => m.key === key) ?? null;
}

/** The research pipe a campaign is (its channel and the step its leg lands on), if any. */
export function researchPipeFor(channel: string | null | undefined, step: string | null | undefined): ResearchPipe | null {
  if (!channel || !step) return null;
  return PIPE_ORDER.find((p) => PIPE_KEY[p].channel === channel && PIPE_KEY[p].step === step) ?? null;
}
