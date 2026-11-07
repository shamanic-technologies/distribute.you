/**
 * PUBLISHED OUTCOMES (owner 2026-11-06, OUTCOME-FINEST-1106: « pour les pages Outcomes … du hardcode pour chaque
 * [outcome] »): Threads posts, X posts, LinkedIn posts, newsletter emails. Each one's page lists the brand's Units (the
 * creative, its date and account, who performed it) with what each led to, served by features-service
 * `GET /brands/:brandId/published-units/:outcomeKey` (gateway `/v1/features/brands/:brandId/published-units/:outcomeKey`).
 * Every figure is served: this module parses and names, nothing is summed or divided.
 *
 * Alias-free (zod and nothing else) so it carries real unit tests.
 */
import { z } from "zod";
import { roiToShow, type RoiToShow } from "../expected-return";

/** The published outcomes with their own page, in the order the Outcomes overview lists them. */
export const PUBLISHED_OUTCOME_KEYS = ["newsletter_email_sent", "x_post_published", "linkedin_post_published", "threads_post_published"] as const;
export type PublishedOutcomeKey = (typeof PUBLISHED_OUTCOME_KEYS)[number];

export function isPublishedOutcomeKey(key: string | null | undefined): key is PublishedOutcomeKey {
  return !!key && (PUBLISHED_OUTCOME_KEYS as readonly string[]).includes(key);
}

/**
 * What each page calls its rows, hard-coded per outcome (owner): a newsletter release is a row of many emails, a post
 * is one. The page title is the catalogue's served step name; `creative` heads the creative column, `unit` names what
 * one Unit is (the "How many" figure).
 */
export const PUBLISHED_OUTCOME_COPY: Record<
  PublishedOutcomeKey,
  { row: string; rows: string; unit: string; units: string; creative: string; account: string; network: string | null; hasViews: boolean }
> = {
  threads_post_published: { row: "post", rows: "posts", unit: "post", units: "posts", creative: "Post", account: "Account", network: "Threads", hasViews: true },
  x_post_published: { row: "post", rows: "posts", unit: "post", units: "posts", creative: "Post", account: "Account", network: "X", hasViews: true },
  linkedin_post_published: { row: "post", rows: "posts", unit: "post", units: "posts", creative: "Post", account: "Account", network: "LinkedIn", hasViews: true },
  newsletter_email_sent: { row: "newsletter", rows: "newsletters", unit: "email", units: "emails", creative: "Newsletter", account: "List", network: null, hasViews: false },
};

/** The network's domain, for its logo (a display lookup). */
export const PUBLISHED_OUTCOME_DOMAIN: Record<PublishedOutcomeKey, string> = {
  threads_post_published: "threads.net",
  x_post_published: "x.com",
  linkedin_post_published: "linkedin.com",
  newsletter_email_sent: "distribute.you",
};

/**
 * SOCIAL-OUTCOMES-1107 (features-service): each engagement kind the platform reports, null = not reported. The kinds
 * reported sum to `engagements` (the producer sums; nothing is added here).
 */
export const EngagementBreakdownSchema = z.object({
  likes: z.number().nullable(),
  /** Comments. */
  replies: z.number().nullable(),
  reposts: z.number().nullable(),
  quotes: z.number().nullable(),
  shares: z.number().nullable(),
  bookmarks: z.number().nullable(),
  /** Link clicks the platform reports. */
  clicks: z.number().nullable(),
});
export type EngagementBreakdown = z.infer<typeof EngagementBreakdownSchema>;

/** The MEASURED return (Units x their value / money actually spent); Learning below the maturity bar. */
export const PublishedMeasuredReturnSchema = z.object({
  roiMultiple: z.number().nullable(),
  valueUsd: z.number().nullable(),
  spentUsd: z.number().nullable(),
  learning: z.boolean(),
  unavailableReason: z.string().nullable(),
});
export type PublishedMeasuredReturn = z.infer<typeof PublishedMeasuredReturnSchema>;

/** The EXPECTED return of one more Unit (its value / the expected cost of one). */
export const PublishedExpectedReturnSchema = z.object({
  roiMultiple: z.number().nullable(),
  valuePerUnitUsd: z.number().nullable(),
  costPerUnitUsd: z.number().nullable(),
  costSource: z.string().nullable(),
  basis: z.string().nullable(),
  pipeId: z.string().nullable(),
  unavailableReason: z.string().nullable(),
});

const TotalsSchema = z.object({
  rows: z.number(),
  units: z.number(),
  views: z.number(),
  engagements: z.number(),
  visits: z.number(),
  signups: z.number(),
  spentUsd: z.number(),
  // SOCIAL-OUTCOMES-1107, additive: optional until every features-service build serves them.
  engagementBreakdown: EngagementBreakdownSchema.optional(),
  /** Σ rows' value produced (yield); rows with no value are counted in `unvaluedRows`. */
  valueUsd: z.number().optional(),
  unvaluedRows: z.number().optional(),
});

