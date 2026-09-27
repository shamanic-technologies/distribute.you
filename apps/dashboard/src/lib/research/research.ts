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
export type ResearchTopic = "llm" | "cost" | "followups" | "opens" | "template";
export type ResearchGoal = "roi" | "rate";

export interface ResearchPoint {
  label: string;
  value: number;
  display: string;
  /** The counts behind the value, printed beside it so a reader can weigh it. */
  note: string;
  /** Too few emails or outcomes to read as a rate: drawn, and marked. */
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
  floors: { minEmails: number; crown: { minEmails: number; minClicks: number; minReplies: number } };
  crews: { id: ResearchCrew; outcome: string; description: string }[];
  studies: ResearchStudy[];
}

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
};

export function studiesFor(crew: ResearchCrew): ResearchStudy[] {
  return RESEARCH.studies.filter((s) => s.crew === crew);
}

export function studyById(id: string): ResearchStudy | null {
  return RESEARCH.studies.find((s) => s.id === id) ?? null;
}

/** A study's standing as one word: a called winner, a leader on thin counts, or no data. */
export type StudyState = "winner" | "thin" | "no-data";
export function studyState(study: ResearchStudy): StudyState {
  if (study.status !== "measured") return "no-data";
  return study.crowned && study.winner ? "winner" : "thin";
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
