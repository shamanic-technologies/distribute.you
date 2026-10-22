/**
 * Our research, as the staff Research page (dashboard v2) renders it.
 *
 * Every study, catalogue page and template text is served LIVE by features-service
 * (`GET /internal/research[/catalog|/templates]`, LIVE-RESEARCH-1018; rebuilt every 15 min), read
 * through the staff route `/api/research/{basis}/{part}` and `research-source.tsx`. No snapshot is
 * kept in this repo. Every study is fleet-wide (all orgs). Nothing here divides or ranks: every
 * value, label and sentence arrives written, and this module only types and looks it up.
 *
 * Alias-free so it carries real unit tests.
 */
import { OUTBOUND_LEG_TO_CONVERSATION, OUTBOUND_LEG_TO_WEBSITE_VISIT } from "../outbound-leg-key";

/** A PIPE is one leg x one channel: the channel doing the work, the leg (from step -> to step) it buys. */
export type ResearchPipe = "cold-email-positive-reply" | "cold-email-website-visit" | "meeting-booking";
/**
 * An OUTCOME row: one outcome asked across every pipe that lands on it (owner 2026-10-18: what one
 * costs and what share of leads reach it, overall then per pipe, channel, leg, workflow, lead
 * strategy and tactic). Its id is the step's served label in words joined by dashes
 * (`positive-reply`, `meeting-booked`); the list comes from the data, so a step a pipe's data
 * measures later arrives by itself. `judgment` (Jev) is no outcome: it sits under Other.
 */
export type ResearchOutcome = string;
export type ResearchTopic =
  | "llm"
  | "cost"
  | "followups"
  | "opens"
  | "template"
  | "workflow"
  | "naming"
  | "layout"
  | "opening"
  | "dash"
  | "weekday"
  | "hour"
  | "judgment"
  | "launch"
  | "strategy"
  | "sourcing-strategy"
  | "conversion"
  | "pipe"
  | "channel"
  | "leg"
  | "tactic"
  | "delay"
  | "niche"
  | "country";
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
  /** On a `months` chart: the average from the first month to each month, written by features-service. */
  cumulative?: { title: string; points: ResearchPoint[] };
  /** The grey methodology line under the chart: which emails were too young to count. */
  note?: string;
  /**
   * On a delay histogram (`delay` topic): the cumulative curve over the same buckets, same order and
   * keys, each value the % arrived by the bucket's END, the last one 100 ("Any time"). Served by
   * features-service off lead-service's distribution (TTFPR-RESEARCH-STUDY-1021).
   */
  curve?: { title: string; points: ResearchPoint[] };
}

/** One tile of a delay study: a percentile or the average, written (`display` "5.2 days"). */
export interface ResearchDelayStat {
  key: string;
  label: string;
  ms: number | null;
  display: string;
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
  /** What the winner cell is called when the study ranks nothing (a cost split: "Largest share"). */
  winnerLabel?: string;
  /** True only when the verdict is a conclusion. */
  crowned: boolean;
  /**
   * What the data can carry (verdict.mjs, owner 2026-10-02): a conclusion (holds after the
   * multiple-comparison correction AND on the same clients in the same months), a signal (to
   * confirm) or noise. Optional: a study without one states no verdict.
   */
  verdict?: { kind: "conclusion" | "signal" | "noise"; reason: string };
  /** The figure the card leads with, its unit in words, and the counts behind it. */
  result: { display: string; unit: string; sample: string } | null;
  charts: ResearchChart[];
  conclusion: string[];
  /** On a `delay` study: the sample and the tiles (p10, p25, median, p75, p90, average), in the served order. */
  delay?: { sampleSize: number; stats: ResearchDelayStat[] };
}

