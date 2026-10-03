import { z } from "zod";

/**
 * features-service's `window` block on the offer revenue read (`?windowDays=N`, v0.179.41+):
 * every Today stat over the SAME last N UTC days, each total served beside its own
 * zero-filled daily values. The browser renders it; it never sums a series itself.
 */
const DayCount = z.object({ date: z.string(), count: z.number() });

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
      brandLevelActualSpentCents: z.number(),
      costPerEmailSentCents: z.number().nullable(),
      daily: z.array(z.object({ date: z.string(), actualSpentCents: z.number(), brandLevelActualSpentCents: z.number() })),
    })
    .nullable(),
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

/** The windows the Today row offers, Explee's two. */
export const TODAY_WINDOWS = [7, 30] as const;
export type TodayWindow = (typeof TODAY_WINDOWS)[number];
