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
 * Alias-free so it carries real unit tests.
 */
import data from "./research.json";

export type ResearchCrew = "herald" | "scout" | "pilot";
export type ResearchTopic = "llm" | "cost" | "followups" | "opens" | "template" | "workflow" | "naming" | "layout" | "opening";
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
  crew: ResearchCrew;
  topic: ResearchTopic;
  goal: ResearchGoal;
  question: string;
  status: "measured" | "not_enough_data";
  /** The key result, in one line. */
  headline: string;
  /** The label of the winning bar, when there is one. */
  winner: string | null;
  /** False when the leader sits on counts too thin to call a winner. */
  crowned: boolean;
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
   * before our markup (staff only, served by /api/research/actual, never bundled). Absent on a
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
  crews: { id: ResearchCrew; outcome: string; description: string }[];
  studies: ResearchStudy[];
  /** How many workflows and templates each crew's pages list (the pages read the catalogue). */
  catalogCounts: Record<ResearchCrew, { workflows: number; templates: number; models: number }>;
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

/** A reference to another catalogue page; `linked` when that page exists in this crew. */
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
  /** `linked`: the template has its own page in this crew. */
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
  ResearchCrew,
  { workflows: ResearchWorkflow[]; templates: ResearchTemplate[]; models: ResearchModel[] }
>;
export type CatalogKind = "workflows" | "templates" | "models";
export const CATALOG_KINDS: CatalogKind[] = ["workflows", "templates", "models"];

export const RESEARCH = data as ResearchFile;

export const CREW_ORDER: ResearchCrew[] = ["herald", "scout", "pilot"];

/** The crew each study belongs to, as `lib/v2/crews` keys it (channel slug + landing step). */
export const CREW_KEY: Record<ResearchCrew, { channel: string; step: string }> = {
  herald: { channel: "sales-cold-email-outreach", step: "conversation" },
  scout: { channel: "sales-cold-email-outreach", step: "website_visit" },
  pilot: { channel: "ai-meeting-booking", step: "meeting_booked" },
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
};

export function studiesFor(crew: ResearchCrew, file: ResearchFile = RESEARCH): ResearchStudy[] {
  return file.studies.filter((s) => s.crew === crew);
}

export function studyById(id: string, file: ResearchFile = RESEARCH): ResearchStudy | null {
  return file.studies.find((s) => s.id === id) ?? null;
}

/** A study's standing as one word: a called winner, a leader on thin counts, or no data. */
export type StudyState = "winner" | "thin" | "no-data";
export function studyState(study: ResearchStudy): StudyState {
  if (study.status !== "measured") return "no-data";
  return study.winner ? "winner" : "thin";
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

export function isResearchCrew(v: string): v is ResearchCrew {
  return (CREW_ORDER as string[]).includes(v);
}

/** What a path under `/research` shows. Study ids carry no slash, so they never collide. */
export type ResearchView =
  | { view: "hub" }
  | { view: "study"; id: string }
  | { view: "list"; crew: ResearchCrew; kind: CatalogKind }
  | { view: "item"; crew: ResearchCrew; kind: CatalogKind; key: string }
  | { view: "missing" };
export function parseResearchPath(rest: string): ResearchView {
  const parts = rest.split("/").filter(Boolean).map((p) => decodeURIComponent(p));
  if (parts.length === 0) return { view: "hub" };
  if (parts.length === 1) return { view: "study", id: parts[0] };
  const [crew, kind, key, ...extra] = parts;
  if (!isResearchCrew(crew) || !(CATALOG_KINDS as string[]).includes(kind) || extra.length) return { view: "missing" };
  const k = kind as CatalogKind;
  return key ? { view: "item", crew, kind: k, key } : { view: "list", crew, kind: k };
}

export function researchCatalogHref(base: string, crew: ResearchCrew, kind: CatalogKind, key?: string): string {
  return `${base}/${crew}/${kind}${key ? `/${encodeURIComponent(key)}` : ""}`;
}

/** The page a study's bar opens: its workflow's or template's own, when the bar names one. */
export function pointHref(base: string, study: ResearchStudy, point: ResearchPoint): string | null {
  if (!point.key) return null;
  if (study.topic === "workflow") return researchCatalogHref(base, study.crew, "workflows", point.key);
  if (study.topic === "template") return researchCatalogHref(base, study.crew, "templates", point.key);
  if (study.topic === "llm") return researchCatalogHref(base, study.crew, "models", point.key);
  return null;
}

// The catalogue and the template texts are side files, loaded once right after the page paints,
// so the hub does not carry them and a click on a workflow or template finds them in memory.
let catalog: ResearchCatalog | null = null;
let catalogLoad: Promise<ResearchCatalog> | null = null;
let texts: Record<string, string> | null = null;
let textsLoad: Promise<Record<string, string>> | null = null;

export function peekResearchCatalog(): ResearchCatalog | null {
  return catalog;
}
export function loadResearchCatalog(): Promise<ResearchCatalog> {
  catalogLoad ??= import("./research-catalog.json").then((m) => {
    catalog = (m.default ?? m) as unknown as ResearchCatalog;
    return catalog;
  });
  return catalogLoad;
}
export function peekTemplateTexts(): Record<string, string> | null {
  return texts;
}
export function loadTemplateTexts(): Promise<Record<string, string>> {
  textsLoad ??= import("./research-templates.json").then((m) => {
    texts = (m.default ?? m) as unknown as Record<string, string>;
    return texts;
  });
  return textsLoad;
}
/** Starts both loads; the Research page calls it once it has painted. */
export function preloadResearchCatalog(): void {
  void loadResearchCatalog();
  void loadTemplateTexts();
}

export function researchWorkflow(c: ResearchCatalog, crew: ResearchCrew, key: string): ResearchWorkflow | null {
  return c[crew].workflows.find((w) => w.key === key) ?? null;
}
export function researchTemplate(c: ResearchCatalog, crew: ResearchCrew, key: string): ResearchTemplate | null {
  return c[crew].templates.find((t) => t.key === key) ?? null;
}
export function researchModel(c: ResearchCatalog, crew: ResearchCrew, key: string): ResearchModel | null {
  return c[crew].models.find((m) => m.key === key) ?? null;
}

/** The research crew a mission's crew is (its channel and the step its leg lands on), if any. */
export function researchCrewFor(channel: string | null | undefined, step: string | null | undefined): ResearchCrew | null {
  if (!channel || !step) return null;
  return CREW_ORDER.find((c) => CREW_KEY[c].channel === channel && CREW_KEY[c].step === step) ?? null;
}