export interface ResearchFile {
  generatedAt: string;
  /** When features-service last built the studies. */
  computedAt?: string | null;
  allOrgs: true;
  /**
   * `user`: what clients were billed. `actual`: what the vendors charged us
   * before our markup (staff only).
   */
  costBasis?: "user" | "actual";
  /** Actual basis only: billed spend no vendor cost is on record for, left out of every figure. */
  unpricedBilledUsd?: number;
  /** Actual basis only: emails left out because their workflow version's spend is unpriced. */
  unpricedEmails?: number;
  window: { from: string; to: string };
  /** The day the data was read out of production. */
  readOn: string;
  /** Not served by features-service yet: the hub states `—` until it is. */
  volume?: {
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
    /** Emails from runs too recent to count yet (not served by features-service yet). */
    excludedEmails?: number;
    /** Emails no record ties to a serving run: in the cohort, as features-service counts them (not served yet). */
    noRunStart?: number;
    note: string;
  };
  pipes: { id: ResearchPipe; channel: string; leg: string; outcome: string; description: string }[];
  /**
   * The outcome rows, in the order the data lands on them, then the sections with no step (Jev):
   * `step` is the outcome's step key (null: no outcome, the Other group), `pipes` the pipes that land
   * on it, `population` who the figures rest on.
   */
  outcomes?: ResearchOutcomeEntry[];
  studies: ResearchStudy[];
  /** How many workflows, templates and models each pipe's pages list: the length of the live catalogue, stated by the staff route. */
  catalogCounts: Record<ResearchPipe, { workflows: number; templates: number; models: number }>;
}

export interface ResearchOutcomeEntry {
  id: ResearchOutcome;
  outcome: string;
  /** The step the outcome is (features-service's key), or null for a section that is no outcome (Jev). */
  step?: string | null;
  /** The pipes that land on it. */
  pipes?: ResearchPipe[];
  description: string;
  population: string;
}

/** The figures a workflow or a template is listed with, fleet-wide, all written by features-service. */
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
  /**
   * Its return as printed (`"3.20x"`), written by features-service (TPL-DYNASTY-ROWS-1021-FS, on templates
   * and versions); its detail (basis, multiple) rides `roiDetail`. v0.179.328 served the OBJECT here for a
   * few minutes before its hotfix moved it to `roiDetail`: read both through `researchRoiOf`. Absent = no tile.
   */
  roi?: string | ResearchRoi | null;
  roiDetail?: ResearchRoi | null;
}

/** A served return (features-service `CatalogRoi`). */
export interface ResearchRoi {
  /** The multiple: 3.2 = $3.20 of pipeline per $1 billed. */
  value: number | null;
  display: string | null;
  basis: "measured" | "expected" | null;
  source: string | null;
  spendCovered: number | null;
  unavailableReason: string | null;
}

/**
 * A row's served return, ready to print: `show` (the `RoiValue` input) when the detail is served,
 * else `text` (the printed string alone), else null (no tile).
 */
export function researchRoiOf(f: Pick<ResearchFigures, "roi" | "roiDetail">): { show: { value: number | null; expected: boolean; reason: string | null } } | { text: string } | null {
  const d = f.roiDetail ?? (f.roi != null && typeof f.roi === "object" ? f.roi : null);
  if (d) return { show: { value: d.value, expected: d.value != null && d.basis === "expected", reason: d.value == null ? d.unavailableReason : null } };
  return typeof f.roi === "string" ? { text: f.roi } : null;
}

/** A reference to another catalogue page; `linked` when that page exists in this pipe. */
export interface ResearchRef {
  key: string;
  label: string;
  linked: boolean;
  /**
   * On a TEMPLATE ref (TPL-DYNASTY-1021): `key`/`label` name the template DYNASTY's page, and
   * `version` the one version the ref means, when it means one. Absent on a catalogue built before it.
   */
  version?: { key: string; label: string } | null;
}

