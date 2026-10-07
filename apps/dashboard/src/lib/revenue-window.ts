import { z } from "zod";

/**
 * features-service's `window` block on the offer revenue read (`?windowDays=N`, v0.179.41+):
 * every Today stat over the SAME last N UTC days, each total served beside its own
 * zero-filled daily values. The browser renders it; it never sums a series itself.
 */
const DayCount = z.object({
  date: z.string(),
  count: z.number(),
  /** Running total since the window start, served (the last day IS `total`). Optional until read everywhere. */
  cumulativeCount: z.number().optional(),
});

export const RevenueWindowSchema = z.object({
  days: z.number(),
  startDate: z.string(),
  endDate: z.string(),
  /** Null when email-gateway's read failed: never a zero. */
  emails: z
    .object({
      sent: z.number(),
      delivered: z.number(),
      bounced: z.number(),
      deliveryRatePct: z.number().nullable(),
      daily: z.array(
        z.object({
          date: z.string(),
          sent: z.number(),
          delivered: z.number(),
          bounced: z.number(),
          deliveryRatePct: z.number().nullable(),
        }),
      ),
    })
    .nullable(),
  /** Actual spend, setup included (the brand's own work no campaign carries). */
  spend: z
    .object({
      actualSpentCents: z.number(),
      /** Committed: actual plus the holds still open. The figure the Spent tile states. */
      totalSpentCents: z.number(),
      /** The holds still open (follow-ups reserved, not sent yet), served. Optional until read everywhere. */
      provisionedSpentCents: z.number().optional(),
      brandLevelActualSpentCents: z.number(),
      costPerEmailSentCents: z.number().nullable(),
      daily: z.array(z.object({ date: z.string(), actualSpentCents: z.number(), totalSpentCents: z.number() })),
    })
    .nullable(),
  /**
   * EMAILS (every step) of the scope's campaigns scheduled and not yet sent RIGHT NOW: a
   * snapshot, the same whatever the window (features-service #1322). Null with a reason when
   * unreadable, never 0. Optional until that release is served.
   */
  queuedEmails: z.number().int().nullable().optional(),
  queuedEmailsUnavailableReason: z.enum(["sender_queue_unreadable", "stats_unreadable"]).nullable().optional(),
  recipientsRepliesPositive: z.object({ total: z.number(), daily: z.array(DayCount) }),
  recipientsClicked: z.object({ total: z.number(), daily: z.array(DayCount) }),
  /** Expected pipeline, the headline's own basis, as a cumulative curve. */
  expectedPipeline: z
    .object({
      totalPipelineUsd: z.number(),
      undatedPipelineUsd: z.number(),
      daily: z.array(z.object({ date: z.string(), cumulativePipelineUsd: z.number() })),
    })
    .nullable(),
});

export type RevenueWindow = z.infer<typeof RevenueWindowSchema>;

export const RevenueWindowResponseSchema = z.object({ window: RevenueWindowSchema });

/**
 * Every stat card states the figures SINCE INCEPTION (owner 2026-10-04: "on veut les chiffres
 * since inception", no 7 / 30 day toggle). features-service serves it as `?windowDays=all`.
 */
export const SINCE_INCEPTION = "all" as const;
export type RevenueWindowDays = number | typeof SINCE_INCEPTION;
