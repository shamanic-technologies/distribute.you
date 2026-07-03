import { z } from "zod";
import { ADMIN_ALLOWED_EMAILS } from "./admin-allowlist";
import { parseFeatureRevenue } from "./revenue-parse";
import type { RevenueOverview, SignalSeries } from "./revenue-view";

export const OUTCOME_DIGEST_TEMPLATE = "daily-outcome-digest";
export const OUTCOME_DIGEST_FEATURE_SLUG = "sales-cold-email-outreach";
// Staff monitoring copy — every customer digest is blind-copied to the staff
// allowlist so the team sees exactly what each customer received. Single source
// = admin-allowlist (the same list that gates the god-mode console).
const STAFF_BCC_EMAILS = ADMIN_ALLOWED_EMAILS;

const PAGE_LIMIT = 100;
const MAX_LEADS_PER_BRAND = 10;
const CLERK_API_URL = "https://api.clerk.com/v1";
// Publishable logo.dev key — same one used across the dashboard (provider-logo,
// brand-logo, conversions-table). Renders a company logo from a domain.
const LOGO_DEV_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";

export type DigestFetch = typeof fetch;

interface EnvConfig {
  apiUrl: string;
  adminApiKey: string;
  clerkSecretKey: string;
}

export interface OutcomeDigestRuntimeConfig extends EnvConfig {
  fetchFn?: DigestFetch;
}

interface ClerkOrganization {
  id: string;
  name: string | null;
}