export interface ResearchWorkflow extends ResearchFigures {
  key: string;
  label: string;
  /** The workflow's own mark (MARKS-1022): a Phosphor name and `#RRGGBB`. Absent on an older catalogue. */
  icon?: string | null;
  color?: string | null;
  /** The workflow's own name as workflow-service states it (Maelstrom, ...); null when it states none. */
  name: string | null;
  model: ResearchRef | null;
  /** `linked`: the template has its own page in this pipe. */
  template: ResearchRef | null;
  /**
   * What the workflow's runnable version writes with NOW (features-service RESEARCH-PAGES-ALL-1018),
   * each with its own page even before it sent anything. Absent on a catalogue built before it.
   */
  writesWithNow?: { version: string; template: ResearchRef | null; model: ResearchRef | null; modelAlias: string | null } | null;
  /**
   * What the row's FIGURES were written with (RESEARCH-DEPRECATED-LLM-TEMPLATE-1019, features-service v0.179.302):
   * set on deprecated workflows too, where `writesWithNow` is null. Absent on a catalogue built before it.
   */
  wroteWith?: { model: ResearchRef | null; template: ResearchRef | null; version: string | null; modelAlias: string | null } | null;
  runs: { when: string; version: string; status: string; duration: string | null; cost: string | null }[];
}

/**
 * A template DYNASTY as content-generation-service names it (TPL-DYNASTY-1021, features-service #1893):
 * every version of one template idea under one name, its customer one-liner, and the version that
 * writes now (`head`).
 */
export interface ResearchTemplateDynasty {
  slug: string;
  name: string;
  /** What the dynasty does, in one customer line. */
  description: string;
  signature?: string | null;
  /** Whether its emails name the client ("named") or keep it private ("blind"). */
  identity: "blind" | "named" | string;
  head: { key: string; label: string } | null;
}

/** Why a template version is listed on its own, outside any dynasty. */
export type TemplateStandaloneReason = "no_dynasty_on_pipe" | "template_dynasties_unreadable";

/** One version of a dynasty, with its own figures (they add up to the dynasty's page exactly). */
export interface ResearchTemplateVersion extends ResearchFigures {
  key: string;
  label: string;
  head: boolean;
  hasText: boolean;
  /** content-generation-service's status of this version (only the head is Active); absent on an older catalogue. */
  status?: "active" | "deprecated" | null;
}

/**
 * A Templates row. Since TPL-DYNASTY-1021 a row is a template DYNASTY (`key` = its slug, `label` =
 * its name, figures pooled over every version), or a version on its own (`dynasty` null and
 * `standaloneReason` set). The dynasty fields are absent on a catalogue built before it.
 */
export interface ResearchTemplate extends ResearchFigures {
  key: string;
  label: string;
  /** The template dynasty's own mark (MARKS-1022): a Phosphor name and `#RRGGBB`. Absent on an older catalogue. */
  icon?: string | null;
  color?: string | null;
  hasText: boolean;
  dynasty?: ResearchTemplateDynasty | null;
  standaloneReason?: TemplateStandaloneReason | null;
  /** The DYNASTY's status (features-service, off content generation); null with `statusUnavailableReason`. */
  status?: "active" | "deprecated" | null;
  statusSource?: string | null;
  statusUnavailableReason?: string | null;
  /** Every version, oldest first, as features-service serves them. */
  versions?: ResearchTemplateVersion[];
  workflows: { key: string; label: string }[];
  runs: {
    when: string;
    model: ResearchRef | null;
    workflow: { key: string; label: string } | null;
    version: string | null;
    tokens: string | null;
    /** The template version the sequence was written with. */
    templateVersion?: string | null;
  }[];
}

/**
 * An LLM DYNASTY as chat-service names it (LLM-DYNASTY-1022-FS, features-service #1944): every version
 * of one model line under one name (« Gemini Flash »), its slug the word a workflow calls, which runs
 * the head (`headModelId`).
 */
export interface ResearchLlmDynasty {
  slug: string;
  name: string;
  provider: string;
  capabilityTier: string;
  headModelId: string;
  /** The slug answers chat-service today. */
  servedToday: boolean;
  /** Names workflows wrote before dynasties; each runs the head. */
  legacyAliases: string[];
}

