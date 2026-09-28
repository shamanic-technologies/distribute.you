/**
 * The audience table's COLUMN and SORT decisions, as data.
 *
 * Which columns a grain shows, what each one reads off the served stats row, which of
 * them state `Learning` under ten outcomes, and how rows are ordered. The v2 audience
 * table reads it; the numbers themselves are features-service's and nothing here divides
 * one served figure by another. It mirrors v1's `customer-audiences-page.tsx`, whose
 * copy stays put because a hundred source guards pin its exact spelling.
 *
 * Alias-free (type-only imports are erased at build), so it carries real unit tests.
 */

import type { AudienceWire, FeatureAudienceStatsRow } from "./api";
import { costSoFarFloorCents } from "./cost-so-far-floor";
import { isLearning } from "./learning-threshold";

export type AudienceSortCol =
  | "audience"
  | "roi"
  | "cacPct"
  | "cacUsd"
  | "invested"
  | "replies"
  | "cppr"
  | "cpc"
  | "clicks"
  | "signups"
  | "cps"
  | "formSubmissions"
  | "cpfs"
  | "sales"
  | "cpsale"
  | "outreach"
  | "remaining"
  | "size";

/** The pairs a grain decided to show. Computed by the caller from the leg and the goal. */
export interface AudienceColumnFlags {
  brandLevelMoney: boolean;
  campaignScoped: boolean;
  showSaleCols: boolean;
  showReplyCols: boolean;
  showSignupCols: boolean;
  showFormSubmissionCols: boolean;
  showVisitCols: boolean;
}

export type AudienceColumnKind = "roi" | "pct" | "usd" | "cents" | "cost" | "count" | "remaining";

export interface AudienceColumn {
  col: AudienceSortCol;
  label: string;
  kind: AudienceColumnKind;
  /** Reads the stats overlay: skeleton it while the stats read is in flight. */
  fromStats: boolean;
}

/**
 * The value columns, in the order v1 renders them: brand money, then the leg's outcome
 * pair (cost then count, except the reply pair which leads with its count), then the
 * visit pair, a campaign's own `$ Invested`, and the three pool columns.
 */
export function audienceColumns(f: AudienceColumnFlags): AudienceColumn[] {
  const cols: AudienceColumn[] = [];
  if (f.brandLevelMoney) {
    cols.push(
      { col: "roi", label: "ROI", kind: "roi", fromStats: true },
      { col: "cacPct", label: "% CAC", kind: "pct", fromStats: true },
      { col: "cacUsd", label: "$ CAC", kind: "usd", fromStats: true },
      { col: "invested", label: "$ Invested", kind: "cents", fromStats: true },
    );
  }
  if (f.showSaleCols) {
    cols.push(
      { col: "cpsale", label: "Cost per sale", kind: "cost", fromStats: true },
      { col: "sales", label: "Sales", kind: "count", fromStats: true },
    );
  }
  if (f.showReplyCols) {
    cols.push(
      { col: "replies", label: "Positive replies", kind: "count", fromStats: true },
      { col: "cppr", label: "Cost per positive reply", kind: "cost", fromStats: true },
    );
  }
  if (f.showSignupCols) {
    cols.push(
      { col: "cps", label: "Cost per signup", kind: "cost", fromStats: true },
      { col: "signups", label: "Signups", kind: "count", fromStats: true },
    );
  }
  if (f.showFormSubmissionCols) {
    cols.push(
      { col: "cpfs", label: "Cost per form submission", kind: "cost", fromStats: true },
      { col: "formSubmissions", label: "Form submissions", kind: "count", fromStats: true },
    );
  }
  if (f.showVisitCols) {
    cols.push(
      { col: "cpc", label: "Cost per website visit", kind: "cost", fromStats: true },
      { col: "clicks", label: "Website visits", kind: "count", fromStats: true },
    );
  }
  if (f.campaignScoped) cols.push({ col: "invested", label: "$ Invested", kind: "cents", fromStats: true });
  cols.push(
    { col: "outreach", label: "Outreach", kind: "count", fromStats: true },
    { col: "remaining", label: "Remaining", kind: "remaining", fromStats: false },
    { col: "size", label: "Size", kind: "count", fromStats: false },
  );
  return cols;
}

/** The outcome a per-outcome price divides by; a column absent here is never gated. */
export const AUDIENCE_COST_OUTCOME: Partial<
  Record<AudienceSortCol, (stats: FeatureAudienceStatsRow) => number | null | undefined>
> = {
  cppr: (s) => s.evidence.positiveReplies,
  cpc: (s) => s.evidence.websiteClicks,
  cps: (s) => s.evidence.signups,
  cpfs: (s) => s.evidence.formSubmissions,
  cpsale: (s) => s.evidence.sales,
};

/** Whether this row's price under this column is still learning. No stats row is not. */
export function audienceCostIsLearning(col: AudienceSortCol, stats: FeatureAudienceStatsRow | undefined): boolean {
  const read = AUDIENCE_COST_OUTCOME[col];
  if (!read || !stats) return false;
  return isLearning(read(stats));
}

const MONEY_COLS: AudienceSortCol[] = ["roi", "cacPct", "cacUsd"];
export const isMoneyCol = (col: AudienceSortCol) => MONEY_COLS.includes(col);

