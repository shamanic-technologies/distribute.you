/**
 * ONE ROW PER WORKFLOW ON ONE LEG, as the live ranking tables draw it: the price per outcome,
 * whether it is mature, its return, its conversion, its outcomes and its spend, plus which row
 * goes first and which one the money goes to.
 *
 * Two sources, one shape, so the two tables cannot read a workflow two ways:
 *
 *  - `fleetWorkflowRows` — Research. The fleet ranking (features-service
 *    `/public/stats/leg-workflow-ranking`) names no org, brand, offer, campaign or audience,
 *    so nothing Research states depends on who is looking. The ORDER and both flags are the
 *    producer's (the best mature workflow holds the money; learning ones cheaper than it sit
 *    above it). Nothing is re-ranked here.
 *  - `campaignWorkflowRows` — the brand's Workflows page. One campaign's own figures: the
 *    CAMPAIGN grain of the per-brand ladder, never a coarser grain wearing its name, and the
 *    realized return of the campaign's own per-workflow group. "Goes first" is the producer's
 *    rank 1 for the campaign, mature or not; "Money goes here" is the producer's
 *    `recommendedWorkflowDynastySlug`, read, never re-derived. Electing "the first mature row in
 *    rank order" here put the money on Dawn ($4.73/visit) while the producer recommended and ran
 *    Osprey ($2.26/visit): the rank had tied on the offer and fallen back to the slug (prod
 *    2026-10-01, brand c4b5284d).
 *
 * A cost per outcome is observed: null at zero outcomes, never a spend floor. Alias-free (types
 * only) so it carries real unit tests.
 */

import type { CostToShow, RoiToShow } from "./expected-return";

/**
 * A workflow's distinctive name: its channel's name dropped from the front ("Sales Cold Email
 * Outreach Maelstrom" under "Sales Cold Email Outreach" reads "Maelstrom"). A name that does not
 * start with it, or that would be left empty, is returned unchanged.
 */
export function shortWorkflowName(name: string, channelName: string | null | undefined): string {
  const prefix = channelName?.trim();
  if (!prefix) return name;
  if (name.toLowerCase().startsWith(prefix.toLowerCase())) {
    const rest = name.slice(prefix.length).replace(/^[\s·:-]+/, "").trim();
    if (rest) return rest;
  }
  return name;
}

export interface LiveWorkflowRow {
  slug: string;
  name: string | null;
  /** The workflow's served mark (MARKS-1022), fleet ranking only; absent elsewhere. */
  icon?: string | null;
  color?: string | null;
  rank: number | null;
  costPerOutcomeUsd: number | null;
  roiMultiple: number | null;
  conversionRatePct: number | null;
  outcomes: number | null;
  spentUsd: number | null;
  /**
   * Whether the WORKFLOW is proven on the leg (mature) or still learning — the producer's verdict,
   * stated on every row, including a workflow this campaign has not run yet.
   */
  mature: boolean | null;
  /** FALSE when this scope has no evidence for the workflow at all. */
  ran: boolean;
  /** `active` / `deprecated` / `unassigned`, or null when not stated. */
  assignment: string | null;
  selectable: boolean;
  first: boolean;
  cash: boolean;
  /**
   * Why the producer's order puts the row there (fleet ranking only, null elsewhere):
   * `explore` | `money` | `mature` | `proven_worse` | `cannot_run`.
   */
  place: string | null;
  /** The price the order compared for a learning row (spend so far over its outcomes, $0 never run). */
  explorePriceUsd: number | null;
  /** FALSE when workflow-service runs no version of it (every version retired). */
  executable: boolean | null;
}

/** One served fleet ranking row (features-service `LegWorkflowRankingRow`). */
export interface FleetRankingRow {
  rank: number;
  workflowDynastySlug: string;
  workflowDynastyName: string | null;
  assignment: string;
  selectable: boolean;
  isMature: boolean | null;
  costPerOutcomeUsd: number | null;
  conversionRatePct: number | null;
  outcomes: number;
  spentUsd: number;
  roiMultiple: number | null;
  goesFirst: boolean;
  moneyGoesHere: boolean;
  executable?: boolean;
  place?: string | null;
  explorePriceUsd?: number | null;
  figures: WorkflowFigures;
  lastRunAt?: string | null;
  lastRunUnavailableReason?: string | null;
  tactics?: readonly FollowedTactic[] | null;
  tacticsUnavailableReason?: string | null;
  icon?: string | null;
  color?: string | null;
}

