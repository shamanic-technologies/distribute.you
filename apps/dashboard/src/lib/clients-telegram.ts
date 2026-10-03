import { z } from "zod";
import { SERVICE_IDENTITY } from "./service-identity";

/**
 * The morning staff Telegram: one line per ACTIVE client brand, so the owner reads
 * the book of business without opening the admin.
 *
 * Every figure is served, nothing is derived here:
 * - who is active, daily + reactive budgets, audiences: features-service customer
 *   health (`/v1/features/audit/customer-success`, the admin Customer success board).
 *   "active" is the producer's verdict, never re-graded.
 * - payment mode, card, auto top-up, next charge / prepaid run-out: billing-service's
 *   fleet revenue (`/v1/billing/revenue/fleet`), one row per ORG, so a multi-brand
 *   org repeats it on each brand.
 * - invested: the CASH the org put in (owner's definition: money paid, never spend),
 *   billing's `credited_paid_cents` on `/v1/billing/accounts` (every payment received
 *   minus refunds, across acquirers), with gifted credit shown beside it. Per ORG.
 *
 * A field the producers could not serve prints `?`, never a zero.
 *
 * Alias-free on purpose (no runtime `@/` import) so it gets real unit tests.
 */

const num = z.coerce.number();

const CustomerSchema = z.object({
  orgId: z.string(),
  orgExternalId: z.string().nullable(),
  brandId: z.string(),
  brandName: z.string().nullable(),
  brandDomain: z.string().nullable(),
  status: z.string(),
  runningDailyBudgetUsd: num,
  reactiveRunningDailyCapUsd: num,
  audiences: z
    .object({ count: num, totalRemaining: num.nullable() })
    .nullable(),
  health: z.object({
    inputs: z.object({ audienceNearExhausted: z.boolean() }),
  }),
});

const CustomerHealthSchema = z.object({
  customers: z.array(z.unknown()),
});

const CashEventSchema = z.object({
  at: z.string(),
  expectedAmountCents: num.nullable(),
});

const FleetOrgSchema = z.object({
  orgId: z.string(),
  paymentMode: z.string(),
  chargeableCard: z.boolean(),
  autoTopupEnabled: z.boolean(),
  cashState: z.string().nullish(),
  cashBlockedReason: z.string().nullish(),
  cashEvents: z.array(CashEventSchema),
  oneOff: z
    .object({
      remainingCents: num,
      runOutAt: z.string().nullable(),
      runOutUnknownReason: z.string().nullish(),
    })
    .nullable(),
});

const FleetSchema = z.object({
  orgs: z.array(z.unknown()),
});

const AccountSchema = z.object({
  credited_paid_cents: num,
  credited_gifted_cents: num,
});

export type ClientCustomer = z.infer<typeof CustomerSchema>;
export type ClientFleetOrg = z.infer<typeof FleetOrgSchema>;

export interface OrgCash {
  paidUsd: number;
  giftedUsd: number;
}

export interface ClientLine {
  customer: ClientCustomer;
  billing: ClientFleetOrg | null;
  cash: OrgCash | null;
}

export interface CustomerBoard {
  active: ClientCustomer[];
  /** status "unknown": billing was unreadable, so the producer could not say whether
   *  they are active. Named in the message so a live client never silently vanishes. */
  unknown: ClientCustomer[];
}

export function parseCustomerBoard(raw: unknown): CustomerBoard {
  const board = CustomerHealthSchema.parse(raw);
  const out: CustomerBoard = { active: [], unknown: [] };
  for (const row of board.customers) {
    const parsed = CustomerSchema.safeParse(row);
    if (!parsed.success) {
      console.error("[dashboard-clients-telegram] unparseable customer row:", JSON.stringify(row).slice(0, 300), parsed.error.message);
      continue;
    }
    if (parsed.data.status === "active") out.active.push(parsed.data);
    if (parsed.data.status === "unknown") out.unknown.push(parsed.data);
  }
  return out;
}

export function parseActiveCustomers(raw: unknown): ClientCustomer[] {
  return parseCustomerBoard(raw).active;
}