export const PublishedUnitRowSchema = z.object({
  id: z.string(),
  publishedAt: z.string(),
  account: z.string().nullable(),
  /** `client_team` = a post the connected account published outside us (a hand post), imported. */
  performedBy: z.enum(["ours", "client_team"]),
  text: z.string().nullable(),
  url: z.string().nullable(),
  /** 1 per post; the emails sent for a newsletter release. */
  units: z.number(),
  views: z.number().nullable(),
  engagements: z.number().nullable(),
  spentUsd: z.number().nullable(),
  visits: z.number().nullable(),
  signups: z.number().nullable(),
  ledgerUnavailableReason: z.string().nullable(),
  // SOCIAL-OUTCOMES-1107, additive.
  /** Why `visits`/`signups` are null: `no_visit_attribution_on_outcome` (nothing tracks a click) or `not_on_ledger_yet`. */
  visitsUnavailableReason: z.string().nullish(),
  engagementBreakdown: EngagementBreakdownSchema.optional(),
  /** `engagements_exceed_views`: the platform reports more interactions than views. */
  metricsWarning: z.string().nullish(),
  /** units x value per unit: the value this row produced (yield). */
  valueUsd: z.number().nullish(),
});
export type PublishedUnitRow = z.infer<typeof PublishedUnitRowSchema>;

export const PublishedDaySchema = z.object({
  date: z.string(),
  units: z.number(),
  oursUnits: z.number(),
  views: z.number(),
  visits: z.number(),
  signups: z.number(),
  spentUsd: z.number(),
});
export type PublishedDay = z.infer<typeof PublishedDaySchema>;

export const PublishedUnitsSchema = z.object({
  brandId: z.string(),
  outcomeKey: z.string(),
  computedAt: z.string(),
  rows: z.array(PublishedUnitRowSchema),
  totals: z.object({ all: TotalsSchema, ours: TotalsSchema }),
  /** Ours spend ÷ ours signups; null while Learning (no signup yet). */
  costPerSignupUsd: z.number().nullable(),
  learning: z.boolean(),
  /** One point per UTC day a row was published on (quiet days omitted): a time axis. */
  daily: z.array(PublishedDaySchema),
  // SOCIAL-OUTCOMES-1107, additive.
  costPerSignupUnavailableReason: z.string().nullish(),
  /** Reposts of someone else's post, left out of every row and total. */
  repostsExcluded: z.object({ rows: z.number(), engagements: z.number() }).optional(),
  /** False = no website visit was ever credited to a Unit of this outcome: visits/signups are not tracked, never 0. */
  visitsMeasured: z.boolean().optional(),
  visitsUnavailableReason: z.string().nullish(),
  /** OURS (billed to the org). */
  measuredReturn: PublishedMeasuredReturnSchema.optional(),
  expectedReturn: PublishedExpectedReturnSchema.optional(),
});
export type PublishedUnits = z.infer<typeof PublishedUnitsSchema>;

/** Who performed a row, in the words the page prints. */
export function performedByLabel(p: PublishedUnitRow["performedBy"]): string {
  return p === "ours" ? "Ours" : "Client's team";
}

/** UTC midnight of a served `YYYY-MM-DD`, for a time axis. */
export function dayTime(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

/**
 * The page's ROI (SOCIAL-OUTCOMES-1107 display rule): the MEASURED return unless it is Learning or null, then the served
 * EXPECTED one flagged expected; still Learning, the measured-so-far figure greyed beside the expected one (the fleet
 * `roiToShow` rule). Undefined while the producer serves neither block.
 */
export function publishedRoiToShow(data: PublishedUnits): RoiToShow | undefined {
  const m = data.measuredReturn;
  if (!m && !data.expectedReturn) return undefined;
  const shown = { learning: m?.learning ?? true, value: m && !m.learning ? m.roiMultiple : null, toDate: m?.learning ? m.roiMultiple : null };
  const exp = data.expectedReturn;
  return roiToShow(shown, exp ? { roiMultiple: exp.roiMultiple, basis: exp.basis, unavailableReason: exp.unavailableReason ?? m?.unavailableReason ?? null } : null);
}

/** Why a visits/signups figure is absent, in the words the page prints. */
export function visitsReasonWords(reason: string | null | undefined): string {
  if (reason === "no_visit_attribution_on_outcome") return "Not tracked";
  if (reason === "not_on_ledger_yet") return "Not counted yet";
  return "—";
}

/** Why there is no $ per signup yet, in the words the page prints. */
export function costPerSignupReasonWords(reason: string | null | undefined): string {
  if (reason === "no_visit_attribution_on_outcome") return "Not tracked";
  if (reason === "nothing_spent_yet") return "Nothing spent yet";
  return "Learning";
}