/** One served figure (features-service `figures.*`): measured, else the pipe's expected one, else why neither. */
export interface ServedFigure {
  value: number | null;
  basis: "measured" | "expected" | null;
  expectedValue: number | null;
  unavailableReason: string | null;
}

/** A ranking row's `figures`, on the read's pricing (net): the ONE set the list, drawer and page print. */
export interface WorkflowFigures {
  roi: ServedFigure;
  costPerOutcomeUsd: ServedFigure;
  conversionRatePct: ServedFigure;
  spentUsd: { value: number | null; unavailableReason: string | null };
  outcomes: number;
}

/** A tactic a workflow follows, as features-service names it. */
export interface FollowedTactic {
  id: string;
  name: string;
}

/** A Research row: the shared row plus what only the fleet ranking serves. */
export interface ResearchWorkflowRow extends LiveWorkflowRow {
  figures: WorkflowFigures;
  lastRunAt: string | null;
  lastRunUnavailableReason: string | null;
  /** Null with `tacticsUnavailableReason`. */
  tactics: readonly FollowedTactic[] | null;
  tacticsUnavailableReason: string | null;
}

/** Research: the fleet ranking, verbatim, in the producer's order. */
export function fleetWorkflowRows(rows: readonly FleetRankingRow[]): ResearchWorkflowRow[] {
  return [...rows]
    .sort((a, b) => a.rank - b.rank)
    .map((r) => ({
      slug: r.workflowDynastySlug,
      name: r.workflowDynastyName,
      icon: r.icon ?? null,
      color: r.color ?? null,
      rank: r.rank,
      costPerOutcomeUsd: r.costPerOutcomeUsd,
      roiMultiple: r.roiMultiple,
      conversionRatePct: r.conversionRatePct,
      outcomes: r.outcomes,
      spentUsd: r.spentUsd,
      mature: r.isMature,
      ran: r.spentUsd > 0,
      assignment: r.assignment,
      selectable: r.selectable,
      first: r.goesFirst,
      cash: r.moneyGoesHere,
      place: r.place ?? null,
      explorePriceUsd: r.explorePriceUsd ?? null,
      executable: r.executable ?? null,
      figures: r.figures,
      lastRunAt: r.lastRunAt ?? null,
      lastRunUnavailableReason: r.lastRunUnavailableReason ?? null,
      tactics: r.tactics ?? null,
      tacticsUnavailableReason: r.tacticsUnavailableReason ?? null,
    }));
}

/**
 * Research's table order (owner 2026-10-23: « mets par ROI desc »): the ROI each row PRINTS (served
 * `figures.roi.value`, measured or expected), highest first; a row with none last; ties keep the
 * producer's order. Sorts served values, computes nothing.
 */
export function byServedRoiDesc<T extends { figures: WorkflowFigures }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const x = a.figures.roi.value;
    const y = b.figures.roi.value;
    if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;
    return y - x;
  });
}

/** The ROI a Research row prints: the served figure, marked expected when it is the pipe's, never computed here. */
export function servedRoi(f: ServedFigure): RoiToShow {
  return { value: f.value, expected: f.value != null && f.basis === "expected", reason: f.value == null ? f.unavailableReason : null };
}

/** The cost per outcome a Research row prints, in cents, read like `servedRoi`. */
export function servedCost(f: ServedFigure): CostToShow {
  return { cents: f.value == null ? null : Math.round(f.value * 100), expected: f.value != null && f.basis === "expected", learning: false, expectedCents: null };
}

/**
 * "Last run" as a short relative time (owner 2026-10-22): "Just now", "3m ago", "2h ago", "5d ago",
 * "4mo ago"; "Never" when the producer states it never ran; null when the producer could not read it.
 */
export function lastRunText(row: Pick<ResearchWorkflowRow, "lastRunAt" | "lastRunUnavailableReason">, now: Date = new Date()): string | null {
  if (row.lastRunAt == null) return row.lastRunUnavailableReason == null ? "Never" : null;
  const ms = Math.max(0, now.getTime() - new Date(row.lastRunAt).getTime());
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 60) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/** The slice of a per-brand ladder row a campaign's table reads. */
export interface CampaignLadderRow {
  audienceId: string | null;
  workflow: { workflowDynastySlug: string; workflowDynastyName?: string | null };
  estimatesByGrain: Partial<
    Record<
      string,
      | {
          isMature?: boolean | null;
          flash?: HalfFigures | null;
          mature?: HalfFigures | null;
        }
      | undefined
    >
  >;
  rank?: number | null;
  legAssignment?: { state: string; selectable: boolean } | undefined;
  /** The WORKFLOW's verdict on the fleet of its leg (the ladder's row `maturity.isMature`). */
  maturity?: { isMature: boolean | null } | undefined;
}