/** Why a model page is one model on its own, outside any dynasty. */
export type ModelStandaloneReason = "no_dynasty_in_chat_service" | "llm_dynasties_unreadable";

/** One version of an LLM dynasty, with its own share of the page's figures (they add up to it). */
export interface ResearchModelVersion extends ResearchFigures {
  key: string;
  label: string;
  modelIds: string[];
  /** The version the dynasty's slug runs now. */
  head: boolean;
  /** chat-service still serves it today (false = retired). */
  servedToday: boolean;
}

/**
 * A Models row. Since LLM-DYNASTY-1022-FS a row is an LLM DYNASTY (`key` = its slug, `label` = its
 * name, figures pooled over every version), or a model on its own (`dynasty` null, `standaloneReason`
 * set). The dynasty fields are absent on a catalogue built before it.
 */
export interface ResearchModel extends ResearchFigures {
  key: string;
  label: string;
  dynasty?: ResearchLlmDynasty | null;
  standaloneReason?: ModelStandaloneReason | null;
  /** Every version, newest first, as features-service serves them; on a model on its own, that model. */
  models?: ResearchModelVersion[];
  /**
   * Every alias chat-service serves this model under NOW, sorted (features-service v0.179.305, read
   * off chat-service's own alias list): the keys its staff status is set on. Empty when none does,
   * `aliasesUnavailableReason` saying why. Absent on a catalogue built before it.
   */
  aliases?: string[];
  modelIds?: string[];
  formerAliases?: string[];
  aliasesUnavailableReason?: ModelAliasGap | null;
  workflows: { key: string; label: string }[];
  runs: { when: string; workflow: { key: string; label: string } | null; template: ResearchRef | null; version: string | null; tokens: string | null }[];
}

/** Why a model has no alias now: chat-service unreadable, unknown to it, or retired (no alias resolves to it). */
export type ModelAliasGap = "model_ids_unreadable" | "model_not_in_chat_service" | "no_alias_serves_it";

export type ResearchCatalog = Record<
  ResearchPipe,
  { workflows: ResearchWorkflow[]; templates: ResearchTemplate[]; models: ResearchModel[] }
>;
export type CatalogKind = "workflows" | "templates" | "models";
export const CATALOG_KINDS: CatalogKind[] = ["workflows", "templates", "models"];


export const PIPE_ORDER: ResearchPipe[] = ["cold-email-positive-reply", "cold-email-website-visit", "meeting-booking"];
/** The order the Outcomes group lists its rows in (display only: the list itself is the file's). */
export const OUTCOME_ORDER: ResearchOutcome[] = ["positive-reply", "website-visit", "meeting-booked"];

/** Each pipe's channel, the leg it buys (features-service's key) and the step that leg lands on. */
export const PIPE_KEY: Record<ResearchPipe, { channel: string; leg: string; step: string }> = {
  "cold-email-positive-reply": { channel: "sales-cold-email-outreach", leg: OUTBOUND_LEG_TO_CONVERSATION, step: "conversation" },
  "cold-email-website-visit": { channel: "sales-cold-email-outreach", leg: OUTBOUND_LEG_TO_WEBSITE_VISIT, step: "website_visit" },
  "meeting-booking": { channel: "ai-meeting-booking", leg: "conversation_to_meeting_booked", step: "meeting_booked" },
};

/**
 * The hub's two lower groups (owner 2026-10-18): Outcomes, every entry that IS a step, in
 * OUTCOME_ORDER then any other the data brings; Other, the entries with no step (Jev).
 */
export function outcomeGroups(file: ResearchFile): { outcomes: ResearchOutcomeEntry[]; other: ResearchOutcomeEntry[] } {
  const all = file.outcomes ?? [];
  const rank = (o: ResearchOutcomeEntry) => {
    const i = OUTCOME_ORDER.indexOf(o.id);
    return i === -1 ? OUTCOME_ORDER.length : i;
  };
  const outcomes = all.filter((o) => o.step).map((o, i) => ({ o, i })).sort((a, b) => rank(a.o) - rank(b.o) || a.i - b.i).map((x) => x.o);
  return { outcomes, other: all.filter((o) => !o.step) };
}