export function parseFleetOrgs(raw: unknown): Map<string, ClientFleetOrg> {
  const fleet = FleetSchema.parse(raw);
  const byOrg = new Map<string, ClientFleetOrg>();
  for (const row of fleet.orgs) {
    const parsed = FleetOrgSchema.safeParse(row);
    if (!parsed.success) {
      console.error("[dashboard-clients-telegram] unparseable billing row:", JSON.stringify(row).slice(0, 300), parsed.error.message);
      continue;
    }
    byOrg.set(parsed.data.orgId, parsed.data);
  }
  return byOrg;
}

export function parseOrgCash(raw: unknown): OrgCash {
  const parsed = AccountSchema.parse(raw);
  return { paidUsd: parsed.credited_paid_cents / 100, giftedUsd: parsed.credited_gifted_cents / 100 };
}

function usd(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function dot(ok: boolean): string {
  return ok ? "🟢" : "🔴";
}

const PARIS_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" });

/** Calendar day number in the owner's timezone, so "tomorrow" means his tomorrow. */
function parisDayNumber(ms: number): number {
  return Date.parse(`${PARIS_DAY.format(ms)}T00:00:00Z`) / 86_400_000;
}

/** "today" / "tomorrow" / "in N days" from an ISO instant, in Paris calendar days. Formatting only. */
export function relativeDays(iso: string, now: Date): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return "on an unknown date";
  const days = parisDayNumber(at) - parisDayNumber(now.getTime());
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

function audiencesLabel(c: ClientCustomer): string {
  if (!c.audiences) return "Audiences ?";
  if (c.audiences.count === 0) return "Audiences 🔴 none";
  if (c.health.inputs.audienceNearExhausted) return "Audiences 🟠 nearly used up";
  return "Audiences 🟢";
}

function paymentModeLabel(b: ClientFleetOrg): string {
  if (b.paymentMode === "prepaid") return b.autoTopupEnabled ? "Prepaid with topup" : "Prepaid no topup";
  if (b.paymentMode === "postpaid") return "Postpaid";
  if (b.paymentMode === "subscription") return "Subscription";
  return b.paymentMode;
}

function cashLabel(b: ClientFleetOrg, now: Date): string {
  if (b.cashBlockedReason) return `next charge blocked (${b.cashBlockedReason})`;
  const next = b.cashEvents[0];
  if (next) {
    const when = relativeDays(next.at, now);
    return next.expectedAmountCents === null
      ? `next charge ${when}, amount unknown`
      : `next charge ${usd(next.expectedAmountCents / 100)} ${when}`;
  }
  if (b.oneOff) {
    const left = `${usd(b.oneOff.remainingCents / 100)} left`;
    if (b.oneOff.runOutAt) return `no charge scheduled, ${left}, runs out ${relativeDays(b.oneOff.runOutAt, now)}`;
    return `no charge scheduled, ${left}${b.oneOff.runOutUnknownReason ? ` (${b.oneOff.runOutUnknownReason})` : ""}`;
  }
  return "no charge scheduled";
}

function investedLabel(cash: OrgCash | null): string {
  if (!cash) return "invested ?";
  const gifted = cash.giftedUsd > 0 ? ` (+${usd(cash.giftedUsd)} free credit)` : "";
  return `${usd(cash.paidUsd)} invested${gifted}`;
}

export function clientLine(line: ClientLine, now: Date): string {
  const c = line.customer;
  const name = brandLabel(c);
  const parts = [
    `Daily ${usd(c.runningDailyBudgetUsd)}`,
    `Reactive ${usd(c.reactiveRunningDailyCapUsd)}`,
    audiencesLabel(c),
  ];
  const b = line.billing;
  if (b) {
    parts.push(paymentModeLabel(b), `Card ${dot(b.chargeableCard)}`, `Topup ${dot(b.autoTopupEnabled)}`);
  } else {
    parts.push("Billing ?");
  }
  parts.push(investedLabel(line.cash));
  if (b) parts.push(cashLabel(b, now));
  return `${name}\n${parts.join(" · ")}`;
}

function brandLabel(c: ClientCustomer): string {
  return c.brandName ?? c.brandDomain ?? c.brandId;
}

export function clientsMessage(lines: ClientLine[], now: Date, unknown: ClientCustomer[] = []): string {
  const unknownBlock = unknown.length
    ? [`⚠️ Status unreadable (billing did not answer): ${unknown.map(brandLabel).join(", ")}`]
    : [];
  if (lines.length === 0) return ["☀️ No active clients this morning.", ...unknownBlock].join("\n\n");
  const sorted = [...lines].sort(
    (a, b) => b.customer.runningDailyBudgetUsd - a.customer.runningDailyBudgetUsd,
  );
  const header = `☀️ ${lines.length} active client${lines.length === 1 ? "" : "s"}`;
  return [header, ...sorted.map((l) => clientLine(l, now)), ...unknownBlock].join("\n\n");
}

/** Telegram caps a message at 4096 chars: split on client boundaries. */
export function splitForTelegram(text: string, limit = 4000): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const block of text.split("\n\n")) {
    const next = current ? `${current}\n\n${block}` : block;
    if (next.length > limit && current) {
      chunks.push(current);
      current = block;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

// ── IO ──────────────────────────────────────────────────────────────────────

export interface ClientsTelegramConfig {
  apiUrl: string;
  adminApiKey: string;
  staffEmail: string;
  telegramBotToken: string;
  telegramChatId: string;
}

type FetchFn = typeof fetch;

async function getJson(fetchFn: FetchFn, url: string, headers: Record<string, string>, label: string): Promise<unknown> {
  const res = await fetchFn(url, { headers });
  const body = await res.text();
  if (!res.ok) throw new Error(`[dashboard-clients-telegram] ${label} ${res.status}: ${body.slice(0, 300)}`);
  return JSON.parse(body);
}

export async function buildClientLines(
  config: ClientsTelegramConfig,
  fetchFn: FetchFn = fetch,
): Promise<{ lines: ClientLine[]; unknown: ClientCustomer[] }> {
  // Staff-gated platform reads: admin key + an allowlisted staff email, no org headers.
  const staffHeaders = { "X-API-Key": config.adminApiKey, "x-email": config.staffEmail };
  const [health, fleet] = await Promise.all([
    getJson(fetchFn, `${config.apiUrl}/v1/features/audit/customer-success`, staffHeaders, "customer-success"),
    getJson(fetchFn, `${config.apiUrl}/v1/billing/revenue/fleet`, staffHeaders, "billing fleet"),
  ]);
  const { active: customers, unknown } = parseCustomerBoard(health);
  const billingByOrg = parseFleetOrgs(fleet);

  // Cash is per ORG: read each org once, even when it runs several brands.
  const orgIds = [...new Map(customers.map((c) => [c.orgId, c.orgExternalId])).entries()];
  const cashByOrg = new Map(
    await Promise.all(orgIds.map(async ([orgId, ext]) => [orgId, await fetchOrgCash(config, fetchFn, orgId, ext)] as const)),
  );

  const lines = customers.map((customer): ClientLine => {
    const billing = billingByOrg.get(customer.orgId) ?? null;
    if (!billing) console.error(`[dashboard-clients-telegram] no billing row for org ${customer.orgId} (${customer.brandName})`);
    return { customer, billing, cash: cashByOrg.get(customer.orgId) ?? null };
  });
  return { lines, unknown };
}

async function fetchOrgCash(
  config: ClientsTelegramConfig,
  fetchFn: FetchFn,
  orgId: string,
  orgExternalId: string | null,
): Promise<OrgCash | null> {
  if (!orgExternalId) {
    console.error(`[dashboard-clients-telegram] org ${orgId} has no Clerk org id, invested unreadable`);
    return null;
  }
  try {
    const raw = await getJson(
      fetchFn,
      `${config.apiUrl}/v1/billing/accounts`,
      {
        "X-API-Key": config.adminApiKey,
        "x-external-org-id": orgExternalId,
        "x-external-user-id": SERVICE_IDENTITY.clientsTelegram,
      },
      `billing account ${orgId}`,
    );
    return parseOrgCash(raw);
  } catch (err) {
    // One org's failed read must not cost the whole morning message: its line says "invested ?".
    console.error(`[dashboard-clients-telegram] invested read failed for org ${orgId}:`, err);
    return null;
  }
}

export async function sendTelegram(config: ClientsTelegramConfig, text: string, fetchFn: FetchFn = fetch): Promise<void> {
  for (const chunk of splitForTelegram(text)) {
    const res = await fetchFn(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: config.telegramChatId, text: chunk, disable_web_page_preview: true }),
    });
    if (!res.ok) throw new Error(`[dashboard-clients-telegram] telegram ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}