interface HalfFigures {
  spentUsd: number | null;
  contacted: number;
  outcomes: number;
  costPerOutcomeUsd: number | null;
  conversionRatePct: number | null;
}

/**
 * The brand's Workflows page, one campaign: every ladder row the caller passes, in the producer's
 * rank for this campaign.
 *
 * `roiBySlug` is the campaign's realized return per workflow (its own grouped revenue read).
 * `recommendedSlug` is the producer's pick for the campaign: the row the money goes to.
 */
export function campaignWorkflowRows(input: {
  ladderRows: readonly CampaignLadderRow[];
  roiBySlug: ReadonlyMap<string, number | null>;
  recommendedSlug: string | null;
}): LiveWorkflowRow[] {
  const out: LiveWorkflowRow[] = [];
  for (const r of input.ladderRows) {
    if (r.audienceId !== null) continue;
    // Which workflows are shown is the CALLER's call (`hiddenWorkflowSlugs` hides an unassigned
    // one only when this campaign never ran it). Dropping every unassigned row here lost the
    // workflow a campaign actually runs when the owner has not assigned it on the leg yet.
    const block = r.estimatesByGrain.campaign;
    const mature = block?.isMature ?? null;
    const half = (mature === true ? block?.mature : block?.flash) ?? null;
    const slug = r.workflow.workflowDynastySlug;
    out.push({
      slug,
      name: r.workflow.workflowDynastyName ?? null,
      rank: r.rank ?? null,
      costPerOutcomeUsd: half?.costPerOutcomeUsd ?? null,
      roiMultiple: input.roiBySlug.get(slug) ?? null,
      conversionRatePct: half?.conversionRatePct ?? null,
      outcomes: half ? half.outcomes : null,
      spentUsd: half?.spentUsd ?? null,
      mature: r.maturity?.isMature ?? null,
      ran: Boolean(block),
      assignment: r.legAssignment?.state ?? null,
      selectable: r.legAssignment ? r.legAssignment.selectable : true,
      first: false,
      cash: false,
      place: null,
      explorePriceUsd: null,
      executable: null,
    });
  }
  const ordered = out
    .map((row, i) => ({ row, i }))
    .sort((a, b) => {
      const ra = a.row.rank;
      const rb = b.row.rank;
      if (ra == null && rb == null) return a.i - b.i;
      if (ra == null) return 1;
      if (rb == null) return -1;
      return ra - rb;
    })
    .map((x) => x.row);
  const first = ordered.find((r) => r.selectable && r.rank != null);
  if (first) first.first = true;
  const cash = ordered.find((r) => r.selectable && r.slug === input.recommendedSlug);
  if (cash) cash.cash = true;
  return ordered;
}

/** The words for WHY a fleet row stands where it does: a display lookup on the producer's `place`. */
export type PlaceTone = "explore" | "money" | "mature" | "worse" | "off";

export function placeWords(row: Pick<LiveWorkflowRow, "place" | "executable" | "assignment">): { label: string; tone: PlaceTone } | null {
  switch (row.place) {
    case "explore":
      return { label: "Explored first", tone: "explore" };
    case "money":
      return { label: "Best mature", tone: "money" };
    case "mature":
      return { label: "Mature, pricier", tone: "mature" };
    case "proven_worse":
      return { label: "Proven pricier", tone: "worse" };
    case "cannot_run":
      return { label: cannotRunReason(row), tone: "off" };
    default:
      return null;
  }
}

/** Why a row can never be put forward, from the producer's flags. */
export function cannotRunReason(row: Pick<LiveWorkflowRow, "executable" | "assignment">): string {
  if (row.executable === false) return "Retired: no version runs";
  if (row.assignment === "deprecated") return "Deprecated on this leg";
  if (row.assignment === "unassigned") return "Not on this leg";
  return "Cannot run";
}

/**
 * How many tags (widths in order) fit on one line of `room` px, keeping `moreW` for "+N more"
 * whenever some are left out. Never below 1: a lone tag truncates rather than vanish.
 */
export function tagsThatFit(widths: readonly number[], room: number, moreW: number, gap: number): number {
  const total = widths.reduce((sum, w, i) => sum + w + (i ? gap : 0), 0);
  if (total <= room) return widths.length;
  let used = 0;
  let k = 0;
  for (let i = 0; i < widths.length; i++) {
    used += (i ? gap : 0) + widths[i];
    if (used + gap + moreW > room) break;
    k = i + 1;
  }
  return Math.max(1, k);
}