/** The number a column sorts on, the same field its cell renders. Null sorts last. */
export function audienceSortValue(
  col: AudienceSortCol,
  audience: AudienceWire,
  stats: FeatureAudienceStatsRow | undefined,
): string | number | null {
  switch (col) {
    case "audience":
      return (audience.name || "").toLowerCase();
    case "roi":
      return stats?.projection?.returnPerDollar ?? null;
    case "cacUsd":
      return stats?.projection?.costPerPaidClientUsd ?? null;
    case "cacPct":
      return stats?.projection?.costOfAcquisitionPct ?? null;
    case "invested":
      return stats?.evidence.totalCostInUsdCents ?? null;
    case "replies":
      return stats?.evidence.positiveReplies ?? null;
    case "cppr":
      return costSoFarFloorCents(stats?.metrics.cpprCents, stats?.evidence.totalCostInUsdCents, stats?.evidence.positiveReplies);
    case "cpc":
      return stats?.metrics.cpcCents ?? null;
    case "clicks":
      return stats?.evidence.websiteClicks ?? null;
    case "signups":
      return stats?.evidence.signups ?? null;
    case "cps":
      return stats?.metrics.cpsCents ?? null;
    case "formSubmissions":
      return stats?.evidence.formSubmissions ?? null;
    case "cpfs":
      return stats?.metrics.cpfsCents ?? null;
    case "sales":
      return stats?.evidence.sales ?? null;
    case "cpsale":
      return stats?.metrics.cpsaleCents ?? null;
    case "outreach":
      return stats?.evidence.contacted ?? null;
    case "remaining":
      return audience.availableToContactPct ?? null;
    case "size":
      return audience.sizeCount ?? null;
  }
}

/**
 * Orders the rows. A row whose price reads `Learning` has no rank under that column, so
 * it sinks below every measured one and is ordered by the outcome count it divides by,
 * descending. Nulls go last in both directions. Ties on an outcome cost break on the
 * cheapest website visit when the caller passes one.
 */
export function sortAudiences(
  rows: AudienceWire[],
  o: {
    sortCol: AudienceSortCol;
    sortDir: "asc" | "desc";
    tieBreakCol: AudienceSortCol | null;
    statsFor: (id: string) => FeatureAudienceStatsRow | undefined;
    /** At brand grain, whether the scope's campaigns have priced this audience yet. */
    moneyLearning: (id: string) => boolean;
  },
): AudienceWire[] {
  const { sortCol, sortDir, tieBreakCol, statsFor, moneyLearning } = o;
  const learningRank = (a: AudienceWire): number | null => {
    if (isMoneyCol(sortCol) && moneyLearning(a.id)) return 0;
    const stats = statsFor(a.id);
    if (!audienceCostIsLearning(sortCol, stats)) return null;
    const read = AUDIENCE_COST_OUTCOME[sortCol];
    return (stats && read ? read(stats) : null) ?? 0;
  };
  return [...rows].sort((a, b) => {
    const al = learningRank(a);
    const bl = learningRank(b);
    if (al != null || bl != null) {
      if (al != null && bl != null) return bl - al;
      return al != null ? 1 : -1;
    }
    const av = audienceSortValue(sortCol, a, statsFor(a.id));
    const bv = audienceSortValue(sortCol, b, statsFor(b.id));
    if (av != null && bv != null) {
      const cmp = typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv) : (av as number) - (bv as number);
      if (cmp !== 0) return sortDir === "asc" ? cmp : -cmp;
    } else if (av == null && bv != null) {
      return 1;
    } else if (av != null && bv == null) {
      return -1;
    }
    if (!tieBreakCol) return 0;
    const at = audienceSortValue(tieBreakCol, a, statsFor(a.id));
    const bt = audienceSortValue(tieBreakCol, b, statsFor(b.id));
    if (at == null && bt == null) return 0;
    if (at == null) return 1;
    if (bt == null) return -1;
    return (at as number) - (bt as number);
  });
}

/** Cents as adaptive dollars: cents under $10, whole dollars above. Null is `—`. */
export function formatAudienceCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  if (cents <= 0) return "$0.00";
  const usd = cents / 100;
  if (usd < 0.01) return "<$0.01";
  const decimals = usd < 10 ? 2 : 0;
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function formatAudienceUsd(usd: number | null | undefined): string {
  if (usd == null) return "—";
  const decimals = Math.abs(usd) < 10 ? 2 : 0;
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

/** The price a cost column states for one row, floored to spend so far on the reply
 *  column exactly as v1 does. */
export function audienceCostCents(col: AudienceSortCol, stats: FeatureAudienceStatsRow): number | null {
  switch (col) {
    case "cppr":
      return costSoFarFloorCents(stats.metrics.cpprCents, stats.evidence.totalCostInUsdCents, stats.evidence.positiveReplies);
    case "cpc":
      return stats.metrics.cpcCents ?? null;
    case "cps":
      return stats.metrics.cpsCents ?? null;
    case "cpfs":
      return stats.metrics.cpfsCents ?? null;
    case "cpsale":
      return stats.metrics.cpsaleCents ?? null;
    default:
      return null;
  }
}

/** The count a count column states for one row. */
export function audienceCount(col: AudienceSortCol, stats: FeatureAudienceStatsRow): number | null {
  switch (col) {
    case "replies":
      return stats.evidence.positiveReplies;
    case "clicks":
      return stats.evidence.websiteClicks;
    case "signups":
      return stats.evidence.signups ?? null;
    case "formSubmissions":
      return stats.evidence.formSubmissions ?? null;
    case "sales":
      return stats.evidence.sales ?? null;
    case "outreach":
      return stats.evidence.contacted;
    default:
      return null;
  }
}