interface ApiUser {
  externalId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

interface BrandSummary {
  id: string;
  name: string | null;
  url: string | null;
  domain: string | null;
}

export interface DigestOutcomeOrg {
  orgName: string;
  expectedRevenueUsd: number;
  tags: string[];
  topPersonName: string | null;
}

/** One person row in the digest body — face + company logo. */
export interface DigestLead {
  name: string;
  photoUrl: string | null;
  companyName: string | null;
  companyLogoUrl: string | null;
  companyDomain: string | null;
  tags: string[];
  /** ISO timestamp of the goal's outcome event (website click for signups,
   *  positive reply for sales_meetings); null when unknown. Rendered as a
   *  discreet "time ago" — nothing when null (no synthesis). */
  outcomeAt: string | null;
}

export interface DigestBrandSummary {
  brandName: string;
  brandUrl: string | null;
  totalPipelineUsd: number;
  organizations: DigestOutcomeOrg[];
  leads: DigestLead[];
}

export interface PreparedDigestSend {
  orgId: string;
  orgName: string;
  brandId: string;
  brandName: string;
  userExternalId: string;
  recipientEmail: string;
  metadata: Record<string, string>;
}

/** A brand's optimization goal selects which daily signal counts as an outcome. */
export type OutcomeGoal = "signups" | "sales_meetings";

export interface OutcomeDigestCollection {
  scannedOrgs: number;
  eligibleUsers: number;
  preparedSends: PreparedDigestSend[];
}

export interface OutcomeDigestSendResult extends OutcomeDigestCollection {
  sent: number;
  deduplicated: number;
}

const ClerkOrganizationsResponseSchema = z.object({
  data: z.array(z.object({
    id: z.string(),
    name: z.string().nullable(),
  })),
  total_count: z.number(),
});

const ApiUsersResponseSchema = z.object({
  users: z.array(z.object({
    externalId: z.string(),
    email: z.string().nullable(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
  }).passthrough()),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

const BrandsResponseSchema = z.object({
  brands: z.array(z.object({
    id: z.string(),
    name: z.string().nullable(),
    domain: z.string().nullable(),
    url: z.string().nullable().optional(),
    brandUrl: z.string().nullable().optional(),
  }).passthrough()),
});

// Brand optimization goal — selects the outcome signal: signups → website clicks,
// sales_meetings (server default when unset) → screened positive replies. The wire
// can carry legacy aliases (booked_meetings / sales); all non-signups → sales_meetings.
const BrandGoalResponseSchema = z.object({
  salesEconomics: z
    .object({
      optimizationGoal: z.union([
        z.literal("signups"),
        z.literal("sales_meetings"),
        z.literal("booked_meetings"),
        z.literal("sales"),
      ]),
    })
    .nullable(),
});

const EmailSendResponseSchema = z.object({
  sent: z.boolean(),
  deduplicated: z.boolean().optional(),
});

export function outcomeDigestConfigFromEnv(): EnvConfig {
  return {
    apiUrl: requireEnv("NEXT_PUBLIC_DISTRIBUTE_API_URL").replace(/\/$/, ""),
    adminApiKey: requireEnv("ADMIN_DISTRIBUTE_API_KEY"),
    clerkSecretKey: requireEnv("CLERK_SECRET_KEY"),
  };
}

export function verifyOutcomeDigestCronRequest(req: Request): boolean {
  const cronSecret = requireEnv("CRON_SECRET");
  return req.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function collectOutcomeDigestSends(
  input: OutcomeDigestRuntimeConfig,
): Promise<OutcomeDigestCollection> {
  const fetchFn = input.fetchFn ?? fetch;
  // Digest reports on the UTC calendar day that just closed (cron runs 01:00 UTC),
  // independent of the exact run hour.
  const targetDay = previousUtcDay();
  const orgs = await listClerkOrganizations(input, fetchFn);
  const preparedSends: PreparedDigestSend[] = [];
  let eligibleUsers = 0;

  for (const org of orgs) {
    const users = await listApiUsersForOrg(input, fetchFn, org.id);
    // Every customer receives the digest — the recipient is the real org user;
    // staff are blind-copied (STAFF_BCC_EMAILS) on the send.
    const recipients = users.filter((u): u is ApiUser & { email: string } => !!u.email);
    eligibleUsers += recipients.length;
    if (recipients.length === 0) continue;

    // One email PER BRAND, sent only when that brand recorded at least one outcome
    // (click for a signups goal, positive reply for a sales-meetings goal) on the day.
    const brands = await listBrandsForOrg(input, fetchFn, org.id);
    for (const brand of brands) {
      const revenue = await fetchBrandRevenue(input, fetchFn, org.id, brand.id);
      if (revenue.organizations.length === 0) continue;

      const goal = await fetchBrandGoal(input, fetchFn, org.id, brand.id);
      const outcome = outcomeOnDay(revenue, goal, targetDay);
      if (outcome.count === 0) continue;

      const summary = toDigestBrandSummary(brand, revenue, goal);
      const metadata = digestMetadataForBrand(summary, outcome.count, outcome.label);
      for (const user of recipients) {
        preparedSends.push({
          orgId: org.id,
          orgName: org.name ?? org.id,
          brandId: brand.id,
          brandName: summary.brandName,
          userExternalId: user.externalId,
          recipientEmail: user.email,
          metadata,
        });
      }
    }
  }

  return { scannedOrgs: orgs.length, eligibleUsers, preparedSends };
}

/** The UTC calendar day before today (YYYY-MM-DD). */
function previousUtcDay(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
  )
    .toISOString()
    .slice(0, 10);
}

/**
 * The brand's outcome count + label for `day`, from the SAME `/revenue` signal series
 * the dashboard renders. signups → `clicked`, sales_meetings → `repliedPositive`.
 * An absent series (backend not yet serving it) reads as zero — the brand is skipped.
 */
function outcomeOnDay(
  revenue: RevenueOverview,
  goal: OutcomeGoal,
  day: string,
): { count: number; label: string } {
  const series: SignalSeries | undefined =
    goal === "signups" ? revenue.clicked : revenue.repliedPositive;
  const label = goal === "signups" ? "clicks" : "positive replies";
  const count = series
    ? series.daily
        .filter((d) => d.date === day)
        .reduce((sum, d) => sum + d.count, 0)
    : 0;
  return { count, label };
}

export async function sendOutcomeDigestEmails(
  input: OutcomeDigestRuntimeConfig,
): Promise<OutcomeDigestSendResult> {
  const fetchFn = input.fetchFn ?? fetch;
  const collection = await collectOutcomeDigestSends({ ...input, fetchFn });
  let sent = 0;
  let deduplicated = 0;

  for (const item of collection.preparedSends) {
    const result = await sendDigestEmail(input, fetchFn, item);
    if (result.sent) sent += 1;
    if (result.deduplicated === true) deduplicated += 1;
  }

  return { ...collection, sent, deduplicated };
}

/** logo.dev URL for a company domain, or the backend logo when present. */
function companyLogoSrc(logoUrl: string | null, domain: string | null): string | null {
  if (logoUrl) return logoUrl;
  if (domain) {
    return `https://img.logo.dev/${encodeURIComponent(domain)}?token=${LOGO_DEV_TOKEN}&size=64`;
  }
  return null;
}

function firstInitial(value: string): string {
  return (value.trim().charAt(0) || "?").toUpperCase();
}

export function renderOutcomeDigestHtml(summaries: DigestBrandSummary[]): string {
  return summaries.map((summary) => {
    const brandLabel = escapeHtml(summary.brandName);
    const brandUrl = summary.brandUrl
      ? ` <span style="color:#64748b;font-size:13px;">${escapeHtml(summary.brandUrl)}</span>`
      : "";
    const rows = summary.leads.slice(0, MAX_LEADS_PER_BRAND).map((lead) => {
      // Email clients can't run an onError fallback — a null photo renders an
      // initials circle; logo.dev returns a generated mark for unknown domains.
      const avatar = lead.photoUrl
        ? `<img src="${escapeHtml(lead.photoUrl)}" width="40" height="40" alt="${escapeHtml(lead.name)}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;display:block;border:1px solid #e2e8f0;" />`
        : `<span style="display:inline-block;width:40px;height:40px;border-radius:50%;background:#e2e8f0;color:#475569;font-weight:700;font-size:15px;line-height:40px;text-align:center;">${escapeHtml(firstInitial(lead.name))}</span>`;
      const logoSrc = companyLogoSrc(lead.companyLogoUrl, lead.companyDomain);
      const companyLogo = logoSrc
        ? `<img src="${escapeHtml(logoSrc)}" width="16" height="16" alt="" style="width:16px;height:16px;border-radius:3px;object-fit:contain;vertical-align:middle;margin-right:6px;background:#fff;border:1px solid #e2e8f0;" />`
        : "";
      const company = lead.companyName
        ? `<div style="color:#64748b;font-size:13px;margin-top:2px;">${companyLogo}${escapeHtml(lead.companyName)}</div>`
        : "";
      const tags = lead.tags.length > 0
        ? `<div style="color:#94a3b8;font-size:11px;margin-top:3px;">${escapeHtml(lead.tags.join(", "))}</div>`
        : "";
      const timeAgo = lead.outcomeAt ? escapeHtml(formatTimeAgo(lead.outcomeAt)) : "";
      return `
        <tr>
          <td width="56" style="padding:10px 0;border-top:1px solid #e2e8f0;vertical-align:top;">${avatar}</td>
          <td style="padding:10px 0;border-top:1px solid #e2e8f0;vertical-align:top;">
            <div style="font-weight:600;color:#0f172a;">${escapeHtml(lead.name)}</div>
            ${company}
            ${tags}
          </td>
          <td style="padding:10px 0;border-top:1px solid #e2e8f0;text-align:right;color:#94a3b8;font-size:12px;vertical-align:top;white-space:nowrap;">
            ${timeAgo}
          </td>
        </tr>`;
    }).join("");
    const peopleLabel = `${summary.leads.length} ${summary.leads.length === 1 ? "person" : "people"} in your pipeline`;
    return `
      <section style="margin:24px 0;">
        <h2 style="font-size:18px;color:#0f172a;margin:0 0 4px;">${brandLabel}${brandUrl}</h2>
        <p style="font-size:14px;color:#475569;margin:0 0 12px;">
          ${peopleLabel}
        </p>
        <table role="presentation" style="width:100%;border-collapse:collapse;">${rows}</table>
      </section>`;
  }).join("");
}

function renderOutcomeDigestText(summaries: DigestBrandSummary[]): string {
  return summaries.map((summary) => {
    const peopleLabel = `${summary.leads.length} ${summary.leads.length === 1 ? "person" : "people"} in your pipeline`;
    const header = `${summary.brandName} — ${peopleLabel}`;
    const rows = summary.leads.slice(0, MAX_LEADS_PER_BRAND).map((lead) => {
      const company = lead.companyName ? ` @ ${lead.companyName}` : "";
      const when = lead.outcomeAt ? ` — ${formatTimeAgo(lead.outcomeAt)}` : "";
      const tags = lead.tags.length > 0 ? ` (${lead.tags.join(", ")})` : "";
      return `- ${lead.name}${company}${when}${tags}`;
    });
    return [header, ...rows].join("\n");
  }).join("\n\n");
}

function digestMetadataForBrand(
  summary: DigestBrandSummary,
  outcomeCount: number,
  outcomeLabel: string,
): Record<string, string> {
  return {
    brandName: summary.brandName,
    brandUrl: summary.brandUrl ?? "",
    outcomeCount: String(outcomeCount),
    outcomeLabel,
    totalLeads: String(summary.leads.length),
    totalOutcomeOrganizations: String(summary.organizations.length),
    digestHtml: renderOutcomeDigestHtml([summary]),
    digestText: renderOutcomeDigestText([summary]),
  };
}

async function listClerkOrganizations(
  config: EnvConfig,
  fetchFn: DigestFetch,
): Promise<ClerkOrganization[]> {
  const orgs: ClerkOrganization[] = [];
  for (let offset = 0; ; offset += PAGE_LIMIT) {
    const url = `${CLERK_API_URL}/organizations?limit=${PAGE_LIMIT}&offset=${offset}`;
    const data = await fetchJson(url, {
      headers: {
        Authorization: `Bearer ${config.clerkSecretKey}`,
        "Content-Type": "application/json",
      },
    }, fetchFn, ClerkOrganizationsResponseSchema, "listClerkOrganizations");
    if (data.data.length === 0 && offset < data.total_count) {
      throw new Error("[dashboard-outcome-digest] listClerkOrganizations returned an empty non-terminal page");
    }
    orgs.push(...data.data);
    if (offset + data.data.length >= data.total_count) break;
  }
  return orgs;
}

async function listApiUsersForOrg(
  config: EnvConfig,
  fetchFn: DigestFetch,
  orgId: string,
): Promise<ApiUser[]> {
  const users: ApiUser[] = [];
  for (let offset = 0; ; offset += PAGE_LIMIT) {
    const url = `${config.apiUrl}/v1/users?limit=${PAGE_LIMIT}&offset=${offset}`;
    const data = await fetchJson(url, {
      headers: adminHeaders(config, orgId, `outcome-digest:${orgId}`),
    }, fetchFn, ApiUsersResponseSchema, "listApiUsersForOrg");
    if (data.users.length === 0 && offset < data.total) {
      throw new Error("[dashboard-outcome-digest] listApiUsersForOrg returned an empty non-terminal page");
    }
    users.push(...data.users);
    if (offset + data.users.length >= data.total) break;
  }
  return users;
}

async function fetchBrandGoal(
  config: EnvConfig,
  fetchFn: DigestFetch,
  orgId: string,
  brandId: string,
): Promise<OutcomeGoal> {
  const data = await fetchJson(
    `${config.apiUrl}/v1/brands/${brandId}/sales-economics`,
    { headers: adminHeaders(config, orgId, `outcome-digest:${orgId}`) },
    fetchFn,
    BrandGoalResponseSchema,
    "fetchBrandGoal",
  );
  return data.salesEconomics?.optimizationGoal === "signups"
    ? "signups"
    : "sales_meetings";
}

async function listBrandsForOrg(
  config: EnvConfig,
  fetchFn: DigestFetch,
  orgId: string,
): Promise<BrandSummary[]> {
  const data = await fetchJson(`${config.apiUrl}/v1/brands`, {
    headers: adminHeaders(config, orgId, `outcome-digest:${orgId}`),
  }, fetchFn, BrandsResponseSchema, "listBrandsForOrg");
  return data.brands.map((brand) => ({
    id: brand.id,
    name: brand.name,
    domain: brand.domain,
    url: brand.url ?? brand.brandUrl ?? null,
  }));
}

async function fetchBrandRevenue(
  config: EnvConfig,
  fetchFn: DigestFetch,
  orgId: string,
  brandId: string,
): Promise<RevenueOverview> {
  const params = new URLSearchParams({ brandId });
  const raw = await fetchJsonUntyped(`${config.apiUrl}/v1/features/${OUTCOME_DIGEST_FEATURE_SLUG}/revenue?${params.toString()}`, {
    headers: adminHeaders(config, orgId, `outcome-digest:${orgId}`),
  }, fetchFn, "fetchBrandRevenue");
  return parseFeatureRevenue(raw, "outcomeDigestRevenue");
}

async function sendDigestEmail(
  config: EnvConfig,
  fetchFn: DigestFetch,
  item: PreparedDigestSend,
): Promise<z.infer<typeof EmailSendResponseSchema>> {
  // Blind-copy staff so the team sees each customer's digest, minus the recipient
  // themselves (a staff member receiving their own org's digest is the To, not a Bcc).
  const bccEmails = STAFF_BCC_EMAILS.filter((email) => email !== item.recipientEmail);
  return fetchJson(`${config.apiUrl}/v1/emails/send`, {
    method: "POST",
    headers: adminHeaders(config, item.orgId, item.userExternalId),
    body: JSON.stringify({
      eventType: OUTCOME_DIGEST_TEMPLATE,
      recipientEmail: item.recipientEmail,
      ...(bccEmails.length > 0 ? { bccEmails } : {}),
      // Per-brand per-day dedup — a user gets one email PER BRAND per day.
      productId: `${OUTCOME_DIGEST_TEMPLATE}:${item.brandId}:${new Date().toISOString().slice(0, 10)}`,
      metadata: item.metadata,
    }),
  }, fetchFn, EmailSendResponseSchema, "sendDigestEmail");
}

// Opens are no longer tracked — drop any "opened" tag the backend still emits so
// the digest never surfaces the deprecated notion (display filter over the wire).
const stripOpened = (tags: string[]): string[] =>
  tags.filter((t) => t.toLowerCase() !== "opened");

function toDigestBrandSummary(
  brand: BrandSummary,
  revenue: RevenueOverview,
  goal: OutcomeGoal,
): DigestBrandSummary {
  const organizations = revenue.organizations
    .map((org): DigestOutcomeOrg => ({
      orgName: org.orgName ?? org.orgDomain ?? org.orgId ?? "Unknown organization",
      expectedRevenueUsd: org.expectedRevenueUsd,
      tags: stripOpened(org.tags),
      topPersonName: org.topPerson
        ? [org.topPerson.firstName, org.topPerson.lastName].filter(Boolean).join(" ") || null
        : null,
    }))
    .sort((a, b) => b.expectedRevenueUsd - a.expectedRevenueUsd);

  const leads = revenue.leads
    .map((lead): DigestLead => ({
      name:
        [lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
        lead.orgName ||
        "Lead",
      photoUrl: lead.photoUrl,
      companyName: lead.orgName,
      companyLogoUrl: lead.orgLogoUrl,
      companyDomain: lead.orgDomain ?? null,
      tags: stripOpened(lead.tags),
      // The goal's outcome timestamp: signups → website click, sales_meetings →
      // positive reply. Null (unknown) sorts last; ISO strings sort chronologically.
      outcomeAt: (goal === "signups" ? lead.clickedAt : lead.repliedPositiveAt) ?? null,
    }))
    .sort((a, b) => {
      if (a.outcomeAt && b.outcomeAt) return b.outcomeAt.localeCompare(a.outcomeAt);
      if (a.outcomeAt) return -1;
      if (b.outcomeAt) return 1;
      return 0;
    });

  return {
    brandName: brand.name ?? brand.domain ?? brand.url ?? brand.id,
    brandUrl: brand.url,
    totalPipelineUsd: revenue.totalPipelineUsd ?? 0,
    organizations,
    leads,
  };
}

async function fetchJson<T>(
  url: string,
  init: RequestInit,
  fetchFn: DigestFetch,
  schema: z.ZodSchema<T>,
  label: string,
): Promise<T> {
  const raw = await fetchJsonUntyped(url, init, fetchFn, label);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[dashboard-outcome-digest] ${label} response shape mismatch`, {
      issues: parsed.error.issues,
    });
    throw new Error(`[dashboard-outcome-digest] ${label}: invalid response shape`);
  }
  return parsed.data;
}

async function fetchJsonUntyped(
  url: string,
  init: RequestInit,
  fetchFn: DigestFetch,
  label: string,
): Promise<unknown> {
  const res = await fetchFn(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`[dashboard-outcome-digest] ${label} ${url} returned ${res.status}: ${body.slice(0, 500)}`);
    throw new Error(`[dashboard-outcome-digest] ${label} returned ${res.status}`);
  }
  return res.json() as Promise<unknown>;
}

function adminHeaders(config: EnvConfig, orgId: string, userId: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-API-Key": config.adminApiKey,
    "x-external-org-id": orgId,
    "x-external-user-id": userId,
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[dashboard-outcome-digest] ${name} is required`);
  return value;
}

/** A discreet relative time ("just now" / "5m ago" / "3h ago" / "2d ago") from an
 *  ISO timestamp. Empty string for an unparseable value (never synthesized). */
function formatTimeAgo(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const diffMinutes = Math.floor((Date.now() - then) / 60_000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
