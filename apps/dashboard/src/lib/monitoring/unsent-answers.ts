import { z } from "zod";

/**
 * Monitoring > Triggers > Unsent answers (staff only, ONE-AI-REFUSED-ANSWERS-1029), alias-free so vitest reads it directly.
 *
 * When a lead or client writes to a brand, a campaign writes an answer and sends it. When the sender REFUSED the written
 * answer, or every run for it failed and we gave up, the person who wrote got nothing. campaign-service serves it on
 * `GET /internal/ops/unsent-answers?days=N`, read through api-service's staff passthrough. Red on the hub IS the alert
 * (never an email). Answered by the brand's own team, or held while the channel is replayed, is normal. The page draws the
 * served verdict, list and daily series as served: no sort, no sum, no re-grading.
 */

const num = z.number();

export const UnsentAnswerSchema = z.object({
  occurrenceId: z.string(),
  orgId: z.string(),
  brandId: z.string(),
  offerId: z.string(),
  triggerId: z.string().nullable(),
  campaignId: z.string(),
  campaignName: z.string().nullable(),
  person: z.object({ name: z.string().nullable(), email: z.string().nullable(), phone: z.string().nullable() }).nullable(),
  state: z.enum(["refused", "failed"]),
  refusalCode: z.string().nullable(),
  refusalReason: z.string().nullable(),
  runs: num,
  at: z.string(),
});

export const UnsentAnswerDaySchema = z.object({
  day: z.string(),
  answered: num,
  answeredByTeam: num,
  replaying: num,
  refused: num,
  failed: num,
  refusedByCode: z.array(z.object({ code: z.string(), count: num })),
});

export const UnsentAnswersSchema = z.object({
  generatedAt: z.string(),
  days: num,
  status: z.enum(["ok", "red"]),
  redWindowHours: num,
  brokenLast24h: num,
  unsent: z.array(UnsentAnswerSchema),
  byDay: z.array(UnsentAnswerDaySchema),
});
export type UnsentAnswers = z.infer<typeof UnsentAnswersSchema>;
export type UnsentAnswer = z.infer<typeof UnsentAnswerSchema>;
export type UnsentAnswerDay = z.infer<typeof UnsentAnswerDaySchema>;

/** The senders' refusal codes as people say them. Display only; the sender's own sentence sits under it. */
const CODE_NAMES: Record<string, string> = {
  not_on_whatsapp: "Number not on WhatsApp",
  email_not_verified: "Email address did not pass our check",
  named_lead_unwritable: "Too little known to write to them",
  recent_brand_contact: "Already emailed in the last 3 months",
  whatsapp_not_connected: "WhatsApp line not connected",
};

/** A refusal code as people say it; an unknown one shows as served, underscores as spaces. Display only. */
export function refusalCodeName(code: string): string {
  return CODE_NAMES[code] ?? code.charAt(0).toUpperCase() + code.slice(1).replace(/_/g, " ");
}

/** Why the person got nothing, in one short line. Display only. */
export function unsentWhy(a: Pick<UnsentAnswer, "state" | "refusalCode" | "runs">): string {
  if (a.state === "failed") return `Every run failed (${a.runs} ${a.runs === 1 ? "try" : "tries"})`;
  return a.refusalCode ? refusalCodeName(a.refusalCode) : "Refused by the sender";
}

/** Who wrote: their name, else their email, else their phone; null when the answer names nobody. Display only. */
export function unsentPerson(a: Pick<UnsentAnswer, "person">): string | null {
  const p = a.person;
  return p ? p.name ?? p.email ?? p.phone ?? null : null;
}

/** A unit's name is `<funnel campaign> - <channel> - <brand> - <offer> - <leg>`: show its funnel campaign part, the rest on hover. */
export function campaignShortName(name: string): string {
  return name.split(" - ")[0];
}
