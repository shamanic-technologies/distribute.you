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
 * - invested: the brand's `/revenue` read at `pricing=net` (what the org paid),
 *   because customer health serves committed spend GROSS and null for a brand with no
 *   saved economics.
 *
 * A field the producers could not serve prints `?`, never a zero.
 *
 * Alias-free on purpose (no runtime `@/` import) so it gets real unit tests.
 */

export const CLIENTS_TELEGRAM_FEATURE_SLUG = "sales-cold-email-outreach";

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

const RevenueSchema = z.object({
  costEconomics: z.object({ committedCostUsd: num.nullish() }).nullish(),
});

export type ClientCustomer = z.infer<typeof CustomerSchema>;
export type ClientFleetOrg = z.infer<typeof FleetOrgSchema>;

export interface ClientLine {
  customer: ClientCustomer;
  billing: ClientFleetOrg | null;
  investedUsd: number | null;
}

export function parseActiveCustomers(raw: unknown): ClientCustomer[] {
  const board = CustomerHealthSchema.parse(raw);
  const out: ClientCustomer[] = [];
  for (const row of board.customers) {
    const parsed = CustomerSchema.safeParse(row);
    if (!parsed.success) {
      console.error("[dashboard-clients-telegram] unparseable customer row:", JSON.stringify(row).slice(0, 300), parsed.error.message);
      continue;
    }
    if (parsed.data.status === "active") out.push(parsed.data);
  }
  return out;
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

export function parseInvestedUsd(raw: unknown): number | null {
  const parsed = RevenueSchema.parse(raw);
  return parsed.costEconomics?.committedCostUsd ?? null;
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

export function clientLine(line: ClientLine, now: Date): string {
  const c = line.customer;
  const name = c.brandName ?? c.brandDomain ?? c.brandId;
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
  parts.push(line.investedUsd === null ? "invested ?" : `${usd(line.investedUsd)} invested`);
  if (b) parts.push(cashLabel(b, now));
  return `${name}\n${parts.join(" · ")}`;
}

export function clientsMessage(lines: ClientLine[], now: Date): string {
  if (lines.length === 0) return "☀️ No active clients this morning.";
  const sorted = [...lines].sort(
    (a, b) => b.customer.runningDailyBudgetUsd - a.customer.runningDailyBudgetUsd,
  );
  const header = `☀️ ${lines.length} active client${lines.length === 1 ? "" : "s"}`;
  return [header, ...sorted.map((l) => clientLine(l, now))].join("\n\n");
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

export async function buildClientLines(config: ClientsTelegramConfig, fetchFn: FetchFn = fetch): Promise<ClientLine[]> {
  // Staff-gated platform reads: admin key + an allowlisted staff email, no org headers.
  const staffHeaders = { "X-API-Key": config.adminApiKey, "x-email": config.staffEmail };
  const [health, fleet] = await Promise.all([
    getJson(fetchFn, `${config.apiUrl}/v1/features/audit/customer-success`, staffHeaders, "customer-success"),
    getJson(fetchFn, `${config.apiUrl}/v1/billing/revenue/fleet`, staffHeaders, "billing fleet"),
  ]);
  const customers = parseActiveCustomers(health);
  const billingByOrg = parseFleetOrgs(fleet);

  return Promise.all(
    customers.map(async (customer): Promise<ClientLine> => {
      const billing = billingByOrg.get(customer.orgId) ?? null;
      if (!billing) console.error(`[dashboard-clients-telegram] no billing row for org ${customer.orgId} (${customer.brandName})`);
      return { customer, billing, investedUsd: await fetchInvested(config, fetchFn, customer) };
    }),
  );
}

async function fetchInvested(config: ClientsTelegramConfig, fetchFn: FetchFn, c: ClientCustomer): Promise<number | null> {
  if (!c.orgExternalId) {
    console.error(`[dashboard-clients-telegram] brand ${c.brandId} has no Clerk org id, invested unreadable`);
    return null;
  }
  const params = new URLSearchParams({ brandId: c.brandId, pricing: "net" });
  try {
    const raw = await getJson(
      fetchFn,
      `${config.apiUrl}/v1/features/${CLIENTS_TELEGRAM_FEATURE_SLUG}/revenue?${params.toString()}`,
      {
        "X-API-Key": config.adminApiKey,
        "x-external-org-id": c.orgExternalId,
        "x-external-user-id": SERVICE_IDENTITY.clientsTelegram,
      },
      `revenue ${c.brandId}`,
    );
    return parseInvestedUsd(raw);
  } catch (err) {
    // One brand's slow /revenue must not cost the whole morning message: its line says "invested ?".
    console.error(`[dashboard-clients-telegram] invested read failed for brand ${c.brandId}:`, err);
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
