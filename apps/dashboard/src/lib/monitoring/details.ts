/**
 * Monitoring > Emails, entity details (MONITORING-ADMIN-PORT-1019, entity-details): what the admin
 * console's cold-email Domains / Mailboxes / Accounts slide-overs showed, read off the SAME
 * instantly-service rows Monitoring already loads (`/v1/instantly/ops/{domains,mailboxes,addresses}`,
 * schemas widened additively in ./sending), plus two reads of our own:
 * - `/v1/instantly/infra/spend`: the estate's monthly run-rate, its USD total and 30-day sends,
 *   served as totals (the admin page summed rows in the browser; we read the producer's total);
 * - `/v1/instantly/audit/account-detail?email=`: one account's raw Instantly config, on demand.
 *
 * Money is in USD twins instantly-service serves beside the vendor's own amount, converted at the
 * ECB rate it names in `fx`. This module converts NOTHING, sums nothing, re-grades nothing: it
 * selects, sorts and formats. Alias-free (imports only zod and ./sending types) so it carries tests.
 */
import { z } from "zod";
import { FxRateSchema, type FxRate, type OpsDomainRow } from "./sending";

// ─── Reads of our own ──────────────────────────────────────────────────────

export const InfraSpendSchema = z.object({
  asOf: z.string(),
  byProvider: z.array(
    z.object({
      provider: z.string(),
      domainCount: z.number(),
      mailboxCount: z.number(),
      monthlyCents: z.number(),
      currency: z.string(),
      source: z.string().nullable(),
    }),
  ),
  monthlyByCurrency: z.array(z.object({ currency: z.string(), cents: z.number() })),
  unpricedProviders: z.array(z.string()),
  unpricedDomainCount: z.number(),
  fx: FxRateSchema.nullable(),
  // Null when a priced amount has no USD rate on record (never a partial sum).
  monthlyTotalUsdCents: z.number().nullable(),
  planSubscriptions: z.array(z.object({ item: z.string(), monthlyCents: z.number(), currency: z.string(), note: z.string().nullable() })),
  sentLast30d: z.number(),
});
export type InfraSpend = z.infer<typeof InfraSpendSchema>;

// ─── Formatting ────────────────────────────────────────────────────────────

/** Cents in their own currency, never converted. Null in, null out (drawn as a dash). */
export function money(cents: number | null | undefined, currency: string | null | undefined): string | null {
  if (cents == null || !Number.isFinite(cents)) return null;
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: currency && currency.length === 3 ? currency : "USD", maximumFractionDigits: 2 });
}

/** The native amount as provenance beside a USD twin ("billed €3.20"); null when it is already dollars. */
export function billedNative(cents: number | null | undefined, currency: string | null | undefined): string | null {
  if (cents == null || !currency || currency === "USD") return null;
  return `billed ${money(cents, currency)}`;
}

const FX_SOURCE_WORD: Record<string, string> = { "ecb-eurofxref-daily": "ECB reference rate" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `2027-09-13T…` -> `Sep 13, 2027`, read in UTC, spelled by hand so server and browser agree. */
export function fullDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00.000Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** `Oct 19, 2026, 11:22 UTC`. */
export function fullTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${fullDay(iso)}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
}

/** The one line saying how euros became dollars, read off the served `fx`, never a constant. */
export function fxRateLine(fx: FxRate | null | undefined): string {
  if (!fx) return "No EUR to USD rate is on record, so euro amounts cannot be stated in dollars.";
  return `${fx.base} converted at 1 ${fx.base} = $${fx.rate} (${FX_SOURCE_WORD[fx.source] ?? fx.source}, ${fullDay(fx.asOf)}).`;
}

export const PAID_TO_DATE_NOTE = "Paid to date is an estimate: the monthly rate times the months elapsed, not a ledger of charges.";

