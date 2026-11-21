import { z } from "zod";
import { cumulativeLineSvg, formatUsd, weeklyBarsSvg, type RevenuePoint } from "./saas-revenue-charts";

/**
 * SaaS cash collected (owner 2026-11-21, SAAS-CASH-1121), served by features-service
 * `GET /internal/stats/saas-cash` through the gateway `GET /v1/features/audit/saas-cash`
 * (staff-only). Three series, owner order: SaaS GROSS (headline, agency excluded), SaaS
 * NET, GROSS with agency.
 *
 * Every figure is a served field: nothing is summed, accumulated or derived here. A
 * missing field is a parse error (loud), never a zero.
 *
 * Alias-free on purpose (no runtime `@/` import) so it gets real unit tests.
 */

const usd = z.number().finite();

const FiguresSchema = z.object({
  saasGrossUsd: usd,
  saasNetUsd: usd,
  withAgencyGrossUsd: usd,
});

const DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const SaasCashSchema = z.object({
  asOf: z.string(),
  firstPaymentDay: DAY.nullable(),
  weeks: z.array(
    FiguresSchema.extend({
      isoWeek: z.string(),
      weekStart: DAY,
      isCurrent: z.boolean(),
    }),
  ),
  days: z.array(
    z.object({
      day: DAY,
      isCurrent: z.boolean(),
      cumulative: FiguresSchema,
    }),
  ),
  totals: z.object({
    thisWeek: FiguresSchema,
    sinceInception: FiguresSchema,
  }),
});

export type SaasCash = z.infer<typeof SaasCashSchema>;
export type SaasCashFigures = z.infer<typeof FiguresSchema>;

export function parseSaasCash(raw: unknown): SaasCash {
  const parsed = SaasCashSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`[saas-cash] unparseable saas-cash body: ${parsed.error.message}`);
  }
  return parsed.data;
}

/** Chart 1 points: one bar per served week, SaaS gross. */
export function weeklyGrossPoints(cash: SaasCash): RevenuePoint[] {
  return cash.weeks.map((w) => ({ start: w.weekStart, usd: w.saasGrossUsd, current: w.isCurrent }));
}

/** Chart 2 points: features-service's own running total per day, SaaS gross. */
export function cumulativeGrossPoints(cash: SaasCash): RevenuePoint[] {
  return cash.days.map((d) => ({ start: d.day, usd: d.cumulative.saasGrossUsd, current: d.isCurrent }));
}

export interface SaasCashCharts {
  weeklySvg: string;
  cumulativeSvg: string;
}

export function saasCashCharts(cash: SaasCash): SaasCashCharts {
  const { thisWeek, sinceInception } = cash.totals;
  return {
    weeklySvg: weeklyBarsSvg(
      weeklyGrossPoints(cash),
      "SaaS cash collected per week (gross, agency excluded)",
      `${formatUsd(thisWeek.saasGrossUsd)} this week`,
    ),
    cumulativeSvg: cumulativeLineSvg(
      cumulativeGrossPoints(cash),
      "SaaS cash collected since inception (gross, agency excluded)",
      `${formatUsd(sinceInception.saasGrossUsd)} since inception`,
    ),
  };
}

/** The Telegram caption: gross ex-agency first, then net ex-agency, then gross with agency. */
export function saasCashCaption(cash: SaasCash): string {
  const { thisWeek: w, sinceInception: all } = cash.totals;
  const line = (label: string, week: number, total: number) =>
    `${label}: ${formatUsd(week)} this week, ${formatUsd(total)} since inception`;
  return [
    `💰 ${line("SaaS cash collected (gross)", w.saasGrossUsd, all.saasGrossUsd)}`,
    line("Net of refunds", w.saasNetUsd, all.saasNetUsd),
    line("With agency (gross)", w.withAgencyGrossUsd, all.withAgencyGrossUsd),
  ].join("\n");
}

// ── IO ──────────────────────────────────────────────────────────────────────

export interface SaasCashTelegramConfig {
  apiUrl: string;
  adminApiKey: string;
  staffEmail: string;
  telegramBotToken: string;
  telegramChatId: string;
}

type FetchFn = typeof fetch;

export async function fetchSaasCash(
  config: Pick<SaasCashTelegramConfig, "apiUrl" | "adminApiKey" | "staffEmail">,
  fetchFn: FetchFn = fetch,
): Promise<SaasCash> {
  // Staff-gated platform read: admin key + an allowlisted staff email, no org headers.
  const res = await fetchFn(`${config.apiUrl}/v1/features/audit/saas-cash`, {
    headers: { "X-API-Key": config.adminApiKey, "x-email": config.staffEmail },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`[saas-cash] saas-cash ${res.status}: ${body.slice(0, 300)}`);
  return parseSaasCash(JSON.parse(body));
}

/** Both charts in ONE Telegram album, the caption on the first photo. */
export async function sendSaasCashTelegram(
  config: Pick<SaasCashTelegramConfig, "telegramBotToken" | "telegramChatId">,
  caption: string,
  pngs: { weekly: Uint8Array<ArrayBuffer>; cumulative: Uint8Array<ArrayBuffer> },
  fetchFn: FetchFn = fetch,
): Promise<void> {
  const form = new FormData();
  form.append("chat_id", config.telegramChatId);
  form.append(
    "media",
    JSON.stringify([
      { type: "photo", media: "attach://weekly", caption },
      { type: "photo", media: "attach://cumulative" },
    ]),
  );
  form.append("weekly", new Blob([pngs.weekly], { type: "image/png" }), "saas-cash-weekly.png");
  form.append("cumulative", new Blob([pngs.cumulative], { type: "image/png" }), "saas-cash-cumulative.png");
  const res = await fetchFn(`https://api.telegram.org/bot${config.telegramBotToken}/sendMediaGroup`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`[saas-cash] telegram ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
