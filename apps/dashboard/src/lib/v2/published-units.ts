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

const TotalsSchema = z.object({
  rows: z.number(),
  units: z.number(),
  views: z.number(),
  engagements: z.number(),
  visits: z.number(),
  signups: z.number(),
  spentUsd: z.number(),
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