/** An outcome entry by id. */
export function outcomeEntry(id: ResearchOutcome | undefined, file: ResearchFile): ResearchOutcomeEntry | null {
  return file.outcomes?.find((o) => o.id === id) ?? null;
}

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
  conversion: "Conversion over time",
  pipe: "Pipe",
  channel: "Channel",
  leg: "Leg",
  tactic: "Tactic",
  delay: "Time to reply",
  niche: "B2B niche",
  country: "Country",
};

/** A topic's label; a topic this build does not know yet reads "Study", never a crash. */
export function topicLabel(topic: ResearchTopic): string {
  return TOPIC_LABEL[topic] ?? "Study";
}

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
  /** One version of a template dynasty: `templates/<dynasty>/<version>`. */
  | { view: "version"; pipe: ResearchPipe; kind: "templates"; key: string; version: string }
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
  if (!isResearchPipe(pipe) || !(CATALOG_KINDS as string[]).includes(kind)) return { view: "missing" };
  if (kind === "templates" && key && extra.length === 1) return { view: "version", pipe, kind, key, version: extra[0] };
  if (extra.length) return { view: "missing" };
  const k = kind as CatalogKind;
  return key ? { view: "item", pipe, kind: k, key } : { view: "list", pipe, kind: k };
}

export function researchCatalogHref(base: string, pipe: ResearchPipe, kind: CatalogKind, key?: string): string {
  return `${base}/${pipe}/${kind}${key ? `/${encodeURIComponent(key)}` : ""}`;
}

