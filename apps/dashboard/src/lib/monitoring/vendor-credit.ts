import { z } from "zod";

/**
 * Monitoring > AI vendors > Credit (staff only, VENDOR-CREDIT-1030), alias-free so vitest reads it directly.
 *
 * From 2026-10-29 ~16:00 UTC the DeepSeek account had no balance: every chat-service call on deepseek-flash got a 402,
 * client replies went unjudged, and nothing was red anywhere. chat-service now stores "vendor out of credit" as a fact
 * (first refused call opens an outage, the next call that succeeds on that vendor closes it) and serves it per provider
 * it calls, with a daily series: `GET /internal/vendor-credit?days=N` (1..90, default 30), read through api-service's
 * staff passthrough `/v1/chat/ops/vendor-credit`. Red on the hub IS the alert (no email, owner 2026-10-22). The page
 * draws the served verdicts, sentences and counts as served: no sort, no sum, no re-grading.
 */

const num = z.number();
const ts = z.string().nullable();

export const VendorCreditItemSchema = z.object({
  provider: z.string(),
  label: z.string(),
  outOfCredit: z.boolean(),
  since: ts,
  lastSeenAt: ts,
  recoveredAt: ts,
  fallbackModel: z.string().nullable(),
  fallbackLabel: z.string().nullable(),
  refusedCalls: num,
  reroutedCalls: num,
  sentence: z.string().nullable(),
});

export const VendorCreditDaySchema = z.object({
  day: z.string(),
  provider: z.string(),
  outOfCredit: z.boolean(),
  refusedCalls: num,
  reroutedCalls: num,
});

export const VendorCreditSchema = z.object({
  vendors: z.array(VendorCreditItemSchema),
  days: z.array(VendorCreditDaySchema),
});
export type VendorCredit = z.infer<typeof VendorCreditSchema>;
export type VendorCreditItem = VendorCredit["vendors"][number];
export type VendorCreditDay = VendorCredit["days"][number];

/** The vendors out of credit right now, in served order. */
export function outOfCreditVendors(data: VendorCredit): VendorCreditItem[] {
  return data.vendors.filter((v) => v.outOfCredit);
}

/** Every vendor, the ones out of credit first, each group in served order (a partition, never a sort). */
export function vendorsRedFirst(data: VendorCredit): VendorCreditItem[] {
  return [...data.vendors.filter((v) => v.outOfCredit), ...data.vendors.filter((v) => !v.outOfCredit)];
}

/** One vendor's served days, in served order. */
export function vendorDays(data: VendorCredit, provider: string): VendorCreditDay[] {
  return data.days.filter((d) => d.provider === provider);
}

/** Whether a vendor's window holds any refused or rerouted call (decides whether its call bars are drawn). Display only. */
export function hasCalls(days: VendorCreditDay[]): boolean {
  return days.some((d) => d.refusedCalls > 0 || d.reroutedCalls > 0);
}
