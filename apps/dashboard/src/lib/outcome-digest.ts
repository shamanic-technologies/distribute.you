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
  /** Firmographics for reassurance (features-service#441). Each null when the
   *  upstream enrichment had no value — the row omits the missing piece. */
  title: string | null;
  orgIndustry: string | null;
  /** Raw headcount; banded for display. */
  orgEmployeeCount: number | null;
  /** Pre-joined "City, Country" (or the known half); null when neither is known. */
  location: string | null;
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

// Brand optimization goal — selects the outcome signal: visit-driven goals →
// website clicks, everything else (server default when unset) → screened positive
// replies. The wire keeps adding goals (form_submissions, purchase, legacy aliases
// booked_meetings/sales); a strict union throws `invalid_union` on any new value and
// SKIPS the brand's digest, so this stays an open `z.string()` and the visit-vs-reply
// mapping is decided in fetchBrandGoal against the settled VISIT_DRIVEN_GOALS set.
const BrandGoalResponseSchema = z.object({
  salesEconomics: z
    .object({
      optimizationGoal: z.string(),
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

// Fleet-scan concurrency. The scan is dominated by cold Neon-backed /revenue calls
// (one per brand) — a sequential walk of every org × brand blew the Vercel 300s cron
// ceiling before a single email was sent. Bounded parallelism keeps the whole scan
// well under budget; nested caps mean at most ORG × BRAND in-flight revenue fetches
// (kept modest so a burst doesn't hammer the scale-to-zero 0.25 CU compute).
const ORG_CONCURRENCY = 4;
const BRAND_CONCURRENCY = 4;

/** Invoked with a brand's prepared sends the moment that brand qualifies — lets
 *  sendOutcomeDigestEmails INTERLEAVE the send into the scan, so a 300s timeout only
 *  loses the un-scanned tail instead of every email (the scan used to fully finish
 *  before any send). Absent in collect-only mode. */
type BrandSendSink = (sends: PreparedDigestSend[]) => Promise<void>;

/** Run `fn` over `items` with at most `limit` in flight. Resolves when all settle. */
async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await fn(items[index]);
    }
  });
  await Promise.all(workers);
}

export async function collectOutcomeDigestSends(
  input: OutcomeDigestRuntimeConfig,
): Promise<OutcomeDigestCollection> {
  return scanFleet(input, input.fetchFn ?? fetch);
}

/**
 * The single fleet-scan path shared by collect (no sink) and send (sink fires per
 * brand). Bounded-parallel over orgs, then bounded-parallel over each org's brands.
 * Per-org and per-brand isolation is preserved: one failed fetch logs loud and skips
 * only that unit, never aborting the fleet.
 */
async function scanFleet(
  input: OutcomeDigestRuntimeConfig,
  fetchFn: DigestFetch,
  sink?: BrandSendSink,
): Promise<OutcomeDigestCollection> {
  // Digest reports on the UTC calendar day that just closed (cron runs 01:00 UTC),
  // independent of the exact run hour.
  const targetDay = previousUtcDay();
  const orgs = await listClerkOrganizations(input, fetchFn);
  const preparedSends: PreparedDigestSend[] = [];
  let eligibleUsers = 0;

  await mapWithConcurrency(orgs, ORG_CONCURRENCY, async (org) => {
    try {
      const users = await listApiUsersForOrg(input, fetchFn, org.id);
      // Every customer receives the digest — the recipient is the real org user;
      // staff are blind-copied (STAFF_BCC_EMAILS) on the send.
      const recipients = users.filter((u): u is ApiUser & { email: string } => !!u.email);
      eligibleUsers += recipients.length;
      if (recipients.length === 0) return;

      // One email PER BRAND, sent only when that brand recorded at least one outcome
      // (click for a visit-driven goal, positive reply otherwise) on the day.
      const brands = await listBrandsForOrg(input, fetchFn, org.id);
      await mapWithConcurrency(brands, BRAND_CONCURRENCY, async (brand) => {
        const sends = await collectBrandSends(input, fetchFn, targetDay, org, recipients, brand);
        if (sends.length === 0) return;
        preparedSends.push(...sends);
        // Send this brand's emails now (interleaved) when running in send mode.
        if (sink) await sink(sends);
      });
    } catch (err) {
      console.error(`[dashboard-outcome-digest] skipped org ${org.id} after error:`, err);
    }
  });

  return { scannedOrgs: orgs.length, eligibleUsers, preparedSends };
}