/** A producer's machine token in words: `delivery_below_bar` -> `Delivery below bar`. Unknown tokens print as served. */
export function tokenWord(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** Bounces per thousand emails, as served. Null = nothing sent, a dash. */
export const perMille = (v: number | null | undefined) => (v == null ? null : `${v.toLocaleString("en-US", { maximumFractionDigits: 1 })}‰`);

/** Yes / No / null, for a served boolean that may be unknown. */
export const yesNo = (v: boolean | null | undefined) => (v == null ? null : v ? "Yes" : "No");

// ─── Lookups and selections (no figure computed) ───────────────────────────

/** Served counts per state, largest first. Sorting only. */
export function lifecycleCounts(byLifecycle: Record<string, number> | undefined): Array<[string, number]> {
  return Object.entries(byLifecycle ?? {}).sort((a, b) => b[1] - a[1]);
}

/**
 * The vendor's mailbox count, or "not reported": a vendor whose inventory never reports mailboxes
 * (Instantly DFY) serves `vendorMailboxes: 0` meaning "not reported", never "hosts none".
 */
export function vendorMailboxesWord(row: { vendorReportsMailboxes?: boolean; vendorMailboxes?: number }): string | null {
  if (row.vendorReportsMailboxes === undefined || row.vendorMailboxes === undefined) return null;
  return row.vendorReportsMailboxes ? row.vendorMailboxes.toLocaleString("en-US") : "Not reported by this vendor";
}

/**
 * The daily max send this address has today, per apps/admin/CLAUDE.md "Instantly audit": the
 * producer's ramp-aware cap, the configured limit only when the cap is not served. A choice
 * between two served fields, never arithmetic.
 */
export function dailyMaxFor(r: { effectiveDailyCap?: number | null; dailyLimit: number | null }): number | null {
  return r.effectiveDailyCap ?? r.dailyLimit;
}

/** The ramp's last served point ("reaches 50 on Oct 25"), or null with no projection. Lookup only. */
export function rampReaches(projection: Array<{ date: string; cap: number }> | undefined): { date: string; cap: number } | null {
  if (!projection || projection.length === 0) return null;
  return projection[projection.length - 1];
}

/** A domain still in the estate: not cancelled, still reported by its vendor. */
export function isLiveDomain(r: Pick<OpsDomainRow, "cancelledAt" | "absentSince">): boolean {
  return !r.cancelledAt && !r.absentSince;
}

export type RenewalEvent = { domain: string; provider: string | null; expiresAt: string; usdCents: number | null; nativeCents: number | null; currency: string | null };

/**
 * The next live domain to LAPSE (no auto-renew) and the next to RENEW ITSELF: two different
 * actions, never one "next renewal". A domain whose vendor stated no auto-renew direction is in
 * neither, and counted apart. Selection by date only; every amount is the served one.
 */
export function nextRenewalEvents(rows: OpsDomainRow[]): { ending: RenewalEvent | null; renewing: RenewalEvent | null; unknownAutorenew: number } {
  const live = rows.filter(isLiveDomain);
  const soonest = (want: boolean): RenewalEvent | null => {
    const m = live.filter((r) => r.expiresAt && r.autorenew === want).sort((a, b) => a.expiresAt!.localeCompare(b.expiresAt!))[0];
    if (!m) return null;
    return { domain: m.domain, provider: m.provider, expiresAt: m.expiresAt!, usdCents: m.cost?.usd.renewalCents ?? null, nativeCents: m.cost?.renewalCents ?? null, currency: m.cost?.currency ?? null };
  };
  return { ending: soonest(false), renewing: soonest(true), unknownAutorenew: live.filter((r) => r.autorenew == null).length };
}

/** Live domains whose served renewal date falls from `now` on, soonest first, at most `limit`. Selection only. */
export function upcomingRenewals(rows: OpsDomainRow[], now: Date, limit: number): OpsDomainRow[] {
  const t = now.toISOString();
  return rows
    .filter((r) => isLiveDomain(r) && r.cost?.renewalAt && r.cost.renewalAt >= t)
    .sort((a, b) => a.cost!.renewalAt!.localeCompare(b.cost!.renewalAt!))
    .slice(0, limit);
}

/** Vendors that bill us for a domain, their own name and console root (verified 2026-09-22 in admin). */
export const VENDOR_CONSOLE: Record<string, { label: string; href: string }> = {
  gandi: { label: "Gandi", href: "https://admin.gandi.net/domain" },
  primeforge: { label: "Primeforge", href: "https://app.primeforge.ai" },
  mailforge: { label: "Mailforge", href: "https://app.mailforge.ai" },
  "instantly-dfy": { label: "Instantly DFY", href: "https://app.instantly.ai/app/accounts" },
};

/** A placement verdict in words. Unknown verdicts print as served. */
export const PLACEMENT_VERDICT_WORD: Record<string, string> = { inbox: "Inbox", junk: "Spam", spam: "Spam", missing: "Missing" };