/** A template version's own page: under its dynasty's (`templates/<dynasty>/<version>`). */
export function researchTemplateVersionHref(base: string, pipe: ResearchPipe, dynastyKey: string, versionKey: string): string {
  return `${researchCatalogHref(base, pipe, "templates", dynastyKey)}/${encodeURIComponent(versionKey)}`;
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
/**
 * The Templates row a template KEY belongs to: the row itself, else the dynasty that lists it as a
 * version (a workflow names the version it writes with; its page is the dynasty's).
 */
export function researchTemplateOf(c: ResearchCatalog, pipe: ResearchPipe, key: string): ResearchTemplate | null {
  const rows = c[pipe].templates;
  return rows.find((t) => t.key === key) ?? rows.find((t) => (t.versions ?? []).some((v) => v.key === key)) ?? null;
}
/** The key the content-generation status and outputs of a row are read on: its head version's, else its own. */
export function templateContentKey(t: Pick<ResearchTemplate, "key" | "dynasty">): string {
  return t.dynasty?.head?.key ?? t.key;
}
/** One version of a Templates row by its key, or null when the row lists no such version. */
export function researchTemplateVersion(t: Pick<ResearchTemplate, "versions">, versionKey: string): ResearchTemplateVersion | null {
  return (t.versions ?? []).find((v) => v.key === versionKey) ?? null;
}

/** The two tabs of the Templates list (owner 2026-10-21). */
export type TemplateTab = "active" | "deprecated";
/** The tab a `?status=` value opens: Active unless it names Deprecated. */
export function templateTab(param: string | null | undefined): TemplateTab {
  return param === "deprecated" ? "deprecated" : "active";
}

/** content-generation's template statuses as the list holds them: answered once, keyed by template version. */
export interface TemplateStatusRead {
  answered: boolean;
  map: ReadonlyMap<string, string>;
}

/**
 * A Templates row's status (owner 2026-10-21): Active iff its HEAD version is Active, Deprecated
 * otherwise; a version on its own reads its own key. Null until the statuses answer, so no row lands
 * in a tab it will leave. The ONE place this is decided: a producer-served dynasty status replaces
 * this body, not its callers.
 */
export function templateRowStatus(row: Pick<ResearchTemplate, "key" | "dynasty" | "status">, statuses: TemplateStatusRead): TemplateTab | null {
  // The dynasty's own status, served by features-service off content generation (TPL-DYNASTY-ROWS-1021-FS),
  // wins; a row served without one (a version on its own, a catalogue built before it) reads its head's status.
  if (row.status === "active" || row.status === "deprecated") return row.status;
  if (!statuses.answered) return null;
  return statuses.map.get(templateContentKey(row)) === "active" ? "active" : "deprecated";
}

/** A served dollar string (`"$9.50"`, `"$1,234"`) as its number, for ordering only; null when none is served. */
function servedUsd(v: string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * The Templates table's order (owner 2026-10-23): every row with an outcome first, the cheapest served
 * cost per outcome first; then the rest by served $ spent, most first. Only reorders served figures;
 * a tie keeps the served order.
 */
export function templatesInTableOrder<T extends Pick<ResearchFigures, "cost" | "spend">>(rows: readonly T[]): T[] {
  const priced = rows.filter((r) => servedUsd(r.cost) != null);
  const rest = rows.filter((r) => servedUsd(r.cost) == null);
  priced.sort((a, b) => servedUsd(a.cost)! - servedUsd(b.cost)!);
  rest.sort((a, b) => (servedUsd(b.spend) ?? -1) - (servedUsd(a.spend) ?? -1));
  return [...priced, ...rest];
}

/** The rows of each tab, in the served order, or null while the statuses have not answered. */
export function templatesByTab<T extends Pick<ResearchTemplate, "key" | "dynasty" | "status">>(rows: readonly T[], statuses: TemplateStatusRead): Record<TemplateTab, T[]> | null {
  if (!statuses.answered) return null;
  const out: Record<TemplateTab, T[]> = { active: [], deprecated: [] };
  for (const r of rows) out[templateRowStatus(r, statuses) ?? "deprecated"].push(r);
  return out;
}

/**
 * The models a Templates row wrote with, first seen first: each workflow's model (the catalogue's
 * workflow rows, matched by key), then the models its last runs name. A display join of served
 * refs; nothing counted or ranked.
 */
export function templateModels(c: ResearchCatalog | null, pipe: ResearchPipe, t: Pick<ResearchTemplate, "workflows" | "runs">): ResearchRef[] {
  const seen = new Map<string, ResearchRef>();
  const add = (r: ResearchRef | null | undefined) => {
    if (r && !seen.has(r.key)) seen.set(r.key, r);
  };
  for (const w of t.workflows) add(c ? researchWorkflow(c, pipe, w.key)?.model : null);
  for (const r of t.runs) add(r.model);
  return [...seen.values()];
}

/**
 * The version an LLM dynasty runs now, as its row names it (« 3.8 Flash » under « Gemini Flash »):
 * the served head version's label, the dynasty's own words dropped from its front. Null on a model on
 * its own or a catalogue built before dynasties.
 */
export function modelHeadLabel(m: Pick<ResearchModel, "dynasty" | "models">): string | null {
  if (!m.dynasty) return null;
  const head = (m.models ?? []).find((v) => v.head);
  if (!head) return null;
  const vendor = m.dynasty.name.split(" ")[0];
  return head.label.startsWith(`${vendor} `) ? head.label.slice(vendor.length + 1) : head.label;
}

export function researchModel(c: ResearchCatalog, pipe: ResearchPipe, key: string): ResearchModel | null {
  return c[pipe].models.find((m) => m.key === key) ?? null;
}

/** The research pipe a campaign is (its channel and the step its leg lands on), if any. */
export function researchPipeFor(channel: string | null | undefined, step: string | null | undefined): ResearchPipe | null {
  if (!channel || !step) return null;
  return PIPE_ORDER.find((p) => PIPE_KEY[p].channel === channel && PIPE_KEY[p].step === step) ?? null;
}