/** Prepared sends for ONE brand on `targetDay`, or [] when it recorded no outcome.
 *  Per-BRAND isolation: a heavy/slow /revenue must not skip the rest of the org. */
async function collectBrandSends(
  input: OutcomeDigestRuntimeConfig,
  fetchFn: DigestFetch,
  targetDay: string,
  org: ClerkOrganization,
  recipients: (ApiUser & { email: string })[],
  brand: BrandSummary,
): Promise<PreparedDigestSend[]> {
  try {
    const revenue = await fetchBrandRevenue(input, fetchFn, org.id, brand.id);
    if (revenue.organizations.length === 0) return [];

    const goal = await fetchBrandGoal(input, fetchFn, org.id, brand.id);
    const outcome = outcomeOnDay(revenue, goal, targetDay);
    if (outcome.count === 0) return [];

    const summary = toDigestBrandSummary(brand, revenue, goal);
    const metadata = digestMetadataForBrand(summary, outcome.count, outcome.label);
    return recipients.map((user) => ({
      orgId: org.id,
      orgName: org.name ?? org.id,
      brandId: brand.id,
      brandName: summary.brandName,
      userExternalId: user.externalId,
      recipientEmail: user.email,
      metadata,
    }));
  } catch (err) {
    console.error(
      `[dashboard-outcome-digest] skipped brand ${brand.id} (org ${org.id}) after error:`,
      err,
    );
    return [];
  }
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
  let sent = 0;
  let deduplicated = 0;

  // Send each brand's emails as the scan qualifies it (interleaved via the sink), so
  // a 300s cron kill only loses the un-scanned tail rather than every email.
  const collection = await scanFleet({ ...input, fetchFn }, fetchFn, async (sends) => {
    for (const item of sends) {
      // Per-SEND isolation: a single failed email (transient send error, bad address)
      // must not abort the remaining sends.
      try {
        const result = await sendDigestEmail(input, fetchFn, item);
        if (result.sent) sent += 1;
        if (result.deduplicated === true) deduplicated += 1;
      } catch (err) {
        console.error(
          `[dashboard-outcome-digest] send failed for ${item.recipientEmail} (brand ${item.brandId}):`,
          err,
        );
      }
    }
  });

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
      // Company line: logo + name, then discreet firmographics (industry · size · location).
      const companyMeta = [
        lead.orgIndustry,
        lead.orgEmployeeCount != null ? formatEmployeeBand(lead.orgEmployeeCount) : null,
        lead.location,
      ].filter((v): v is string => !!v);
      const companyText = [lead.companyName, ...companyMeta].filter(Boolean).join(" · ");
      const company = companyText
        ? `<div style="color:#64748b;font-size:13px;margin-top:2px;">${companyLogo}${escapeHtml(companyText)}</div>`
        : "";
      // Job title (or seniority) directly under the name — the "who is this" reassurance.
      const titleLine = lead.title
        ? `<div style="color:#475569;font-size:13px;margin-top:1px;">${escapeHtml(lead.title)}</div>`
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
            ${titleLine}
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
      const title = lead.title ? `, ${lead.title}` : "";
      const company = lead.companyName ? ` @ ${lead.companyName}` : "";
      const meta = [
        lead.orgIndustry,
        lead.orgEmployeeCount != null ? formatEmployeeBand(lead.orgEmployeeCount) : null,
        lead.location,
      ].filter(Boolean).join(" · ");
      const metaText = meta ? ` [${meta}]` : "";
      const when = lead.outcomeAt ? ` — ${formatTimeAgo(lead.outcomeAt)}` : "";
      const tags = lead.tags.length > 0 ? ` (${lead.tags.join(", ")})` : "";
      return `- ${lead.name}${title}${company}${metaText}${when}${tags}`;
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
  // Visit-driven goals track website clicks; every other goal (incl. the server
  // default when unset) tracks screened positive replies. Mirrors the dashboard's
  // settled `isVisitDrivenGoal` (api.ts) so the digest never diverges from it.
  const goal = data.salesEconomics?.optimizationGoal;
  return goal && VISIT_DRIVEN_GOALS.has(goal) ? "signups" : "sales_meetings";
}

