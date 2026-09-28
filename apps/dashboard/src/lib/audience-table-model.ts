/**
 * The audience table's COLUMN and SORT decisions, as data.
 *
 * Which columns a grain shows, what each one reads off the served stats row, which of
 * them state `Learning`, and how rows are ordered. The v2 audience table reads it; the
 * numbers themselves are features-service's and nothing here divides one served figure
 * by another, counts outcomes against a bar, or floors a missing price to spend.
 *
 * Every ratio is the half of the row's served MATURITY PAIR the reader is shown
 * (lib/maturity.ts): the mature figure for every customer, `Learning` exactly where the
 * producer says the row is not mature. The legacy `metrics.*` fields stay the producer's
 * floored RANKING figures and are never stated.
 *
 * Alias-free (type-only imports are erased at build), so it carries real unit tests.
 */

import type { AudienceCostFigures, AudienceProjectionFigures, AudienceWire, FeatureAudienceStatsRow } from "./api";
import { shownFigure, type ShownFigure, type StatBasis } from "./maturity";

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

/** The outcome count a per-outcome price divides by: orders the rows that read Learning. */
export const AUDIENCE_COST_OUTCOME: Partial<
  Record<AudienceSortCol, (stats: FeatureAudienceStatsRow) => number | null | undefined>
> = {
  cppr: (s) => s.evidence.positiveReplies,
  cpc: (s) => s.evidence.websiteClicks,
  cps: (s) => s.evidence.signups,
  cpfs: (s) => s.evidence.formSubmissions,
  cpsale: (s) => s.evidence.sales,
};

/** The served field of `metrics.maturity` each cost column states. */
const COST_FIELD: Partial<Record<AudienceSortCol, keyof AudienceCostFigures>> = {
  cppr: "cpprCents",
  cpc: "cpcCents",
  cps: "cpsCents",
  cpfs: "cpfsCents",
  cpsale: "cpsaleCents",
};

/** The served field of `projection.maturity` each brand-level money column states. */
const MONEY_FIELD: Partial<Record<AudienceSortCol, keyof AudienceProjectionFigures>> = {
  roi: "returnPerDollar",
  cacPct: "costOfAcquisitionPct",
  cacUsd: "costPerPaidClientUsd",
};

export const isMoneyCol = (col: AudienceSortCol) => MONEY_FIELD[col] !== undefined;

/**
 * What a ratio column states for one row on the reader's basis: the served figure, and
 * whether the producer says it is Learning. A column that is not a ratio, or a row with
 * no stats, states nothing and is never Learning.
 */
export function audienceFigure(
  col: AudienceSortCol,
  stats: FeatureAudienceStatsRow | undefined,
  basis: StatBasis,
): ShownFigure {
  const none: ShownFigure = { value: null, learning: false };
  if (!stats) return none;
  const cost = COST_FIELD[col];
  if (cost) return shownFigure(stats.metrics.maturity, (h) => h[cost], basis);
  const money = MONEY_FIELD[col];
  if (money) return shownFigure(stats.projection?.maturity, (h) => h[money], basis);
  return none;
}

/** The number a column sorts on, the same field its cell renders. Null sorts last. */
export function audienceSortValue(
  col: AudienceSortCol,
  audience: AudienceWire,
  stats: FeatureAudienceStatsRow | undefined,
  basis: StatBasis,
): string | number | null {
  if (COST_FIELD[col] || MONEY_FIELD[col]) return audienceFigure(col, stats, basis).value;
  switch (col) {
    case "audience":
      return (audience.name || "").toLowerCase();
    case "invested":
      return stats?.evidence.totalCostInUsdCents ?? null;
    case "replies":
      return stats?.evidence.positiveReplies ?? null;
    case "clicks":
      return stats?.evidence.websiteClicks ?? null;
    case "signups":
      return stats?.evidence.signups ?? null;
    case "formSubmissions":
      return stats?.evidence.formSubmissions ?? null;
    case "sales":
      return stats?.evidence.sales ?? null;
    case "outreach":
      return stats?.evidence.contacted ?? null;
    case "remaining":
      return audience.availableToContactPct ?? null;
    case "size":
      return audience.sizeCount ?? null;
    default:
      return null;
  }
}

/**
 * Orders the rows. A row whose figure reads `Learning` (the producer's verdict) has no
 * rank under that column, so it sinks below every measured one and is ordered by the
 * served outcome count behind it, descending. Nulls go last in both directions. Ties on
 * an outcome cost break on the cheapest website visit when the caller passes one.
 */
export function sortAudiences(
  rows: AudienceWire[],
  o: {
    sortCol: AudienceSortCol;
    sortDir: "asc" | "desc";
    tieBreakCol: AudienceSortCol | null;
    statsFor: (id: string) => FeatureAudienceStatsRow | undefined;
    basis: StatBasis;
  },
): AudienceWire[] {
  const { sortCol, sortDir, tieBreakCol, statsFor, basis } = o;
  const learningRank = (a: AudienceWire): number | null => {
    const stats = statsFor(a.id);
    if (!audienceFigure(sortCol, stats, basis).learning) return null;
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
    const av = audienceSortValue(sortCol, a, statsFor(a.id), basis);
    const bv = audienceSortValue(sortCol, b, statsFor(b.id), basis);
    if (av != null && bv != null) {
      const cmp = typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv) : (av as number) - (bv as number);
      if (cmp !== 0) return sortDir === "asc" ? cmp : -cmp;
    } else if (av == null && bv != null) {
      return 1;
    } else if (av != null && bv == null) {
      return -1;
    }
    if (!tieBreakCol) return 0;
    const at = audienceSortValue(tieBreakCol, a, statsFor(a.id), basis);
    const bt = audienceSortValue(tieBreakCol, b, statsFor(b.id), basis);
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
