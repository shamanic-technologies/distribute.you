import { z } from "zod";

/**
 * Monitoring > Cost > Email sources (staff only, APOLLO-ZERO-COST-1119), alias-free so vitest reads it.
 *
 * Owner 2026-11-19: Apollo's PAID reveal is the last resort; our stock, an email-format guess and treg go first, and
 * free people sources (Leadsforge, Dropleads) find the people. apollo-service counts, per UTC day, where each served
 * email came from and serves `GET /internal/stats/email-sources/daily?days=N` (one row per UTC day, oldest first),
 * read through api-service's staff passthrough. A high Apollo share is not broken: the hub is red ONLY when the read
 * fails. `apolloShare` is apollo-service's (null on a day with no email); the page prints its complement only.
 */

export const EmailSourcesDaySchema = z.object({
  day: z.string(),
  apolloReveals: z.number(),
  tregFinds: z.number(),
  stockReuses: z.number(),
  formatGuesses: z.number(),
  freeSourcePeople: z.number(),
  apolloShare: z.number().nullable(),
});
export type EmailSourcesDay = z.infer<typeof EmailSourcesDaySchema>;

export const EmailSourcesSchema = z.object({ days: z.array(EmailSourcesDaySchema) });
export type EmailSources = z.infer<typeof EmailSourcesSchema>;

/** The stacked bar's paths, bottom to top, in the owner's order: free and cheap first, Apollo (paid) on top. */
export const EMAIL_PATHS = [
  { key: "stockReuses", label: "Our stock", color: "var(--data-teal)" },
  { key: "formatGuesses", label: "Format guess", color: "var(--data-lime)" },
  { key: "tregFinds", label: "treg", color: "var(--data-sky)" },
  { key: "apolloReveals", label: "Apollo (paid)", color: "var(--data-amber)" },
] as const satisfies ReadonlyArray<{ key: keyof EmailSourcesDay; label: string; color: string }>;

/** Emails found on a day, every path together (the bar's height). */
export function emailsFound(d: EmailSourcesDay): number {
  return d.stockReuses + d.formatGuesses + d.tregFinds + d.apolloReveals;
}

/** Today's served row: the newest one (apollo-service serves oldest first, ending on today's UTC day). */
export function todayRow(data: EmailSources): EmailSourcesDay | undefined {
  return data.days.at(-1);
}

/** Share of a day's emails found without Apollo, in percent: the complement of the served `apolloShare`; null stays null. */
export function withoutApolloPct(d: EmailSourcesDay): number | null {
  return d.apolloShare == null ? null : (1 - d.apolloShare) * 100;
}