// The click-driven optimization goals — kept byte-equal with `isVisitDrivenGoal`
// in api.ts. Any goal NOT in this set (sales_meetings, positive_replies, legacy
// booked_meetings/sales, and any future reply-driven goal) maps to positive replies.
const VISIT_DRIVEN_GOALS = new Set([
  "signups",
  "website_visits",
  "form_submissions",
  "purchase",
]);

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
      // Firmographics — job title (fall back to Apollo seniority band), company
      // industry, headcount, and location. Null when unknown (never synthesized).
      title: lead.title ?? lead.seniority ?? null,
      orgIndustry: lead.orgIndustry ?? null,
      orgEmployeeCount: lead.orgEmployeeCount ?? null,
      location: [lead.orgCity, lead.orgCountry].filter(Boolean).join(", ") || null,
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

// Per-fetch budget. The digest calls cold Neon-backed siblings (features/api,
// scale-to-zero 0.25 CU) and a brand's /revenue can be heavy (a large brand owns
// thousands of Instantly campaigns), so 30s was too tight — a single cold call
// blew it and aborted the whole cron. 60s + a connect-phase retry absorbs the wake.
const FETCH_TIMEOUT_MS = 60_000;
const FETCH_RETRY_BACKOFF_MS = [250, 500, 1000];

/** A THROWN transport failure worth retrying (connect timeout / reset / cold-start),
 *  walking `err.cause` + AggregateError. Never matches a completed HTTP response —
 *  an HTTP 5xx is a real answer and is thrown separately, not retried here. */
function isTransientFetchError(err: unknown): boolean {
  const seen = new Set<unknown>();
  const visit = (e: unknown): boolean => {
    if (!e || typeof e !== "object" || seen.has(e)) return false;
    seen.add(e);
    const anyErr = e as { name?: string; code?: string; message?: string; cause?: unknown; errors?: unknown[] };
    const name = anyErr.name ?? "";
    const code = anyErr.code ?? "";
    const message = anyErr.message ?? "";
    if (name === "TimeoutError" || name === "AbortError") return true;
    if (["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT"].includes(code)) return true;
    if (/timed? ?out|timeout|econnreset|econnrefused|fetch failed|network|socket hang up/i.test(message)) return true;
    if (Array.isArray(anyErr.errors) && anyErr.errors.some(visit)) return true;
    return visit(anyErr.cause);
  };
  return visit(err);
}

async function fetchJsonUntyped(
  url: string,
  init: RequestInit,
  fetchFn: DigestFetch,
  label: string,
): Promise<unknown> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= FETCH_RETRY_BACKOFF_MS.length; attempt += 1) {
    try {
      const res = await fetchFn(url, {
        ...init,
        cache: "no-store",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error(`[dashboard-outcome-digest] ${label} ${url} returned ${res.status}: ${body.slice(0, 500)}`);
        throw new Error(`[dashboard-outcome-digest] ${label} returned ${res.status}`);
      }
      return (await res.json()) as unknown;
    } catch (err) {
      lastErr = err;
      // Only retry a transient TRANSPORT failure (the read is idempotent GET). An
      // HTTP-status error above is a real answer — rethrow it immediately.
      if (!isTransientFetchError(err) || attempt === FETCH_RETRY_BACKOFF_MS.length) throw err;
      const delay = FETCH_RETRY_BACKOFF_MS[attempt];
      console.error(`[dashboard-outcome-digest] ${label} ${url} transient failure (attempt ${attempt + 1}), retrying in ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr;
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

/** Band a raw headcount into a human range (Apollo-style) for display. */
function formatEmployeeBand(count: number): string {
  const bands: [number, string][] = [
    [10, "1-10"],
    [50, "11-50"],
    [200, "51-200"],
    [500, "201-500"],
    [1_000, "501-1,000"],
    [5_000, "1,001-5,000"],
    [10_000, "5,001-10,000"],
  ];
  for (const [max, label] of bands) {
    if (count <= max) return `${label} employees`;
  }
  return "10,000+ employees";
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
