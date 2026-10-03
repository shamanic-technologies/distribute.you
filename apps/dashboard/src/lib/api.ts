import { parseOfferSalesPaths, type OfferSalesPaths } from "./offer-sales-paths";
import { parseBrandSalesBudget, type BrandSalesBudget } from "./brand-sales-budget";
import { browserHasAnonSession } from "./anon-session-cookie";
import { offerArchiveRefusalSentence } from "./offer-archive";
import { CrmAttributionSchema, type CrmAttribution } from "./crm-attribution";
import {
  PeopleListSchema,
  PersonTimelineSchema,
  type PeopleList,
  type PersonTimeline,
} from "./people-conversations";
import { z } from "zod";
import {
  CostMarginSchema,
  CurrentPricesSchema,
  FleetEmailStatsSchema,
  PriceVersionsSchema,
  type CostMargin,
  type CurrentPrice,
  type PriceVersion,
  MarginTimeseriesSchema,
  ProviderSourcesListSchema,
  type MarginTimeseries,
  type ProviderSourcesRow,
  SentPerPeriodSchema,
  type SentGrain,
  type SentPerPeriod,
  EmailSendPriceSchema,
  type EmailSendPrice,
  SubscriptionCostsSchema,
  type SubscriptionCosts,
  RealCostsSchema,
  type RealCosts,
  RealCostSeriesSchema,
  type RealCostSeries,
  PriceComparisonSchema,
  type PriceComparison,
  type PriceSource,
  type ComparisonInterval,
  StaffBrandsSchema,
  type StaffBrand,
  BasisSummarySchema,
  type BasisSummary,
} from "./monitoring/monitoring";
import {
  LeadBucketCountsSchema,
  LeadStandingCountsSchema,
  LeadsPageEnvelopeSchema,
  type LeadBucketCounts,
  type LeadStandingCounts,
} from "./leads-server-page";
import type { PublishedChannelTerms } from "./channel-minimums";
import { ORG_DESYNC_ERROR, ORG_DESYNC_STATUS } from "./org-desync";
import { keepLastGoodFields } from "./keep-last-good";
import type { RevenueOverview } from "./revenue-view";
import type {
  WorkflowCatalogueRow,
  WorkflowDynastyMembership,
  WorkflowRevenueGroup,
  FleetRead,
} from "./campaign-workflow-rows";
import type { LeadStanding } from "./lead-standing";
import type { LeadConversation } from "./lead-conversation";
import { EconomicsMaturitySchema, ScopeMaturitySchema, parseFeatureRevenue } from "./revenue-parse";
import { maturityPairSchema, type MaturityPair } from "./maturity";
import type { EconomicsFigures, OutcomeFigures, ScopeMaturity } from "./revenue-view";
import { LeadHistorySchema, type LeadHistory } from "./lead-history";
import { withAverageCampaignRelevanceScores } from "./outlet-relevance";
import { measuredProjectionRows } from "./workflow-projection-measured";
import {
  CrmContactOriginsSchema,
  CrmPairingCountsSchema,
  CrmPairingsSchema,
  type CrmContactOrigins,
  type CrmPairingCounts,
  type CrmPairings,
} from "./crm-pairings";

const API_URL = process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";

interface ApiOptions {
  token?: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  suppressPaymentRequired?: boolean;
  /**
   * What the body IS. `json` (the default) parses it; `text` hands it back verbatim.
   *
   * One caller wants text: the leads CSV export, which lead-service streams as a file. It
   * goes through here rather than around it so the export carries the same per-tab Clerk
   * bearer, the same org-desync retry and the same error envelope as every other read — an
   * export authenticating differently from the page it exports is a second auth path to
   * keep correct.
   */
  responseType?: "json" | "text";
}

/**
 * Unified API call function.
 * - With token: direct call to external API (server-side usage)
 * - Without token: routes through /api/v1 proxy (client-side, auth via Clerk cookies)
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * True when an error is a 402 insufficient-credits failure. apiCall auto-dispatches
 * the billing-guard modal on a 402 (see the 402 branch above), so callers use this
 * to AVOID treating a credit failure as a hard error (no destructive reset / error
 * banner) — the modal handles it and a `billing:resolved` event signals recovery.
 */
export function isInsufficientCredit(err: unknown): boolean {
  return err instanceof ApiError && err.status === 402;
}

function asErrorBody(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : { error: "Request failed", body: value };
}

function stringOrNumber(value: unknown): string | number | undefined {
  return typeof value === "string" || typeof value === "number" ? value : undefined;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

async function readJsonResponse(response: Response, endpoint: string): Promise<unknown> {
  const contentType = response.headers?.get?.("Content-Type") ?? "application/json";
  if (!contentType.toLowerCase().includes("application/json")) {
    const text = await response.text().catch(() => "");
    const preview = text.trim().slice(0, 200);
    // Carry the status + body preview in the MESSAGE, not only in the error body:
    // most call sites render `err.message` alone, and a bare "non-JSON response"
    // hides whether the platform 500'd (Vercel HTML error page), the gateway
    // timed out, or the route is missing.
    throw new ApiError(
      `API returned a non-JSON response (HTTP ${response.status}, ${contentType || "no content-type"}) from ${endpoint}${preview ? `: ${preview}` : ""}`,
      response.status,
      {
        error: "Non-JSON API response",
        endpoint,
        status: response.status,
        contentType: contentType || null,
        preview,
      },
    );
  }

  try {
    return await response.json();
  } catch (err) {
    throw new ApiError("API returned invalid JSON", response.status, {
      error: "Invalid JSON API response",
      endpoint,
      status: response.status,
      contentType,
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * The org a flow is acting on when it is NOT the org the URL names.
 *
 * One caller: the v2 "New organization" modal, which creates an org and builds its
 * brand, offers and campaign WITHOUT making it the session's active org. Switching the
 * active org mid-flow makes Clerk refresh the page, and the edge first-run gate then
 * sends the person to the full-page onboarding because the new org is not set up yet.
 * So while the override is set, every call sends a token Clerk mints FOR that org
 * (`getToken({ organizationId })`) and the matching `x-active-org-id`; the proxy's
 * `auth()` honours the Bearer, so the JWT stays the authority and the desync check
 * still fails closed. The page behind keeps its own org and keeps working.
 * Cleared the moment the modal closes or finishes.
 */
let activeOrgOverride: string | null = null;
export function setApiActiveOrgOverride(orgId: string | null): void {
  activeOrgOverride = orgId;
}

/**
 * The org the UI is currently rendering, parsed from the `/orgs/<id>/...` URL.
 * Client-side only. Sent to the proxy as `x-active-org-id` so the proxy can fail
 * closed (409 `org_desync`) when it disagrees with the Clerk session JWT — never
 * a silent cross-org read/write. The JWT remains the org authority server-side.
 */
function activeOrgIdFromPath(): string | null {
  if (typeof window === "undefined") return null;
  if (activeOrgOverride) return activeOrgOverride;
  const match = window.location.pathname.match(/\/orgs\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * This tab's Clerk session token (per-tab active org), via the global `window.Clerk`
 * client — NOT a React hook, so it works from the plain `apiCall` function. Each
 * browser tab has its own `window.Clerk` with its own in-memory active org, so the
 * minted token carries the org THIS tab is viewing, regardless of which tab last
 * wrote the shared session cookie. Returns null on the server, before Clerk loads,
 * or when signed out → caller omits the Authorization header and falls back to the
 * cookie. Cached by Clerk (re-mints only near expiry), so per-request cost is low.
 */
async function getTabSessionToken(forceRefresh = false): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const clerk = (
    window as unknown as {
      Clerk?: {
        session?: {
          getToken: (opts?: { skipCache?: boolean; organizationId?: string }) => Promise<string | null>;
        } | null;
      };
    }
  ).Clerk;
  try {
    // `getToken()` is CACHED by Clerk, and the cached token carries the org claim
    // it was minted with. So a retry after an org-desync 409 that re-sends the
    // cached token re-sends the STALE org and 409s again, deterministically —
    // the retry was a no-op for the one case it exists to fix. `skipCache` mints
    // a fresh token carrying this tab's current active org.
    // A flow acting on an org the session has not switched to asks for a token FOR it.
    if (activeOrgOverride) {
      return (
        (await clerk?.session?.getToken({
          organizationId: activeOrgOverride,
          ...(forceRefresh ? { skipCache: true } : {}),
        })) ?? null
      );
    }
    return (await clerk?.session?.getToken(forceRefresh ? { skipCache: true } : undefined)) ?? null;
  } catch {
    return null;
  }
}

/**
 * Backoff between org-desync retries. Three attempts, not one: a switch has to
 * get through `setActive` → Clerk's token endpoint → the cookie before the JWT's
 * org claim matches the URL, and on a slow connection that is comfortably longer
 * than half a second. Every attempt re-mints (see `getTabSessionToken`), so each
 * one asks a genuinely different question.
 */
const ORG_DESYNC_BACKOFF_MS = [400, 900, 2000] as const;

async function apiCall<T>(endpoint: string, options?: ApiOptions): Promise<T> {
  const {
    token,
    method = "GET",
    body,
    headers: extraHeaders,
    suppressPaymentRequired,
    responseType = "json",
  } = options ?? {};

  const send = async (forceFreshToken = false): Promise<Response> => {
    const headers: Record<string, string> = { "Content-Type": "application/json", ...extraHeaders };
    let url: string;

    if (token) {
      url = `${API_URL}/v1${endpoint}`;
      headers["X-API-Key"] = token;
    } else {
      // WHICH PROXY CARRIES THIS CALL — and a Clerk session outranks the
      // anonymous flag, always.
      //
      // The build half of onboarding runs before signup, against an org whose
      // external id is `anon_<uuid>` instead of a Clerk org id. That org is an
      // ordinary org everywhere downstream, so every helper in this file works
      // unchanged — the only difference is which proxy carries the call, and
      // that is decided here rather than at ~40 call sites.
      //
      // Per-tab org-scoped auth (Clerk multi-tab guidance). The Clerk session
      // COOKIE is a global singleton for the whole browser — it reflects whichever
      // tab was focused LAST, so the proxy's cookie-based `auth()` would scope a
      // background poll / navigation from a NON-focused tab to the WRONG org
      // (cross-org bleed + 409 desync churn + the visible "org switches by itself"
      // across tabs). `window.Clerk` is PER-TAB, so `session.getToken()` returns
      // THIS tab's active-org token; Clerk's `auth()` honors an Authorization
      // Bearer over the cookie, giving the proxy the correct per-tab org.
      // (Clerk docs: "Organizations → multiple browser tabs" + "Making
      // authenticated requests".) Read with `?.`: before Clerk loads, or with no
      // session, it answers null and the cookie carries the call instead (and
      // checkProxyOrg still fails closed).
      //
      // ⚠️ READ THE TOKEN FIRST. The flag is a ROUTING HINT FOR A BROWSER WITH
      // NO ACCOUNT, so it may only break the tie when there is no session at all.
      // It used to be checked BEFORE this, on the reasoning that
      // `getTabSessionToken` returns null while signed out and the authed proxy
      // answers 401 — true for a signed-out visitor, and wrong for a signed-in
      // one. The flag lives 24 hours and only `/sign-up` clears it (through the
      // claim), so somebody who started the signed-out setup, abandoned it and
      // then SIGNED IN kept it — and EVERY call in their dashboard was routed to
      // the anonymous proxy, whose allowlist is closed, and answered
      // `403 Not available`. Nothing looked broken, which is what made it
      // expensive: the local-first cache paints the previous visit from disk, so
      // the whole dashboard read as healthy on stale numbers and the only control
      // that reported anything was the leads export, which has no cache to fall
      // back on. Reading the token first costs a signed-out visitor nothing —
      // `window.Clerk.session` is null for them, so this returns null with no
      // request and the anonymous branch is taken exactly as before.
      const tabToken = await getTabSessionToken(forceFreshToken);

      if (
        !tabToken &&
        typeof document !== "undefined" &&
        browserHasAnonSession(document.cookie)
      ) {
        // No Authorization header: there is no Clerk session to mint one from.
        // The anonymous proxy reads a SIGNED httpOnly cookie the browser cannot
        // forge, checks the call against a closed allowlist, and forwards under
        // the session's own org. This flag cookie carries no authority of its own.
        url = `/api/anon/v1${endpoint}`;
      } else {
        url = `/api/v1${endpoint}`;
        const activeOrgId = activeOrgIdFromPath();
        if (activeOrgId) headers["x-active-org-id"] = activeOrgId;
        if (tabToken) headers["Authorization"] = `Bearer ${tabToken}`;
      }
    }

    return fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  };

  let response = await send();

  // Org-switch rotation lag: the proxy refused because the session JWT hadn't
  // caught up with the UI's org yet. Wait for Clerk to settle, then retry with a
  // FRESHLY MINTED token — the cached one carries the org claim that was just
  // refused, so re-sending it is guaranteed to be refused again. Proxy-routed
  // calls only. Give up after the backoff table and let the 409 surface: a
  // desync that outlives ~3s is not rotation lag, it is Clerk being unreachable,
  // and every surface fails visibly rather than skeletoning forever.
  if (!token) {
    for (let attempt = 0; attempt < ORG_DESYNC_BACKOFF_MS.length; attempt++) {
      if (response.status !== ORG_DESYNC_STATUS) break;
      const peek = await response.clone().json().catch(() => null);
      if (peek?.error !== ORG_DESYNC_ERROR) break;
      await new Promise((resolve) => setTimeout(resolve, ORG_DESYNC_BACKOFF_MS[attempt]));
      response = await send(true);
    }
  }

  if (!response.ok) {
    const errorBody = asErrorBody(await readJsonResponse(response, endpoint));
    if (response.status === 402 && !suppressPaymentRequired && typeof window !== "undefined") {
      const { dispatchPaymentRequired } = await import("@/lib/billing-guard");
      dispatchPaymentRequired({
        balance_cents: stringOrNumber(errorBody.balance_cents),
        required_cents: stringOrNumber(errorBody.required_cents),
        error: stringOrUndefined(errorBody.error),
      });
    }
    throw new ApiError(
      stringOrUndefined(errorBody.error) ?? stringOrUndefined(errorBody.message) ?? "Request failed",
      response.status,
      errorBody
    );
  }

  if (responseType === "text") return (await response.text()) as T;
  return await readJsonResponse(response, endpoint) as T;
}

// Types
export interface UserInfo {
  userId: string;
  orgId: string;
  authType: "user_key" | "admin";
}

export interface ApiKey {
  id: string;
  keyPrefix: string;
  name: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface NewApiKey {
  id: string;
  key: string; // Full key, only shown once
  keyPrefix: string;
  name: string | null;
  message: string;
}

export interface ByokKey {
  provider: string;
  maskedKey: string;
  createdAt: string;
  updatedAt: string;
}

// User/Org info
export async function getMe(token?: string): Promise<UserInfo> {
  return apiCall<UserInfo>("/me", { token });
}

// API Keys
export async function listApiKeys(token?: string): Promise<{ keys: ApiKey[] }> {
  return apiCall<{ keys: ApiKey[] }>("/api-keys", { token });
}

export async function createApiKey(name?: string, token?: string): Promise<NewApiKey> {
  return apiCall<NewApiKey>("/api-keys", { token, method: "POST", body: { name } });
}

export async function deleteApiKey(id: string, token?: string): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`/api-keys/${id}`, { token, method: "DELETE" });
}

// BYOK Keys
export async function listByokKeys(token?: string): Promise<{ keys: ByokKey[] }> {
  return apiCall<{ keys: ByokKey[] }>("/keys", { token });
}

export async function setByokKey(
  provider: string,
  apiKey: string,
  token?: string
): Promise<{ provider: string; maskedKey: string }> {
  return apiCall<{ provider: string; maskedKey: string }>("/keys", {
    token,
    method: "POST",
    body: { provider, apiKey },
  });
}

export async function deleteByokKey(
  provider: string,
  token?: string
): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`/keys/${provider}`, {
    token,
    method: "DELETE",
  });
}

// ==================== BRAND-SCOPED THIRD-PARTY CREDENTIALS ====================
//
// A credential the CUSTOMER holds for a third-party account, stored against ONE
// brand. Distinct grain from the org-wide BYOK keys directly above, and the two
// never substitute for each other: one agency org holds many brands, each a
// different end client with their own account, so two brands of one org need two
// different credentials for the same provider. key-service keys the upsert on
// (org, brand, provider) and 404s an absent brand credential rather than quietly
// resolving the org-wide one.
//
// The decrypted value is service-to-service only and is deliberately NOT proxied
// to the browser — a backend that needs the credential resolves it itself. Here we
// only ever write it and read it back MASKED.

const BrandKeySchema = z.object({
  provider: z.string(),
  maskedKey: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type BrandKey = z.infer<typeof BrandKeySchema>;

const ListBrandKeysResponseSchema = z.object({
  brandId: z.string(),
  keys: z.array(BrandKeySchema),
});

const SetBrandKeyResponseSchema = z.object({
  brandId: z.string(),
  provider: z.string(),
  maskedKey: z.string(),
});

/** This brand's third-party credentials, masked. Never the org-wide ones. */
export async function listBrandKeys(
  brandId: string,
  token?: string,
): Promise<{ brandId: string; keys: BrandKey[] }> {
  const raw = await apiCall<unknown>(`/keys/brands/${brandId}`, { token });
  const parsed = ListBrandKeysResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[api] listBrandKeys response shape mismatch", parsed.error.flatten());
    throw new Error("listBrandKeys returned an unexpected shape");
  }
  return parsed.data;
}

/** Store or replace this brand's credential for one provider. */
export async function setBrandKey(
  brandId: string,
  provider: string,
  apiKey: string,
  token?: string,
): Promise<{ brandId: string; provider: string; maskedKey: string }> {
  const raw = await apiCall<unknown>(`/keys/brands/${brandId}`, {
    token,
    method: "POST",
    body: { provider, apiKey },
  });
  // The write response carries no timestamps, so it is parsed on its OWN schema
  // rather than the read one — a shared schema would fail every success.
  const parsed = SetBrandKeyResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[api] setBrandKey response shape mismatch", parsed.error.flatten());
    throw new Error("setBrandKey returned an unexpected shape");
  }
  return parsed.data;
}

/** Remove this brand's credential for one provider. Leaves every other brand's alone. */
export async function deleteBrandKey(
  brandId: string,
  provider: string,
  token?: string,
): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`/keys/brands/${brandId}/${provider}`, {
    token,
    method: "DELETE",
  });
}

// ==================== THE CLIENT'S OWN CRM (crm-service, GoHighLevel) ====================
//
// A brand connects the CRM it already runs on, and we mirror what is in it so the
// customer can read their own contacts and pipeline here. READ-ONLY end to end:
// no service between here and their CRM has a write path back to it, so nothing
// below sends them anything.
//
// The credential does NOT travel on these calls. It is stored once against the
// brand in key-service (see `setBrandKey` above) and crm-service resolves it
// itself, service-to-service. Connecting therefore states only WHICH account to
// read; crm-service proves the credential against the vendor before it writes a
// connection, and refuses with the vendor's own words when it cannot.

const CrmConnectionSchema = z.object({
  id: z.string(),
  brandId: z.string(),
  locationId: z.string(),
  // Read as a plain string, never a z.enum: the producer owns this vocabulary and
  // a reader that closes the set throws the whole page the day it grows.
  status: z.string(),
  synced: z.boolean(),
  lastSyncedAt: z.string().nullable(),
  lastError: z.string().nullable(),
  lastRunId: z.string().nullable(),
  createdAt: z.string(),
});

export type CrmConnection = z.infer<typeof CrmConnectionSchema>;

const ListCrmConnectionsResponseSchema = z.object({
  connections: z.array(CrmConnectionSchema),
});

/** This brand's CRM connection and its health. Empty when nothing is connected. */
export async function listCrmConnections(
  brandId: string,
  token?: string,
): Promise<{ connections: CrmConnection[] }> {
  const raw = await apiCall<unknown>(`/orgs/gohighlevel/connections?brandId=${brandId}`, { token });
  const parsed = ListCrmConnectionsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[api] listCrmConnections response shape mismatch", parsed.error.flatten());
    throw new Error("listCrmConnections returned an unexpected shape");
  }
  return parsed.data;
}

/**
 * Conversations: everyone the brand is in conversation with, every channel merged, one
 * state each (crm-service's gold person layer, gateway passthrough). Order, totals and
 * per-source counts are crm-service's. The first read for a brand starts its build and
 * answers `scope.status = "building"` with nobody in it yet.
 */
export async function listPeople(
  brandId: string,
  opts: { limit: number; offset: number },
  token?: string,
): Promise<PeopleList> {
  const qs = new URLSearchParams({ brandId, limit: String(opts.limit), offset: String(opts.offset) });
  const raw = await apiCall<unknown>(`/orgs/people?${qs.toString()}`, { token });
  const parsed = PeopleListSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[api] listPeople response shape mismatch", parsed.error.flatten());
    throw new Error("listPeople returned an unexpected shape");
  }
  return parsed.data;
}

/** One person's whole exchange, every channel merged, oldest first (read live from each source). */
export async function getPersonTimeline(brandId: string, personKey: string, token?: string): Promise<PersonTimeline> {
  const qs = new URLSearchParams({ brandId, personKey });
  const raw = await apiCall<unknown>(`/orgs/people/timeline?${qs.toString()}`, { token });
  const parsed = PersonTimelineSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[api] getPersonTimeline response shape mismatch", parsed.error.flatten());
    throw new Error("getPersonTimeline returned an unexpected shape");
  }
  return parsed.data;
}

/**
 * Connect this brand to the CRM account named by `locationId`.
 *
 * The credential must ALREADY be stored for this brand — crm-service resolves it
 * and proves it against the vendor before writing anything, so a wrong token or a
 * mismatched account is refused here rather than failing silently on the first
 * sync.
 *
 * ⚠️ `brandId` travels TWICE, in the query string AND in the body, and the query
 * copy is the load-bearing one. Do NOT delete it as a duplicate.
 *
 * The body copy is what crm-service's own handler reads to know which brand to
 * connect. The query copy is what the api-service gateway promotes to the
 * `x-brand-id` identity header, and it reads that from a header or a query param
 * ONLY, never from a body. crm-service opens its run from those headers BEFORE
 * its handler is reached, and runs-service refuses a run whose brand list is
 * present and empty — so with the body copy alone the run is refused, crm-service
 * fails loud with a 502, and the handler never runs. The customer then reads
 * "We could not reach your CRM just now" on a perfectly good token, because
 * nothing ever asked the vendor anything.
 *
 * This has now happened twice on this service: the CSV upload hit the identical
 * 400 and was fixed the same way (distribute.you#2968). crm-service owns the
 * durable fix; this is the half that makes the customer's button work.
 */
export async function connectCrm(
  brandId: string,
  locationId: string,
  token?: string,
): Promise<{ connection: CrmConnection }> {
  const raw = await apiCall<unknown>(
    `/orgs/gohighlevel/connections?brandId=${encodeURIComponent(brandId)}`,
    { token, method: "POST", body: { brandId, locationId } },
  );
  const parsed = z.object({ connection: CrmConnectionSchema }).safeParse(raw);
  if (!parsed.success) {
    console.error("[api] connectCrm response shape mismatch", parsed.error.flatten());
    throw new Error("connectCrm returned an unexpected shape");
  }
  return parsed.data;
}

/**
 * Stop syncing this connection, and drop what was mirrored with it.
 *
 * `brandId` rides the query string for the same reason the connect does, and it
 * is the ONLY place it can travel here: the connection is addressed by its own
 * id, so nothing else in the request names a brand.
 */
export async function disconnectCrm(
  connectionId: string,
  brandId: string,
  token?: string,
): Promise<{ disconnected: boolean; connectionId: string }> {
  return apiCall<{ disconnected: boolean; connectionId: string }>(
    `/orgs/gohighlevel/connections/${connectionId}?brandId=${encodeURIComponent(brandId)}`,
    { token, method: "DELETE" },
  );
}

// ==================== GMAIL (google-service), per organization ====================
//
// The mailbox is connected by a Google sign-in round trip google-service owns (see
// `lib/google-connect.ts`). Read-only Gmail scopes; nothing here sends mail.

const GoogleAccountSchema = z.object({
  email: z.string(),
  // A plain string: the producer owns this vocabulary ("active" | "gmail_unavailable" today).
  status: z.string(),
  gmailUnavailableReason: z.string().nullable(),
  connectedAt: z.string(),
});

export type GoogleAccount = z.infer<typeof GoogleAccountSchema>;

/** The org's connected mailboxes and their health. Empty when none. */
export async function listGoogleAccounts(token?: string): Promise<{ accounts: GoogleAccount[] }> {
  const raw = await apiCall<unknown>(`/orgs/google/accounts`, { token });
  const parsed = z.object({ accounts: z.array(GoogleAccountSchema) }).safeParse(raw);
  if (!parsed.success) {
    console.error("[api] listGoogleAccounts response shape mismatch", parsed.error.flatten());
    throw new Error("listGoogleAccounts returned an unexpected shape");
  }
  return parsed.data;
}

/** Start the Google sign-in; returns the URL to send the browser to. */
export async function startGoogleConnect(redirectUri: string, token?: string): Promise<{ url: string }> {
  const raw = await apiCall<unknown>(`/orgs/google/auth/start`, { token, method: "POST", body: { redirectUri } });
  const parsed = z.object({ url: z.string().url() }).safeParse(raw);
  if (!parsed.success) {
    console.error("[api] startGoogleConnect response shape mismatch", parsed.error.flatten());
    throw new Error("startGoogleConnect returned an unexpected shape");
  }
  return parsed.data;
}

/** Relay Google's code + state; google-service stores the mailbox and starts its sync. */
export async function finishGoogleConnect(
  code: string,
  state: string,
  token?: string,
): Promise<{ googleAccountEmail: string }> {
  const qs = new URLSearchParams({ code, state });
  const raw = await apiCall<unknown>(`/orgs/google/auth/callback?${qs.toString()}`, { token });
  const parsed = z.object({ googleAccountEmail: z.string() }).safeParse(raw);
  if (!parsed.success) {
    console.error("[api] finishGoogleConnect response shape mismatch", parsed.error.flatten());
    throw new Error("finishGoogleConnect returned an unexpected shape");
  }
  return parsed.data;
}

/** Disconnect a mailbox: stops the sync, drops its mirror, revokes the grant at Google. */
export async function disconnectGoogleAccount(email: string, token?: string): Promise<unknown> {
  return apiCall<unknown>(`/orgs/google/accounts/${encodeURIComponent(email)}`, { token, method: "DELETE" });
}

// ==================== MESSAGING APPS (crm-service Matrix bridges), per brand ====================
//
// Self-serve linking: crm-service creates the brand's own bridge account and runs the
// vendor's login (WhatsApp: a QR to scan, or a pairing code for a phone number). The
// browser only ever sees that QR / code. Read-only: nothing is sent on the account.
// `brandId` rides the query string on every call (the gateway reads identity from
// query / headers only, never a body).

const MatrixLinkSchema = z.object({
  // Plain strings: crm-service owns these vocabularies and adds channels.
  channel: z.string(),
  available: z.boolean(),
  unavailableReason: z.string().nullable(),
  methods: z.array(z.string()),
  status: z.string(),
  qr: z.object({ data: z.string(), imageDataUrl: z.string() }).nullable(),
  pairingCode: z.string().nullable(),
  instructions: z.string().nullable(),
  account: z.object({ id: z.string(), name: z.string().nullable() }).nullable(),
  bridgeState: z.object({ state: z.string().nullable(), reason: z.string().nullable() }).nullable(),
  error: z.object({ code: z.string(), message: z.string() }).nullable(),
});

export type MatrixLink = z.infer<typeof MatrixLinkSchema>;

/** Every messaging channel's link for this brand, with the CURRENT code while waiting. */
export async function listMatrixLinks(brandId: string, token?: string): Promise<{ links: MatrixLink[] }> {
  const raw = await apiCall<unknown>(`/orgs/matrix/links?brandId=${encodeURIComponent(brandId)}`, { token });
  const parsed = z.object({ links: z.array(MatrixLinkSchema) }).safeParse(raw);
  if (!parsed.success) {
    console.error("[api] listMatrixLinks response shape mismatch", parsed.error.flatten());
    throw new Error("listMatrixLinks returned an unexpected shape");
  }
  return parsed.data;
}

/** Start linking `channel`: answers with the first QR, or the pairing code for `phoneNumber`. */
export async function startMatrixLink(
  brandId: string,
  channel: string,
  method: "qr" | "phone",
  phoneNumber?: string,
  token?: string,
): Promise<{ link: MatrixLink }> {
  const raw = await apiCall<unknown>(`/orgs/matrix/links?brandId=${encodeURIComponent(brandId)}`, {
    token,
    method: "POST",
    body: { brandId, channel, method, ...(phoneNumber ? { phoneNumber } : {}) },
  });
  const parsed = z.object({ link: MatrixLinkSchema }).safeParse(raw);
  if (!parsed.success) {
    console.error("[api] startMatrixLink response shape mismatch", parsed.error.flatten());
    throw new Error("startMatrixLink returned an unexpected shape");
  }
  return parsed.data;
}

/** Unlink: logs the bridge out, stops syncing, drops what was mirrored. */
export async function unlinkMatrixLink(brandId: string, channel: string, token?: string): Promise<unknown> {
  return apiCall<unknown>(
    `/orgs/matrix/links/${encodeURIComponent(channel)}?brandId=${encodeURIComponent(brandId)}`,
    { token, method: "DELETE" },
  );
}

// ==================== POSTHOG + STRIPE, read-only sources of Conversations ====================
//
// Same two-write connect as GoHighLevel: the credential goes to key-service under the
// brand (`setBrandKey(brandId, "posthog" | "stripe", key)`), then crm-service proves it
// against the vendor and writes the connection, or refuses in the vendor's own words.
// `brandId` rides the query string on every call for the same gateway reason as
// `connectCrm` above (identity is promoted from headers / query only, never a body).

export type SourceSlug = "posthog" | "stripe";

const SourceConnectionSchema = z.object({
  id: z.string(),
  brandId: z.string(),
  // A plain string: the producer owns this vocabulary.
  status: z.string(),
  synced: z.boolean(),
  lastSyncedAt: z.string().nullable(),
  lastError: z.string().nullable(),
  createdAt: z.string(),
});

export type SourceConnection = z.infer<typeof SourceConnectionSchema>;

/** This brand's connection to `source` and its health. Empty when nothing is connected. */
export async function listSourceConnections(
  source: SourceSlug,
  brandId: string,
  token?: string,
): Promise<{ connections: SourceConnection[] }> {
  const raw = await apiCall<unknown>(`/orgs/${source}/connections?brandId=${encodeURIComponent(brandId)}`, { token });
  const parsed = z.object({ connections: z.array(SourceConnectionSchema) }).safeParse(raw);
  if (!parsed.success) {
    console.error("[api] listSourceConnections response shape mismatch", source, parsed.error.flatten());
    throw new Error("listSourceConnections returned an unexpected shape");
  }
  return parsed.data;
}

/**
 * Connect `source` for this brand. The credential must ALREADY be stored; `fields`
 * is what names the account (PostHog: projectId + region; Stripe: nothing, the
 * restricted key is bound to its account).
 */
export async function connectSource(
  source: SourceSlug,
  brandId: string,
  fields: Record<string, string>,
  token?: string,
): Promise<{ connection: SourceConnection }> {
  const raw = await apiCall<unknown>(`/orgs/${source}/connections?brandId=${encodeURIComponent(brandId)}`, {
    token,
    method: "POST",
    body: { brandId, ...fields },
  });
  const parsed = z.object({ connection: SourceConnectionSchema }).safeParse(raw);
  if (!parsed.success) {
    console.error("[api] connectSource response shape mismatch", source, parsed.error.flatten());
    throw new Error("connectSource returned an unexpected shape");
  }
  return parsed.data;
}

/** Stop syncing this connection and drop what was mirrored with it. */
export async function disconnectSource(
  source: SourceSlug,
  connectionId: string,
  brandId: string,
  token?: string,
): Promise<unknown> {
  return apiCall<unknown>(
    `/orgs/${source}/connections/${connectionId}?brandId=${encodeURIComponent(brandId)}`,
    { token, method: "DELETE" },
  );
}

// The three groups are crm-service's own grouping and it always emits them, so
// they are REQUIRED here with nullable leaves — a field their CRM does not hold
// reads null, which is a different statement from a group we failed to parse.
// `.optional()` would read `undefined` for ever on a rename and blank the whole
// surface silently; required fails the parse loudly instead.
const CrmContactSchema = z.object({
  id: z.string(),
  externalId: z.string(),
  primaryEmail: z.string().nullable(),
  phoneE164: z.string().nullable(),
  fullName: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  unsubscribed: z.boolean(),
  lastRebuiltAt: z.string().nullable(),
  company: z.object({
    name: z.string().nullable(),
    website: z.string().nullable(),
  }),
  location: z.object({
    city: z.string().nullable(),
    stateRegion: z.string().nullable(),
    country: z.string().nullable(),
    postalCode: z.string().nullable(),
    streetAddress: z.string().nullable(),
  }),
  record: z.object({
    type: z.string().nullable(),
    leadSource: z.string().nullable(),
    // Every tag in production is a string, over all 2,694 mirrored contacts.
    tags: z.array(z.string()).nullable(),
    createdAt: z.string().nullable(),
    updatedAt: z.string().nullable(),
    origin: z.object({
      medium: z.string().nullable(),
      url: z.string().nullable(),
      referrer: z.string().nullable(),
    }),
  }),
});

/** This brand's contacts, as mirrored out of their own CRM. */
export async function listCrmContacts(
  brandId: string,
  opts: { limit?: number; offset?: number } = {},
  token?: string,
): Promise<{ contacts: z.infer<typeof CrmContactSchema>[] }> {
  const q = new URLSearchParams({ brandId });
  if (opts.limit != null) q.set("limit", String(opts.limit));
  if (opts.offset != null) q.set("offset", String(opts.offset));
  const raw = await apiCall<unknown>(`/orgs/gohighlevel/contacts?${q}`, { token });
  const parsed = z.object({ contacts: z.array(CrmContactSchema) }).safeParse(raw);
  if (!parsed.success) {
    console.error("[api] listCrmContacts response shape mismatch", parsed.error.flatten());
    throw new Error("listCrmContacts returned an unexpected shape");
  }
  return parsed.data;
}

// The pipeline arrives ALREADY GROUPED, with the per-stage and per-pipeline
// count and total computed by crm-service. Read them; do not regroup, recount or
// re-sum here — that would be a second answer to a question already answered,
// and the two would drift the first time either side changed.
const CrmOpportunitySchema = z.object({
  id: z.string(),
  externalId: z.string(),
  name: z.string(),
  status: z.string().nullable(),
  /** Whole-currency amount as a numeric string. No currency code is mirrored. */
  monetaryValue: z.string().nullable(),
  contactName: z.string().nullable(),
  contactEmail: z.string().nullable(),
});

const CrmStageSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  position: z.number().nullable(),
  count: z.number(),
  totalValue: z.string(),
  opportunities: z.array(CrmOpportunitySchema),
});

const CrmPipelineReadSchema = z.object({
  pipelines: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      count: z.number(),
      totalValue: z.string(),
      stages: z.array(CrmStageSchema),
    }),
  ),
  /** Deals their system placed in a pipeline we have not mirrored, or in none. */
  ungrouped: z.array(CrmOpportunitySchema),
  totalOpportunities: z.number(),
});

/** This brand's pipeline, grouped the way their own CRM groups it. */
export async function getCrmPipeline(
  brandId: string,
  token?: string,
): Promise<z.infer<typeof CrmPipelineReadSchema>> {
  const raw = await apiCall<unknown>(`/orgs/gohighlevel/opportunities?brandId=${brandId}`, { token });
  const parsed = CrmPipelineReadSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[api] getCrmPipeline response shape mismatch", parsed.error.flatten());
    throw new Error("getCrmPipeline returned an unexpected shape");
  }
  return parsed.data;
}

// ==================== THE CLIENT'S CRM BESIDE OUR LEADS (lead-service) ======
//
// lead-service pairs each contact of the brand's mirrored CRM with the lead we
// emailed. The gateway reaches these through its `/v1/leads/*` passthrough (the
// two reads) and two dedicated proxies (the ruling write and its retraction).
// Parsed by `crm-pairings.ts`, which holds the schemas so they carry real tests.

/**
 * One page of the side-by-side view. Bounded by `limit` over THEIR contacts; the
 * view never holds a brand's lead population. `states` narrows to pairing states
 * server-side; `offset`/`nextOffset` stay positions in their contact list.
 */
export async function listCrmPairings(
  brandId: string,
  opts: { limit: number; offset: number; states?: string[] | null; toConfirm?: boolean },
  token?: string,
): Promise<CrmPairings> {
  const q = new URLSearchParams({ brandId, limit: String(opts.limit), offset: String(opts.offset) });
  if (opts.states?.length) q.set("state", opts.states.join(","));
  if (opts.toConfirm) q.set("toConfirm", "true");
  const raw = await apiCall<unknown>(`/leads/crm-pairings?${q}`, { token });
  const parsed = CrmPairingsSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[api] listCrmPairings response shape mismatch", parsed.error.flatten());
    throw new Error("listCrmPairings returned an unexpected shape");
  }
  return parsed.data;
}

/** The counts above the table. Stored state only; safe to poll. */
export async function getCrmPairingCounts(brandId: string, token?: string): Promise<CrmPairingCounts> {
  const raw = await apiCall<unknown>(
    `/leads/crm-pairing-counts?brandId=${encodeURIComponent(brandId)}`,
    { token },
  );
  const parsed = CrmPairingCountsSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[api] getCrmPairingCounts response shape mismatch", parsed.error.flatten());
    throw new Error("getCrmPairingCounts returned an unexpected shape");
  }
  return parsed.data;
}

/**
 * Where the brand's CRM contacts came from, counted by crm-service over the whole
 * mirrored population (lead source, origin medium, type, tags), verbatim.
 */
export async function getCrmContactOrigins(brandId: string, token?: string): Promise<CrmContactOrigins> {
  const raw = await apiCall<unknown>(
    `/orgs/gohighlevel/contacts/origins?brandId=${encodeURIComponent(brandId)}`,
    { token },
  );
  const parsed = CrmContactOriginsSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[api] getCrmContactOrigins response shape mismatch", parsed.error.flatten());
    throw new Error("getCrmContactOrigins returned an unexpected shape");
  }
  return parsed.data;
}

/** A person says whether a CRM contact and one of our leads are one human. */
export async function setCrmPairingRuling(
  body: {
    brandId: string;
    crmContactId: string;
    leadId: string;
    ruling: "accepted" | "rejected";
    note?: string | null;
  },
  token?: string,
): Promise<unknown> {
  return apiCall<unknown>("/leads/crm-pairings/rulings", { token, method: "POST", body });
}

/** Take a ruling back. Nothing is deleted upstream: the statement is marked withdrawn. */
export async function withdrawCrmPairingRuling(
  q: { brandId: string; crmContactId: string; leadId: string },
  token?: string,
): Promise<unknown> {
  const params = new URLSearchParams(q);
  return apiCall<unknown>(`/leads/crm-pairings/rulings?${params}`, { token, method: "DELETE" });
}

// Chat session history — restore the "Edit with AI" panel after a refresh.
// Gateway proxies GET /v1/chat/sessions/:sessionId → chat-service /sessions/:id.
// We only render `messages`; the schema stays tolerant of the other session
// metadata fields (org/brand/workflow) the endpoint returns.
const ChatHistoryToolCallSchema = z.object({
  name: z.string(),
  args: z.record(z.string(), z.unknown()),
  result: z.unknown().optional(),
});
const ChatHistoryMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "tool"]),
  content: z.string(),
  contentBlocks: z.array(z.unknown()).nullable(),
  toolCalls: z.array(ChatHistoryToolCallSchema).nullable(),
});
const ChatSessionHistorySchema = z.object({
  sessionId: z.string(),
  messages: z.array(ChatHistoryMessageSchema),
});
export type ChatSessionHistory = z.infer<typeof ChatSessionHistorySchema>;

export async function getChatSessionHistory(
  sessionId: string,
  token?: string,
): Promise<ChatSessionHistory> {
  const raw = await apiCall<unknown>(`/chat/sessions/${sessionId}`, { token });
  const parsed = ChatSessionHistorySchema.safeParse(raw);
  if (!parsed.success) {
    console.error("getChatSessionHistory: response shape mismatch", parsed.error, raw);
    throw new Error("Invalid chat session history response shape");
  }
  return parsed.data;
}

// Auth event notifications (signup/signin)
export async function sendAuthNotification(
  eventType: string,
  token?: string,
  extra?: Record<string, string>
): Promise<unknown> {
  return apiCall<unknown>("/emails/send", {
    token,
    method: "POST",
    body: { eventType, metadata: { timestamp: new Date().toISOString(), ...extra } },
  });
}

// Campaign email notifications (create/stop)
// User identity resolution
export async function resolveUser(
  params: {
    externalOrgId: string;
    externalUserId: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    imageUrl?: string;
  },
  token?: string
): Promise<{ orgId: string; userId: string }> {
  return apiCall<{ orgId: string; userId: string }>("/users/resolve", {
    token,
    method: "POST",
    body: params as unknown as Record<string, unknown>,
  });
}

// Campaigns
/**
 * The goal a campaign carries, forwarded VERBATIM from brand-service, so the
 * vocabulary here is brand-service's canonical set — the same one
 * `CANONICAL_GOALS` pins, which its own DB constrains. `purchase` rides along as
 * the pre-rename spelling of `websitePurchase`, exactly as on the brand wire.
 *
 * NULL on a campaign = inherit the brand goal.
 */
export type RuntimeGoal = CanonicalGoal | "purchase";

/**
 * Map a campaign's own goal onto this app's local brand-goal vocabulary, which is
 * what every goal-labelled surface speaks. Display-only.
 *
 * It delegates rather than re-deciding: the campaign goal and the brand goal are
 * the SAME vocabulary, so a second mapping here is a second place to go stale —
 * which is exactly what happened when a three-token copy printed the wrong outcome.
 * `normalizeBrandOptimizationGoal` is exhaustive and throws on an unmapped
 * spelling, so the next vocabulary the producer adds fails loud instead.
 */
export function optimizationGoalForRuntimeGoal(goal: RuntimeGoal): BrandOptimizationGoal {
  return normalizeBrandOptimizationGoal(goal);
}

export interface Campaign {
  id: string;
  name: string;
  status: string;
  workflowSlug: string | null;
  featureSlug: string | null;
  brandIds: string[];
  // Client-enriched via /v1/brands/by-ids. Raw api-service response no longer
  // carries this field since v0.42.2 (PR #469).
  brandUrls: string[];
  featureInputs: Record<string, string> | null;
  maxBudgetDailyUsd: string | null;
  maxBudgetWeeklyUsd: string | null;
  maxBudgetMonthlyUsd: string | null;
  maxBudgetTotalUsd: string | null;
  // Per-campaign config (v2, campaign-service). All nullable; NULL = inherit the
  // brand-level value (goal / active audience set / services / click destination).
  goal: RuntimeGoal | null;
  /**
   * The LEG this campaign is bought for — features-service's own canonical identifier,
   * carried verbatim by campaign-service. A campaign is (offer x leg x channel), so this
   * is what it buys. OPAQUE: resolve it through the leg catalogue (`lib/legs.ts`), never
   * by splitting it. Null only on a row older than the column.
   */
  legKey: string | null;
  /**
   * The OFFER this campaign sells. Nullable on the wire for a campaign created before
   * campaign-service carried the column; such a campaign belongs to no offer and is left
   * out of an offer-scoped list rather than guessed into one.
   */
  offerId: string | null;
  audienceIds: string[] | null;
  servicesOffered: string[] | null;
  clickDestinationUrl: string | null;
  endDate: string | null;
  toResumeAt: string | null;
  /**
   * WHY campaign-service stopped it: `manual` (a person), `org_teardown`, or
   * `payment_declined` (billing could not charge the org's card, and every start
   * is refused until the customer pays and fixes the card). Null on a running
   * campaign and on one stopped before the reason was recorded. Read as a plain
   * string: the vocabulary is campaign-service's and may grow.
   */
  stopReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CostByName {
  costName: string;
  totalCostInUsdCents: string;
  actualCostInUsdCents: string;
  provisionedCostInUsdCents: string;
  totalQuantity: string;
}

export interface RecipientStats {
  contacted: number;
  sent: number;
  delivered: number;
  bounced: number;
  clicked: number;
  unsubscribed: number;
  repliesPositive: number;
  repliesNegative: number;
  repliesNeutral: number;
  repliesAutoReply: number;
  repliesDetail: number;
}

export interface EmailStats {
  sent: number;
  delivered: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  stepStats: Record<string, number>;
}

export interface CampaignStats {
  campaignId: string;
  totalCostInUsdCents?: string | null;
  costBreakdown?: CostByName[];
  leadsServed: number;
  leadsBuffered: number;
  leadsSkipped: number;
  emailsGenerated: number;
  recipientStats: RecipientStats;
  emailStats: EmailStats;
}

// Raw campaign shape as returned by api-service ≥ v0.42.2 (no brandUrls).
type RawCampaign = Omit<Campaign, "brandUrls">;

/** Batch lookup of brands by UUID. Proxies api-service /v1/brands/by-ids,
 *  which itself proxies brand-service /internal/brands?ids=...
 *  Missing ids are silently omitted from the response; caller maps by id. */
export interface BrandSummary {
  id: string;
  url: string | null;
  name: string | null;
  domain: string | null;
  logoUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export async function getBrandsByIds(
  ids: string[],
  token?: string,
): Promise<{ brands: BrandSummary[] }> {
  if (ids.length === 0) return { brands: [] };
  const query = encodeURIComponent(ids.join(","));
  return apiCall<{ brands: BrandSummary[] }>(`/brands/by-ids?ids=${query}`, { token });
}

/** Attach brandUrls to each raw campaign by resolving brandIds via
 *  /v1/brands/by-ids in a single batched call. Missing ids are logged
 *  loudly and omitted from the resulting urls array. */
async function enrichCampaignsWithBrandUrls(
  rawCampaigns: RawCampaign[],
  token?: string,
): Promise<Campaign[]> {
  const allBrandIds = [...new Set(rawCampaigns.flatMap((c) => c.brandIds))];
  if (allBrandIds.length === 0) {
    return rawCampaigns.map((c) => ({ ...c, brandUrls: [] }));
  }
  const { brands } = await getBrandsByIds(allBrandIds, token);
  const brandById = new Map(brands.map((b) => [b.id, b]));
  return rawCampaigns.map((c) => {
    const brandUrls: string[] = [];
    for (const id of c.brandIds) {
      const brand = brandById.get(id);
      if (!brand) {
        console.error(
          `[dashboard] brand id ${id} missing from /v1/brands/by-ids response (campaign ${c.id})`,
        );
        continue;
      }
      if (brand.url) brandUrls.push(brand.url);
    }
    return { ...c, brandUrls };
  });
}

export interface BrandDeliveryStats {
  recipientStats: RecipientStats;
  emailStats: EmailStats;
}

export async function getBrandDeliveryStats(brandId: string, token?: string): Promise<BrandDeliveryStats> {
  return apiCall<BrandDeliveryStats>(`/email-gateway/stats?brandId=${brandId}`, { token });
}

export interface CostStatsGroup {
  dimensions: Record<string, string | null>;
  totalCostInUsdCents: string;
  actualCostInUsdCents: string;
  provisionedCostInUsdCents: string;
  cancelledCostInUsdCents: string;
  runCount: number;
}

export async function getBrandCostBreakdown(
  brandId: string,
  opts?: { featureSlug?: string; startedAfter?: string; startedBefore?: string },
  token?: string,
): Promise<{ costs: CostByName[] }> {
  const query = new URLSearchParams({ brandId, groupBy: "costName" });
  if (opts?.featureSlug) query.set("featureSlug", opts.featureSlug);
  if (opts?.startedAfter) query.set("startedAfter", opts.startedAfter);
  if (opts?.startedBefore) query.set("startedBefore", opts.startedBefore);
  const result = await apiCall<{ groups: CostStatsGroup[] }>(`/runs/stats/costs?${query}`, { token });
  const costs: CostByName[] = result.groups.map((g) => ({
    costName: g.dimensions.costName ?? "Unknown",
    totalCostInUsdCents: g.totalCostInUsdCents,
    actualCostInUsdCents: g.actualCostInUsdCents,
    provisionedCostInUsdCents: g.provisionedCostInUsdCents,
    totalQuantity: String(g.runCount),
  }));
  return { costs };
}

export interface FeatureCostGroup {
  featureSlug: string | null;
  totalCostInUsdCents: string;
  actualCostInUsdCents: string;
  provisionedCostInUsdCents: string;
  runCount: number;
}

export async function getBrandCostsByFeature(brandId: string, token?: string): Promise<{ groups: FeatureCostGroup[] }> {
  const query = new URLSearchParams({ brandId, groupBy: "featureSlug" });
  const result = await apiCall<{ groups: CostStatsGroup[] }>(`/runs/stats/costs?${query}`, { token });
  return {
    groups: result.groups.map((g) => ({
      featureSlug: g.dimensions.featureSlug ?? null,
      totalCostInUsdCents: g.totalCostInUsdCents,
      actualCostInUsdCents: g.actualCostInUsdCents,
      provisionedCostInUsdCents: g.provisionedCostInUsdCents,
      runCount: g.runCount,
    })),
  };
}

export interface BrandCostGroup {
  brandId: string | null;
  totalCostInUsdCents: string;
  actualCostInUsdCents: string;
  provisionedCostInUsdCents: string;
  runCount: number;
}

export async function getOrgCostsByBrand(token?: string): Promise<{ groups: BrandCostGroup[] }> {
  const query = new URLSearchParams({ groupBy: "brandId" });
  const result = await apiCall<{ groups: CostStatsGroup[] }>(`/runs/stats/costs?${query}`, { token });
  return {
    groups: result.groups.map((g) => ({
      brandId: g.dimensions.brandId ?? null,
      totalCostInUsdCents: g.totalCostInUsdCents,
      actualCostInUsdCents: g.actualCostInUsdCents,
      provisionedCostInUsdCents: g.provisionedCostInUsdCents,
      runCount: g.runCount,
    })),
  };
}

export async function getOrgCostBreakdown(token?: string): Promise<{ costs: CostByName[] }> {
  const query = new URLSearchParams({ groupBy: "costName" });
  const result = await apiCall<{ groups: CostStatsGroup[] }>(`/runs/stats/costs?${query}`, { token });
  const costs: CostByName[] = result.groups.map((g) => ({
    costName: g.dimensions.costName ?? "Unknown",
    totalCostInUsdCents: g.totalCostInUsdCents,
    actualCostInUsdCents: g.actualCostInUsdCents,
    provisionedCostInUsdCents: g.provisionedCostInUsdCents,
    totalQuantity: String(g.runCount),
  }));
  return { costs };
}

// Platform price catalog — authoritative `costName -> providerDomain` mapping.
// Public, no auth. Used to show a provider logo next to each cost label.
export interface PlatformPrice {
  name: string;
  provider: string;
  providerDomain: string | null;
}

const PlatformPriceSchema = z.object({
  name: z.string(),
  provider: z.string(),
  // Null in prod on the sponsorship spend items: a strict string rejected the whole catalogue.
  providerDomain: z.string().nullable(),
});
const PlatformPricesResponseSchema = z.array(PlatformPriceSchema);

export async function getPlatformPrices(token?: string): Promise<PlatformPrice[]> {
  const raw = await apiCall<unknown>(`/costs/platform-prices`, { token });
  const parsed = PlatformPricesResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(
      "[dashboard] getPlatformPrices: response shape mismatch",
      { issues: parsed.error.issues, raw },
    );
    throw new Error("[dashboard] getPlatformPrices: invalid response shape");
  }
  return parsed.data;
}

// Staff Monitoring — fleet-wide cost, price, margin and emails, since inception. Every path is a
// staff-only gateway route (api-service `requireStaff`: platform key + a staff `x-email`, which
// the /api/v1 proxy forwards from the verified session), so a non-staff caller gets a 403 and
// no figure. Schemas and the reasons behind them: lib/monitoring/monitoring.ts.
export const STAFF_MONITORING_PATHS = {
  margin: "/runs/stats/costs/margin",
  priceVersions: "/costs/vendor-costs",
  emails: "/instantly/stats",
  marginTimeseries: "/runs/stats/costs/margin/timeseries",
  providerSources: "/costs/provider-payment-sources",
  sentPerPeriod: "/instantly/ops/sent-per-period",
  emailSendPrice: "/costs/email-send-price",
  subscriptionCosts: "/costs/subscription-costs",
  realCosts: "/costs/real-costs",
  priceComparison: "/costs/price-comparison",
  brands: "/admin/brands",
} as const;

function parseStaff<T>(name: string, schema: z.ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[dashboard] ${name}: response shape mismatch`, { issues: parsed.error.issues, raw });
    throw new Error(`[dashboard] ${name}: invalid response shape`);
  }
  return parsed.data;
}

export async function getStaffCostMargin(): Promise<CostMargin> {
  return parseStaff("getStaffCostMargin", CostMarginSchema, await apiCall<unknown>(STAFF_MONITORING_PATHS.margin));
}

export async function getStaffPriceVersions(): Promise<PriceVersion[]> {
  return parseStaff("getStaffPriceVersions", PriceVersionsSchema, await apiCall<unknown>(STAFF_MONITORING_PATHS.priceVersions)).versions;
}

/** The public catalogue's price in force now per cost item, with its unit price (the logo reader above drops it). */
export async function getStaffCurrentPrices(): Promise<CurrentPrice[]> {
  return parseStaff("getStaffCurrentPrices", CurrentPricesSchema, await apiCall<unknown>(`/costs/platform-prices`));
}

export async function getStaffEmailsSent(): Promise<{ emails: number; people: number }> {
  const s = parseStaff("getStaffEmailsSent", FleetEmailStatsSchema, await apiCall<unknown>(STAFF_MONITORING_PATHS.emails));
  return { emails: s.emailStats.sent, people: s.recipientStats.sent };
}

// Per provider per month (runs-service) and the accounts paying each vendor (costs-service).
export async function getStaffMarginTimeseries(): Promise<MarginTimeseries> {
  return parseStaff("getStaffMarginTimeseries", MarginTimeseriesSchema, await apiCall<unknown>(STAFF_MONITORING_PATHS.marginTimeseries));
}

/** Emails sent per day/week/month by purpose (instantly-service), to leads apart from our own mail. */
export async function getStaffSentPerPeriod(grain: SentGrain): Promise<SentPerPeriod> {
  return parseStaff("getStaffSentPerPeriod", SentPerPeriodSchema, await apiCall<unknown>(`${STAFF_MONITORING_PATHS.sentPerPeriod}?grain=${grain}`));
}

export async function getStaffProviderSources(): Promise<ProviderSourcesRow[]> {
  return parseStaff("getStaffProviderSources", ProviderSourcesListSchema, await apiCall<unknown>(STAFF_MONITORING_PATHS.providerSources)).providers;
}

/** The price of one cold email sent to a lead, per day since the first payment (costs-service, daily). */
export async function getStaffEmailSendPrice(): Promise<EmailSendPrice> {
  return parseStaff("getStaffEmailSendPrice", EmailSendPriceSchema, await apiCall<unknown>(STAFF_MONITORING_PATHS.emailSendPrice));
}

/** The real cost per credit of each vendor subscription, per day since 2026-01-01 (costs-service, daily). */
export async function getStaffSubscriptionCosts(): Promise<SubscriptionCosts> {
  return parseStaff("getStaffSubscriptionCosts", SubscriptionCostsSchema, await apiCall<unknown>(STAFF_MONITORING_PATHS.subscriptionCosts));
}

/** Every cost item's real cost and proposed price on a day (latest when omitted), costs-service, daily. */
export async function getStaffRealCosts(day: string | null): Promise<RealCosts> {
  const q = day ? `?day=${encodeURIComponent(day)}` : "";
  return parseStaff("getStaffRealCosts", RealCostsSchema, await apiCall<unknown>(`${STAFF_MONITORING_PATHS.realCosts}${q}`));
}

/** Which cost items are priced on an average and which at list cost, fleet-wide (costs-service). */
export async function getStaffBasisSummary(day: string | null): Promise<BasisSummary> {
  const q = day ? `?day=${encodeURIComponent(day)}` : "";
  return parseStaff("getStaffBasisSummary", BasisSummarySchema, await apiCall<unknown>(`${STAFF_MONITORING_PATHS.realCosts}/basis-summary${q}`));
}

/** One cost item's real cost, catalogue price and proposed price per day. */
export async function getStaffRealCostSeries(costName: string): Promise<RealCostSeries> {
  return parseStaff("getStaffRealCostSeries", RealCostSeriesSchema, await apiCall<unknown>(`${STAFF_MONITORING_PATHS.realCosts}/${encodeURIComponent(costName)}`));
}

export interface PriceListRef {
  source: PriceSource;
  date: string;
}

/** A perimeter's consumption since inception replayed under two dated price lists (costs-service). */
export async function getStaffPriceComparison(args: { list1: PriceListRef; list2: PriceListRef; orgId: string | null; brandId: string | null; interval: ComparisonInterval }): Promise<PriceComparison> {
  const q = new URLSearchParams({ list1: `${args.list1.source}:${args.list1.date}`, list2: `${args.list2.source}:${args.list2.date}`, interval: args.interval });
  if (args.orgId) q.set("orgId", args.orgId);
  if (args.brandId) q.set("brandId", args.brandId);
  return parseStaff("getStaffPriceComparison", PriceComparisonSchema, await apiCall<unknown>(`${STAFF_MONITORING_PATHS.priceComparison}?${q.toString()}`));
}

/** Every brand of every org (staff), to name the comparison's org and brand ids. */
export async function getStaffBrands(): Promise<StaffBrand[]> {
  return parseStaff("getStaffBrands", StaffBrandsSchema, await apiCall<unknown>(STAFF_MONITORING_PATHS.brands)).brands;
}

// Brands
export interface Brand {
  id: string;
  domain: string | null;
  name: string | null;
  url: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  logoUrl: string | null;
  // The page outreach clicks should land on (user-chosen in onboarding / Brand
  // Settings). null = never set → consumers fall back to the brand domain.
  // Optional on the wire so the dashboard ships ahead of the brand-service field
  // (additive rollout) — absent reads as undefined, present populates.
  clickDestinationUrl?: string | null;
  // The brand's own colours, read off logo.dev by brand-service. Optional for
  // the same additive-rollout reason: the dashboard renders the charter blue
  // until the producer ships the field, and for every brand logo.dev has not
  // indexed after it does. `BrandTint` decides whether any of them is a usable
  // accent — a palette is often three neutrals, so having colours is NOT having
  // a tint. Never read `colors[0]` as "the brand colour": the dominant colour
  // of a logo is usually its background.
  colors?: (string | { hex?: unknown })[] | null;
}

export type BrandDetail = Brand;

// brand-service /orgs/brands still emits `brandUrl`; /internal/brands/:id and
// /internal/brands?ids= emit `url`. Normalize at the client boundary.
interface BrandWireOrgs {
  id: string;
  domain: string | null;
  name: string | null;
  brandUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  logoUrl: string | null;
  colors?: (string | { hex?: unknown })[] | null;
}

function normalizeBrandFromOrgs(raw: BrandWireOrgs): Brand {
  const { brandUrl, ...rest } = raw;
  return { ...rest, url: brandUrl };
}

export async function listBrands(token?: string): Promise<{ brands: Brand[] }> {
  const { brands } = await apiCall<{ brands: BrandWireOrgs[] }>("/brands", { token });
  return { brands: brands.map(normalizeBrandFromOrgs) };
}

/** GET /brands/:brandId — returns brand detail or null if not found (404) */
export async function getBrand(brandId: string, token?: string): Promise<{ brand: BrandDetail } | null> {
  try {
    return await apiCall<{ brand: BrandDetail }>(`/brands/${brandId}`, { token });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

// ── Brand sales conversion economics ──
// Persisted per brand in brand-service via api-service /v1/brands/:id/sales-economics.
// READ returns the saved set or null (unset → the page uses its hard-coded defaults).
// WRITE is an idempotent full-set upsert that returns the saved row (never null).
// Conversion rates are numeric percents (0–100, decimals allowed);
// lifetimeRevenueUsd is whole US dollars.
// businessModel (b2c | b2b | null) is part of the saved set: it picks which path
// the revenue-overview pipeline applies. Both GET and PUT responses always include it.
export type BrandBusinessModel = "b2c" | "b2b";

// The single metric the brand wants to optimise for. Server default
// "sales_meetings" when never set; GET/PUT responses always include a non-null value.
// website_visits / positive_replies are the two beta single-step goals (visit→paid,
// reply→paid) — their wire values match the local names 1:1 (no rename).
// website_purchase = the RENAMED former `purchase` goal (multi-step self-serve close);
// sales = the beta COMBINED goal (a paying client won via EITHER the visit→paid OR the
// reply→paid path, valued at CLTV). Both terminate in a `sale`.
export type BrandOptimizationGoal =
  | "signups"
  | "sales_meetings"
  | "website_visits"
  | "positive_replies"
  | "form_submissions"
  | "website_purchase"
  | "sales";
/**
 * The ONE goal vocabulary the fleet is converging on — camelCase runtime tokens,
 * owned by brand-service (it owns what a brand declares).
 *
 * Three lists describe these same goals today and each carries translation layers
 * for the other two: brand-service's `CurrentGoal` (camelCase) beside its own
 * `LegacyOptimizationGoal` (snake, and named "legacy" in its own source),
 * features-service's `Goal` (camelCase), and this file's `BrandOptimizationGoal`
 * (snake). They do not agree — `websitePurchase` is `purchase` in one of them, and
 * the bare token `sales` means WEBSITE PURCHASE to brand-service while it means
 * COMBINED sales here and in features-service. That collision is not theoretical:
 * it put every website-purchase brand in the combined-sales bucket of the fleet
 * benchmark (distribute.you#3214).
 *
 * This list is the target. It is pinned by `tests/goal-vocabulary.test.ts` so the
 * three lists cannot drift further apart while the migration is in flight.
 */
export const CANONICAL_GOALS = [
  "signup",
  "meetingBooked",
  "websitePurchase",
  "combinedSales",
  "websiteVisit",
  "positiveReply",
  "formSubmission",
  "whatsappConversation",
] as const;

export type CanonicalGoal = (typeof CANONICAL_GOALS)[number];

/**
 * Every spelling this app may receive for a brand's optimization goal: its own
 * local snake vocabulary, brand-service's current wire spellings, and the
 * canonical camelCase tokens above.
 *
 * The canonical tokens are here AHEAD of brand-service emitting them. That is the
 * point: brand-service switching its emission is a breaking change for any
 * consumer that cannot already read the new spelling, so the dashboard learns to
 * read both BEFORE the producer flips. Reading a spelling nobody sends yet costs
 * nothing; failing to parse the day it arrives takes down every economics surface.
 */
type BrandOptimizationGoalWire =
  | BrandOptimizationGoal
  | "booked_meetings"
  | "combined_sales"
  | "purchase"
  | CanonicalGoal;

/**
 * Collapse any wire spelling onto this app's local goal vocabulary.
 *
 * `whatsappConversation` is deliberately ABSENT from the return type: no brand
 * carries that goal today and adding it here would mean adding a member to
 * `BrandOptimizationGoal`, which several exhaustive `Record`s key on. It is a
 * separate change, and the schema union below does not accept it either — so a
 * whatsapp brand fails LOUD at parse rather than reading as a sales meeting.
 */
export function normalizeBrandOptimizationGoal(
  goal: BrandOptimizationGoalWire,
): BrandOptimizationGoal {
  switch (goal) {
    case "signups":
    case "signup":
      return "signups";
    case "website_visits":
    case "websiteVisit":
      return "website_visits";
    case "positive_replies":
    case "positiveReply":
      return "positive_replies";
    case "form_submissions":
    case "formSubmission":
      return "form_submissions";
    // The combined-sales goal is `combined_sales` on the brand-service wire today
    // and `combinedSales` once it speaks canonical.
    case "combined_sales":
    case "combinedSales":
      return "sales";
    // The renamed website-purchase goal reads as `website_purchase`. The LEGACY `sales`
    // wire (brand-service still persists the old purchase goal as `sales`, and its
    // internal read emits `sales` for EVERY purchase brand) + the `purchase` runtime
    // spelling + the canonical `websitePurchase` all collapse to it.
    case "website_purchase":
    case "sales":
    case "purchase":
    case "websitePurchase":
      return "website_purchase";
    case "sales_meetings":
    case "booked_meetings":
    case "meetingBooked":
      return "sales_meetings";
  }
  // Exhaustive above. A value reaching here is a spelling added to the wire union
  // without being mapped — fail loud rather than silently reading as a sales
  // meeting, which is what the old catch-all `return "sales_meetings"` did.
  throw new Error(`Unmapped brand optimization goal: ${goal as string}`);
}

function serializeBrandOptimizationGoal(
  goal: BrandOptimizationGoal,
): "signups" | "booked_meetings" | "website_visits" | "positive_replies" | "form_submissions" | "website_purchase" | "combined_sales" {
  if (goal === "signups") return "signups";
  if (goal === "website_visits") return "website_visits";
  if (goal === "positive_replies") return "positive_replies";
  if (goal === "form_submissions") return "form_submissions";
  // website_purchase serialises 1:1; sales → the combined-sales wire value.
  if (goal === "website_purchase") return "website_purchase";
  if (goal === "sales") return "combined_sales";
  return "booked_meetings";
}

// Most surfaces only distinguish VISIT-driven (website click → outcome) from
// REPLY-driven (positive reply → outcome) behaviour. signups + website_visits +
// form_submissions + website_purchase are visit-driven; sales_meetings + positive_replies
// are reply-driven. The combined `sales` goal is BOTH visit- and reply-driven — it counts
// as visit-driven here so the coarse overview surfaces group it with the paid-client
// (website_purchase) family; the Audiences ranking table handles its cost-per-sale column
// explicitly. Use this instead of `goal === "signups"` so the beta goals route to the
// right family everywhere.
export function isVisitDrivenGoal(goal: BrandOptimizationGoal): boolean {
  return (
    goal === "signups" ||
    goal === "website_visits" ||
    goal === "form_submissions" ||
    goal === "website_purchase" ||
    goal === "sales"
  );
}

export interface BrandSalesEconomics {
  lifetimeRevenueUsd: number;
  replyToMeetingPct: number;
  visitToMeetingPct: number;
  meetingToClosePct: number;
  // Self-serve close decomposed into two steps. visitToClosePct is now DERIVED
  // server-side (= visitToSignupPct × signupToPaidClientPct) and stays on the
  // response for the projection engine — never sent on the PUT (see Input).
  visitToSignupPct: number;
  signupToPaidClientPct: number;
  visitToClosePct: number;
  // Single-step conversions for the beta website_visits / positive_replies goals.
  visitToPaidClientPct: number;
  replyToPaidClientPct: number;
  // Two-step conversions for the beta form_submissions goal (visit → form submission → paid),
  // the sibling of signups. brand-service serves them PRESENT-BUT-NULLABLE: a brand that never
  // set form-submission rates gets `null` (not absent). Hence `number | null` — a bare `number`
  // (or a non-nullable schema) makes the GET safeParse throw on every such brand.
  visitToFormSubmissionPct?: number | null;
  formSubmissionToPaidClientPct?: number | null;
  businessModel: BrandBusinessModel | null;
  // OPTIONAL because brand-service retired the goal from this payload (#434):
  // the brand's legs are the only vocabulary for what a brand sells
  // through. A consumer that needs a goal reads the arbitrated one, and a
  // reader that requires this field here takes every econ surface down.
  optimizationGoal?: BrandOptimizationGoal;
  updatedAt: string;
}

// businessModel is a partial-update field on PUT: omit = leave unchanged, null = clear
// (brand-service contract). The campaign form omits it (edits only the 5 metrics); the
// Brand Settings editor sends it explicitly. Hence optional in the input, not required.
// businessModel / optimizationGoal are partial-update fields on PUT:
// omit = leave unchanged. Hence optional in the input.
// visitToClosePct is derived server-side, never sent — omit it from the input.
// visitToPaidClientPct / replyToPaidClientPct are partial-update too: omit = leave
// unchanged (brand-service defaults 5 / 25). Only the beta settings card sends them.
export type BrandSalesEconomicsInput = Omit<
  BrandSalesEconomics,
  | "updatedAt"
  | "businessModel"
  | "optimizationGoal"
  | "visitToClosePct"
  | "visitToPaidClientPct"
  | "replyToPaidClientPct"
  | "visitToFormSubmissionPct"
  | "formSubmissionToPaidClientPct"
> & {
  businessModel?: BrandBusinessModel | null;
  optimizationGoal?: BrandOptimizationGoal;
  visitToPaidClientPct?: number;
  replyToPaidClientPct?: number;
  visitToFormSubmissionPct?: number;
  formSubmissionToPaidClientPct?: number;
};

const BrandSalesEconomicsSchema = z.object({
  lifetimeRevenueUsd: z.number(),
  replyToMeetingPct: z.number(),
  visitToMeetingPct: z.number(),
  meetingToClosePct: z.number(),
  visitToSignupPct: z.number(),
  signupToPaidClientPct: z.number(),
  visitToClosePct: z.number(),
  visitToPaidClientPct: z.number(),
  replyToPaidClientPct: z.number(),
  // Present-but-NULLABLE on the wire: brand-service returns these in `required[]` but serves `null`
  // for a brand that never set form-submission rates. `.nullable().optional()` tolerates BOTH null
  // (the common case) and absent (older prod) — a bare `.optional()` rejects null → the whole GET
  // safeParse throws, breaking every econ-reading surface. Consumers already `?? default`-guard.
  visitToFormSubmissionPct: z.number().nullable().optional(),
  formSubmissionToPaidClientPct: z.number().nullable().optional(),
  businessModel: z.union([z.literal("b2c"), z.literal("b2b")]).nullable(),
  // Both vocabularies: the snake spellings brand-service used to emit, and the
  // canonical camelCase it migrated to. Accepting both is what let the producer
  // flip its emission without breaking this app — see `CANONICAL_GOALS`.
  // `whatsappConversation` is absent on purpose: this app has no local goal for
  // it, so it must fail loud here rather than be mapped.
  //
  // `.optional()` because brand-service has RETIRED the goal from this payload
  // (#434): the goal was the poorer word for what a brand sells through
  // (two meeting paths collapsed onto one). Keeping it REQUIRED is what took every econ-reading
  // surface down the day that promoted — the settings card rendered blank
  // rates and a blank lifetime revenue on brands whose numbers were sitting
  // untouched on the wire, and it read as lost data. Same retirement as the
  // `goal` / `currentGoal` pair on the payload above; this one
  // was the straggler. Delete it outright once no brand-service in any
  // environment still sends it.
  optimizationGoal: z.union([
    z.literal("signups"),
    z.literal("sales_meetings"),
    z.literal("booked_meetings"),
    z.literal("website_purchase"),
    z.literal("combined_sales"),
    z.literal("sales"),
    z.literal("website_visits"),
    z.literal("positive_replies"),
    z.literal("form_submissions"),
    z.literal("signup"),
    z.literal("meetingBooked"),
    z.literal("websitePurchase"),
    z.literal("combinedSales"),
    z.literal("websiteVisit"),
    z.literal("positiveReply"),
    z.literal("formSubmission"),
  ]).transform(normalizeBrandOptimizationGoal).optional(),
  updatedAt: z.string(),
});

// WRITE: the row was just persisted, so salesEconomics is always present. Per CLAUDE.md
// #1221 the write response DTO is narrower than the read sibling — its own schema.
const SaveBrandSalesEconomicsResponseSchema = z.object({
  salesEconomics: BrandSalesEconomicsSchema,
});

/** PUT /brands/:brandId/sales-economics — idempotent upsert of the 5 metrics (+ optional businessModel). */
export async function saveBrandSalesEconomics(
  brandId: string,
  input: BrandSalesEconomicsInput,
  token?: string,
): Promise<{ salesEconomics: BrandSalesEconomics }> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/sales-economics`, {
    token,
    method: "PUT",
    body: {
      lifetimeRevenueUsd: input.lifetimeRevenueUsd,
      replyToMeetingPct: input.replyToMeetingPct,
      visitToMeetingPct: input.visitToMeetingPct,
      meetingToClosePct: input.meetingToClosePct,
      // Self-serve close as two steps; brand-service derives visitToClosePct.
      visitToSignupPct: input.visitToSignupPct,
      signupToPaidClientPct: input.signupToPaidClientPct,
      // Single-step conversions (partial-update): send only when the caller set them.
      ...(input.visitToPaidClientPct !== undefined
        ? { visitToPaidClientPct: input.visitToPaidClientPct }
        : {}),
      ...(input.replyToPaidClientPct !== undefined
        ? { replyToPaidClientPct: input.replyToPaidClientPct }
        : {}),
      // Two-step form-submission conversions (partial-update): send only when set.
      ...(input.visitToFormSubmissionPct !== undefined
        ? { visitToFormSubmissionPct: input.visitToFormSubmissionPct }
        : {}),
      ...(input.formSubmissionToPaidClientPct !== undefined
        ? { formSubmissionToPaidClientPct: input.formSubmissionToPaidClientPct }
        : {}),
      // Partial-update: send businessModel only when the caller set it (settings
      // editor). Omitting it leaves the stored value unchanged; null clears it.
      ...(input.businessModel !== undefined
        ? { businessModel: input.businessModel }
        : {}),
      // Same partial-update semantics for the sales goal: omit = leave unchanged.
      ...(input.optimizationGoal !== undefined
        ? { optimizationGoal: serializeBrandOptimizationGoal(input.optimizationGoal) }
        : {}),
    },
  });
  const parsed = SaveBrandSalesEconomicsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] saveBrandSalesEconomics: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] saveBrandSalesEconomics: invalid response shape");
  }
  return parsed.data;
}

// ── Brand click-destination URL (where outreach clicks land) ──
// Per-brand config persisted in brand-service via api-service
// PUT /v1/brands/:brandId/click-destination. Idempotent set; returns the
// saved value. Defaults to the brand domain at onboarding when unset.
const SaveBrandClickDestinationResponseSchema = z.object({
  clickDestinationUrl: z.string().nullable(),
});

export async function saveBrandClickDestination(
  brandId: string,
  clickDestinationUrl: string,
  token?: string,
): Promise<{ clickDestinationUrl: string | null }> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/click-destination`, {
    token,
    method: "PUT",
    body: { clickDestinationUrl },
  });
  const parsed = SaveBrandClickDestinationResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] saveBrandClickDestination: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] saveBrandClickDestination: invalid response shape");
  }
  return parsed.data;
}

// ─── Conversion rates per LEG (brand-service, 2026-09-25) ─────────────────────
//
// A conversion rate describes how a BRAND sells, so it is stated once per (brand, leg)
// and shared by every offer. A leg is named by the two step LABELS brand-service
// serves, and a write sends those strings back verbatim. `stated: false` means the
// brand never gave us the number; its `ratePct` is then null, never a zero.
const BrandLegRateSchema = z.object({
  fromStep: z.string(),
  toStep: z.string(),
  ratePct: z.number().nullable(),
  stated: z.boolean(),
  statedAt: z.string().nullable(),
});

export type BrandLegRate = z.infer<typeof BrandLegRateSchema>;

const BrandLegRatesResponseSchema = z.object({ legRates: z.array(BrandLegRateSchema) });

/** GET /brands/:brandId/leg-rates — every leg once, stated or not. */
export async function getBrandLegRates(brandId: string, token?: string): Promise<BrandLegRate[]> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/leg-rates`, { token });
  const parsed = BrandLegRatesResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getBrandLegRates: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getBrandLegRates: invalid response shape");
  }
  return parsed.data.legRates;
}

export type BrandLegRatePatch = { fromStep: string; toStep: string; ratePct: number | null };

/**
 * PUT /brands/:brandId/leg-rates — state or clear the brand's rate on some legs.
 * PARTIAL: a leg the patch omits is untouched, `ratePct: null` clears it.
 */
export async function stateBrandLegRates(
  brandId: string,
  legRates: BrandLegRatePatch[],
  token?: string,
): Promise<BrandLegRate[]> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/leg-rates`, {
    token,
    method: "PUT",
    body: { legRates },
  });
  const parsed = BrandLegRatesResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] stateBrandLegRates: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] stateBrandLegRates: invalid response shape");
  }
  return parsed.data.legRates;
}

// ─── An offer's own economics (brand-service, 2026-09-25) ────────────────────
//
// What a client won through this offer is worth. Unstated reads null, never a zero.
const OfferEconomicsSchema = z.object({
  offerId: z.string(),
  name: z.string(),
  lifetimeRevenueUsd: z.number().nullable(),
  lifetimeRevenueStatedAt: z.string().nullable(),
  // The scheduling page a prospect of this offer books on; the AI meeting-booking
  // channel reads it to propose slots. `null` = never stated.
  bookingUrl: z.string().nullable(),
  legRates: z.array(BrandLegRateSchema),
});

export type OfferEconomics = z.infer<typeof OfferEconomicsSchema>;

function parseOfferEconomics(raw: unknown, label: string): OfferEconomics {
  const parsed = OfferEconomicsSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[dashboard] ${label}: response shape mismatch`, {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error(`[dashboard] ${label}: invalid response shape`);
  }
  return parsed.data;
}

/** GET /brands/:brandId/offers/:offerId/economics */
export async function getOfferEconomics(
  brandId: string,
  offerId: string,
  token?: string,
): Promise<OfferEconomics> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/offers/${offerId}/economics`, { token });
  return parseOfferEconomics(raw, "getOfferEconomics");
}

/**
 * PUT /brands/:brandId/offers/:offerId/economics — state (or clear, with null) what a
 * client won through this offer is worth. Only the lifetime revenue is sent, so a rate
 * is never restated from a possibly stale copy.
 */
export async function saveOfferLifetimeRevenue(
  brandId: string,
  offerId: string,
  lifetimeRevenueUsd: number | null,
  token?: string,
): Promise<OfferEconomics> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/offers/${offerId}/economics`, {
    token,
    method: "PUT",
    body: { lifetimeRevenueUsd },
  });
  return parseOfferEconomics(raw, "saveOfferLifetimeRevenue");
}

/**
 * PUT /brands/:brandId/offers/:offerId/economics — state (or clear, with null) the
 * booking page of this offer. Only `bookingUrl` is sent, so nothing else is restated.
 */
export async function saveOfferBookingUrl(
  brandId: string,
  offerId: string,
  bookingUrl: string | null,
  token?: string,
): Promise<OfferEconomics> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/offers/${offerId}/economics`, {
    token,
    method: "PUT",
    body: { bookingUrl },
  });
  return parseOfferEconomics(raw, "saveOfferBookingUrl");
}

// ─── How an offer sells (brand-service, 2026-09-29, beta) ────────────────────
//
// The steps and legs the customer ticked for ONE offer, stored as
// features-service's own keys. `stated: false` = never stated (both lists null),
// distinct from a stated empty selection.

const OfferSalesPathSchema = z.object({
  offerId: z.string(),
  stated: z.boolean(),
  steps: z.array(z.string()).nullable(),
  legKeys: z.array(z.string()).nullable(),
  statedAt: z.string().nullable(),
});
export type OfferSalesPath = z.infer<typeof OfferSalesPathSchema>;

function parseOfferSalesPath(raw: unknown, where: string): OfferSalesPath {
  const parsed = OfferSalesPathSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[${where}] invalid response shape`, parsed.error.issues, raw);
    throw new Error(`[${where}] invalid response shape`);
  }
  return parsed.data;
}

/** GET /brands/:brandId/offers/:offerId/sales-path — the offer's ticked steps and legs. */
export async function getOfferSalesPath(brandId: string, offerId: string): Promise<OfferSalesPath> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/offers/${offerId}/sales-path`);
  return parseOfferSalesPath(raw, "getOfferSalesPath");
}

/** PUT /brands/:brandId/offers/:offerId/sales-path — replaces the whole selection. */
export async function saveOfferSalesPath(
  brandId: string,
  offerId: string,
  steps: string[],
  legKeys: string[],
): Promise<OfferSalesPath> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/offers/${offerId}/sales-path`, {
    method: "PUT",
    body: { steps, legKeys },
  });
  return parseOfferSalesPath(raw, "saveOfferSalesPath");
}

/** GET /offers/:offerId/sales-paths — the offer's sales paths ranked by ROI (features-service). */
export async function getOfferSalesPaths(brandId: string, offerId: string): Promise<OfferSalesPaths> {
  const raw = await apiCall<unknown>(`/offers/${offerId}/sales-paths?brandId=${encodeURIComponent(brandId)}`);
  return parseOfferSalesPaths(raw, "getOfferSalesPaths");
}

/** GET /brands/:brandId/sales-budget — the brand's daily sales budget mode (billing-service). */
export async function getBrandSalesBudget(brandId: string): Promise<BrandSalesBudget> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/sales-budget`);
  return parseBrandSalesBudget(raw, "getBrandSalesBudget");
}

/** PUT /brands/:brandId/sales-budget — state ONE daily budget for sales (global mode). */
export async function setBrandSalesBudget(brandId: string, dailyBudgetCents: number): Promise<BrandSalesBudget> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/sales-budget`, {
    method: "PUT",
    body: { dailyBudgetCents },
  });
  return parseBrandSalesBudget(raw, "setBrandSalesBudget");
}

/** DELETE /brands/:brandId/sales-budget — back to each campaign's own ceiling. */
export async function clearBrandSalesBudget(brandId: string): Promise<BrandSalesBudget> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/sales-budget`, { method: "DELETE" });
  return parseBrandSalesBudget(raw, "clearBrandSalesBudget");
}

// ─── Effective conversion rates (features-service, 2026-09-25) ───────────────
//
// The rate every money figure is priced on, per leg, and WHERE it came from: MEASURED
// on the brand's own leads once enough of them reached the leg's FROM step, else what
// the brand STATED by hand, else the cross-org MEDIAN of stated rates. features-service
// resolves it; this app never re-derives it.
//
// The producer still groups its answer in paths of steps; the reader flattens it to one
// entry per leg (the two step labels) at the parse boundary, first occurrence winning,
// so nothing downstream sees the grouping.
const MeasuredLegRateSchema = z.object({
  fromReached: z.number().nullable(),
  toReached: z.number().nullable(),
  ratePct: z.number().nullable(),
  sufficient: z.boolean(),
  gap: z.string().nullable(),
  // WHERE the counts were read (features-service v0.177.1, 2026-09-26): `crm` = the
  // client's whole CRM (a leg their own sales team runs), `our_leads` = our leads. On
  // our leads, `outcomesCounted` says which outcomes the counts include. Plain strings,
  // since the producer owns the vocabulary; absent on an older body.
  basis: z.string().nullish(),
  outcomesCounted: z.string().nullish(),
});

const EffectiveLegRateSchema = z.object({
  fromStep: z.string(),
  toStep: z.string(),
  // The catalogue's own leg identity (features-service v0.179.25): join on this, never on
  // the labels, which can differ from the catalogue's. Optional for an older body.
  legKey: z.string().nullish(),
  effectiveRatePct: z.number().nullable(),
  source: z.string().nullable(),
  unresolvedReason: z.string().nullable(),
  measured: MeasuredLegRateSchema,
  manualRatePct: z.number().nullable(),
  median: z.object({ ratePct: z.number().nullable(), brandCount: z.number() }),
});

export type EffectiveLegRate = z.infer<typeof EffectiveLegRateSchema>;

const BrandConversionRatesSchema = z
  .object({
    brandId: z.string(),
    minMeasuredFromReached: z.number(),
    contactedRecipients: z.number(),
    // Every leg of the brand, flat. The producer's older grouping of them is not read.
    legs: z.array(EffectiveLegRateSchema),
  })
  .transform((body) => {
    const legs: EffectiveLegRate[] = [];
    const seen = new Set<string>();
    for (const leg of body.legs) {
      const id = `${leg.fromStep}\u0000${leg.toStep}`;
      if (seen.has(id)) continue;
      seen.add(id);
      legs.push(leg);
    }
    return {
      brandId: body.brandId,
      minMeasuredFromReached: body.minMeasuredFromReached,
      contactedRecipients: body.contactedRecipients,
      legs,
    };
  });

export type BrandConversionRates = z.infer<typeof BrandConversionRatesSchema>;

/** GET /brands/:brandId/conversion-rates — the effective rate of every leg. */
export async function getBrandConversionRates(
  brandId: string,
  token?: string,
): Promise<BrandConversionRates> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/conversion-rates`, { token });
  const parsed = BrandConversionRatesSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getBrandConversionRates: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getBrandConversionRates: invalid response shape");
  }
  return parsed.data;
}

// ─── Offers (Org > Brand > Offer > Campaign) ─────────────────────────────────
//
// A BRAND is an identity: a name, a domain, a logo, a conversion-tracking snippet.
// An OFFER is a PROPOSITION: what it promises (the 7 Hormozi user-fields), its
// lifetime revenue, and the campaigns that sell it. A brand selling a $200 self-serve plan and a $20k enterprise
// contract has two offers, and everything that used to hang off the brand and is
// really about the proposition — audiences, leads, campaigns — hangs off
// the offer.
//
// brand-service owns the level. There is no DELETE route: an offer the owner no
// longer sells is ARCHIVED (brand-service v0.82.3), which hides it from the default
// list and deletes nothing.
const OfferSchema = z.object({
  offerId: z.string(),
  brandId: z.string(),
  name: z.string(),
  // The offer's own generated mark (brand-service v0.78.2). `null` = none yet, which
  // is the state of every offer created before it shipped and of every offer created
  // today — so the dashboard falls back to its glyph rather than an empty square
  // (`OfferMark`). brand-service states it outright: null is a first-class state, and
  // there is no placeholder and no derived image.
  //
  // `.nullish()` and not `.nullable()`: the producer serves it on every offer read,
  // but this schema is shared by the list, the by-id read and the write responses, and
  // a reader that REQUIRES it throws on any body predating the field. Absent and null
  // read the same here — the mark has nothing to draw either way.
  imageUrl: z.string().nullish(),
  // `archived` = the owner retired it: hidden from the default list, nothing deleted.
  // `.nullish()` for the same reason as `imageUrl`: absent reads as active.
  status: z.enum(["active", "archived"]).nullish(),
  archivedAt: z.string().nullish(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Offer = z.infer<typeof OfferSchema>;

/** True when the owner archived this offer. An offer read before the field existed is active. */
export function isOfferArchived(offer: Pick<Offer, "status">): boolean {
  return offer.status === "archived";
}

const ListBrandOffersResponseSchema = z.object({ offers: z.array(OfferSchema) });
const BrandOfferResponseSchema = z.object({ offer: OfferSchema });

/**
 * GET /brands/:brandId/offers — every proposition this brand sells.
 *
 * ARCHIVED offers are left out unless `includeArchived`. Query keys: the default list is
 * `["brandOffers", brandId]`; the list WITH archived offers is
 * `["brandOffers", brandId, "withArchived"]`, so invalidating the prefix refreshes both.
 * A surface that names an offer by id for HISTORY (missions, leads marks) reads the
 * with-archived list, or an archived offer's past work loses its name.
 */
export async function listBrandOffers(
  brandId: string,
  token?: string,
  opts: { includeArchived?: boolean } = {},
): Promise<{ offers: Offer[] }> {
  const qs = opts.includeArchived ? "?includeArchived=true" : "";
  const raw = await apiCall<unknown>(`/brands/${brandId}/offers${qs}`, { token });
  const parsed = ListBrandOffersResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] listBrandOffers: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] listBrandOffers: invalid response shape");
  }
  return parsed.data;
}

/** GET /brands/:brandId/offers/:offerId — one offer, by id. */
export async function getBrandOffer(
  brandId: string,
  offerId: string,
  token?: string,
): Promise<{ offer: Offer }> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/offers/${offerId}`, { token });
  const parsed = BrandOfferResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getBrandOffer: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getBrandOffer: invalid response shape");
  }
  return parsed.data;
}

/**
 * POST /brands/:brandId/offers — a new proposition under this brand.
 *
 * The name is at most two words and 20 characters, and unique per brand;
 * brand-service enforces all three and its 400 is the answer, so nothing is
 * pre-empted here.
 */
export async function createBrandOffer(
  brandId: string,
  name: string,
  token?: string,
): Promise<{ offer: Offer }> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/offers`, {
    token,
    method: "POST",
    body: { name },
  });
  const parsed = BrandOfferResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] createBrandOffer: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] createBrandOffer: invalid response shape");
  }
  return parsed.data;
}

// ── Offer proposals: the "New organization" modal's offers step ────────────
// brand-service splits a free-text "what do you sell?" into the distinct offers it
// describes (one when it describes one), each with a short name, a sentence and an
// icon token, and flags the likely main one through a Jev judgment. Nothing is stored
// until the confirm, which creates them all and adopts the brand's implicit offer
// into the chosen one, so the brand ends with exactly the confirmed offers.

const OfferProposalSchema = z.object({
  name: z.string(),
  description: z.string(),
  /** Phosphor icon name, kebab-case, from brand-service's closed vocabulary. */
  icon: z.string(),
});
export type OfferProposal = z.infer<typeof OfferProposalSchema>;

const ProposeOffersResponseSchema = z.object({
  offers: z.array(OfferProposalSchema),
  mainOfferIndex: z.number().int(),
  mainOfferConfidence: z.number().nullable(),
  /** Read as a plain string: the producer's vocabulary. */
  mainOfferBasis: z.string(),
});
export type OfferProposals = z.infer<typeof ProposeOffersResponseSchema>;

export async function proposeBrandOffers(brandId: string, description: string, token?: string): Promise<OfferProposals> {
  const raw = await withTimeout(
    apiCall<unknown>(`/brands/${brandId}/offers/proposals`, { token, method: "POST", body: { description } }),
    120_000,
    "proposeBrandOffers",
  );
  const parsed = ProposeOffersResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] proposeBrandOffers: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] proposeBrandOffers: invalid response shape");
  }
  return parsed.data;
}

export async function confirmBrandOffers(
  brandId: string,
  offers: readonly OfferProposal[],
  chosenIndex: number,
  token?: string,
): Promise<{ chosenOfferId: string }> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/offers/confirm`, {
    token,
    method: "POST",
    body: { offers: offers.map((o) => ({ name: o.name, description: o.description, icon: o.icon })), chosenIndex },
  });
  const parsed = z.object({ chosenOfferId: z.string() }).passthrough().safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] confirmBrandOffers: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] confirmBrandOffers: invalid response shape");
  }
  return { chosenOfferId: parsed.data.chosenOfferId };
}

/**
 * POST /brands/:brandId/offers/:offerId/archive | /unarchive — retire an offer the owner
 * no longer sells, or bring it back. Nothing is deleted either way.
 *
 * Archive is refused 409 with `reason: "offer_has_ongoing_campaign"` while a campaign on
 * the offer is running; `offerArchiveErrorMessage` turns that into a sentence.
 */
export async function setBrandOfferArchived(
  brandId: string,
  offerId: string,
  archived: boolean,
  token?: string,
): Promise<{ offer: Offer }> {
  const raw = await apiCall<unknown>(
    `/brands/${brandId}/offers/${offerId}/${archived ? "archive" : "unarchive"}`,
    { token, method: "POST", body: {} },
  );
  const parsed = BrandOfferResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] setBrandOfferArchived: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] setBrandOfferArchived: invalid response shape");
  }
  return parsed.data;
}

/** A failed archive or unarchive, as a sentence for the owner (see `offer-archive.ts`). */
export function offerArchiveErrorMessage(err: unknown, archiving: boolean): string {
  return err instanceof ApiError
    ? offerArchiveRefusalSentence(err.status, err.body, archiving)
    : offerArchiveRefusalSentence(null, null, archiving);
}

/** PATCH /brands/:brandId/offers/:offerId — rename. */
export async function renameBrandOffer(
  brandId: string,
  offerId: string,
  name: string,
  token?: string,
): Promise<{ offer: Offer }> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/offers/${offerId}`, {
    token,
    method: "PATCH",
    body: { name },
  });
  const parsed = BrandOfferResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] renameBrandOffer: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] renameBrandOffer: invalid response shape");
  }
  return parsed.data;
}

/**
 * POST /brands/:brandId/offers/:offerId/image — (re)generate the offer's mark.
 *
 * brand-service builds the prompt from the offer's own descriptors and delegates the
 * image to chat-service, which OWNS the cost: the org that presses the button pays
 * for it, on the identity headers this request already carries. Returns the offer
 * with its new mark, so the caller writes the response into the cache rather than
 * re-reading.
 *
 * May 402 when the org cannot afford it — `apiCall` dispatches the billing-guard
 * modal on that status, so the call site shows NO error line of its own for it.
 */
export async function generateOfferImage(
  brandId: string,
  offerId: string,
  token?: string,
): Promise<{ offer: Offer }> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/offers/${offerId}/image`, {
    token,
    method: "POST",
  });
  const parsed = BrandOfferResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] generateOfferImage: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] generateOfferImage: invalid response shape");
  }
  return parsed.data;
}

// ── Attach a website to a no-website brand (one-time domain setup) ──
// A brand created via the "I have no website" onboarding path has domain === null.
// This attaches a website URL, which brand-service sets as brands.url + domain; the
// next post-cache-expiry field extraction re-sources from the site automatically.
// Reached via api-service PATCH /v1/brands/:brandId { url } → response { brandId,
// domain, name, url } (owned by brand-service). Downstream 4xx validation + 409
// domain-conflict propagate verbatim (fail-loud — surfaced in the settings card).
// One-time: the setup section is hidden once domain !== null.
const AttachBrandWebsiteResponseSchema = z.object({
  brandId: z.string().optional(),
  domain: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
});

/**
 * The brand IDENTITY write: the display name, and the logo the brand is shown under.
 *
 * Both are DERIVED by default — the name from a one-off extraction at signup, the
 * logo from whatever logo.dev has indexed for the domain — and until brand-service
 * widened this route neither could be corrected by the person they describe. That
 * is the whole feature: a brand whose third-party logo is stale (ours was, for two
 * months after a rebrand) had no way back.
 *
 * PARTIAL, and the partiality is load-bearing in BOTH directions:
 *  - a field omitted is left as stored, so correcting the name cannot overwrite a
 *    logo somebody set an hour ago from a copy this tab read on load;
 *  - `logoUrl: null` CLEARS it and is NOT the same as omitting it — it is how a
 *    customer returns to the derived logo. So the body is built off key PRESENCE
 *    in `patch`, never off truthiness, which cannot tell the two apart.
 *
 * The URL is one storage handed back (`uploadOrgImage`), never one a person typed:
 * see `brand-logo-file.ts` for why a logo is uploaded rather than linked.
 */
const UpdateBrandIdentityResponseSchema = z.object({
  brandId: z.string().optional(),
  domain: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  // Optional so this ships ahead of the producer without breaking (additive
  // rollout): absent reads as undefined and the caller keeps what it had.
  logoUrl: z.string().nullable().optional(),
});

export async function updateBrandIdentity(
  brandId: string,
  patch: { name?: string; logoUrl?: string | null },
  token?: string,
): Promise<{ name: string | null; logoUrl: string | null }> {
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name;
  // `'logoUrl' in patch` — a null here is an instruction, not an absence.
  if ("logoUrl" in patch) body.logoUrl = patch.logoUrl;

  const raw = await apiCall<unknown>(`/brands/${brandId}`, { token, method: "PATCH", body });
  const parsed = UpdateBrandIdentityResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] updateBrandIdentity: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] updateBrandIdentity: invalid response shape");
  }
  return { name: parsed.data.name ?? null, logoUrl: parsed.data.logoUrl ?? null };
}

/**
 * Put an image on OUR storage and get the public URL back.
 *
 * Org-scoped by construction: the gateway route opens a run under the caller's org
 * and declares the storage cost against it, so the file a customer uploads is filed
 * under the org that uploaded it — not under the platform, which is what the
 * staff-only `/platform-uploads` route does and why it is not this one.
 *
 * The response shape is cloudflare-service's and comes through the gateway
 * untouched; only `url` is read here, because that is the only field anything
 * downstream of this call has a use for.
 */
const OrgUploadResponseSchema = z.object({
  url: z.string(),
});

export async function uploadOrgImage(
  input: { contentBase64: string; folder: string; filename: string; contentType: string },
  token?: string,
): Promise<{ url: string }> {
  const raw = await apiCall<unknown>("/orgs/uploads", { token, method: "POST", body: input });
  const parsed = OrgUploadResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] uploadOrgImage: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] uploadOrgImage: invalid response shape");
  }
  return { url: parsed.data.url };
}

export async function attachBrandWebsite(
  brandId: string,
  url: string,
  token?: string,
): Promise<{ domain: string | null; url: string | null }> {
  const raw = await apiCall<unknown>(`/brands/${brandId}`, {
    token,
    method: "PATCH",
    body: { url },
  });
  const parsed = AttachBrandWebsiteResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] attachBrandWebsite: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] attachBrandWebsite: invalid response shape");
  }
  return { domain: parsed.data.domain ?? null, url: parsed.data.url ?? null };
}

// ── Sales-rep phone (the number rung when a positive reply lands) ──
// Per brand, one number. When a prospect replies to a campaign saying they are
// interested, instantly-service rings this number within a minute or two, and —
// when Apollo revealed the prospect's own number in time — offers to bridge the
// two. Absence is a FIRST-CLASS answer meaning nobody to ring, not an error and
// not an empty string: the overwhelming majority of brands will never set one,
// and a brand with no number simply produces no call, silently.
//
// BRAND grain, deliberately. A campaign is (offer x leg x channel), so storing
// it there would mean retyping one number per channel selling the same offer —
// four rows for one fact on the brand that asked for this, drifting from the
// first edit — and a brand with no campaign yet could declare nothing at all.
//
// Reached via api-service GET/PUT/DELETE /v1/brands/:id/sales-rep ->
// brand-service, which owns what a valid rep is and states it in sentences a
// person reads: a phone must carry a country code (no country is inferred — a
// guess dials a different person), an email is ONE bare address, and a write
// carrying a phone with no email is refused outright. Its 400 IS the answer;
// never re-implement any of those rules here.
const SalesRepResponseSchema = z.object({
  salesRepEmail: z.string().nullable(),
  salesRepPhone: z.string().nullable(),
  // How a hand-over names the rep in the prospect's thread ("I've copied Marie, Head
  // of Partnerships at Doc Dinners"). Both optional and never inferred; absent reads
  // as null so a response from before brand-service served them still parses.
  salesRepFirstName: z.string().nullable().default(null),
  salesRepRole: z.string().nullable().default(null),
});

/** The one person to reach for a brand: how to reach them, and how to introduce them. */
export type SalesRep = z.infer<typeof SalesRepResponseSchema>;

/** Nobody stated. A first-class answer, never an error and never a 404. */
export const NO_SALES_REP: SalesRep = {
  salesRepEmail: null,
  salesRepPhone: null,
  salesRepFirstName: null,
  salesRepRole: null,
};

function parseSalesRep(raw: unknown, fn: string): SalesRep {
  const parsed = SalesRepResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[dashboard] ${fn}: response shape mismatch`, {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error(`[dashboard] ${fn}: invalid response shape`);
  }
  return parsed.data;
}

export async function getBrandSalesRep(
  brandId: string,
  token?: string,
): Promise<SalesRep> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/sales-rep`, { token });
  return parseSalesRep(raw, "getBrandSalesRep");
}

/**
 * State the rep. The write REPLACES the email and the phone, so both always travel:
 * omitting the phone CLEARS a number that was there, which is brand-service's
 * own documented semantic and not something to work around by sending a subset.
 * The first name and role are the exception, by the producer's design: OMITTED
 * leaves the stored value as it is, `null` (or blank) clears it.
 */
export async function setBrandSalesRep(
  brandId: string,
  rep: {
    salesRepEmail: string | null;
    salesRepPhone: string | null;
    salesRepFirstName?: string | null;
    salesRepRole?: string | null;
  },
  token?: string,
): Promise<SalesRep> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/sales-rep`, {
    token,
    method: "PUT",
    body: rep,
  });
  return parseSalesRep(raw, "setBrandSalesRep");
}

export async function clearBrandSalesRep(
  brandId: string,
  token?: string,
): Promise<SalesRep> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/sales-rep`, {
    token,
    method: "DELETE",
  });
  return parseSalesRep(raw, "clearBrandSalesRep");
}

// ── Conversion tracking token (per-brand publishable write-key) ──
// A per-brand token the client embeds in a snippet on their own site to fire
// "Signup" / "Meeting Booked" events back to us; lead-service ingests them and
// attributes each to a lead we emailed for the brand. The token is a PUBLISHABLE
// write-key (it lives in a client-side JS pixel, so it is not a secret): it can
// ONLY POST conversion events for its one brand, never read. Rotate is the abuse
// remedy. `ingestUrl` is the full public URL the client's site POSTs to.
// Reached via api-service GET/POST /v1/brands/:brandId/conversion-token[/rotate].
const BrandConversionTokenSchema = z.object({
  token: z.string(),
  ingestUrl: z.string(),
  // Liveness/status — ADDED by lead-service (additive). Declared OPTIONAL so the
  // dashboard ships ahead of the producer and auto-populates once it lands (a
  // required field would strip via safeParse before the backend deploys). `status`
  // is server-computed; the timestamps + `eventTypesSeen` are the raw signals
  // behind it. `.nullish()` tolerates the server's `null` for "never seen".
  //   not_set_up   — no ping and no real conversion ever received
  //   live_waiting — a tag-loaded ping seen (tracker alive) but no conversion yet
  //   live         — at least one real conversion received
  status: z.enum(["not_set_up", "live_waiting", "live"]).optional(),
  lastEventAt: z.string().nullish(),
  lastPingAt: z.string().nullish(),
  // Distinct REAL conversion events actually received (excludes "ping").
  eventTypesSeen: z.array(z.string()).optional(),
});
export type BrandConversionToken = z.infer<typeof BrandConversionTokenSchema>;

export async function getBrandConversionToken(
  brandId: string,
  token?: string,
): Promise<BrandConversionToken> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/conversion-token`, { token });
  const parsed = BrandConversionTokenSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getBrandConversionToken: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getBrandConversionToken: invalid response shape");
  }
  return parsed.data;
}

export async function rotateBrandConversionToken(
  brandId: string,
  token?: string,
): Promise<BrandConversionToken> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/conversion-token/rotate`, {
    token,
    method: "POST",
  });
  const parsed = BrandConversionTokenSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] rotateBrandConversionToken: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] rotateBrandConversionToken: invalid response shape");
  }
  return parsed.data;
}

// ── Daily budget (per-brand spend pacing) ──
// A per-day spend ceiling campaign-service uses to pace a brand's work. Separate
// from org credit balance / top-up (that's affordability; this is allocation).
// Wire value is cents as a decimal string (Postgres numeric serializes as string,
// per CLAUDE.md numeric-string rule) → coerce. null = never set (a 200, not a 404).
export interface BrandDailyBudget {
  brandId: string;
  dailyBudgetCents: number | null;
  updatedAt: string | null;
}

// READ: dailyBudgetCents null when unset; updatedAt null until first save.
const GetBrandDailyBudgetResponseSchema = z.object({
  brandId: z.string(),
  dailyBudgetCents: z.coerce.number().nullable(),
  updatedAt: z.string().nullable(),
});

// WRITE: the row was just persisted, so the value + updatedAt are always present;
// the write response adds orgId. Per-verb schema (narrower/different than read).
const SaveBrandDailyBudgetResponseSchema = z.object({
  brandId: z.string(),
  orgId: z.string(),
  dailyBudgetCents: z.coerce.number(),
  updatedAt: z.string(),
});

/** GET /brands/:brandId/daily-budget — saved cents or null when never set. */
export async function getBrandDailyBudget(
  brandId: string,
  token?: string,
): Promise<BrandDailyBudget> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/daily-budget`, { token });
  const parsed = GetBrandDailyBudgetResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getBrandDailyBudget: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getBrandDailyBudget: invalid response shape");
  }
  return parsed.data;
}

/** PATCH /brands/:brandId/daily-budget — set the per-day cents ceiling (0 = pause). */
export async function saveBrandDailyBudget(
  brandId: string,
  dailyBudgetCents: number,
  token?: string,
): Promise<{ brandId: string; orgId: string; dailyBudgetCents: number; updatedAt: string }> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/daily-budget`, {
    token,
    method: "PATCH",
    body: { dailyBudgetCents },
    headers: { "x-run-id": globalThis.crypto.randomUUID() },
  });
  const parsed = SaveBrandDailyBudgetResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] saveBrandDailyBudget: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] saveBrandDailyBudget: invalid response shape");
  }
  return parsed.data;
}

// ── Per-campaign daily ceilings (billing-service #500) ──
// A campaign is (offer x leg x acquisition channel), and billing keeps its daily
// ceiling on exactly that address. api-service proxies the reads and the write
// verbatim. The entries add up to `dailyBudgetCents`, the brand total every other
// surface reads, so nothing here sums them.
//
// `offerId` / `legKey` are NULLABLE: a ceiling stated before billing carried the
// dimension names none. Such a row is not "for no offer": it is the money of a brand
// that had exactly one, which billing resolves on the read.
const CampaignBudgetRowSchema = z.object({
  offerId: z.string().nullable(),
  legKey: z.string().nullable(),
  featureSlug: z.string(),
  dailyBudgetCents: z.coerce.number(),
  updatedAt: z.string(),
});

export type CampaignBudgetRow = z.infer<typeof CampaignBudgetRowSchema>;

const BrandCampaignBudgetsResponseSchema = z.object({
  brandId: z.string(),
  dailyBudgetCents: z.coerce.number().nullable(),
  campaigns: z.array(CampaignBudgetRowSchema),
});

export type BrandCampaignBudgets = z.infer<typeof BrandCampaignBudgetsResponseSchema>;

/** GET /brands/:brandId/campaign-budgets — every campaign's ceiling, plus the total. */
export async function getBrandCampaignBudgets(
  brandId: string,
  token?: string,
): Promise<BrandCampaignBudgets> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/campaign-budgets`, { token });
  const parsed = BrandCampaignBudgetsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getBrandCampaignBudgets: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getBrandCampaignBudgets: invalid response shape");
  }
  return parsed.data;
}

const SavedCampaignBudgetSchema = z.object({
  offerId: z.string(),
  legKey: z.string(),
  featureSlug: z.string(),
  dailyBudgetCents: z.coerce.number().nullable(),
  updatedAt: z.string().nullable(),
});

/**
 * PUT /brands/:brandId/campaign-budget — ONE campaign's daily ceiling, every other
 * campaign untouched. Zero is an ordinary value. billing refuses (400) a channel funded
 * below its published daily floor, judged on the channel's total across the brand.
 */
export async function saveCampaignBudget(
  brandId: string,
  campaign: { offerId: string; legKey: string; featureSlug: string },
  dailyBudgetCents: number,
  token?: string,
): Promise<z.infer<typeof SavedCampaignBudgetSchema>> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/campaign-budget`, {
    token,
    method: "PUT",
    body: { ...campaign, dailyBudgetCents },
    headers: { "x-run-id": globalThis.crypto.randomUUID() },
  });
  const parsed = SavedCampaignBudgetSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] saveCampaignBudget: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] saveCampaignBudget: invalid response shape");
  }
  return parsed.data;
}

/**
 * The platform's step, leg and channel catalogue, as features-service publishes it
 * (`GET /public/channels`, public, no auth, no org scope).
 *
 * ONE read for everything this app needs out of it: every step and its label, every
 * leg with its canonical `legKey` and the two steps it connects, and every channel
 * with the legs it performs and the commercial TERMS it runs on (the floor a funded
 * ceiling must clear). One read, because they are one catalogue and two reads of it
 * is how a leg and its price would come to be answered by different snapshots.
 *
 * Declared NARROW: every field no consumer uses is left undeclared. `legs` and `steps`
 * are `.optional()` so a producer older than them still parses (the leg lookup then
 * falls back to each channel's own transitions).
 */
const StepRefSchema = z.object({ key: z.string(), label: z.string().optional() });
const PublicCatalogueSchema = z.object({
  steps: z.array(z.object({ key: z.string(), label: z.string(), shortDescription: z.string().nullish() })).optional(),
  legs: z
    .array(
      z.object({
        legKey: z.string(),
        fromStep: StepRefSchema.nullable(),
        toStep: StepRefSchema,
      }),
    )
    .optional(),
  channels: z.array(
    z.object({
      slug: z.string(),
      terms: z
        .object({ dailyOperatingCostCents: z.coerce.number().nullish() })
        .nullish(),
      stepTransitions: z
        .array(
          z.object({
            legKey: z.string(),
            from: StepRefSchema.nullable(),
            to: StepRefSchema,
            // The crew's name (Herald, Scout, Pilot...), published per leg. Undeclared,
            // zod strips it and every crew reads by its channel's name instead.
            crewName: z.string().nullish(),
          }),
        )
        .optional(),
    }),
  ),
});

export type PublicCatalogue = z.infer<typeof PublicCatalogueSchema>;
/** One published channel, as narrowly as this app reads one. */
export type PublicChannelWire = PublicCatalogue["channels"][number] & PublishedChannelTerms;

function parsePublicCatalogue(raw: unknown, label: string): PublicCatalogue {
  const parsed = PublicCatalogueSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[dashboard] ${label}: response shape mismatch`, { issues: parsed.error.issues });
    throw new Error(`[dashboard] ${label}: invalid response shape`);
  }
  return parsed.data;
}

/** GET /public/channels — the steps, the legs, and what each channel performs and costs. */
export async function getPublicCatalogue(token?: string): Promise<PublicCatalogue> {
  const raw = await apiCall<unknown>(`/public/channels`, { token });
  return parsePublicCatalogue(raw, "getPublicCatalogue");
}

/**
 * The same catalogue, read through the route that answers WITHOUT a session.
 *
 * `getPublicCatalogue` goes through `/api/v1/*`, which lives inside `(authed)` and
 * attaches a Clerk bearer, so signed out it is answered with the sign-in PAGE. The
 * onboarding wizard runs signed out, so it reads the catalogue the way the screens
 * before it do: `/api/public/catalogue`, which proxies the same features-service route
 * server-side. ONE schema, two transports.
 */
export async function getPublicCatalogueSignedOut(): Promise<PublicCatalogue> {
  const res = await fetch("/api/public/catalogue");
  if (!res.ok) {
    throw new Error(`[dashboard] getPublicCatalogueSignedOut: catalogue ${res.status}`);
  }
  // The route hands the upstream body back verbatim under `channels`.
  const body = (await res.json()) as { channels?: unknown };
  return parsePublicCatalogue(body.channels, "getPublicCatalogueSignedOut");
}

// ---------------------------------------------------------------------------
// What a brand may actually spend TODAY — campaign-service, through the gateway.
//
// The question is a JOIN and neither producer can answer it alone: billing keys a
// ceiling on (offer x leg x channel) and stores no campaign status, while
// campaign-service stores the status and no money. billing's brand total is
// therefore status-BLIND — a brand running one campaign at $50 beside one paused
// at $10 answers $60 — so every surface that divided by it, or projected a month
// from it, counted ceilings nobody can spend against.
//
// The dashboard used to make that join itself, in the browser, from the campaign
// list and the ceilings. campaign-service serves it now, decomposed by
// offer / campaign / ceiling so no consumer sums anything.
// ---------------------------------------------------------------------------

/** ONE campaign inside the answer: whether it is running, and what it may spend. */
const SpendableCampaignSchema = z.object({
  campaignId: z.string(),
  status: z.string(),
  running: z.boolean(),
  featureSlug: z.string().nullable(),
  offerId: z.string().nullable(),
  configuredDailyBudgetCents: z.coerce.number(),
  runningDailyBudgetCents: z.coerce.number(),
});

/** ONE offer's own totals, plus the campaigns that produced them. */
const SpendableOfferSchema = z.object({
  offerId: z.string().nullable(),
  configuredDailyBudgetCents: z.coerce.number(),
  runningDailyBudgetCents: z.coerce.number(),
  campaignIds: z.array(z.string()),
});

const BrandSpendableBudgetResponseSchema = z.object({
  brandId: z.string(),
  // Which billing width the figures were computed at. Read only to explain a
  // figure; exactly one width is ever counted, since the coarser ones are
  // billing's own sums of the finer.
  grain: z.string(),
  // What the customer SET. A paused campaign's settings screen must still be able
  // to state this, which is why the producer serves both rather than one.
  configuredDailyBudgetCents: z.coerce.number(),
  // The part of it standing behind a campaign that is ONGOING right now.
  runningDailyBudgetCents: z.coerce.number(),
  offers: z.array(SpendableOfferSchema),
  campaigns: z.array(SpendableCampaignSchema),
});

export type BrandSpendableBudget = z.infer<typeof BrandSpendableBudgetResponseSchema>;

/**
 * GET /brands/:brandId/spendable-budget — both daily-budget figures for a brand,
 * with the per-offer and per-campaign decompositions.
 *
 * Fail loud on a shape mismatch, like every other reader here: a money figure that
 * silently parsed to nothing would render as "this brand spends nothing", which is
 * a different statement from "we could not read it".
 */
export async function getBrandSpendableBudget(
  brandId: string,
  token?: string,
): Promise<BrandSpendableBudget> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/spendable-budget`, { token });
  const parsed = BrandSpendableBudgetResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getBrandSpendableBudget: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getBrandSpendableBudget: invalid response shape");
  }
  return parsed.data;
}

// ── Per-lead step statements (lead-service v0.57.0 via the api-service proxy) ──
//
// What happened to ONE lead at each step its campaign's legs reach, stated by a
// person rather than measured. lead-service writes an `outcome` into the SAME conversion
// ledger every consumer already counts, so a statement moves the brand's outcome counts
// on the next read with nothing to change downstream; a `never` goes to a store no count
// reads, so it can never move a number.
//
// `id` here is the leads_campaigns ROW id — the `id` a leads-table row already carries,
// NOT `lead.leadId` (the person). The row is what carries the campaign, which is how a
// statement made on a campaign screen is attributable to that campaign.

/** The steps lead-service accepts a statement on. Its spelling, not ours. */
export type LeadStepName = "signup" | "meeting_booked" | "meeting_attended" | "form_submission" | "sale";

export type LeadStepState = "outcome" | "never" | "pending";

/**
 * State what happened at one step, or that it never will.
 *
 * Correcting one is a WITHDRAWAL (below), not the opposite statement: stating the other
 * thing to undo a mistake is itself a false statement, and it keeps counting. An outcome
 * still supersedes an earlier `never` on its own — that is the step order resolving a
 * contradiction, a different fact from somebody taking their own words back.
 */
export async function setLeadStepStatement(
  leadRowId: string,
  body: {
    step: LeadStepName;
    kind: "outcome" | "never";
    /**
     * What the step cost the CUSTOMER, in cents. MANDATORY on every statement, outcome
     * and "never" alike: lead-service 400s with code `cost_required` without it, and a
     * meeting that was run and went nowhere still cost what it cost. `0` is a legal
     * answer and is recorded as a stated zero; there is no default, because an absent
     * answer and a stated zero are different statements.
     */
    costCents: number;
    valueCents?: number;
    /**
     * Whether OUR outreach caused this outcome. Optional, and a 400 on a `never` —
     * nothing happened, so nothing caused it.
     *
     * OMITTING it is a real third answer, not a default: the producer records `null`,
     * which reads as "nobody was asked", and that is what every deal stated before the
     * field shipped carries. So a caller that cannot ask the question must leave it out
     * rather than guessing either way.
     */
    causedByOutreach?: boolean;
    note?: string;
    occurredAt?: string;
  },
  token?: string,
): Promise<unknown> {
  return apiCall<unknown>(`/leads/${leadRowId}/step-statements`, {
    token,
    method: "POST",
    body,
  });
}

/**
 * Say the next follow-up to this person is owed NOW.
 *
 * A customer looking at a lead whose next answer is days out can bring it forward:
 * lead-service writes the due date and releases any claim, so the campaign that answers
 * interested buyers picks that person up on its next turn instead of waiting the
 * schedule out. Until api-service#911 the whole follow-up surface was service-to-service
 * only, so no browser could state anything about it.
 *
 * `kind: "scheduled"` and the timestamp are lead-service's own vocabulary, forwarded
 * verbatim by the gateway. `now` is stated by the CALLER rather than left to the
 * producer: the person pressing the button is saying "at this moment", and lead-service
 * bounds it (never in the past beyond a few minutes of clock slack, never past its
 * horizon) rather than clamping it to something nobody asked for.
 *
 * The response is the resulting follow-up state. Nothing here reads it — the line that
 * renders it is drawn from the lead's HISTORY, which moves as a whole (the timeline gains
 * a row), so the caller re-reads that rather than patching one field of it.
 */
export async function setLeadFollowupNow(
  leadRowId: string,
  now: Date = new Date(),
  token?: string,
): Promise<unknown> {
  return apiCall<unknown>(`/leads/${leadRowId}/followups`, {
    token,
    method: "POST",
    body: { kind: "scheduled", dueAt: now.toISOString() },
  });
}

/**
 * Whose win each step the customer's own CRM evidences was (lead-service), for one lead
 * row: the evidence, the default rule's answer, a person's override, and which stands.
 * Scoped by `brandId` because the answer is about the person within the brand.
 */
export async function getLeadCrmAttribution(
  leadRowId: string,
  brandId: string,
  token?: string,
): Promise<CrmAttribution> {
  const raw = await apiCall<unknown>(
    `/leads/${leadRowId}/crm-attribution?brandId=${encodeURIComponent(brandId)}`,
    { token },
  );
  const parsed = CrmAttributionSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getLeadCrmAttribution: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getLeadCrmAttribution: invalid response shape");
  }
  return parsed.data;
}

/**
 * A person states whose win one CRM-evidenced step was. Outranks the date rule until
 * withdrawn. lead-service answers 409 `no_crm_evidence` for a step their CRM does not
 * evidence.
 */
export async function setLeadCrmAttribution(
  leadRowId: string,
  step: string,
  brandId: string,
  causedByOutreach: boolean,
  token?: string,
): Promise<void> {
  await apiCall<unknown>(
    `/leads/${leadRowId}/crm-attribution/${step}?brandId=${encodeURIComponent(brandId)}`,
    { token, method: "PUT", body: { causedByOutreach } },
  );
}

/** Withdraw a person's answer on one step: the date rule's answer stands again. */
export async function withdrawLeadCrmAttribution(
  leadRowId: string,
  step: string,
  brandId: string,
  token?: string,
): Promise<void> {
  await apiCall<unknown>(
    `/leads/${leadRowId}/crm-attribution/${step}?brandId=${encodeURIComponent(brandId)}`,
    { token, method: "DELETE" },
  );
}

// The welcome signup gift is NOT front-end editable. Its grant amount is
// code-owned and pinned at boot by instrumentation.ts (WELCOME_GIFT_CENTS →
// PATCH /v1/promo-codes/welcome). No dashboard read/write helper exists by design.

// ── Effective sales economics (new-campaign prefill) ──
// brand-service decides the default server-side: the brand's saved set when present
// (source "user"), else the cross-brand average (source "cross-brand-average"), else
// economics null (source null → empty table; caller keeps its hard-coded defaults).
// Replaces the old client-side null→average fallback (two calls) with ONE call.
export interface EffectiveSalesEconomics {
  lifetimeRevenueUsd: number;
  replyToMeetingPct: number;
  visitToMeetingPct: number;
  meetingToClosePct: number;
  visitToSignupPct: number;
  signupToPaidClientPct: number;
  visitToClosePct: number;
}

export type SalesEconomicsSource = "user" | "cross-brand-average";

// z.coerce.number per CLAUDE.md #1357: the cross-brand average is Postgres
// ROUND(AVG(...)) `numeric`, serialized as a STRING ("40") on the wire — z.number()
// would reject it. coerce parses string OR number, forward-compatible if cast later.
const EffectiveSalesEconomicsSchema = z.object({
  lifetimeRevenueUsd: z.coerce.number(),
  replyToMeetingPct: z.coerce.number(),
  visitToMeetingPct: z.coerce.number(),
  meetingToClosePct: z.coerce.number(),
  visitToSignupPct: z.coerce.number(),
  signupToPaidClientPct: z.coerce.number(),
  visitToClosePct: z.coerce.number(),
});

const GetSalesEconomicsEffectiveResponseSchema = z.object({
  economics: EffectiveSalesEconomicsSchema.nullable(),
  source: z.enum(["user", "cross-brand-average"]).nullable(),
});

/** GET /brands/:brandId/sales-economics-effective — the brand's saved set (source "user"),
 * else the cross-brand average (source "cross-brand-average"), else { economics: null, source: null }. */
export async function getSalesEconomicsEffective(
  brandId: string,
  token?: string,
): Promise<{ economics: EffectiveSalesEconomics | null; source: SalesEconomicsSource | null }> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/sales-economics-effective`, { token });
  const parsed = GetSalesEconomicsEffectiveResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getSalesEconomicsEffective: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getSalesEconomicsEffective: invalid response shape");
  }
  return parsed.data;
}

// ── Audiences (human-service via gateway /orgs/audiences/*) ──────────
// A saved people-filter-set, brand-scoped, generated from a natural-language
// prompt by human-service `/suggest` (apollo + apify candidates, dry-run
// counted). This is the unified "audience" concept that replaces the legacy
// brand-service persona. human-service OWNS these rows; the dashboard reaches
// them through the api-service gateway, never brand-service.

export type AudienceStatus = "suggested" | "active" | "paused" | "archived" | "deprecated";

export interface AudienceCandidate {
  // The PERSISTED audience row id — /suggest creates each candidate at status
  // "suggested" (inactive). Activating a pick = PATCH this id's status to "active".
  audienceId: string;
  name: string;
  rationale: string;
  provider: "apollo" | "apify";
  filters: Record<string, unknown>;
  // The winning provider's free dry-run match count (0 = no valid non-empty filters).
  count: number;
  status: AudienceStatus;
  validationError: string | null;
  truncated: boolean;
  // apollo-service's own verdict on the filter set it built: true when its refine
  // loop judged no candidate a good fit and returned the best attempt anyway rather
  // than failing. INFORMATION, never a gate — a degraded audience is served,
  // persisted and activatable exactly like any other, and the customer decides.
  // OPTIONAL in the reader although the producer marks it required: an older
  // human-service deploy does not send it, and absent means not degraded. Never
  // infer it from counts or filter shapes; render the flag the backend sends.
  degraded?: boolean;
}

const AudienceStatusSchema = z.union([
  z.literal("suggested"),
  z.literal("active"),
  z.literal("paused"),
  z.literal("archived"),
  z.literal("deprecated"),
]);

const AudienceCandidateSchema = z.object({
  audienceId: z.string(),
  name: z.string(),
  rationale: z.string(),
  provider: z.union([z.literal("apollo"), z.literal("apify")]),
  filters: z.record(z.string(), z.unknown()),
  count: z.number(),
  status: AudienceStatusSchema,
  validationError: z.string().nullable(),
  truncated: z.boolean(),
  degraded: z.boolean().optional(),
});

const SuggestAudiencesResponseSchema = z.object({
  candidates: z.array(AudienceCandidateSchema),
});

/**
 * POST /orgs/audiences/suggest — natural-language prompt → candidate audiences.
 * ONE candidate per audience (the winning provider, larger free dry-run count).
 * Each candidate is PERSISTED at status "suggested" (inactive); the user picks
 * one or more, which are ACTIVATED via `setAudienceStatus(audienceId, "active")`.
 * Unpicked candidates remain suggested/inactive.
 */
// Cold human-service (audience suggest) + brand-service (ICP) calls can HANG,
// not just fail — a backend 502/partial-failure that never closes the socket
// leaves the request PENDING forever. The onboarding audience step's loaders
// (the prewarm `.finally`, `runSuggest`'s `finally`) only clear on settle, and a
// hang never settles → eternal "Generating…" spinner. Bounding the request turns
// a hang into a rejection so the existing catch/finally clears the loader + shows
// the error. 2 min is generous for a slow cold suggest but finite.
const SUGGEST_TIMEOUT_MS = 120_000;

export async function suggestAudiences(
  brandId: string,
  nlPrompt: string,
  token?: string,
): Promise<{ candidates: AudienceCandidate[] }> {
  const raw = await withTimeout(
    apiCall<unknown>(`/orgs/audiences/suggest`, {
      token,
      method: "POST",
      body: { brandId, nlPrompt },
    }),
    SUGGEST_TIMEOUT_MS,
    "suggestAudiences",
  );
  const parsed = SuggestAudiencesResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] suggestAudiences: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] suggestAudiences: invalid response shape");
  }
  return parsed.data;
}

// ── Audience split: the "New organization" modal's audiences step ───────────
// human-service splits a confirmed "who do you sell to?" into at most 6 segments that
// do not overlap, along axes a people search can filter on, persisting nothing; the
// confirm creates the kept ones as ACTIVE audiences under the brand and offer. No
// search and no count runs on either call: the Apollo filters are built later.

const AudienceSegmentProposalSchema = z.object({
  name: z.string(),
  description: z.string(),
  /** Phosphor icon name, kebab-case, from human-service's closed vocabulary. */
  icon: z.string(),
  iconConfidence: z.number(),
  /** human-service's instant rough guess of the people the segment reaches; null when it has none. */
  estimatedLeadCount: z.number().nullish(),
});
export type AudienceSegmentProposal = z.infer<typeof AudienceSegmentProposalSchema>;

const SplitAudiencesResponseSchema = z.object({
  /** Read as plain strings: the axis vocabulary is the producer's and may grow. */
  axes: z.array(z.string()),
  segments: z.array(AudienceSegmentProposalSchema),
});

export async function proposeAudienceSegments(
  brandId: string,
  targetAudience: string,
  token?: string,
): Promise<{ axes: string[]; segments: AudienceSegmentProposal[] }> {
  const raw = await withTimeout(
    apiCall<unknown>(`/orgs/audiences/split`, { token, method: "POST", body: { brandId, targetAudience } }),
    SUGGEST_TIMEOUT_MS,
    "proposeAudienceSegments",
  );
  const parsed = SplitAudiencesResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] proposeAudienceSegments: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] proposeAudienceSegments: invalid response shape");
  }
  return parsed.data;
}

export async function confirmAudienceSegments(
  brandId: string,
  offerId: string,
  targetAudience: string,
  segments: ReadonlyArray<Pick<AudienceSegmentProposal, "name" | "description">>,
  token?: string,
): Promise<{ audiences: Array<{ id: string; name: string }> }> {
  const raw = await apiCall<unknown>(`/orgs/audiences/split/confirm`, {
    token,
    method: "POST",
    body: {
      brandId,
      offerId,
      targetAudience,
      segments: segments.map((s) => ({ name: s.name, description: s.description })),
    },
  });
  const parsed = z
    .object({ audiences: z.array(z.object({ id: z.string(), name: z.string() }).passthrough()) })
    .safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] confirmAudienceSegments: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] confirmAudienceSegments: invalid response shape");
  }
  return parsed.data;
}

const PortfolioAudienceSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    /** cold = a segment of the ICP split; signal = the whole ICP narrowed to one buying signal. Read as a string: the producer's vocabulary. */
    kind: z.string(),
    adopted: z.boolean(),
  })
  .passthrough();
const PortfolioSignalOutcomeSchema = z
  .object({
    type: z.string(),
    /** created | below_threshold | failed, the producer's words. */
    outcome: z.string(),
    companies: z.number().nullable(),
    audienceId: z.string().nullable(),
  })
  .passthrough();
const LaunchAudiencePortfolioResponseSchema = z.object({
  portfolioId: z.string(),
  replayed: z.boolean(),
  audiences: z.array(PortfolioAudienceSchema),
  signals: z.array(PortfolioSignalOutcomeSchema),
});
export type LaunchAudiencePortfolioResponse = z.infer<typeof LaunchAudiencePortfolioResponseSchema>;

/**
 * POST /orgs/audiences/portfolio: at the terminal launch, human-service turns the
 * customer's ICP text into the brand + offer's ACTIVE audience portfolio: the cold
 * split (the rows a pre-payment flow already confirmed are adopted, never copied)
 * plus one buying-signal audience per signal that reaches enough companies. Every
 * audience carries the same target, so the pre-pay screen filters them all alike.
 * Idempotent per (brand, offer): a resumed launch replays the same set.
 */
export async function launchAudiencePortfolio(
  brandId: string,
  offerId: string,
  targetAudience: string,
  token?: string,
): Promise<LaunchAudiencePortfolioResponse> {
  const raw = await apiCall<unknown>(`/orgs/audiences/portfolio`, {
    token,
    method: "POST",
    body: { brandId, offerId, targetAudience },
  });
  const parsed = LaunchAudiencePortfolioResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] launchAudiencePortfolio: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] launchAudiencePortfolio: invalid response shape");
  }
  if (parsed.data.audiences.length === 0) {
    console.error("[dashboard] launchAudiencePortfolio: no audience launched", { brandId, offerId, raw });
    throw new Error("[dashboard] launchAudiencePortfolio: the portfolio holds no audience");
  }
  return parsed.data;
}

/** The ICP text the customer validated, saved on the brand as its `targetAudience` user-field. */
export async function readBrandTargetAudience(brandId: string, token?: string): Promise<string> {
  const { fields } = await getBrandUserFields(brandId, token);
  const value = fields.targetAudience?.value;
  const text = typeof value === "string" ? value.trim() : Array.isArray(value) ? value.join("\n").trim() : "";
  if (!text) {
    console.error("[dashboard] readBrandTargetAudience: the brand holds no targetAudience", { brandId });
    throw new Error("We could not find who you sell to on this brand. Go back to that step and save it again.");
  }
  return text;
}

export interface AudienceWire {
  id: string;
  orgId: string;
  brandId: string;
  name: string;
  nlPrompt: string | null;
  /** Per-audience one-sentence description (what THIS audience targets). Distinct
   *  from `nlPrompt` (the shared multi-audience batch request). Optional until
   *  human-service serves it in prod (decoupled rollout). */
  description?: string | null;
  provider: string | null;
  /** The OFFER (Org > Brand > Offer > Campaign) this audience belongs to. An audience is
   *  assembled for one distinct thing the brand sells, so its detail page lives under that
   *  offer — this is what a link to it is built from, at every scope. `null` = never filed
   *  under an offer (rows predating the offer level), so there is no page to send a reader
   *  to. Required on the wire, so required here: a renamed or absent field would read
   *  `undefined` forever and every audience link would quietly disappear. */
  offerId: string | null;
  status: AudienceStatus;
  source: string | null;
  filters: Record<string, unknown> | null;
  /** AI-generated avatar as a self-contained data: URI. Null = none yet. */
  avatarUrl: string | null;
  apolloCount: number | null;
  apifyCount: number | null;
  /** Total contactable audience pool (the "Size" column). Backend-computed;
   *  the denominator `availableToContactPct` divides by. Optional until
   *  human-service serves it in prod (decoupled rollout). */
  sizeCount?: number;
  /** Pool members currently contactable (not suppressed within the 3-month
   *  re-contact window). Backend-owned; never computed client-side. */
  availableToContactCount?: number;
  /** availableToContactCount / sizeCount * 100, integer 0–100 (the "Remaining"
   *  column). Backend-computed so Size and this % stay coherent. */
  availableToContactPct?: number;
  countedAt: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

const AudienceSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  brandId: z.string(),
  name: z.string(),
  nlPrompt: z.string().nullable(),
  description: z.string().nullable().optional(),
  provider: z.string().nullable(),
  offerId: z.string().nullable(),
  status: AudienceStatusSchema,
  source: z.string().nullable(),
  filters: z.record(z.string(), z.unknown()).nullable(),
  avatarUrl: z.string().nullable(),
  apolloCount: z.number().nullable(),
  apifyCount: z.number().nullable(),
  // Postgres count columns can serialize as string → coerce. Optional until
  // human-service ships the fields (decoupled rollout); absent renders "—".
  sizeCount: z.coerce.number().optional(),
  availableToContactCount: z.coerce.number().optional(),
  availableToContactPct: z.coerce.number().optional(),
  countedAt: z.string().nullable(),
  createdByUserId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const AudienceResponseSchema = z.object({ audience: AudienceSchema });

// ── Up to 100 companies of an audience, one person each ────────────────────────
// human-service `GET /orgs/audiences/{id}/preview/companies?offset&limit`: built
// progressively (each call builds only as far as offset+limit), stored once per
// audience, rows stable in order. Never an email or a phone; a last name is masked.
// A field Apollo did not give is null. `status` / `reason` are the producer's
// vocabulary and are read as plain strings.

const AudienceCompanyRowSchema = z.object({
  index: z.number(),
  company: z.object({
    name: z.string(),
    domain: z.string().nullable(),
    website: z.string().nullable(),
    logoUrl: z.string().nullable(),
    description: z.string().nullable(),
    location: z.string().nullable(),
    city: z.string().nullable(),
    country: z.string().nullable(),
    employeeCount: z.number().nullable(),
    industry: z.string().nullable(),
    linkedinUrl: z.string().nullable(),
    foundedYear: z.number().nullable(),
    // Additive, declared optional so an older body still parses.
    annualRevenue: z.string().nullable().optional(),
    totalFunding: z.string().nullable().optional(),
    latestFundingStage: z.string().nullable().optional(),
    keywords: z.array(z.string()).optional(),
  }),
  person: z.object({
    firstName: z.string().nullable(),
    lastNameObfuscated: z.string().nullable(),
    title: z.string().nullable(),
    linkedinUrl: z.string().nullable(),
  }),
});
export type AudienceCompanyRow = z.infer<typeof AudienceCompanyRowSchema>;

const AudienceCompaniesSchema = z.object({
  audienceId: z.string(),
  status: z.string(),
  reason: z.string().nullable(),
  rows: z.array(AudienceCompanyRowSchema),
  totalAvailable: z.number(),
  nextOffset: z.number().nullable(),
  done: z.boolean(),
  maxRows: z.number(),
});
export type AudienceCompanies = z.infer<typeof AudienceCompaniesSchema>;

export async function getAudienceCompanies(
  audienceId: string,
  page: { offset: number; limit: number },
  token?: string,
): Promise<AudienceCompanies> {
  const raw = await apiCall<unknown>(
    `/orgs/audiences/${audienceId}/preview/companies?offset=${page.offset}&limit=${page.limit}`,
    { token, headers: { "x-run-id": globalThis.crypto.randomUUID() } },
  );
  const parsed = AudienceCompaniesSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getAudienceCompanies: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] getAudienceCompanies: invalid response shape");
  }
  return parsed.data;
}

// One row's person, found and verified live (the first 10 rows only). POST runs ONE
// billed reveal + verify (~6-7s) and is idempotent: a settled row answers at once with
// no spend. The address is never returned, only its masked domain.
const CompanyRowEmailCheckSchema = z.object({
  index: z.number(),
  status: z.string(),
  finder: z.string().nullable(),
  verifier: z.string().nullable(),
  verdict: z.string().nullable(),
  deliverable: z.boolean().nullable(),
  maskedEmail: z.string().nullable(),
  checkedAt: z.string().nullable(),
});
export type CompanyRowEmailCheck = z.infer<typeof CompanyRowEmailCheckSchema>;

export async function checkAudienceCompanyEmail(audienceId: string, index: number, token?: string): Promise<CompanyRowEmailCheck> {
  const raw = await apiCall<unknown>(`/orgs/audiences/${audienceId}/preview/companies/${index}/email-check`, {
    token,
    method: "POST",
    headers: { "x-run-id": globalThis.crypto.randomUUID() },
  });
  const parsed = CompanyRowEmailCheckSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] checkAudienceCompanyEmail: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] checkAudienceCompanyEmail: invalid response shape");
  }
  return parsed.data;
}

// ── One cold email, written before any campaign exists ────────────────────────
// content-generation-service `POST /preview-email` (v0.35.6): the product's real
// writing (same template, brand intel and model as live campaigns) for a brand of the
// calling org and a sample recipient. Billed to the calling org (402 when it cannot
// afford it); creates nothing sendable; the same inputs return the stored email.

const PreviewEmailSchema = z.object({
  id: z.string(),
  brandId: z.string(),
  brandName: z.string(),
  recipient: z.object({
    firstName: z.string(),
    lastName: z.string(),
    title: z.string(),
    companyName: z.string(),
  }).passthrough(),
  subject: z.string(),
  bodyText: z.string(),
  bodyHtml: z.string(),
  model: z.string(),
  // Why each sentence is there and which input it rests on (content-generation
  // v0.35.7). Null for a preview stored before highlights existed; `kind` read as a
  // plain string so a new source kind parses.
  highlights: z
    .array(
      z.object({
        text: z.string(),
        start: z.number(),
        end: z.number(),
        kind: z.string(),
        source: z.string(),
        sourceLabel: z.string(),
        sourceValue: z.string().nullable(),
        reason: z.string(),
      }),
    )
    .nullish(),
  cached: z.boolean(),
  createdAt: z.string(),
});
export type PreviewEmailHighlight = NonNullable<z.infer<typeof PreviewEmailSchema>["highlights"]>[number];
export type PreviewEmail = z.infer<typeof PreviewEmailSchema>;

export interface PreviewEmailRecipient {
  firstName: string;
  lastName: string;
  title: string;
  companyName: string;
  companyDomain?: string;
}

export async function previewColdEmail(
  input: { brandId: string; recipient: PreviewEmailRecipient; audience?: string; offerId?: string | null },
  token?: string,
): Promise<PreviewEmail> {
  const raw = await apiCall<unknown>(`/content/preview-email`, {
    token,
    method: "POST",
    body: {
      brandId: input.brandId,
      recipient: input.recipient,
      ...(input.audience ? { audience: input.audience } : {}),
      ...(input.offerId ? { offerId: input.offerId } : {}),
    },
    headers: { "x-run-id": globalThis.crypto.randomUUID() },
  });
  const parsed = PreviewEmailSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] previewColdEmail: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] previewColdEmail: invalid response shape");
  }
  return parsed.data;
}


/**
 * PATCH /orgs/audiences/:audienceId/status — change an audience's lifecycle status
 * (mutates only status). Used to ACTIVATE a suggested candidate ("suggested" →
 * "active") so it's selected for the brand; unpicked candidates stay suggested.
 */
export async function setAudienceStatus(
  audienceId: string,
  status: AudienceStatus,
  token?: string,
): Promise<{ audience: AudienceWire }> {
  const raw = await apiCall<unknown>(`/orgs/audiences/${audienceId}/status`, {
    token,
    method: "PATCH",
    body: { status },
  });
  const parsed = AudienceResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] setAudienceStatus: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] setAudienceStatus: invalid response shape");
  }
  return parsed.data;
}

/**
 * POST /orgs/audiences/:audienceId/avatar — (re)generate the audience's avatar
 * image via chat-service (which owns the cost). Optional `prompt` steers the
 * image; omitted ⟹ derived from the audience's own descriptors. Returns the
 * updated audience with `avatarUrl` populated (a self-contained data: URI).
 * May 402 (insufficient credits) — surface via the billing guard at the call site.
 */
export async function generateAudienceAvatar(
  audienceId: string,
  prompt?: string,
  token?: string,
): Promise<{ audience: AudienceWire }> {
  const raw = await apiCall<unknown>(`/orgs/audiences/${audienceId}/avatar`, {
    token,
    method: "POST",
    body: prompt ? { prompt } : {},
  });
  const parsed = AudienceResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] generateAudienceAvatar: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] generateAudienceAvatar: invalid response shape");
  }
  return parsed.data;
}

const ListAudiencesResponseSchema = z.object({
  audiences: z.array(AudienceSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

/** GET /orgs/audiences?brandId= — saved audiences for a brand, or for one OFFER.
 *
 *  An audience belongs to an offer (human-service carries `offerId` on the row),
 *  so an offer-scoped surface passes it and gets exactly that proposition's
 *  audiences. Omitting it is the brand-wide read, unchanged. */
export async function listAudiences(
  brandId: string,
  params?: { status?: AudienceStatus; limit?: number; offset?: number; offerId?: string },
  token?: string,
): Promise<{ audiences: AudienceWire[]; total: number }> {
  const query = new URLSearchParams({ brandId });
  if (params?.offerId) query.set("offerId", params.offerId);
  if (params?.status) query.set("status", params.status);
  if (params?.limit !== undefined) query.set("limit", String(params.limit));
  if (params?.offset !== undefined) query.set("offset", String(params.offset));
  const raw = await apiCall<unknown>(`/orgs/audiences?${query.toString()}`, { token });
  const parsed = ListAudiencesResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] listAudiences: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] listAudiences: invalid response shape");
  }
  return { audiences: parsed.data.audiences, total: parsed.data.total };
}

/** One person matched to their audience memberships (audience id + name). */
export interface AudienceMembershipMatch {
  personId: string;
  emailNorm: string | null;
  fullName: string | null;
  audiences: { audienceId: string; name: string }[];
}

const AudienceMembershipMatchSchema = z.object({
  personId: z.string(),
  emailNorm: z.string().nullable(),
  fullName: z.string().nullable(),
  audiences: z.array(z.object({ audienceId: z.string(), name: z.string() })),
});

// Only `matched` is consumed (lead → audience membership); `unmatched`/`byAudience`
// are passthrough — `.passthrough()` keeps them without re-declaring.
const AudienceStatsResponseSchema = z
  .object({ matched: z.array(AudienceMembershipMatchSchema) })
  .passthrough();

/**
 * POST /orgs/audiences/stats — per-audience membership for a list of emails (or
 * personIds). Used by the overview lead detail panel to answer "which audience
 * does this lead belong to" on-demand: pass the clicked lead's email, get back
 * its audience memberships, then join `audienceId` to `listAudiences` for the
 * audience name / description / avatar / targeting filters. human-service owns
 * the mapping; the dashboard never derives it.
 */
export async function getAudienceMembershipStats(
  args: { emails?: string[]; personIds?: string[] },
  token?: string,
): Promise<{ matched: AudienceMembershipMatch[] }> {
  const raw = await apiCall<unknown>(`/orgs/audiences/stats`, {
    token,
    method: "POST",
    body: args,
  });
  const parsed = AudienceStatsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getAudienceMembershipStats: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] getAudienceMembershipStats: invalid response shape");
  }
  return { matched: parsed.data.matched };
}

const SuggestBrandIcpResponseSchema = z.object({ icp: z.string() });

/**
 * POST /brands/:brandId/icp/suggest — brand-service writes ONE short plain-language
 * ICP line for the brand (seeded from its profile + sales economics). Used to
 * pre-fill the onboarding audience-step prompt. `existingIcps` lets the caller ask
 * for an ICP distinct from / complementary to ones already chosen.
 */
export async function suggestBrandIcp(
  brandId: string,
  existingIcps?: string[],
  token?: string,
): Promise<{ icp: string }> {
  // Same hang class as suggestAudiences — the prewarm awaits this FIRST, so a
  // hung ICP call stalls the audience prewarm before suggestAudiences even runs.
  const raw = await withTimeout(
    apiCall<unknown>(`/brands/${brandId}/icp/suggest`, {
      token,
      method: "POST",
      body: existingIcps && existingIcps.length > 0 ? { existingIcps } : {},
    }),
    SUGGEST_TIMEOUT_MS,
    "suggestBrandIcp",
  );
  const parsed = SuggestBrandIcpResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] suggestBrandIcp: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] suggestBrandIcp: invalid response shape");
  }
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Confirmed brand USER-FIELDS (2-layer brand-fields model, brand-service).
//
// The 7 user-facing fields a user validates for their brand. Each carries a
// provenance tag:
//   - "confirmed"  — the user saved this value.
//   - "suggested"  — a user-facing field not yet confirmed; the value is the AI
//                    prefill (from extraction). The UI surfaces this as
//                    "AI-suggested" so the user knows it is a draft.
//   - "extracted"  — backend-only auto-extracted field (should not appear in the
//                    7 user-facing keys, but tolerated in the schema).
//
// Everything OUTSIDE this set is auto-extracted + ephemeral (3-day cache) and is
// NOT user-editable — read it via the extract-fields endpoints, never here.
// `dreamOutcome` REPLACES the old `valueProposition` (label "Dream outcome"); it is
// extracted under its OWN key (see USER_PROFILE_FIELDS), never seeded from the
// valueProposition extraction — that is a separate backend-only field.
// ---------------------------------------------------------------------------
export const USER_FIELD_KEYS = [
  "services",
  "dreamOutcome",
  "perceivedLikelihood",
  "socialProof",
  "riskReversal",
  "urgency",
  "scarcity",
] as const;
export type UserFieldKey = (typeof USER_FIELD_KEYS)[number];

/**
 * The offer's two give lists (brand-service #584): what the brand gives a prospect who
 * replies, and what an email must never promise. Stored like the levers but kept OUT of
 * `USER_FIELD_KEYS` on purpose: the lever editors send every key of that list on save,
 * empties included, so listing these there would clear them on every lever edit.
 */
export const GIVE_LIST_KEYS = ["giveForFree", "neverGive"] as const;
export type GiveListKey = (typeof GIVE_LIST_KEYS)[number];

export type FieldProvenance = "confirmed" | "suggested" | "extracted";
export type UserFieldValue = string | string[];
export interface UserField {
  /**
   * The confirmed value OR the AI-suggested prefill. `null` when the field is
   * unconfirmed and its prefill is empty/expired (or a legacy/degenerate row).
   */
  value: UserFieldValue | null;
  provenance: FieldProvenance;
}
/** The confirmed user-fields map, keyed by user-field key. */
export type BrandUserFields = Record<string, UserField>;

/**
 * A user-field VALUE as it can arrive on the wire. The deployed backend contract
 * types it LOOSELY — `string | string[] (items may be null) | object | null` —
 * because a "suggested" (unconfirmed / expired) prefill resolves to `null`, and
 * legacy rows can be an array-with-null-items or an object. A CONFIRMED value is
 * always a string or string[]. We normalize ANY non-(string | non-empty string[])
 * shape to `null` so a single unconfirmed/degenerate field can NEVER throw the
 * whole read and hide the sibling CONFIRMED values.
 *
 * This is the data-loss-recovery bug: a brand with 6 recovered confirmed fields +
 * 1 unconfirmed field whose suggested prefill was `null` rendered the Strategy
 * offer levers EMPTY, because the old `z.union([z.string(), z.array(z.string())])`
 * rejected that one `null` → `safeParse` threw → the entire query errored → NONE
 * of the confirmed values reached the page (and clearing browser storage never
 * helped, because the network read itself threw on every load).
 */
const UserFieldValueSchema = z.unknown().transform((v): UserFieldValue | null => {
  if (typeof v === "string") return v.trim().length > 0 ? v : null;
  if (Array.isArray(v)) {
    const strings = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
    return strings.length > 0 ? strings : null;
  }
  return null;
});
const UserFieldSchema = z.object({
  value: UserFieldValueSchema,
  provenance: z.enum(["confirmed", "suggested", "extracted"]),
});
export const BrandUserFieldsResponseSchema = z.object({
  fields: z.record(z.string(), UserFieldSchema),
});

/**
 * GET /brands/:brandId/user-fields — the 7 confirmed user-facing fields, each
 * with its value + provenance ("confirmed" | "suggested"). A "suggested" value
 * is the AI prefill the user has not yet confirmed.
 */
export async function getBrandUserFields(
  brandId: string,
  token?: string,
): Promise<{ fields: BrandUserFields }> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/user-fields`, { token });
  const parsed = BrandUserFieldsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getBrandUserFields: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] getBrandUserFields: invalid response shape");
  }
  return parsed.data;
}

/**
 * PUT /brands/:brandId/user-fields with the ONE key onboarding writes outside
 * the 7 offer fields: `targetAudience`, the customer's own words for who they
 * sell to. Same store the brand profile reads (it is a SALES_PROFILE_FIELDS
 * key), so whoever builds the audiences after payment finds it there. A
 * separate function rather than a widening of `saveBrandUserFields`: that one is
 * typed on the offer's 7 keys, and the guards around them pin the set.
 */
export async function saveBrandTargetAudience(
  brandId: string,
  targetAudience: string,
  token?: string,
): Promise<{ fields: BrandUserFields }> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/user-fields`, {
    token,
    method: "PUT",
    body: { fields: { targetAudience } },
  });
  const parsed = BrandUserFieldsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] saveBrandTargetAudience: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] saveBrandTargetAudience: invalid response shape");
  }
  return parsed.data;
}

/**
 * PUT /brands/:brandId/user-fields — save (confirm) one or more user-fields.
 * Body is `{ fields: { <key>: value } }`; every key sent is marked "confirmed".
 * Omit a key to leave its current value/provenance untouched. Returns the full
 * user-fields map (with the saved keys now "confirmed").
 */
export async function saveBrandUserFields(
  brandId: string,
  fields: Partial<Record<UserFieldKey, UserFieldValue>>,
  token?: string,
): Promise<{ fields: BrandUserFields }> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/user-fields`, { token, method: "PUT", body: { fields } });
  const parsed = BrandUserFieldsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] saveBrandUserFields: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] saveBrandUserFields: invalid response shape");
  }
  return parsed.data;
}

/**
 * GET /brands/:brandId/offers/:offerId/user-fields — the 7 user-facing fields for
 * ONE proposition. Byte-identical payload to the brand-scoped route (brand-service
 * reuses the schema), so the reader reuses the schema rather than declaring a
 * second copy that could drift from it.
 */
export async function getOfferUserFields(
  brandId: string,
  offerId: string,
  token?: string,
): Promise<{ fields: BrandUserFields }> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/offers/${offerId}/user-fields`, { token });
  const parsed = BrandUserFieldsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getOfferUserFields: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] getOfferUserFields: invalid response shape");
  }
  return parsed.data;
}

/**
 * PUT /brands/:brandId/offers/:offerId/user-fields — confirm one or more fields
 * for ONE proposition. Same body and same semantics as the brand-scoped write: a
 * key sent is confirmed, a key omitted is left as stored, and an emptied field is
 * sent (never omitted) so clearing it is expressible.
 */
export async function saveOfferUserFields(
  brandId: string,
  offerId: string,
  fields: Partial<Record<UserFieldKey | GiveListKey, UserFieldValue>>,
  token?: string,
): Promise<{ fields: BrandUserFields }> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/offers/${offerId}/user-fields`, {
    token,
    method: "PUT",
    body: { fields },
  });
  const parsed = BrandUserFieldsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] saveOfferUserFields: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] saveOfferUserFields: invalid response shape");
  }
  return parsed.data;
}

// Brand field extraction
export interface ExtractFieldDef {
  key: string;
  description: string;
}

/** Per-brand extraction metadata (byBrand[domain] entries) */
export interface BrandFieldExtraction {
  value: unknown;
  cached: boolean;
  extractedAt: string;
  expiresAt: string;
  sourceUrls: string[] | null;
}

export interface ExtractFieldResult {
  value: unknown;
  cached: boolean;
  extractedAt: string;
  expiresAt: string;
  sourceUrls: string[] | null;
  byBrand?: Record<string, BrandFieldExtraction>;
}

/** Brand summary returned in extract-fields response */
export interface ExtractFieldBrandInfo {
  brandId: string;
  domain: string;
  name: string;
}

/** Response shape for POST /brands/extract-fields (multi-brand) */
export interface ExtractFieldsResponse {
  brands: ExtractFieldBrandInfo[];
  fields: Record<string, ExtractFieldResult>;
}

/** A previously extracted and cached field (from GET /brands/:id/extracted-fields) */
export interface CachedField {
  key: string;
  value: unknown;
  sourceUrls: string[] | null;
  extractedAt: string;
  expiresAt: string;
}

/** Core sales profile fields — reproduces the old /sales-profile extraction */
export const SALES_PROFILE_FIELDS: ExtractFieldDef[] = [
  { key: "services", description: "The distinct paid services or products the brand explicitly sells to customers — exclude internal process steps, delivery sub-tasks and capabilities. Said differently, what package / product / service customers will pay for when they think about it. If one offering, list one. If different offerings appear in the content provided, list all. List each as a short phrase." },
  { key: "companyOverview", description: "Company overview" },
  { key: "valueProposition", description: "Core value proposition" },
  { key: "targetAudience", description: "Target audience description" },
  { key: "customerPainPoints", description: "Target pain points" },
  { key: "keyFeatures", description: "Key product features" },
  { key: "productDifferentiators", description: "Key differentiators" },
  { key: "competitors", description: "Known competitors" },
  { key: "leadership", description: "Key leadership team members, their roles and backgrounds" },
  { key: "funding", description: "Funding history: total raised, rounds, notable investors and backers" },
  { key: "awardsAndRecognition", description: "Awards, recognition, and industry accolades" },
  { key: "revenueMilestones", description: "Revenue milestones and key business metrics" },
  { key: "socialProof", description: "Social proof: case studies, testimonials, and results" },
  { key: "perceivedLikelihood", description: "Perceived likelihood of success: proof the outcome is achievable — track record, data, guarantees, named results and outcomes" },
  { key: "callToAction", description: "Primary CTA" },
  { key: "urgency", description: "Urgency elements and time pressure" },
  { key: "scarcity", description: "Scarcity and limited availability" },
  { key: "riskReversal", description: "Risk reversal: trials, guarantees, refund policy" },
  { key: "additionalContext", description: "Additional context and notable information" },
];

/**
 * The 7 USER-FACING fields (services + the 6 Hormozi offer levers) that onboarding
 * prefills and the user confirms — the exact `USER_FIELD_KEYS` set. Onboarding extracts
 * ONLY these (in `mode:"suggest"`, so every lever gets a best-effort inferred value and
 * never "Unknown"); it does NOT extract the backend-only fields in SALES_PROFILE_FIELDS
 * (funding/competitors/leadership/...), which the onboarding flow never reads (the
 * brand-info alpha page regenerates those on demand). `dreamOutcome` MUST be here — it is
 * a user-field key that SALES_PROFILE_FIELDS never listed (it kept the legacy
 * `valueProposition`), so the Dream-outcome lever had no extraction source and prefilled empty.
 */
export const USER_PROFILE_FIELDS: ExtractFieldDef[] = [
  { key: "services", description: "The distinct paid services or products the brand explicitly sells to customers — exclude internal process steps, delivery sub-tasks and capabilities. Said differently, what package / product / service customers will pay for when they think about it. If one offering, list one. If different offerings appear in the content provided, list all. List each as a short phrase." },
  { key: "dreamOutcome", description: "Dream outcome: the specific end result or transformation the customer most wants from this brand — the core promise every outreach email is written around. Make it concrete and worth wanting." },
  { key: "perceivedLikelihood", description: "Perceived likelihood of success: proof the outcome is achievable — track record, data, guarantees, named results and outcomes" },
  { key: "socialProof", description: "Social proof: case studies, testimonials, and results" },
  { key: "riskReversal", description: "Risk reversal: trials, guarantees, refund policy" },
  { key: "urgency", description: "Urgency elements and time pressure" },
  { key: "scarcity", description: "Scarcity and limited availability" },
];


/**
 * Persists the user's OPTIONAL onboarding phone number to Clerk user
 * publicMetadata via the in-repo server route (which holds CLERK_SECRET_KEY).
 * Fail-loud: a non-2xx throws so the caller surfaces it.
 */
export async function savePhoneNumber(input: {
  countryCode: string;
  dialCode: string;
  national: string;
}): Promise<void> {
  const res = await fetch("/api/onboarding/phone", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`Failed to save phone number (${res.status})`);
  }
}

/** Convert extract-fields results map to a key→value map (preserves raw types) */
export function fieldResultsToMap(results: Record<string, ExtractFieldResult>): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  for (const [key, r] of Object.entries(results)) map[key] = r.value;
  return map;
}

/** Flatten any field value to a string (for form pre-fill) */
export function flattenFieldValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((v) => flattenFieldValue(v)).filter(Boolean).join("\n");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v != null)
      .map(([k, v]) => {
        const flat = flattenFieldValue(v);
        return flat ? `${k}: ${flat}` : "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return String(value);
}

/** Convert extract-fields results map to a string map (for form pre-fill) */
export function fieldResultsToStringMap(results: Record<string, ExtractFieldResult>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [key, r] of Object.entries(results)) map[key] = flattenFieldValue(r.value);
  return map;
}

/** POST /brands/extract-fields — extract specific fields (cached 30 days per field).
 *  brandIds is required and must be a non-empty array. */
export async function extractBrandFields(
  brandIds: string[],
  fields: ExtractFieldDef[],
  opts?: {
    token?: string;
    resetCache?: boolean;
    urlStrategy?: "url_map" | "landing";
    mode?: "extract" | "suggest";
    /**
     * Keys to write again from scratch, ignoring whatever the user already confirmed
     * for them: their confirmed value is neither shown to the model as authoritative
     * context nor overlaid onto the response. Confirmed values for keys NOT listed
     * still reach the model, so regenerating the offer levers still sees the brand's
     * confirmed services. Nothing is persisted — the caller saves the reviewed draft.
     * Every key must also appear in `fields` or brand-service 400s.
     */
    regenerateFieldKeys?: string[];
    /**
     * Read the fields for ONE offer. A brand selling several offers refuses a
     * brand-scoped read (409 SEVERAL_OFFERS): each offer has its own value proposition.
     */
    offerId?: string;
  },
): Promise<ExtractFieldsResponse> {
  const { token, resetCache, urlStrategy, mode, regenerateFieldKeys, offerId } = opts ?? {};
  // `mode` (brand-service): omitted/"extract" = site-grounded (returns "Unknown" when
  // absent); "suggest" = a generative Hormozi + top-3-expert persona that infers a
  // best-effort value where the source is silent and never returns "Unknown". Onboarding
  // passes "suggest" for the user-facing offer levers + services (USER_PROFILE_FIELDS).
  return apiCall<ExtractFieldsResponse>(
    `/brands/extract-fields`,
    { token, method: "POST", body: { brandIds, fields, resetCache, urlStrategy, mode, regenerateFieldKeys, ...(offerId ? { offerId } : {}) } },
  );
}

/** GET /brands/:brandId/extracted-fields — list previously extracted and cached fields */
export async function listExtractedFields(
  brandId: string,
  token?: string,
): Promise<{ brandId: string; fields: CachedField[] }> {
  return apiCall<{ brandId: string; fields: CachedField[] }>(
    `/brands/${brandId}/extracted-fields`,
    { token },
  );
}

// ─── Feature prefill ───────────────────────────────────────────────────────

/** format=text response — flat string values */
export interface PrefillResponse {
  slug: string;
  brandId: string;
  prefilled: Record<string, string | null>;
}

/** format=full response — rich objects with byBrand metadata per domain */
export interface PrefillFullFieldResult {
  value: unknown;
  cached: boolean;
  sourceUrls: string[] | null;
  byBrand?: Record<string, BrandFieldExtraction>;
}

export interface PrefillFullResponse {
  slug: string;
  brandId: string;
  prefilled: Record<string, PrefillFullFieldResult>;
}

/**
 * POST /features/:slug/prefill?format=text — get pre-filled input values as plain strings
 *
 * `offerId` names WHICH proposition the values must describe. The keys this fills are
 * the offer's own words — the ask, the value proposition, the proof — and a brand
 * selling two things has two right answers, so brand-service refuses a brand-scoped
 * extraction for such a brand (409 SEVERAL_OFFERS) rather than guessing. Omitting it is
 * the pre-existing behaviour and stays byte-identical for a brand selling one thing:
 * the key is left OFF the body rather than sent null.
 *
 * It travels in the BODY, which is features-service's own choice — the api-service
 * gateway forwards this route's body verbatim while whitelisting only `format` on the
 * query string, so a body contract needed no gateway change (features-service #989).
 */
export async function prefillFeatureInputs(
  featureSlug: string,
  brandIds: string[],
  offerId?: string | null,
  token?: string,
): Promise<PrefillResponse> {
  return apiCall<PrefillResponse>(
    `/features/${featureSlug}/prefill?format=text`,
    { token, method: "POST", body: { brandIds, ...(offerId ? { offerId } : {}) } },
  );
}

/** Extract flat string map from prefill response */
export function prefillToStringMap(prefilled: Record<string, string | null>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [key, value] of Object.entries(prefilled)) {
    map[key] = value ?? "";
  }
  return map;
}

// ─── Features (from features-service) ──────────────────────────────────────

export interface FeatureInput {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "select";
  placeholder: string;
  description: string;
  extractKey: string;
  options?: string[];
}

export interface FeatureOutput {
  key: string;
  displayOrder: number;
  defaultSort?: boolean;
  sortDirection?: "asc" | "desc";
}

export interface FeatureEntity {
  name: string;
  countKey?: string;
}

export interface Feature {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon?: string;
  status: "active" | "draft" | "deprecated";
  implemented: boolean;
  displayOrder?: number;
  inputs: FeatureInput[];
  outputs: FeatureOutput[];
  /** The producer's chart declarations. Nothing in this app renders them. */
  charts?: unknown[];
  entities: FeatureEntity[];
  byokProvider?: string | null;
  workflowSlug?: string | null;
  /**
   * What this feature states about being an acquisition channel. NULL for a feature
   * that is not one (PR, hiring, VC). `listFeatures` runs no Zod, so declaring it here
   * is enough for it to arrive.
   */
  acquisitionChannel?: {
    operatedBy?: string;
    family?: string;
    stepTransitions?: { from?: string | null; to?: string }[];
  } | null;
}

// ─── Stats Registry & Stats Types ────────────────────────────────────────────

export interface StatsRegistryEntry {
  type: "count" | "rate" | "currency" | "score";
  label: string;
}

export type StatsRegistry = Record<string, StatsRegistryEntry>;

export interface SystemStats {
  totalCostInUsdCents: number;
  completedRuns: number;
  activeCampaigns: number;
  firstRunAt: string | null;
  lastRunAt: string | null;
}

export interface StatsGroup {
  workflowSlug?: string;
  workflowDynastySlug?: string;
  brandId?: string;
  campaignId?: string;
  featureSlug?: string;
  systemStats: SystemStats;
  stats: Record<string, number>;
}

export interface GlobalStatsResponse {
  groupBy?: string;
  systemStats: SystemStats;
  stats: Record<string, number>;
  groups?: StatsGroup[];
}

/** features-service's canonical Goal enum, minus the goals no brand can pick today.
 *  `websiteVisit` + `positiveReply` are the SINGLE-STEP goals (visit -> paid, reply -> paid);
 *  they are native on audience-stats, so a brand on either MUST send its own goal rather than
 *  borrow the nearest multi-step family — the borrow ranked workflows on the wrong outcome. */
export type FeatureAudienceStatsGoal =
  | "signup"
  | "meetingBooked"
  | "websitePurchase"
  | "sales"
  | "websiteVisit"
  | "positiveReply"
  | "formSubmission";
/** `returnPerDollar` is the BRAND-level order (descending, unmeasurable last); the two
 *  cost metrics order a campaign-scoped read (ascending, cheapest first). */
export type FeatureAudienceStatsSortMetric = "cpc" | "cppr" | "returnPerDollar";

export interface FeatureAudienceStatsRow {
  audienceId: string;
  brandProfileId: string | null;
  audience: {
    id: string;
    name: string;
    status: "active" | "paused" | "archived";
    filters: Record<string, unknown> | null;
    avatarUrl?: string | null;
  };
  evidence: {
    totalCostInUsdCents: number;
    completedRuns: number;
    firstRunAt: string | null;
    lastRunAt: string | null;
    contacted: number;
    websiteClicks: number;
    positiveReplies: number;
    /** REAL per-audience form-submission conversions (attributed, deduped). Present
     *  ONLY for the form_submissions goal; absent otherwise — never a fabricated 0. */
    formSubmissions?: number;
    /** REAL per-audience signup conversions (attributed by audience-member-email ∩
     *  signup-converted-lead emails, deduped). Present ONLY for the signups goal;
     *  absent otherwise / when the signup emails weren't served — never a fabricated
     *  0. Optional to decouple the rollout: renders "-" until features-service ships. */
    signups?: number;
    /** REAL per-audience SALES — paying clients won (lead-service conversion tracker,
     *  event=sale), attributed by the same membership join as signups. Present ONLY for
     *  the website_purchase OR combined-sales goals (both terminate in a `sale`); absent
     *  otherwise / when the emails weren't served — never a fabricated 0. */
    sales?: number | null;
  };
  metrics: {
    cpcCents: number | null;
    cpprCents: number | null;
    /** REAL cost per form submission = spend ÷ formSubmissions. Null when 0/absent
     *  (not the form_submissions goal, or emails not served). Never a false $0. */
    cpfsCents?: number | null;
    /** REAL cost per signup = spend ÷ signups. Null when 0/absent (not the signups
     *  goal, or emails not served). Never a false $0. Optional until the producer ships. */
    cpsCents?: number | null;
    /** REAL cost per sale = spend ÷ sales. Null when 0/absent (not the website_purchase
     *  / combined-sales goal, or emails not served). Never a false $0. */
    cpsaleCents?: number | null;
    /**
     * The five costs, OBSERVED (never floored: null at 0 outcomes), served twice with this
     * row's maturity verdict (lib/maturity.ts). The legacy fields above stay the floored
     * RANKING figures; a surface STATES the mature half and reads Learning on `isMature`.
     */
    maturity?: MaturityPair<AudienceCostFigures> | null;
  };
  /** PROJECTED return for this audience, on the brand's own economics. See
   *  {@link AudienceProjection}. Optional only for rollout tolerance — features-service
   *  v0.127.0 requires it on every row. */
  projection?: AudienceProjection & {
    /** The three projections served twice with this row's maturity verdict. */
    maturity?: MaturityPair<AudienceProjectionFigures> | null;
  };
}

/** One half of an audience row's `metrics.maturity` pair. */
export interface AudienceCostFigures {
  cpcCents: number | null;
  cpprCents: number | null;
  cpfsCents: number | null;
  cpsCents: number | null;
  cpsaleCents: number | null;
}

/** One half of an audience row's `projection.maturity` pair. */
export interface AudienceProjectionFigures {
  returnPerDollar: number | null;
  costOfAcquisitionPct: number | null;
  costPerPaidClientUsd: number | null;
}

/**
 * What an audience is PROJECTED to return, on the brand's own declared economics.
 *
 * Rank a brand's audiences on `returnPerDollar`, never on cost per outcome: cost per
 * outcome ranks by CHEAPNESS, so an audience that converts to nothing outranks an
 * expensive one that pays. It is the identical definition the brand's own return is
 * computed on, so an audience's return and the brand's return are one statistic at two
 * grains.
 *
 * Distinct from `/revenue`'s REALIZED `costEconomics.roiMultiple`, which divides
 * measured pipeline by measured spend — this is what the evidence projects.
 */
export interface AudienceProjection {
  /** PROJECTED cost to win ONE paying client from this audience — the denominator of
   *  `returnPerDollar`. Null (never 0) when there is no path to a paying client. */
  costPerPaidClientUsd: number | null;
  /** PROJECTED dollars of lifetime revenue per dollar spent. Null (never 0) when
   *  unmeasurable. An audience with no measured grain inherits `brandProjection`. */
  returnPerDollar: number | null;
  /** Brand-level read only: the lifetime revenue this row values a client at. */
  lifetimeRevenueUsd?: number | null;
  /**
   * PROJECTED cost of winning a customer as a SHARE of what that customer is worth —
   * `100 / returnPerDollar`, served rather than divided here so two surfaces cannot
   * print two numbers for one statistic.
   *
   * Do NOT pair it with `/revenue`'s `costEconomics.costOfAcquisitionPct`, which is
   * REALIZED (measured spend over measured pipeline). Same projected-vs-realized split
   * the return already carries against `roiMultiple`.
   */
  costOfAcquisitionPct?: number | null;
}

export interface FeatureAudienceStatsResponse {
  featureSlug: string;
  brandId: string;
  /** Null on the brand-level read — there is no goal there, only the return. */
  goal: FeatureAudienceStatsGoal | null;
  brandProfileId: string | null;
  sortMetric: FeatureAudienceStatsSortMetric;
  audiences: FeatureAudienceStatsRow[];
  /** The BRAND-level twin of every row's projection, on the same economics and the same
   *  formula — read a row's return against it ("this audience beats the brand"). */
  brandProjection?: AudienceProjection & {
    /** The lifetime revenue per paying client this whole payload was projected on,
     *  surfaced so a consumer can never pair a return with an LTR it did not use. */
    lifetimeRevenueUsd: number | null;
  };
  /** THE SCOPE'S MATURITY (features-service#1196): the same object the scope's /revenue
   *  serves, so a campaign's own price on its Audiences page is its Overview's figure. */
  maturity?: ScopeMaturity | null;
}

const AudienceProjectionSchema = z.object({
  costPerPaidClientUsd: z.coerce.number().nullable(),
  returnPerDollar: z.coerce.number().nullable(),
  costOfAcquisitionPct: z.coerce.number().nullable().optional(),
  lifetimeRevenueUsd: z.coerce.number().nullable().optional(),
});

const AudienceCostMaturitySchema = maturityPairSchema(
  z.object({
    cpcCents: z.coerce.number().nullable(),
    cpprCents: z.coerce.number().nullable(),
    cpfsCents: z.coerce.number().nullable(),
    cpsCents: z.coerce.number().nullable(),
    cpsaleCents: z.coerce.number().nullable(),
  }),
);
const AudienceProjectionMaturitySchema = maturityPairSchema(
  z.object({
    returnPerDollar: z.coerce.number().nullable(),
    costOfAcquisitionPct: z.coerce.number().nullable(),
    costPerPaidClientUsd: z.coerce.number().nullable(),
  }),
);

const FeatureAudienceStatsRowSchema = z.object({
  audienceId: z.string(),
  brandProfileId: z.string().nullable(),
  audience: z.object({
    id: z.string(),
    name: z.string(),
    status: z.union([z.literal("active"), z.literal("paused"), z.literal("archived")]),
    filters: z.record(z.string(), z.unknown()).nullable(),
    avatarUrl: z.string().nullable().optional(),
  }),
  evidence: z.object({
    totalCostInUsdCents: z.number(),
    completedRuns: z.number(),
    firstRunAt: z.string().nullable(),
    lastRunAt: z.string().nullable(),
    contacted: z.number(),
    websiteClicks: z.number(),
    positiveReplies: z.number(),
    formSubmissions: z.number().optional(),
    signups: z.number().optional(),
    sales: z.coerce.number().nullable().optional(),
  }),
  metrics: z.object({
    cpcCents: z.number().nullable(),
    cpprCents: z.number().nullable(),
    cpfsCents: z.number().nullable().optional(),
    cpsCents: z.number().nullable().optional(),
    cpsaleCents: z.coerce.number().nullable().optional(),
    // Optional as the producer declares it; absent -> `—`, never the legacy figure.
    maturity: AudienceCostMaturitySchema.nullish(),
  }),
  projection: AudienceProjectionSchema.extend({ maturity: AudienceProjectionMaturitySchema.nullish() }).optional(),
});

const FeatureAudienceStatsResponseSchema = z.object({
  featureSlug: z.string(),
  brandId: z.string(),
  goal: z.union([
    z.literal("signup"),
    z.literal("meetingBooked"),
    z.literal("websitePurchase"),
    z.literal("sales"),
    z.literal("websiteVisit"),
    z.literal("positiveReply"),
    z.literal("formSubmission"),
  ]).nullable(),
  brandProfileId: z.string().nullable(),
  sortMetric: z.union([
    z.literal("cpc"),
    z.literal("cppr"),
    z.literal("returnPerDollar"),
  ]),
  audiences: z.array(FeatureAudienceStatsRowSchema),
  brandProjection: AudienceProjectionSchema.extend({
    lifetimeRevenueUsd: z.coerce.number().nullable(),
  }).optional(),
  // Optional as served; absent -> the scope line states no figure.
  maturity: ScopeMaturitySchema.nullish(),
});

/** GET /features — list all features */
export async function listFeatures(
  params?: { implemented?: boolean },
  token?: string,
): Promise<{ features: Feature[] }> {
  const query = new URLSearchParams();
  if (params?.implemented !== undefined) query.set("implemented", String(params.implemented));
  const qs = query.toString();
  return apiCall<{ features: Feature[] }>(`/features${qs ? `?${qs}` : ""}`, { token });
}

/** GET /features/:slug — get a single feature by versioned slug */
export async function getFeature(slug: string, token?: string): Promise<{ feature: Feature }> {
  return apiCall<{ feature: Feature }>(`/features/${slug}`, { token });
}

// ─── Entity Registry ─────────────────────────────────────────────────────────

export interface EntityRegistryEntry {
  label: string;
  icon: string;
  pathSuffix: string;
  description: string;
}

export type EntityRegistry = Record<string, EntityRegistryEntry>;

/** GET /features/entities/registry — entity type registry */
export async function fetchEntityRegistry(token?: string): Promise<{ registry: EntityRegistry }> {
  return apiCall<{ registry: EntityRegistry }>("/features/entities/registry", { token });
}

/** GET /features/stats/registry — stats key registry */
export async function fetchStatsRegistry(token?: string): Promise<{ registry: StatsRegistry }> {
  return apiCall<{ registry: StatsRegistry }>("/features/stats/registry", { token });
}

/** GET /features/:featureSlug/audience-stats — real audience-level cost/outcome evidence. */
export async function fetchFeatureAudienceStats(
  featureSlug: string,
  params: {
    brandId: string;
    /**
     * The LEG to price the cost columns on — what a CAMPAIGN-scoped surface sends, since
     * a campaign is bought for exactly one leg and states it on its own row.
     */
    leg?: string | null;
    /**
     * DEPRECATED. The retired brand goal, kept only for a caller that still has one.
     */
    goal?: FeatureAudienceStatsGoal;
    brandProfileId?: string;
    limit?: number;
    /** Audience lifecycle statuses to include. Comma-separated subset of
     *  `active,paused,archived`. Omitted → features-service defaults to active-only
     *  (preserves the Top-audiences ranking card). The Audiences page passes all
     *  three so archived audiences show their historical outreach stats. */
    statuses?: string;
    /** Optional campaign scope (v2). Audiences stay brand-wide, but their stats can
     *  be filtered to a single campaign's outreach — the campaign overview passes it.
     *  Omitted → brand-wide numbers as before. (api-service forwards ?campaignId=.) */
    campaignId?: string;
    /** Optional OFFER scope. An audience belongs to one proposition, so an
     *  offer-scoped page narrows both the rows and the outreach they are priced
     *  on. Mutually exclusive with `campaignId` (features-service 400s the pair). */
    offerId?: string;
  },
  token?: string,
): Promise<FeatureAudienceStatsResponse> {
  // Sending NEITHER is the BRAND- or OFFER-LEVEL read, and it is a first-class request
  // rather than a missing parameter: features-service then prices every audience on the
  // best path it can reach and sorts on return descending.
  const query = new URLSearchParams({ brandId: params.brandId });
  if (params.leg) query.set("leg", params.leg);
  else if (params.goal) query.set("goal", params.goal);
  if (params.brandProfileId) query.set("brandProfileId", params.brandProfileId);
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.statuses) query.set("statuses", params.statuses);
  if (params.offerId) query.set("offerId", params.offerId);
  if (params.campaignId) query.set("campaignId", params.campaignId);
  // pricing=net → per-audience MONEY metrics (metrics.cpcCents / cpprCents /
  // cpfsCents / cpsCents) reflect the org's FROZEN post-usage-discount cost, so the
  // Top-audiences card + Audiences ranking match the net brand-overview cost cards.
  // Ranking order is unchanged (uniform scale) and net == gross for a non-discounted
  // org. Frozen server-side — no client discount math.
  query.set("pricing", "net");
  const raw = await apiCall<unknown>(`/features/${featureSlug}/audience-stats?${query.toString()}`, { token });
  const parsed = FeatureAudienceStatsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] fetchFeatureAudienceStats: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] fetchFeatureAudienceStats: invalid response shape");
  }
  return parsed.data;
}

// NOTE: The old `GET /features/:slug/candidates` reader (FeatureCandidate*, the
// audience/brand-goal/goal-global grain ladder) was REMOVED — features-service folded
// that grain into `GET /features/:slug/workflow-projection` (the 3-grain ladder above,
// `getWorkflowProjectionLadder`). The Strategy page reads the server-resolved grain
// verbatim; there is no separate candidates fetch or client-side ladder resolution.

/** GET /features/stats — global stats cross-features */
export async function fetchGlobalStats(
  params?: { groupBy?: string; brandId?: string },
  token?: string,
): Promise<GlobalStatsResponse> {
  const query = new URLSearchParams();
  if (params?.groupBy) query.set("groupBy", params.groupBy);
  if (params?.brandId) query.set("brandId", params.brandId);
  const qs = query.toString();
  return apiCall<GlobalStatsResponse>(`/features/stats${qs ? `?${qs}` : ""}`, { token });
}

/**
 * What a brand's contacted-but-not-yet-engaged leads are worth in expectation —
 * features-service `GET /brands/:brandId/contacted-value`. A SEPARATE figure: it is not in
 * the pipeline, the ROI or any money total. Priced by features-service off the brand's own
 * conversion rates and client value; nothing here multiplies anything. `null` means the producer could not
 * measure it and says why in `unmeasuredReason`, never a zero.
 */
const ContactedValueSchema = z.object({
  totalExpectedValueUsd: z.number().nullable(),
  perLeadExpectedValueUsd: z.number().nullable(),
  unmeasuredReason: z.string().nullable(),
  leads: z.array(z.object({ leadId: z.string(), expectedValueUsd: z.number().nullable() })),
  nextCursor: z.string().nullable(),
});
export type ContactedValue = z.infer<typeof ContactedValueSchema>;

/** The priced subset for the lead ids given (≤1000, the producer's cap), plus the brand total. */
/**
 * What ONE offer's contacted leads are worth — features-service
 * `GET /offers/:offerId/contacted-value` (#1264), priced on the brand's entry rates.
 */
export async function getOfferContactedValue(offerId: string, brandId: string, leadIds: string[]): Promise<ContactedValue> {
  const query = new URLSearchParams({ brandId, pricing: "net" });
  if (leadIds.length > 0) query.set("leadIds", leadIds.slice(0, 1000).join(","));
  else query.set("limit", "1");
  const raw = await apiCall<unknown>(`/offers/${encodeURIComponent(offerId)}/contacted-value?${query.toString()}`);
  const parsed = ContactedValueSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[getOfferContactedValue] response shape mismatch", parsed.error.issues, raw);
    throw new Error("getOfferContactedValue: invalid response shape");
  }
  return parsed.data;
}

export async function getContactedValue(brandId: string, leadIds: string[]): Promise<ContactedValue> {
  const query = new URLSearchParams();
  if (leadIds.length > 0) query.set("leadIds", leadIds.slice(0, 1000).join(","));
  else query.set("limit", "1");
  const raw = await apiCall<unknown>(`/brands/${brandId}/contacted-value?${query.toString()}`);
  const parsed = ContactedValueSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[getContactedValue] response shape mismatch", parsed.error.issues, raw);
    throw new Error("getContactedValue: invalid response shape");
  }
  return parsed.data;
}

/**
 * What each Deals-board column holds — features-service `GET /brands/:brandId/deals-value`.
 * A SEPARATE figure (in no pipeline, ROI or cost total). A column is lead-service's standing;
 * Interested is priced at each person's expected value, Won at the stated sale else the
 * brand's client value, company-deduped for the column total. `valueUsd: null` always comes
 * with the producer's `unvaluedReason`, never a zero. Vocabularies are read as plain strings:
 * the producer owns them and may widen them.
 */
const DealsValueSchema = z.object({
  brandId: z.string(),
  lifetimeRevenueUsd: z.number().nullable(),
  columns: z.array(
    z.object({
      standing: z.string(),
      valueUsd: z.number().nullable(),
      unvaluedReason: z.string().nullable(),
      basis: z.string().nullable(),
      leadCount: z.number().nullable(),
      organizationCount: z.number().nullable(),
      unpricedLeadCount: z.number().nullable(),
      leads: z.array(
        z.object({
          leadId: z.string(),
          valueUsd: z.number().nullable(),
          valueSource: z.string().nullable().optional(),
          zeroValueReason: z.string().nullable().optional(),
        }),
      ),
    }),
  ),
});
export type DealsValue = z.infer<typeof DealsValueSchema>;

export async function getDealsValue(brandId: string): Promise<DealsValue> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/deals-value`);
  const parsed = DealsValueSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[getDealsValue] response shape mismatch", parsed.error.issues, raw);
    throw new Error("getDealsValue: invalid response shape");
  }
  return parsed.data;
}

/**
 * The SAME columns for ONE offer — features-service `GET /offers/:offerId/deals-value`
 * (#1264): the brand body plus `offerId`, over the leads served on the offer's campaigns.
 * People do not add across offers (a lead served under two counts on both boards).
 */
export async function getOfferDealsValue(offerId: string, brandId: string): Promise<DealsValue> {
  const query = new URLSearchParams({ brandId, pricing: "net" });
  const raw = await apiCall<unknown>(`/offers/${encodeURIComponent(offerId)}/deals-value?${query.toString()}`);
  const parsed = DealsValueSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[getOfferDealsValue] response shape mismatch", parsed.error.issues, raw);
    throw new Error("getOfferDealsValue: invalid response shape");
  }
  return parsed.data;
}

/**
 * How the runs of each group ENDED and how long they took — runs-service
 * `GET /v1/stats/run-outcomes` (gateway `/v1/runs/stats/run-outcomes`). Entry runs only
 * (the producer's default scope): one row per run an agent started, not per service call.
 * `successRate` is completed / ended, null when none ended; `medianDurationMs` is over
 * completed runs, null when none completed. Both served, never derived here.
 */
const RunOutcomeGroupSchema = z.object({
  dimensions: z.record(z.string(), z.string().nullable()),
  runCount: z.number(),
  completedCount: z.number(),
  failedCount: z.number(),
  runningCount: z.number(),
  successRate: z.number().nullable(),
  medianDurationMs: z.number().nullable(),
});
export type RunOutcomeGroup = z.infer<typeof RunOutcomeGroupSchema>;

export async function getRunOutcomes(params: {
  brandId: string;
  groupBy: string;
  campaignIds?: string[];
  startedAfter: string;
}): Promise<RunOutcomeGroup[]> {
  const query = new URLSearchParams({ brandId: params.brandId, groupBy: params.groupBy, startedAfter: params.startedAfter });
  if (params.campaignIds && params.campaignIds.length > 0) query.set("campaignIds", params.campaignIds.slice(0, 500).join(","));
  const raw = await apiCall<unknown>(`/runs/stats/run-outcomes?${query}`);
  const parsed = z.object({ groups: z.array(RunOutcomeGroupSchema) }).safeParse(raw);
  if (!parsed.success) {
    console.error("[getRunOutcomes] response shape mismatch", parsed.error.issues, raw);
    throw new Error("getRunOutcomes: invalid response shape");
  }
  return parsed.data.groups;
}

/**
 * What a BRAND returned — across every acquisition channel it runs.
 *
 * The offer read above, one level further up, and NOT the sum of it: a brand holds
 * several offers and each runs several channels, so the same non-additivity applies
 * one grain higher and features-service owns it there too.
 *
 * This is what a brand-scoped surface must ask. Asking the per-feature read there
 * is what produced a fraction with two grains in it — one channel's spend over
 * billing's brand-wide ceiling, `$40 / 50` for a brand whose channels had spent
 * $40.07 and $10.32 against their own $40 and $10.
 */
export async function getBrandRevenue(
  brandId: string,
  token?: string,
): Promise<RevenueOverview> {
  const query = new URLSearchParams({ pricing: "net" });
  const raw = await apiCall<unknown>(`/brands/${brandId}/revenue?${query.toString()}`, { token });
  return parseFeatureRevenue(raw, "getBrandRevenue");
}

/**
 * ONE offer's money across every channel selling it — features-service's offer grain
 * (`/offers/:offerId/revenue`), the same engine and body as the brand read, narrowed to
 * the campaigns that sell the offer. v2 reads every money figure through it now that the
 * dashboard is about one offer (owner 2026-10-03). An offer no campaign sells is a 404
 * there (`offer_has_no_campaigns`), never the brand's numbers: callers do not ask until
 * the offer has a campaign.
 */
export async function getOfferRevenue(
  offerId: string,
  brandId: string,
  token?: string,
): Promise<RevenueOverview> {
  const query = new URLSearchParams({ brandId, pricing: "net" });
  const raw = await apiCall<unknown>(`/offers/${encodeURIComponent(offerId)}/revenue?${query.toString()}`, { token });
  return parseFeatureRevenue(raw, "getOfferRevenue");
}

/**
 * `structuralSharing` merge for the `["featureRevenue", ...]` query. The
 * server-computed `spend` block (cost card) and the actual series
 * (`outreachContacted`, `clicked`, `repliedPositive`, `meetingsBooked`,
 * `purchased`) are `.optional()` on the wire to decouple the backend rollout — but
 * a transient degenerate refetch can drop them back to `undefined`/`null` on a
 * VALID 200, which would collapse the cost card / chart actuals mid-session.
 * Keep the last-good series across such a refetch (fail-loud console.error in
 * keep-last-good); a real persistent absence still logs. Opt-in here ONLY —
 * absence is "transient/not-ready", never "removed".
 */
export function keepLastGoodFeatureRevenue(
  prev: RevenueOverview | undefined,
  next: RevenueOverview,
): RevenueOverview {
  return keepLastGoodFields(
    prev,
    next,
    ["spend", "sequences", "outreachContacted", "opened", "clicked", "repliedPositive", "meetingsBooked", "purchased"],
    "featureRevenue",
  );
}

// ─── Per-campaign revenue (grouped) ──────────────────────────────────────────
// features-service `GET /features/:slug/revenue?groupBy=campaignId` returns one
// LEAN group per campaign that has runs for the brand+feature: campaignId +
// headline.totalPipelineUsd + costEconomics only (no timeSeries/orgs/leads/events).
// Each group is byte-equal to the standalone ?campaignId= call. Every displayed
// stat (pipeline / $CAC / ROI / %CAC) is a ready features-service field — the
// dashboard renders, never computes (CLAUDE.md: a displayed stat is
// features-service-owned). One call powers the whole Campaigns table.
const CampaignRevenueCostEconomicsSchema = z.object({
  // COMMITTED (billed + open holds) — features-service's single spend basis, and the
  // exact number ROI and %CAC divide by, so a row cannot contradict its own return.
  // `.optional()` for rollout tolerance only; it is required on the wire today.
  //
  // The billed-only sibling is deliberately NOT read here and NOT used as a fallback:
  // actual means actual and committed means committed, so rendering billed spend under
  // a committed label would reprint the very contradiction this replaced. Absent →
  // null → the cell reads "—".
  // Nullable too: on the staff ACTUAL-cost read a group whose spend has no known vendor
  // cost states null (never the billed figure).
  committedCostUsd: z.number().nullish(),
  costOfAcquisitionPct: z.number().nullable(),
  roiMultiple: z.number().nullable(),
  expectedConversions: z.number().nullish(),
  costPerConversionUsd: z.number().nullish(),
  // The three ratios above, served twice with the group's own maturity verdict
  // (lib/maturity.ts). Every row states `mature`, and Learning where `isMature` is false.
  // Optional as served (see EconomicsMaturitySchema); absent -> `—`.
  maturity: EconomicsMaturitySchema.nullish(),
});
/** A group's cost per outcome, served twice with the group's own maturity verdict. */
const OutcomesMaturitySchema = maturityPairSchema(
  z.object({ cpcCents: z.number().nullable(), cpprCents: z.number().nullable() }),
);
/**
 * The VOLUME half of a campaign group: how much real outcome evidence its money rests on.
 *
 * features-service serves it under its own names (the same block it already serves on
 * `?groupBy=workflow`), so those names are read verbatim rather than renamed here. Only
 * the two counts a consumer gates on are declared — the block carries its own cost
 * figures too, and this repo renders those from `costEconomics` instead, on one basis.
 *
 * NULLISH, and both halves of that are load-bearing. ABSENT covers a producer that
 * predates the block. NULL is the producer's own word, served on a required field, for
 * "nothing is wired for this channel and the leads were never read" — a state a real
 * brand reaches, because an offer is sold through channels that have nothing wired yet (prod: `pr-expert-quote-opportunities`). Reading that as `.optional()`
 * refuses the null, so ONE such channel in an offer's fan-out threw the whole read and
 * blanked every campaign row on the page. Either way the row states its figures exactly
 * as it did before, which is "we cannot tell how thin this is", never "it is fine".
 */
const CampaignRevenueOutcomesSchema = z.object({
  recipientsRepliesPositive: z.number().nullish(),
  recipientsClicked: z.number().nullish(),
  // What this campaign identity paid for one of each, SERVED. The step walk states a
  // per-campaign cost from these rather than the scope-wide rung, so a row's price
  // divides the same spend its `$ Invested` states and the same count in the cell
  // before it. Measured in prod: the rung read $164 (whole scope, including a
  // feedback-request campaign that produced none) beside $2,889 and 18 on one row.
  cpprCents: z.number().nullish(),
  cpcCents: z.number().nullish(),
  // The two costs above, served twice with this group's maturity verdict.
  maturity: OutcomesMaturitySchema.nullish(),
  // What happened to the emails this campaign identity sent (features-service #1143):
  // distinct leads sent to, and the SERVED share of them who replied. Only the two
  // figures the v2 missions table prints are declared.
  sending: z
    .object({ recipientsSent: z.number(), replyRatePct: z.number().nullable() })
    .nullish(),
});
const FeatureRevenueByCampaignSchema = z.object({
  groupBy: z.string(),
  groups: z.array(
    z.object({
      campaignId: z.string(),
      headline: z.object({ totalPipelineUsd: z.number().nullable() }),
      costEconomics: CampaignRevenueCostEconomicsSchema,
      outcomes: CampaignRevenueOutcomesSchema.nullish(),
    }),
  ),
});

export interface CampaignRevenueGroup {
  campaignId: string;
  totalPipelineUsd: number | null;
  /** COMMITTED spend for this campaign — the number ROI and %CAC divide by. Null means
   *  "we have no figure", never "it cost nothing", so the cell reads "—" rather than $0. */
  committedCostUsd: number | null;
  costOfAcquisitionPct: number | null;
  roiMultiple: number | null;
  expectedConversions: number | null;
  costPerConversionUsd: number | null;
  /** Positive replies attributed to this campaign identity. Undefined = the producer did
   *  not answer the volume half, which is not the same as zero. */
  positiveReplies?: number | null;
  /** Website visits attributed to it, same rule. */
  websiteClicks?: number | null;
  /** What one positive reply cost this campaign. Undefined = not answered; null = the
   *  producer measured none, which is not a zero price. */
  cpprCents?: number | null;
  /** What one website visit cost it, same rule. */
  cpcCents?: number | null;
  /** Distinct leads this campaign identity sent at least one email to. Undefined = not
   *  answered; never read as zero. */
  sentCount?: number | null;
  /** The SERVED share of those who replied, in percent. Null = nothing was sent. */
  replyRatePct?: number | null;
  /** ROI, % CAC and $ CAC served twice with this campaign's maturity verdict. */
  economicsMaturity: MaturityPair<EconomicsFigures> | null;
  /** Cost per visit and per positive reply, served twice. Null when the producer served no
   *  outcomes block for this group (nothing wired for its channel). */
  outcomesMaturity: MaturityPair<OutcomeFigures> | null;
}

/** GET /features/:slug/revenue?groupBy=campaignId — one lean revenue group per campaign. */
export async function getFeatureRevenueByCampaign(
  featureSlug: string,
  brandId: string,
  token?: string,
): Promise<CampaignRevenueGroup[]> {
  const query = new URLSearchParams({ brandId, groupBy: "campaignId", pricing: "net" });
  const raw = await apiCall<unknown>(
    `/features/${encodeURIComponent(featureSlug)}/revenue?${query.toString()}`,
    { token },
  );
  const parsed = FeatureRevenueByCampaignSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getFeatureRevenueByCampaign: response shape mismatch", {
      issues: parsed.error.issues,
    });
    throw new Error("[dashboard] getFeatureRevenueByCampaign: invalid response shape");
  }
  return parsed.data.groups.map((g) => ({
    campaignId: g.campaignId,
    totalPipelineUsd: g.headline.totalPipelineUsd,
    committedCostUsd: g.costEconomics.committedCostUsd ?? null,
    costOfAcquisitionPct: g.costEconomics.costOfAcquisitionPct,
    roiMultiple: g.costEconomics.roiMultiple,
    expectedConversions: g.costEconomics.expectedConversions ?? null,
    costPerConversionUsd: g.costEconomics.costPerConversionUsd ?? null,
    positiveReplies: g.outcomes?.recipientsRepliesPositive,
    websiteClicks: g.outcomes?.recipientsClicked,
    cpprCents: g.outcomes?.cpprCents,
    cpcCents: g.outcomes?.cpcCents,
    sentCount: g.outcomes?.sending?.recipientsSent,
    replyRatePct: g.outcomes?.sending?.replyRatePct,
    economicsMaturity: g.costEconomics.maturity ?? null,
    outcomesMaturity: g.outcomes?.maturity ?? null,
  }));
}

// ─── The WORKFLOWS a campaign's channel runs ─────────────────────────────────
// A campaign is (offer x leg x channel) and the channel is worked by a WORKFLOW.
// Three reads answer "which workflows could run this, which one is, and what did
// each do for me": the channel's catalogue (workflow-service), this campaign's money
// per workflow (features-service `?groupBy=workflow`), and one workflow's whole body
// (the same un-grouped read narrowed by `?workflow=`).
//
// The join between them is the DYNASTY slug — a workflow's identity across its
// versions, which both producers already speak. Everything else lives in the
// alias-free `lib/campaign-workflow-rows`.

/**
 * The wire row `GET /v1/workflows` serves.
 *
 * Deliberately NARROW: only what the table renders plus the two keys it joins on.
 * `dag` is on the wire and is NOT declared — a DAG serializes to hundreds of KB and
 * this surface parses nothing out of it. The MODEL and the TEMPLATE are workflow-
 * service's to state, and it now does (v0.45.7): it derives both off the DAG's own
 * content-generation call and serves them as `contentModel` / `contentPromptType`. A
 * consumer reading them out of the DAG itself would be re-deriving another service's
 * answer from its internals; reading the fields it publishes is the opposite.
 *
 * `.nullish()` on every tag: workflow-service serves them nullable, and a row missing
 * one renders without it rather than failing the whole read.
 *
 * `requiredProviders` is on the wire and is deliberately NOT declared. The table used
 * to draw a logo per provider a workflow CALLS (the lead database, the sending
 * platform), and every workflow of one channel calls the same ones — so the stack
 * distinguished nothing while attributing a customer's row to Apollo and Anthropic.
 * The one logo a row carries is the MODEL's provider, which is what two rows differ
 * by. Do not re-declare it here to draw a second stack.
 */
const WorkflowCatalogueWireSchema = z.object({
  workflowSlug: z.string(),
  workflowDynastySlug: z.string(),
  workflowDynastyName: z.string(),
  version: z.number(),
  status: z.string().nullish(),
  channel: z.string().nullish(),
  audienceType: z.string().nullish(),
  // The chat-service model alias the DAG's content-generation call states, and the
  // prompt template it asks for. NULL is workflow-service's own word for "the call
  // names none" — half the live channel — so both are `.nullish()` and a null renders
  // as a dash rather than a guessed default.
  contentModel: z.string().nullish(),
  contentPromptType: z.string().nullish(),
});
const WorkflowCatalogueResponseSchema = z.object({
  workflows: z.array(WorkflowCatalogueWireSchema),
});

/**
 * GET /v1/workflows?featureSlug= — the workflows a channel currently offers.
 *
 * The gateway forwards `featureSlug` and asks workflow-service for its EXECUTABLE
 * set, so a RETIRED dynasty this campaign once ran is absent here by construction.
 * That is why the table is a union with the revenue groups rather than a walk of
 * this list: dropping a retired workflow would delete the campaign's own history
 * from the page that exists to show it.
 */
export async function listChannelWorkflows(
  featureSlug: string,
  token?: string,
): Promise<WorkflowCatalogueRow[]> {
  const query = new URLSearchParams({ featureSlug });
  const raw = await apiCall<unknown>(`/workflows?${query.toString()}`, { token });
  const parsed = WorkflowCatalogueResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] listChannelWorkflows: response shape mismatch", {
      issues: parsed.error.issues,
    });
    throw new Error("[dashboard] listChannelWorkflows: invalid response shape");
  }
  return parsed.data.workflows.map((w) => ({
    workflowSlug: w.workflowSlug,
    workflowDynastySlug: w.workflowDynastySlug,
    workflowDynastyName: w.workflowDynastyName,
    version: w.version,
    status: w.status ?? null,
    channel: w.channel ?? null,
    audienceType: w.audienceType ?? null,
    contentModel: w.contentModel ?? null,
    contentPromptType: w.contentPromptType ?? null,
  }));
}

/**
 * The VOLUME half of a workflow group, read verbatim under features-service's own
 * names — the same block `?groupBy=campaignId` already serves.
 *
 * NULLISH, both halves load-bearing, for the reason the campaign block states: ABSENT
 * covers a producer that predates it, NULL is the producer's own word for "nothing
 * is wired for this channel and the leads were never read". Reading it `.optional()`
 * refuses that null and blanks the whole table.
 */
const WorkflowRevenueOutcomesSchema = z.object({
  recipientsContacted: z.number().nullish(),
  recipientsClicked: z.number().nullish(),
  recipientsRepliesPositive: z.number().nullish(),
  cpprCents: z.number().nullish(),
  cpcCents: z.number().nullish(),
  maturity: OutcomesMaturitySchema.nullish(),
});
const FeatureRevenueByWorkflowSchema = z.object({
  groupBy: z.string(),
  groups: z.array(
    z.object({
      workflowDynastySlug: z.string(),
      // Null when workflow-service does not describe the slug — the producer says so
      // rather than inventing a name, and the row falls back to the slug.
      workflowDynastyName: z.string().nullish(),
      workflowSlugs: z.array(z.string()),
      headline: z.object({ totalPipelineUsd: z.number().nullable() }),
      costEconomics: CampaignRevenueCostEconomicsSchema,
      outcomes: WorkflowRevenueOutcomesSchema.nullish(),
    }),
  ),
});

/**
 * GET /features/:slug/revenue?groupBy=workflow — one lean money row per workflow
 * dynasty, SCOPED TO ONE CAMPAIGN.
 *
 * `campaignId` is what makes the page honest: without it the read answers for the
 * whole BRAND, and printing a brand-grain figure under a campaign's name is the
 * wrong-scope bug this repo keeps recording. Measured in prod before features-service
 * honoured it (brand `01800fc5`, 53 campaigns): the campaign-scoped read returned all
 * five of the brand's dynasties at the brand's own spend, to the cent.
 *
 * pricing=net, like every other money read here — the org's frozen post-discount
 * figures, so this table cannot state a different basis from the cards above it.
 */
export async function getFeatureRevenueByWorkflow(
  featureSlug: string,
  brandId: string,
  /** Null groups the BRAND's money by workflow rather than one campaign's. */
  campaignId: string | null,
  token?: string,
): Promise<WorkflowRevenueGroup[]> {
  const query = new URLSearchParams({ brandId, groupBy: "workflow" });
  if (campaignId) query.set("campaignId", campaignId);
  query.set("pricing", "net");
  return readWorkflowGroups(featureSlug, query, "getFeatureRevenueByWorkflow", token);
}

/**
 * The SAME grouped read at the BRAND grain — every campaign of the brand on this
 * channel, folded per workflow.
 *
 * It is the campaign reader minus `campaignId`, which is exactly what the producer
 * documents the omission as meaning ("the whole brand"), so the two can never answer
 * different questions under one word: the grain the page states IS the parameter it
 * sends. Its cache key carries no campaign for the same reason — a brand entry must
 * never be served to a campaign-scoped question, and the reverse.
 *
 * pricing=net, like every other money read here.
 */
export async function getBrandRevenueByWorkflow(
  featureSlug: string,
  brandId: string,
  token?: string,
): Promise<WorkflowRevenueGroup[]> {
  const query = new URLSearchParams({ brandId, groupBy: "workflow" });
  query.set("pricing", "net");
  return readWorkflowGroups(featureSlug, query, "getBrandRevenueByWorkflow", token);
}

/**
 * The SAME grouped read at the OFFER grain — the campaigns selling ONE offer, folded
 * per workflow. The grain between the brand and its campaigns.
 *
 * `offerId` is the parameter the grain states, exactly as `campaignId` is one grain
 * finer and its absence is the brand: features-service resolves the offer to the
 * campaigns selling it and computes every figure over exactly those, re-attributing
 * nothing. Measured in prod on brand `f4d73dab` before this shipped: the brand read
 * returned 31 workflow dynasties and the offer read 28 — the three `pr-*` lineages
 * belong to campaigns selling a DIFFERENT offer, so the scope is genuinely narrower
 * and this is not the single-member tautology a scoping probe has to avoid.
 *
 * Two refusals the producer owns and this reader must not paper over. An offer no
 * campaign of the brand sells is a **404 `offer_has_no_campaigns`** — never the
 * brand's own numbers under the offer's name, and never a fabricated zero; the query
 * errors, the catalogue still supplies the rows, and the money columns read `—`,
 * which is the honest "we have no figure". And `offerId` beside `campaignId` is a
 * **400**: a campaign already sells exactly one offer, so the two can never be sent
 * together (the page's tabs are mutually exclusive by construction).
 *
 * pricing=net, like every other money read here.
 */
export async function getOfferRevenueByWorkflow(
  featureSlug: string,
  brandId: string,
  offerId: string,
  token?: string,
): Promise<WorkflowRevenueGroup[]> {
  const query = new URLSearchParams({ brandId, offerId, groupBy: "workflow" });
  query.set("pricing", "net");
  return readWorkflowGroups(featureSlug, query, "getOfferRevenueByWorkflow", token);
}

/**
 * STAFF ONLY. The same per-workflow groups as `getFeatureRevenueByWorkflow` (same scope, same
 * partition, same value leg) with every spend figure at VENDOR cost, before our markup
 * (features-service #1193, gateway `/features/:slug/revenue/actual-cost`). A group whose spend
 * has no known vendor cost reads null money, never the billed figure. The route refuses
 * `pricing`: the vendor basis has no net/gross.
 */
export async function getFeatureRevenueByWorkflowActual(
  featureSlug: string,
  brandId: string,
  campaignId: string | null,
  token?: string,
): Promise<WorkflowRevenueGroup[]> {
  const query = new URLSearchParams({ brandId, groupBy: "workflow" });
  if (campaignId) query.set("campaignId", campaignId);
  return readWorkflowGroups(featureSlug, query, "getFeatureRevenueByWorkflowActual", token, "revenue/actual-cost");
}

/** One parse for every grain: a second copy is a second place for the shape to drift. */
async function readWorkflowGroups(
  featureSlug: string,
  query: URLSearchParams,
  caller: string,
  token?: string,
  path: "revenue" | "revenue/actual-cost" = "revenue",
): Promise<WorkflowRevenueGroup[]> {
  const raw = await apiCall<unknown>(
    `/features/${encodeURIComponent(featureSlug)}/${path}?${query.toString()}`,
    { token },
  );
  const parsed = FeatureRevenueByWorkflowSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[dashboard] ${caller}: response shape mismatch`, {
      issues: parsed.error.issues,
    });
    throw new Error(`[dashboard] ${caller}: invalid response shape`);
  }
  return parsed.data.groups.map((g) => ({
    workflowDynastySlug: g.workflowDynastySlug,
    workflowDynastyName: g.workflowDynastyName ?? null,
    workflowSlugs: g.workflowSlugs,
    totalPipelineUsd: g.headline.totalPipelineUsd,
    committedCostUsd: g.costEconomics.committedCostUsd ?? null,
    roiMultiple: g.costEconomics.roiMultiple,
    costOfAcquisitionPct: g.costEconomics.costOfAcquisitionPct,
    recipientsContacted: g.outcomes?.recipientsContacted ?? null,
    recipientsClicked: g.outcomes?.recipientsClicked ?? null,
    recipientsRepliesPositive: g.outcomes?.recipientsRepliesPositive ?? null,
    cpprCents: g.outcomes?.cpprCents ?? null,
    cpcCents: g.outcomes?.cpcCents ?? null,
    economicsMaturity: g.costEconomics.maturity ?? null,
    outcomesMaturity: g.outcomes?.maturity ?? null,
  }));
}

/**
 * GET /features/:slug/revenue?campaignId=&workflow=<dynastySlug> — ONE workflow's
 * whole body, for the drill-down.
 *
 * Not a new computation: it is the same un-grouped body every campaign Overview
 * reads, narrowed to the leads that workflow served and the spend it incurred. So the
 * drill-down renders through the SAME `parseFeatureRevenue` and the same cards, and a
 * figure cannot mean one thing on the campaign page and another one click in.
 *
 * `workflow` and `groupBy` are mutually exclusive at the producer (400) — a body is
 * either one workflow's answer or a table of them, never both.
 */
export async function getWorkflowRevenue(
  featureSlug: string,
  brandId: string,
  /** Null reads the BRAND's figures for the workflow (features-service narrows the
   *  brand-scoped body to one dynasty exactly as it does a campaign's). */
  campaignId: string | null,
  workflowDynastySlug: string,
  token?: string,
): Promise<RevenueOverview> {
  const query = new URLSearchParams({ brandId, workflow: workflowDynastySlug });
  if (campaignId) query.set("campaignId", campaignId);
  query.set("pricing", "net");
  const raw = await apiCall<unknown>(
    `/features/${encodeURIComponent(featureSlug)}/revenue?${query.toString()}`,
    { token },
  );
  return parseFeatureRevenue(raw, "getWorkflowRevenue");
}

/**
 * The wire row the gateway's dynasty listing serves, as workflow-service states it.
 *
 * ⚠️ CONFORM THIS TO THE DEPLOYED CONTRACT BEFORE MERGING. workflow-service is scoping
 * its dynasty listing to a single feature in parallel with this; the shape below mirrors
 * what the unscoped listing already serves in production, and the scoping parameter's
 * name is theirs to choose. Read the deployed shape from the api-registry (live beats
 * source) and conform — never freeze a shape this side authored.
 */
const WorkflowDynastyWireSchema = z.object({
  workflowDynastySlug: z.string(),
  workflowDynastyName: z.string(),
  workflowSlugs: z.array(z.string()),
});
const WorkflowDynastiesResponseSchema = z.object({
  dynasties: z.array(WorkflowDynastyWireSchema),
});

/**
 * GET /v1/workflows/dynasties?featureSlug= — every version of every dynasty a channel
 * offers, superseded versions included.
 *
 * This is the ONLY thing in the fleet that can name the dynasty a superseded workflow
 * version belongs to. The catalogue read above carries each dynasty's CURRENT version
 * only, and a revenue group's folded `workflowSlugs` carries the versions that SPENT in
 * that scope — so a campaign pinned to a version that is neither is unnameable by both,
 * and its `Running now` row silently disappears. See `WorkflowDynastyMembership`.
 *
 * SCOPED to the feature on purpose: the unscoped listing is fleet-wide and is every
 * internal workflow codename we have, which must never reach a customer's browser.
 */
export async function listChannelWorkflowDynasties(
  featureSlug: string,
  token?: string,
): Promise<WorkflowDynastyMembership[]> {
  const query = new URLSearchParams({ featureSlug });
  const raw = await apiCall<unknown>(`/workflows/dynasties?${query.toString()}`, { token });
  const parsed = WorkflowDynastiesResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] listChannelWorkflowDynasties: response shape mismatch", {
      issues: parsed.error.issues,
    });
    throw new Error("[dashboard] listChannelWorkflowDynasties: invalid response shape");
  }
  return parsed.data.dynasties.map((d) => ({
    workflowDynastySlug: d.workflowDynastySlug,
    workflowDynastyName: d.workflowDynastyName,
    workflowSlugs: d.workflowSlugs,
  }));
}

/**
 * GET /v1/public/features/workflow-cost-per-outcome — the FLEET's per-workflow rate.
 *
 * Public, no org, no auth: it answers "what does this workflow cost everyone",
 * which is a property of the workflow rather than of this customer. Its own
 * `costBasis` is `incurred` — comped spend counts at full value — so it is NOT the
 * same question as the charged figures beside it, and the surface says so rather
 * than charting the two as one series.
 */
/**
 * ONE GRAIN's observed figures for the leg, on one half of the maturity pair
 * (features-service#1196). OBSERVED, never floored: `costPerOutcomeUsd` is null at zero
 * outcomes and `conversionRatePct` null at zero contacted. `spentUsd` is null only on the
 * staff actual-cost body, where the grain's vendor cost is unknown.
 */
const LegOutcomeFiguresSchema = z.object({
  spentUsd: z.number().nullable(),
  contacted: z.number(),
  outcomes: z.number(),
  costPerOutcomeUsd: z.number().nullable(),
  conversionRatePct: z.number().nullable(),
});
export type LegOutcomeFigures = z.infer<typeof LegOutcomeFiguresSchema>;

/** One fleet row's maturity pair, on its objective's own leg (features-service#1196). */
const FleetLegMaturitySchema = z.object({
  // Nullable as served (`LegMaturityFigures.legKey`), though a fleet read always names one.
  legKey: z.string().nullable(),
  durationDays: z.number(),
  outcomesRequired: z.number(),
  outcomeSignal: z.string().nullable(),
  source: z.string(),
  flash: LegOutcomeFiguresSchema.nullable(),
  mature: LegOutcomeFiguresSchema.nullable(),
  isMature: z.boolean().nullable(),
});

const FleetWorkflowCostSchema = z.object({
  objective: z.string(),
  workflows: z.array(
    z.object({
      workflowDynastySlug: z.string(),
      workflowDynastyName: z.string(),
      spentUsd: z.number(),
      costPerOutcomeUsd: z.number().nullable(),
      // REQUIRED at the producer, so required here: a rename must fail the parse
      // loudly rather than read `undefined` forever and blank a column.
      observedPositiveReplies: z.number(),
      observedClicks: z.number(),
      /** REQUIRED key, null on a projected objective. The drawer states this workflow's
       *  mature figure off it, never the legacy one. */
      maturity: FleetLegMaturitySchema.nullable(),
    }),
  ),
  /** THE FLEET's best and median, served over the workflows that are MATURE on this leg.
   *  The browser takes no median and picks no best. REQUIRED key, null on a projected
   *  objective. */
  fleet: z
    .object({
      legKey: z.string(),
      basis: z.string(),
      matureWorkflowCount: z.number(),
      best: z
        .object({ workflowDynastySlug: z.string(), costPerOutcomeUsd: z.number().nullable() })
        .nullable(),
      median: z.object({ costPerOutcomeUsd: z.number().nullable() }).nullable(),
    })
    .nullable(),
});

export async function getFleetWorkflowCost(
  featureSlug: string,
  objective: string,
  token?: string,
): Promise<FleetRead> {
  const query = new URLSearchParams({ featureSlug, objective });
  const raw = await apiCall<unknown>(
    `/public/features/workflow-cost-per-outcome?${query.toString()}`,
    { token },
  );
  const parsed = FleetWorkflowCostSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getFleetWorkflowCost: response shape mismatch", {
      issues: parsed.error.issues,
    });
    throw new Error("[dashboard] getFleetWorkflowCost: invalid response shape");
  }
  return {
    workflows: parsed.data.workflows.map((w) => ({
      workflowDynastySlug: w.workflowDynastySlug,
      workflowDynastyName: w.workflowDynastyName,
      spentUsd: w.spentUsd,
      costPerOutcomeUsd: w.costPerOutcomeUsd,
      observedPositiveReplies: w.observedPositiveReplies,
      observedClicks: w.observedClicks,
      maturity: w.maturity,
    })),
    fleet: parsed.data.fleet,
  };
}

// ─── Per-offer revenue, at the OFFER grain ───────────────────────────────────
// features-service `GET /brands/:brandId/offers` returns one LEAN row per offer,
// each combined across EVERY acquisition channel that offer is sold through.
//
// The read this replaced was `/features/:slug/revenue?groupBy=offerId`, which
// groups by offer but answers for ONE channel — a feature IS a channel here. So a
// brand running several printed an offer's single-channel figures under the offer's
// name, directly beneath brand cards showing the whole thing. Both real, about
// different things, nothing erroring. Measured on the brand that surfaced it, whose
// one offer runs four channels: $2,625.44 / 2.67x from the old read against
// $2,670.44 / 2.62x here, the second being what the cards above it already said.
//
// features-service combines the channels; nothing is combined here. Money adds
// across an offer's channels because a run belongs to exactly one, but people do
// not (a lead worked through two channels is one lead) and no ratio does (a ratio
// of sums is neither the sum nor the average of ratios).
//
// The gateway path carries the service segment because `/v1/brands/:id/offers` is
// already the brand's offer CATALOG from brand-service — two different questions
// sharing a noun (api-service#855).
const BrandOfferMoneySchema = z.object({
  brandId: z.string(),
  offers: z.array(
    z.object({
      offerId: z.string(),
      headline: z.object({ totalPipelineUsd: z.number().nullable() }),
      costEconomics: CampaignRevenueCostEconomicsSchema,
    }),
  ),
});

export interface OfferRevenueGroup {
  offerId: string;
  totalPipelineUsd: number | null;
  /** COMMITTED spend for this offer — the number ROI and %CAC divide by. Null means
   *  "we have no figure", never "it cost nothing", so the cell reads "—" rather than $0. */
  committedCostUsd: number | null;
  costOfAcquisitionPct: number | null;
  roiMultiple: number | null;
  /** ROI, % CAC and $ CAC served twice with this OFFER's maturity verdict (lib/maturity.ts).
   *  Null when the body carried no pair. */
  economicsMaturity: MaturityPair<EconomicsFigures> | null;
}

/**
 * GET /features/brands/:brandId/offers — one lean money row per offer of a brand,
 * each across every channel it sells through.
 *
 * An EMPTY `offers` array is a real answer and NOT the same as the 404: it means
 * campaign-service lists campaigns for this brand but none states an offer yet.
 */
export async function getBrandOfferMoney(
  brandId: string,
  token?: string,
): Promise<OfferRevenueGroup[]> {
  // Same NET basis as every other money read — coherent with the NET-paced budget.
  const query = new URLSearchParams({ pricing: "net" });
  const raw = await apiCall<unknown>(
    `/features/brands/${encodeURIComponent(brandId)}/offers?${query.toString()}`,
    { token },
  );
  const parsed = BrandOfferMoneySchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getBrandOfferMoney: response shape mismatch", {
      issues: parsed.error.issues,
    });
    throw new Error("[dashboard] getBrandOfferMoney: invalid response shape");
  }
  return parsed.data.offers.map((o) => ({
    offerId: o.offerId,
    totalPipelineUsd: o.headline.totalPipelineUsd,
    committedCostUsd: o.costEconomics.committedCostUsd ?? null,
    costOfAcquisitionPct: o.costEconomics.costOfAcquisitionPct,
    roiMultiple: o.costEconomics.roiMultiple,
    economicsMaturity: o.costEconomics.maturity ?? null,
  }));
}

/** POST /brands — upsert brand by URL, returns brandId */
export async function upsertBrand(
  url: string,
  token?: string
): Promise<{ brandId: string; domain: string | null; name: string | null; created: boolean }> {
  return apiCall<{ brandId: string; domain: string | null; name: string | null; created: boolean }>(
    `/brands`,
    { token, method: "POST", body: { url } }
  );
}

// ── No-website brand creation (beta) ──────────────────────────────
// Creates a brand with NO website URL from a user-typed name + a large free-form block
// the user pasted about their business, then persists that context so field extraction
// reads it instead of scraping a site (brand-service #366, api-service #760 + business-
// context passthrough). MUST persist the context BEFORE extract-fields runs.
export async function createBrandWithoutWebsite(
  name: string,
  context: string,
  token?: string,
): Promise<{ brandId: string }> {
  // POST /orgs/brands accepts EITHER { url } OR { name }; no-website brand = { name }.
  const { brandId } = await apiCall<{ brandId: string }>(`/brands`, {
    token,
    method: "POST",
    body: { name },
  });
  // PUT /orgs/brands/:id/business-context { content } — the extraction source.
  await apiCall(`/brands/${brandId}/business-context`, {
    token,
    method: "PUT",
    body: { content: context },
  });
  return { brandId };
}

/** POST /brands/:brandId/transfer — transfer brand to another org */
export async function transferBrand(
  brandId: string,
  targetOrgId: string,
  token?: string
): Promise<void> {
  await apiCall(
    `/brands/${brandId}/transfer`,
    { token, method: "POST", body: { targetOrgId } }
  );
}

// Brand transfers

interface TransferServiceSuccess {
  updatedTables: { tableName: string; count: number }[];
}
interface TransferServiceError {
  error: string;
}
interface TransferServiceSkipped {
  skipped: true;
}
type TransferServiceResult = TransferServiceSuccess | TransferServiceError | TransferServiceSkipped;

export interface BrandTransfer {
  id: string;
  brandId: string;
  sourceOrgId: string;
  targetOrgId: string;
  initiatedByUserId: string;
  serviceResults: Record<string, TransferServiceResult>;
  createdAt: string;
}

/** GET /brand-transfers/outgoing — transfers where your org is the source */
export async function listOutgoingTransfers(
  brandId?: string,
  token?: string
): Promise<{ transfers: BrandTransfer[] }> {
  const query = brandId ? `?brandId=${brandId}` : "";
  return apiCall<{ transfers: BrandTransfer[] }>(
    `/brand-transfers/outgoing${query}`,
    { token }
  );
}

/** GET /brand-transfers/incoming — transfers where your org is the target */
export async function listIncomingTransfers(
  brandId?: string,
  token?: string
): Promise<{ transfers: BrandTransfer[] }> {
  const query = brandId ? `?brandId=${brandId}` : "";
  return apiCall<{ transfers: BrandTransfer[] }>(
    `/brand-transfers/incoming${query}`,
    { token }
  );
}

// Brand runs
export interface RunCost {
  costName: string;
  totalCostInUsdCents: string;
  actualCostInUsdCents: string;
  provisionedCostInUsdCents: string;
  quantity: number;
}

export interface DescendantRun {
  serviceName: string;
  taskName: string;
  costs: RunCost[];
  ownCostInUsdCents: string;
}

export interface ErrorSummary {
  failedStep: string;
  message: string;
  rootCause: string;
}

export interface BrandRun {
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  totalCostInUsdCents: string | null;
  costs: RunCost[];
  serviceName: string | null;
  taskName: string | null;
  error?: string;
  errorSummary?: ErrorSummary;
  descendantRuns: unknown[];
}

// ─── Run events (logs) ───────────────────────────────────────────────────────

export type EventLevel = "info" | "warn" | "error";

export interface RunEvent {
  id: string;
  runId: string;
  service: string;
  event: string;
  detail: string | null;
  level: EventLevel;
  data: unknown;
  orgId: string | null;
  userId: string | null;
  brandIds: string | null;
  campaignId: string | null;
  workflowSlug: string | null;
  featureSlug: string | null;
  createdAt: string;
}

// Per-field schema verified against runs-service GET /v1/events (api-registry).
// `.passthrough()` keeps every field; the feed only reads id/service/event/level/
// createdAt. safeParse turns wire-rot into a caught fetch-error per CLAUDE.md.
const RunEventSchema = z
  .object({
    id: z.string(),
    service: z.string(),
    event: z.string(),
    level: z.enum(["info", "warn", "error"]),
    createdAt: z.string(),
  })
  .passthrough();

const ListEventsResponseSchema = z.object({ events: z.array(RunEventSchema) });

/**
 * GET /events — run events for one campaign, through the runs-service proxy.
 *
 * `orgId` is injected from the auth context at the gateway and never trusted from the
 * query, so this only ever answers for the caller's own org.
 *
 * `event` takes a comma-separated list of slugs. Asking for the hold events by name is
 * what keeps this cheap on a campaign with tens of thousands of gate checks: without it
 * the newest page is all `Gate check PASSED` and the one line that matters is never on it.
 */
export async function listCampaignEvents(
  campaignId: string,
  options?: { event?: string; level?: EventLevel; limit?: number; offset?: number; token?: string },
): Promise<{ events: RunEvent[] }> {
  const params = new URLSearchParams();
  params.set("campaignId", campaignId);
  if (options?.event) params.set("event", options.event);
  if (options?.level) params.set("level", options.level);
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.offset != null) params.set("offset", String(options.offset));
  const raw = await apiCall<unknown>(`/events?${params.toString()}`, { token: options?.token });
  const parsed = ListEventsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] listCampaignEvents: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] listCampaignEvents: invalid response shape");
  }
  return parsed.data as unknown as { events: RunEvent[] };
}

/** GET /brands/:brandId/runs — returns runs or empty list if brand not found (404) */
export async function listBrandRuns(brandId: string, token?: string): Promise<{ runs: BrandRun[] }> {
  try {
    return await apiCall<{ runs: BrandRun[] }>(`/brands/${brandId}/runs`, { token });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return { runs: [] };
    throw err;
  }
}

/**
 * Every campaign of a brand, whatever its status.
 *
 * `status` is OMITTED on purpose, and that is what "every status" means to
 * campaign-service. It accepts exactly `ongoing` and `stopped`, and 400s
 * anything else — so the `status=all` this used to send was a value the
 * dashboard invented and the producer never accepted. The 400 surfaced as a 500
 * through the gateway, the query threw, and every surface reading it rendered
 * its empty state: a brand with a live campaign read "No campaign yet".
 *
 * The lesson is the general one about a filter value: an enum belongs to the
 * service that validates it, and "all" is almost never a member — it is the
 * ABSENCE of the filter. Do not reintroduce it here, and do not teach
 * campaign-service to accept it: omitting the parameter already means this.
 */
export async function listCampaignsByBrand(brandId: string, token?: string): Promise<{ campaigns: Campaign[] }> {
  const { campaigns } = await apiCall<{ campaigns: RawCampaign[] }>(
    `/campaigns?brandId=${brandId}`,
    { token },
  );
  return { campaigns: await enrichCampaignsWithBrandUrls(campaigns, token) };
}

// Single campaign
export async function getCampaign(campaignId: string, token?: string): Promise<{ campaign: Campaign }> {
  const { campaign } = await apiCall<{ campaign: RawCampaign }>(`/campaigns/${campaignId}`, { token });
  const [enriched] = await enrichCampaignsWithBrandUrls([campaign], token);
  return { campaign: enriched };
}

/**
 * There is NO per-campaign settings write.
 *
 * A campaign used to carry four editable fields — its name, its audiences, its
 * services and its click destination — and each of them is a statement about the
 * OFFER, which has its own Settings page. Editing them per campaign put four
 * copies of the offer's answer one click below the offer itself, and a customer
 * reading two of them had no way to know which one the send would use. They are
 * gone, and `updateCampaign` / `CampaignSettingsPatch` went with them rather than
 * being left unrendered.
 *
 * What IS per-campaign is the money: a campaign is (offer x leg x channel) and
 * billing keys a ceiling on exactly that triple, so Campaign Settings edits it
 * through `saveCampaignBudget` above — billing's row, not a campaign-service
 * mirror of one.
 *
 * ...and its STATUS, which is `setCampaignStatus` below. That is not one of the
 * four offer fields: whether a campaign runs is a fact about the campaign and
 * nothing else, and it is the one thing an offer-level answer could never state.
 */

/**
 * PATCH /campaigns/:id — start or stop ONE campaign.
 *
 * The whole reason this exists beside `saveCampaignBudget`: stopping a
 * campaign and defunding it are different actions, and only one of them is
 * reversible for free. Dropping a ceiling to zero throws the amount away, and
 * billing's per-channel floor only lets a channel funded under its minimum be KEPT
 * or RAISED — so a campaign grandfathered under the floor, stopped that way,
 * could never be restarted at the figure it was running. A status flag keeps the
 * ceiling untouched, so restarting is one click and the amount is still there.
 *
 * campaign-service maps `activate` to `ongoing` and `stop` to `stopped`, and
 * stamps `stopReason: manual` on a stop — which its own code documents as NOT
 * resumable, so nothing brings the campaign back on its own. That is the point:
 * a person stopped it, a person restarts it.
 *
 * ⚠️ `activate` FIRES THE WORKFLOW IMMEDIATELY (`executeCampaignWorkflow` +
 * `wakeScheduler`), so restarting spends now rather than at the next tick. The
 * surface offering it says so.
 *
 * `x-brand-id` / `x-feature-slug` are REQUIRED for an activate: campaign-service
 * validates the workflow's seven tracking headers before flipping the row and
 * 400s naming the missing ones. api-service reads both off the inbound request
 * and forwards them, so they are sent here rather than assumed.
 */
export async function setCampaignStatus(
  campaignId: string,
  status: "activate" | "stop",
  identity: { brandId: string; featureSlug: string },
  token?: string,
): Promise<void> {
  await apiCall<unknown>(`/campaigns/${campaignId}`, {
    token,
    method: "PATCH",
    body: { status },
    headers: {
      "x-run-id": globalThis.crypto.randomUUID(),
      "x-brand-id": identity.brandId,
      "x-feature-slug": identity.featureSlug,
    },
  });
}

/**
 * POST /campaigns — START one campaign: an acquisition channel performing one LEG for
 * one offer.
 *
 * The other half of `setCampaignStatus` above: a status write addresses a campaign that
 * EXISTS; this is what a (leg x channel) with no campaign needs. Money starts nothing
 * (campaign-service, 2026-09-06), so a funded leg with no campaign stays not started
 * until a person starts it here.
 *
 * ⚠️ This CREATES-OR-RESTARTS and hands the row back STARTED: campaign-service matches
 * the incumbent of the identity (offer x leg x channel) whatever its status. So it spends
 * immediately rather than at the next daily tick, and the surface offering it says so.
 *
 * `workflowDynastySlug` is features-service's OWN pick for that leg, resolved by the
 * caller off the workflow-projection ladder and never invented here.
 *
 * There is deliberately NO maxBudget* field: a sales campaign's money is billing's,
 * keyed per (offer, leg, channel).
 */
export async function startCampaign(
  params: {
    name: string;
    brandId: string;
    featureSlug: string;
    featureInputs: Record<string, string>;
    workflowDynastySlug: string;
    /** The proposition it sells. */
    offerId: string;
    /** The one leg it is bought for. */
    legKey: string;
  },
  token?: string,
): Promise<{ campaign: RawCampaign }> {
  return apiCall<{ campaign: RawCampaign }>("/campaigns", {
    token,
    method: "POST",
    body: {
      name: params.name,
      brandIds: [params.brandId],
      featureSlug: params.featureSlug,
      featureInputs: params.featureInputs,
      // campaign-service takes ONE required `workflowSlug` and has no dynasty field (it
      // dropped dynasty slugs in April), so a body carrying only `workflowDynastySlug`
      // was refused 400 on every Start. The dynasty slug goes in `workflowSlug`, exactly
      // as the onboarding launch sends it: the selector picks the running version itself.
      workflowSlug: params.workflowDynastySlug,
      offerId: params.offerId,
      legKey: params.legKey,
    },
    headers: {
      "x-run-id": globalThis.crypto.randomUUID(),
      "x-brand-id": params.brandId,
      "x-feature-slug": params.featureSlug,
    },
  });
}

// Campaign sub-resources

/** Snapshot of the lead's CURRENT employer organization (lead-service OrganizationView). */
export interface LeadOrganizationView {
  id: string;
  apolloOrganizationId: string | null;
  name: string | null;
  primaryDomain: string | null;
  websiteUrl: string | null;
  industry: string | null;
  estimatedNumEmployees: number | null;
  annualRevenue: string | null;
  logoUrl: string | null;
  shortDescription: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  facebookUrl: string | null;
  blogUrl: string | null;
  crunchbaseUrl: string | null;
  foundedYear: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  streetAddress: string | null;
  postalCode: string | null;
  technologyNames: string[] | null;
  industries: string[] | null;
  secondaryIndustries: string[] | null;
}

/** One contact endpoint attached to a lead (lead-service ContactMethodView). */
export interface LeadContactMethodView {
  channel: string;
  value: string;
  status: string | null;
  source: string;
}

/** One row from the lead's employment history (lead-service EmploymentEntryView). */
export interface LeadEmploymentEntryView {
  organizationId: string;
  organizationName: string | null;
  title: string | null;
  startDate: string | null;
  endDate: string | null;
  current: boolean;
  description: string | null;
}

/** Canonical lead payload (lead-service FullLead). */
export interface FullLead {
  leadId: string;
  apolloPersonId: string | null;
  firstName: string;
  lastName: string;
  name: string | null;
  headline: string | null;
  // Current employer's job title (lead-service derives it from the lead's
  // current employment row). The LinkedIn-style `headline` above is a separate,
  // often-null field — render `currentTitle` for the "Title" label, not headline.
  // Optional: present on the full FullLead today; the slim `view=basic`
  // projection populates it once lead-service ships the slim-field add.
  currentTitle?: string | null;
  linkedinUrl: string | null;
  photoUrl: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  seniority: string | null;
  departments: string[] | null;
  subdepartments: string[] | null;
  functions: string[] | null;
  twitterUrl: string | null;
  githubUrl: string | null;
  facebookUrl: string | null;
  enrichedAt: string | null;
  organization: LeadOrganizationView | null;
  // Optional: omitted by the slim `view=basic` projection (brand leads list).
  // Present in the full payload (campaign leads, feature leads). #1620
  contacts?: LeadContactMethodView[];
  employmentHistory?: LeadEmploymentEntryView[];
}

/** A leads_campaigns row plus the canonical FullLead — mirrors lead-service LeadDetail. */
export interface Lead {
  id: string;
  leadId: string | null;
  namespace: string;
  email: string;
  apolloPersonId: string | null;
  emailStatus: string | null;
  status: "buffered" | "skipped" | "claimed" | "served";
  statusReason: string | null;
  statusDetails: string | null;
  parentRunId: string | null;
  runId: string | null;
  brandIds: string[];
  campaignId: string;
  orgId: string;
  userId: string | null;
  workflowSlug: string | null;
  featureSlug: string | null;
  servedAt: string | null;
  // Per-event first-occurrence ISO timestamps from email-gateway, forwarded by
  // lead-service. Optional: present once lead-service ships them; `.passthrough()`
  // on LeadDeliverySchema keeps them at runtime. Drive the lead detail-panel
  // event timeline. #audiences-leads-date / lead-event-timeline
  firstClickedAt?: string | null;
  firstContactedAt?: string | null;
  firstSentAt?: string | null;
  firstDeliveredAt?: string | null;
  firstRepliedAt?: string | null;
  firstBouncedAt?: string | null;
  firstUnsubscribedAt?: string | null;
  contacted: boolean;
  sent: boolean;
  delivered: boolean;
  clicked: boolean;
  bounced: boolean;
  unsubscribed: boolean;
  replied: boolean;
  replyClassification: "positive" | "negative" | "neutral" | null;
  lastDeliveredAt: string | null;
  global: { bounced: boolean; unsubscribed: boolean };
  // Audience attribution stored on the leads_campaigns row by lead-service —
  // `audienceId` = human-service audience.id (null = unattributed), `audience`
  // the resolved {id,name,avatarUrl} for direct render. The Audience column
  // reads `lead.audience` straight from the wire (no client-side membership
  // join). Optional: `.passthrough()` on LeadDeliverySchema keeps them at
  // runtime; typed optional so a not-yet-attributed lead renders "-".
  audienceId?: string | null;
  audience?: { id: string; name: string; avatarUrl: string | null } | null;
  /**
   * The OFFER this lead belongs to — the offer named by the CAMPAIGN it was
   * served under, resolved by lead-service off the attribution it froze on the
   * membership row. Read straight from the wire, never joined here: the
   * dashboard holds neither the campaign→offer map nor the offer's name, and
   * the Audience field above is the precedent for why a client-side join is the
   * wrong layer even when it is possible.
   *
   * `null` = the campaign names no offer (a campaign that stopped before offers
   * existed), or lead-service could not resolve one — it is fail-soft there, so
   * an absent offer is "we could not say", never "there is none". Either way
   * the section is dropped rather than showing a guess.
   *
   * `name` can be null on a present id: lead-service states the id it was given
   * even when brand-service does not list the offer back. Render the id's
   * section without a name rather than hiding a real attribution.
   *
   * Optional because `LeadDeliverySchema.passthrough()` keeps it at runtime and
   * a lead read before lead-service v0.55.0 carries none.
   */
  offer?: { id: string; name: string | null } | null;
  /**
   * WHERE THIS PERSON STANDS on the campaign they were served under, decided by
   * lead-service (v0.64.0) and by nobody else.
   *
   * The leads board renders `standing.state` instead of deriving one from the reply
   * signals below. Those signals stay on the wire and stay read — they are what the
   * table's status badge and the lead panel's timeline are about — but "is this
   * person still a live prospect" is commercial policy, it is leg-aware, and it
   * has ONE owner now. See `lib/lead-standing.ts` for why.
   *
   * OPTIONAL, and only that: a payload written before v0.64.0 carries none, which in
   * practice is a snapshot restored from the local-first cache for the second before
   * the poll lands. Its FIELDS are required-and-nullable, so they are `T | null` and
   * never `.optional()` — the producer means to send those nulls.
   */
  standing?: LeadStanding | null;
  /**
   * The CLOSED DEAL on this row, or null when nobody has stated one (lead-service
   * v0.76.0, on every scope of both list paths).
   *
   * Derived by the producer in the same pass as `standing`, off the same two statement
   * reads, so a page of leads costs no request per lead and the row and the panel
   * cannot disagree about whether somebody bought. Nothing is stored, so withdrawing or
   * restating the statement moves it with no write.
   *
   * `causedByOutreach` is the answer to "did OUR outreach cause this deal", and it has
   * THREE states that must never collapse into two: `true` ours, `false` theirs, and
   * `null` NOBODY WAS ASKED — every deal stated before the field shipped, and every
   * tracker-reported one, because a page-load tag cannot know why somebody bought.
   * Reading null as either answer is the whole thing this field exists to stop.
   *
   * It is emphatically NOT the tracker's own attribution reading (`attributed` /
   * `needs_review` / `unmatched`), which answers whether we managed to identify who a
   * conversion belonged to. Different question; the producer keeps the two apart.
   *
   * `.optional()` on the OBJECT only — a payload written before v0.76.0 carries none.
   * Its fields are the producer's required-and-nullable, so they are `T | null`.
   */
  closedDeal?: {
    occurredAt: string | null;
    valueCents: number | null;
    /** What the customer said closing it cost THEM. Their own money; never billed. */
    costCents: number | null;
    causedByOutreach: boolean | null;
    source: string | null;
  } | null;
  /**
   * THIS PERSON'S CAMPAIGNS, each card stating what happened IN THAT CAMPAIGN
   * (lead-service v0.67.0, served only when the read asks `?include=campaigns`).
   *
   * A brand-scoped read answers ONE ROW PER PERSON (`DISTINCT ON (lead_id)`) and the
   * delivery fields above are the BRAND-wide roll-up — right for "did this brand reach
   * this person", wrong for "did this campaign reach them". 56,809 people in production
   * sit in more than one campaign of one brand, one of them in 11 campaign identities
   * across 9 offers, so a panel nesting campaign cards under a person without this would
   * print byte-identical evidence under every card.
   *
   * Both facts are served at once: the row's own fields stay the brand-wide roll-up
   * (the table's status badge, its tabs, the triage board and the covered-lead count all
   * read them) and these cards answer the per-campaign question beside them.
   *
   * `.optional()` because it is OPT-IN, not because the producer might omit it: a read
   * that does not ask carries no key at all. `delivery: null` means the provider reports
   * none for that campaign — "we cannot tell", never "nothing happened".
   */
  campaigns?: LeadCampaignEvidence[];
  lead: FullLead | null;
}

/** One campaign of a person, with the delivery evidence of THAT campaign alone. */
export interface LeadCampaignEvidence {
  /** The `leads_campaigns` row this card speaks for. */
  id: string;
  /** The campaign row that membership names. */
  campaignId: string;
  /** Every stored campaign id whose evidence the card reads — the identity's members. */
  campaignIds: string[];
  status: "buffered" | "skipped" | "claimed" | "served";
  servedAt: string | null;
  /**
   * The audience THIS campaign picked the person for. An id only — the resolved
   * `{name, avatarUrl}` rides the ROW, and only for the row's own campaign, so a card's
   * name is looked up in the audiences list the panel already holds.
   */
  audienceId: string | null;
  offer: { id: string; name: string | null } | null;
  standing: LeadStanding;
  /** Null = the provider reports no evidence for this campaign. Not "nothing happened". */
  delivery: LeadCampaignDelivery | null;
}

/** The delivery facts of ONE campaign — the same fields the row carries at top level,
 *  answering for that campaign instead of for the brand. */
export interface LeadCampaignDelivery {
  contacted: boolean;
  sent: boolean;
  delivered: boolean;
  opened: boolean;
  clicked: boolean;
  bounced: boolean;
  unsubscribed: boolean;
  replied: boolean;
  replyClassification: "positive" | "negative" | "neutral" | null;
  /** Tri-state: absent means nobody can tell us, which is not `false`. */
  disqualified?: boolean;
  sentCount: number;
  lastDeliveredAt: string | null;
  firstContactedAt: string | null;
  firstSentAt: string | null;
  firstDeliveredAt: string | null;
  firstOpenedAt: string | null;
  firstClickedAt: string | null;
  firstRepliedAt: string | null;
  firstBouncedAt: string | null;
  firstUnsubscribedAt: string | null;
  global: { bounced: boolean; unsubscribed: boolean };
}

export type LeadConsolidatedStatus = "replied" | "clicked" | "delivered" | "sent" | "bounced" | "unsubscribed" | "contacted" | "served" | "skipped" | "claimed" | "buffered";

/**
 * The lead's most-advanced delivery state, most-advanced FIRST.
 *
 * A BOUNCE and an UNSUBSCRIBE outrank `delivered` and `sent`, and that ordering is the
 * whole point of this function rather than a detail of it. A bounce can only happen to
 * a message that was SENT, so lead-service reports `sent: true` alongside `bounced: true`
 * on every bounced lead (729 of 732 on the campaign that surfaced this) — with `sent`
 * tested first, every bounce in the fleet read **Sent**, in the table badge, on the board
 * card and in the CSV, while the lead panel right beside it said the address had bounced.
 * The same shape hid `unsubscribed` behind `delivered`, since an unsubscribe requires a
 * delivered message.
 *
 * `replied` and `clicked` stay on top: a lead who answered or came to the site did those
 * things, and a later follow-up bouncing does not un-do them.
 *
 * ⚠️ `LEAD_STATUS_ORDER` (the priority `useMonotonicStatuses` latches on) MUST list these
 * in the SAME order. The latch suppresses a "downgrade", so an order that still ranked
 * `sent` above `bounced` would keep a row on Sent even once this function said Bounced,
 * and the fix would look like it had not shipped.
 */
export function getLeadConsolidatedStatus(lead: Lead): LeadConsolidatedStatus {
  if (lead.replied) return "replied";
  if (lead.clicked) return "clicked";
  if (lead.bounced) return "bounced";
  if (lead.unsubscribed) return "unsubscribed";
  if (lead.delivered) return "delivered";
  if (lead.sent) return "sent";
  if (lead.contacted) return "contacted";
  return lead.status;
}

/**
 * When the status the badge SHOWS actually happened.
 *
 * The leads table's Date column is per-TAB (Outreach reads the first-contacted
 * timestamp for every row it lists), while the badge states the lead's
 * most-advanced state — so a row reading "Replied" sat next to a contact date
 * from days earlier, two numbers about two different events with nothing on the
 * row saying so. The Status cell states its own date instead, taken from the
 * same status it renders.
 *
 * Exhaustive over `LeadConsolidatedStatus`, so a new status cannot ship without
 * deciding which timestamp proves it. The three pre-serve states carry no
 * timestamp on the wire and return null: the cell then renders nothing, because
 * a dash reads as a value we looked for and found empty.
 */
export function leadDateForStatus(lead: Lead, status: LeadConsolidatedStatus): string | null {
  switch (status) {
    case "replied": return lead.firstRepliedAt ?? null;
    case "clicked": return lead.firstClickedAt ?? null;
    case "delivered": return lead.firstDeliveredAt ?? null;
    case "sent": return lead.firstSentAt ?? null;
    case "bounced": return lead.firstBouncedAt ?? null;
    case "unsubscribed": return lead.firstUnsubscribedAt ?? null;
    case "contacted": return lead.firstContactedAt ?? null;
    case "served": return lead.servedAt;
    case "skipped":
    case "claimed":
    case "buffered":
      return null;
  }
}

// Validate the leads envelope + the fields the consolidated-status logic
// dereferences (id/email/status + the 7 delivery booleans — always present from
// lead-service). `.passthrough()` keeps every other field (the nested FullLead,
// `global`, `servedAt`, `campaignId`, …) untouched so we never strip data.
// Per #1213/#1221: a 200 with a non-leads body (proxy redirect, shape rot, a
// missing-booleans partial) now throws → React Query keeps the last-good data
// (keepPreviousData) instead of overwriting the table with a bad success.
const LeadDeliverySchema = z
  .object({
    id: z.string(),
    email: z.string(),
    status: z.string(),
    contacted: z.boolean(),
    sent: z.boolean(),
    delivered: z.boolean(),
    clicked: z.boolean(),
    bounced: z.boolean(),
    unsubscribed: z.boolean(),
    replied: z.boolean(),
    // The two fields the BOARD dereferences, validated for the same reason the
    // booleans above are: a 200 whose standing is the wrong shape must fail loudly
    // rather than place every card in "Not placed".
    //
    // `z.string()`, never `z.enum`: lead-service owns this vocabulary and can widen it
    // before this app ships, and closing the set here would turn a state it ADDS into
    // a thrown parse — which reveal-on-settle paints as headings with nothing under
    // them. `leadBoardColumnFor` renders a word it does not know as "we cannot place
    // this", which is the honest read and costs nobody the page.
    //
    // `.optional()` on the OBJECT (a payload written before lead-service v0.64.0
    // carries none) but never on its fields, which the producer marks required — most
    // of them nullable, so `.nullable()` is what those need, and they ride the
    // passthrough rather than being restated.
    standing: z
      .object({ state: z.string(), signal: z.string() })
      .passthrough()
      .nullish(),
    // Declared rather than left to the envelope's passthrough: the Close won column
    // renders off it, and a field nothing validates is one nobody notices going away.
    // `.nullish()` because the object is the producer's required-and-NULLABLE (null is
    // "nobody has stated a deal", the ordinary case) AND absent on a payload written
    // before v0.76.0 — `.optional()` alone would reject the null it means to send.
    closedDeal: z
      .object({ causedByOutreach: z.boolean().nullable() })
      .passthrough()
      .nullish(),
  })
  .passthrough();

const ListLeadsResponseSchema = z.object({ leads: z.array(LeadDeliverySchema) });

/**
 * Exported so a guard can run the REAL parser over a REAL body — a claim that a field
 * survives the parse is a claim about what this function returns, and reading the
 * schema back is not evidence of it.
 */
export function parseLeadsResponse(raw: unknown, fn: string): { leads: Lead[] } {
  const parsed = ListLeadsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[dashboard] ${fn}: response shape mismatch`, { issues: parsed.error.issues, raw });
    throw new Error(`[dashboard] ${fn}: invalid response shape`);
  }
  // `.passthrough()` preserves every field at runtime; the validated subset
  // doesn't structurally overlap the full Lead type, so cast through unknown.
  return parsed.data as unknown as { leads: Lead[] };
}

/**
 * ONE lead row, by its `leads_campaigns` id: lead-service `GET /orgs/leads/{id}`,
 * proxied at `/v1/leads/{id}`. The body is `{ leadDetail }`, the same row shape a list
 * serves (full person, delivery flags, standing), so it goes through the list's own
 * parser and a person page and a list row can never disagree about a lead.
 */
export async function getLeadDetail(leadRowId: string, brandId: string): Promise<Lead> {
  const raw = await apiCall<{ leadDetail?: unknown }>(
    `/leads/${encodeURIComponent(leadRowId)}?brandId=${encodeURIComponent(brandId)}`,
  );
  if (!raw || typeof raw !== "object" || !("leadDetail" in raw) || !raw.leadDetail) {
    console.error("[dashboard] getLeadDetail: response carries no leadDetail", { raw });
    throw new Error("[dashboard] getLeadDetail: invalid response shape");
  }
  return parseLeadsResponse({ leads: [raw.leadDetail] }, "getLeadDetail").leads[0];
}

// `view=basic` returns the slim lead projection (thin person + thin org, no
// employmentHistory / extra org columns). Both readers feed the SAME
// `EngagedLeadsPage`, which renders its table, status tabs, search and detail
// panel from thin fields only — so neither scope has a use for the full one.
//
// The campaign read went without it for as long as a campaign scope meant one
// stored campaign row and a handful of leads. lead-service now answers a
// campaign-scoped read for the whole campaign IDENTITY, so its size matches the
// brand's: one production brand measured 53,777 rows / 156 MB / 54s on the full
// projection against 102 MB / 6.6s on the slim one. The page polls this every
// 30 seconds per open tab, and the gateway used to buffer the whole body into
// memory, which is what OOM-crash-looped api-service.
// Requires api-service to forward the `view` param.
// See shamanic-technologies/distribute.you#1620.
//
// `include=campaigns` nests THIS PERSON'S campaigns under each row (lead-service
// v0.67.0), each card carrying the delivery evidence and the standing of that campaign
// alone. Asked for on BOTH readers because the lead panel is the same component at every
// grain: a person's campaigns are what it nests, and a read that does not ask carries no
// key at all, so the panel would silently draw one card for a person in eleven.
//
// The row's own top-level delivery fields are UNCHANGED by it — they stay the brand-wide
// roll-up the table's badge, its tabs, the board and the covered-lead count all read.
const LEADS_INCLUDE = "campaigns";

export async function listCampaignLeads(campaignId: string, token?: string): Promise<{ leads: Lead[] }> {
  const raw = await apiCall<unknown>(
    `/leads?campaignId=${campaignId}&view=basic&include=${LEADS_INCLUDE}`,
    { token },
  );
  return parseLeadsResponse(raw, "listCampaignLeads");
}

export async function listBrandLeads(brandId: string, token?: string): Promise<{ leads: Lead[] }> {
  const raw = await apiCall<unknown>(
    `/leads?brandId=${brandId}&view=basic&include=${LEADS_INCLUDE}`,
    { token },
  );
  return parseLeadsResponse(raw, "listBrandLeads");
}

/**
 * ONE PAGE of a scope's leads, plus how many there are in total.
 *
 * The unpaginated readers above hand back a brand's whole population — 44.5 MB over
 * 12,945 rows on one real brand, 99 MB on the largest. That is fine for a consumer that
 * genuinely wants every row (features-service's revenue engine, the staff console) and
 * ruinous for a page a customer opens many times a day: it is far past the 2 MB on-disk
 * cache entry cap, so it was never cached and the Leads page cold-loaded every visit.
 *
 * lead-service answers a bounded page instead (`limit`/`offset`, plus `bucket`, `q` and
 * `sort`), and states how many rows match the filter so a pager can exist without
 * holding them. The query is built by `leads-server-page.ts`, which is where the
 * producer's vocabulary lives; this function only carries it.
 */
export interface LeadsPage {
  leads: Lead[];
  /**
   * How many leads match this filter in total. `null` means the producer did not say —
   * it documents `total` as absent on an unbounded unfiltered read — and is never read
   * as zero: a pager told nothing shows one page rather than claiming an empty tab.
   */
  total: number | null;
  /** Where a cursor walk would resume; `null` at the end of the population. */
  nextCursor: string | null;
}

/**
 * `?brandId=` or `?campaignId=`, exactly as the unpaginated readers scope themselves.
 * `offerId` narrows a brand read to the campaigns selling that offer (lead-service
 * resolves it; never sent beside a campaign, which already sells one offer).
 */
export interface LeadScope {
  brandId?: string;
  campaignId?: string;
  offerId?: string;
}

function leadScopeQuery(scope: LeadScope): string {
  if (scope.campaignId) return `campaignId=${encodeURIComponent(scope.campaignId)}`;
  if (scope.brandId && scope.offerId) {
    return `brandId=${encodeURIComponent(scope.brandId)}&offerId=${encodeURIComponent(scope.offerId)}`;
  }
  if (scope.brandId) return `brandId=${encodeURIComponent(scope.brandId)}`;
  throw new Error("[dashboard] leadScopeQuery: a leads read must name a brand or a campaign");
}

function leadQueryString(scope: LeadScope, query: Record<string, string>): string {
  const parts = [leadScopeQuery(scope)];
  for (const [key, value] of Object.entries(query)) {
    parts.push(`${key}=${encodeURIComponent(value)}`);
  }
  return parts.join("&");
}

export async function listLeadsPage(
  scope: LeadScope,
  query: Record<string, string>,
  token?: string,
  options?: { includeCampaigns?: boolean },
): Promise<LeadsPage> {
  // `include=campaigns` nests each person's campaigns under their row, which the lead
  // panel opens from a row and needs. It roughly quadruples a row (6.2 KB against 1.6 KB
  // measured in production), so the EXPORT opts out: the CSV states no campaign card, and
  // a walk of thousands of rows is the one place that multiple is worth avoiding.
  const includeCampaigns = options?.includeCampaigns ?? true;
  const raw = await apiCall<unknown>(
    `/leads?${leadQueryString(scope, includeCampaigns ? { ...query, include: LEADS_INCLUDE } : query)}`,
    { token },
  );
  // Two parses over one body, deliberately: the ROWS go through the same
  // `parseLeadsResponse` every other leads reader uses, so a page and a full read can
  // never disagree about a lead's shape, while the envelope is parsed on its own
  // because that schema strips the keys the pager needs.
  const { leads } = parseLeadsResponse(raw, "listLeadsPage");
  const envelope = LeadsPageEnvelopeSchema.safeParse(raw);
  if (!envelope.success) {
    console.error("[dashboard] listLeadsPage: envelope shape mismatch", {
      issues: envelope.error.issues,
    });
    throw new Error("[dashboard] listLeadsPage: invalid response shape");
  }
  return { leads, total: envelope.data.total ?? null, nextCursor: envelope.data.nextCursor };
}

/**
 * Every engagement bucket's size for a scope, without a single lead row.
 *
 * This is what lets the tabs state their counts once the page stops holding the
 * population. It takes the SAME search the list takes, so the counts follow the search
 * box rather than describing a different set from the rows underneath them.
 */
export async function getLeadBucketCounts(
  scope: LeadScope,
  query: Record<string, string>,
  token?: string,
): Promise<LeadBucketCounts> {
  const raw = await apiCall<unknown>(
    `/leads/bucket-counts?${leadQueryString(scope, query)}`,
    { token },
  );
  const parsed = LeadBucketCountsSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getLeadBucketCounts: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getLeadBucketCounts: invalid response shape");
  }
  return parsed.data;
}

/**
 * Every STANDING's population for a scope, without a single lead row.
 *
 * This is what lets the board's columns state their true size. A standing is a
 * partition — one per lead — so a column holding two of them adds two served numbers
 * (`boardColumnTotals`) rather than counting whatever rows a page happened to return,
 * which is what made the whole screen describe three different populations.
 *
 * Same scope and same search as the list, so a column's stated size and what the column
 * shows cannot disagree.
 */
export async function getLeadStandingCounts(
  scope: LeadScope,
  query: Record<string, string>,
  token?: string,
): Promise<LeadStandingCounts> {
  const raw = await apiCall<unknown>(
    `/leads/standing-counts?${leadQueryString(scope, query)}`,
    { token },
  );
  const parsed = LeadStandingCountsSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getLeadStandingCounts: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getLeadStandingCounts: invalid response shape");
  }
  return parsed.data;
}

/**
 * Everything that happened to ONE person, in order, in one place.
 *
 * lead-service assembles it (`GET /orgs/leads/{id}/history`, sales-lead-service #508):
 * both directions of every exchange WITH THE WORDS, what we sent and when it landed,
 * what they did, what somebody recorded by hand and who recorded it, and what it
 * converted into — already merged, already de-duplicated, already ordered. Including
 * the customer's own mailbox, which for some prospects holds the only copy of the
 * exchange and which nothing read before.
 *
 * This replaces a merge the BROWSER did across six services. Do NOT reintroduce one:
 * ordering, de-duplication and which fact outranks which are the producer's, and every
 * timeline bug of that week came from this app deciding them for itself.
 *
 * `id` is the `leads_campaigns` row id a list row already carries. `scope` is the
 * producer's own: `campaign` (this campaign's identity) or `brand` (the roll-up).
 */
export async function getLeadHistory(
  leadRowId: string,
  params: { brandId?: string; scope?: "campaign" | "brand" } = {},
  token?: string,
): Promise<LeadHistory> {
  const qs = new URLSearchParams();
  if (params.brandId) qs.set("brandId", params.brandId);
  if (params.scope) qs.set("scope", params.scope);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const raw = await apiCall<unknown>(
    `/leads/${encodeURIComponent(leadRowId)}/history${suffix}`,
    { token },
  );
  const parsed = LeadHistorySchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getLeadHistory: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getLeadHistory: invalid response shape");
  }
  return parsed.data;
}

/**
 * The export, streamed by lead-service and fetched when the button is pressed.
 *
 * This walked the filter page by page for a while, assembling the file here, purely to
 * control the column headings: the producer's export used to head its columns with the
 * API's own field names while the page a customer had just been looking at said
 * "Contacted" and "Website visit". lead-service v0.70.0 heads them in the customer's
 * words, so the second implementation had nothing left to buy — and the walk carried a
 * row ceiling and several megabytes of transient traffic on a press that this does not.
 *
 * The file is now the producer's, headings included. That is the right home for it: it is
 * one artifact, and two implementations of it is how the file and the screen drift apart.
 */
export async function fetchLeadsCsv(
  scope: LeadScope,
  query: Record<string, string>,
  token?: string,
): Promise<string> {
  return apiCall<string>(
    `/leads?${leadQueryString(scope, { ...query, format: "csv" })}`,
    { token, responseType: "text" },
  );
}

export interface EmailSequenceStep {
  step: number;
  bodyHtml: string;
  bodyText: string;
  daysSinceLastStep: number;
}

export interface Email {
  id: string;
  campaignId: string;
  subject: string;
  bodyHtml: string | null;
  bodyText: string | null;
  sequence: EmailSequenceStep[] | null;
  leadFirstName: string;
  leadLastName: string;
  leadTitle: string;
  leadCompany: string;
  leadIndustry: string;
  /** The lead's company domain, as content-generation stores it (logo mark). */
  leadOrganizationDomain?: string | null;
  clientCompanyName: string;
  createdAt: string;
  generationRun: {
    status: string;
    startedAt: string;
    completedAt: string | null;
    totalCostInUsdCents: string;
    costs: RunCost[];
    serviceName: string;
    taskName: string;
    descendantRuns: DescendantRun[];
    error?: string;
    errorSummary?: ErrorSummary;
  } | null;
}

export async function listBrandEmails(brandId: string, token?: string): Promise<{ emails: Email[] }> {
  return apiCall<{ emails: Email[] }>(`/emails?brandId=${brandId}`, { token });
}

/**
 * The emails ONE workflow run wrote. content-generation files each generation under the
 * `x-run-id` it was called with, which is the workflow's own `execute-workflow` run —
 * verified in prod 2026-09-27 — so a run from the ledger opens its emails by id.
 */
export async function listRunEmails(brandId: string, runId: string, token?: string): Promise<Email[]> {
  const query = new URLSearchParams({ brandId, runId });
  const raw = await apiCall<unknown>(`/emails?${query}`, { token });
  const parsed = z.object({ emails: z.array(z.object({ id: z.string() }).passthrough()) }).safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] listRunEmails: invalid response shape", parsed.error.issues);
    throw new Error("[dashboard] listRunEmails: invalid response shape");
  }
  return parsed.data.emails as unknown as Email[];
}

/** A prompt template as content-generation serves it, read by its `type`. */
export interface PlatformPrompt {
  id: string;
  type: string;
  prompt: string;
  updatedAt: string;
}

/** One day of a workflow's curve on the ACTUAL-cost basis (vendor cost, before markup). */
export interface ActualCostPoint {
  date: string;
  /** Null = some billed spend that day has no known vendor cost. Never the billed figure. */
  cumulativeSpendUsd: number | null;
  cumulativePipelineUsd: number;
  roiMultiple: number | null;
}

export interface ActualCostHistory {
  daily: ActualCostPoint[];
  unpricedBilledCostUsd: number;
  unpricedFromDate: string | null;
}

/** One day of a workflow's fleet curve on the billed basis (what clients were charged, net). */
export interface FleetReturnPoint {
  date: string;
  cumulativeSpendUsd: number;
  cumulativePipelineUsd: number;
  roiMultiple: number | null;
}

const FLEET_POINT = z.object({
  date: z.string(),
  cumulativeSpendUsd: z.coerce.number(),
  cumulativePipelineUsd: z.coerce.number(),
  roiMultiple: z.coerce.number().nullable(),
});

/**
 * The query both fleet return reads send. A `legKey` narrows BOTH legs of the curve (spend
 * and value) to the campaigns performing that leg (features-service#1188), so a workflow
 * viewed under one crew states that crew's history, never the dynasty's across every leg.
 * Absent, the answer is the whole fleet, unchanged.
 */
function fleetReturnQuery(featureSlug: string, workflowDynastySlug: string, legKey?: string): URLSearchParams {
  const query = new URLSearchParams({ featureSlug, workflowDynastySlug });
  if (legKey) query.set("leg", legKey);
  return query;
}

/**
 * ONE workflow across EVERY client org, day by day: cumulative billed spend, cumulative
 * pipeline value and their ratio (features-service#1151 via api-service#1005). An
 * aggregate: no org is named. Null `roiHistory` = the producer could not read the dated
 * spend. The workflow page's three charts render it verbatim.
 */
export async function getFleetWorkflowReturnHistory(
  featureSlug: string,
  workflowDynastySlug: string,
  legKey?: string,
  token?: string,
): Promise<FleetReturnPoint[] | null> {
  const query = fleetReturnQuery(featureSlug, workflowDynastySlug, legKey);
  const raw = await apiCall<unknown>(`/public/features/workflow-return-history?${query.toString()}`, { token });
  const parsed = z
    .object({ roiHistory: z.object({ daily: z.array(FLEET_POINT) }).passthrough().nullable() })
    .passthrough()
    .safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getFleetWorkflowReturnHistory: invalid response shape", parsed.error.issues);
    throw new Error("[dashboard] getFleetWorkflowReturnHistory: invalid response shape");
  }
  return parsed.data.roiHistory ? parsed.data.roiHistory.daily : null;
}

const LegWorkflowRankingSchema = z
  .object({
    featureSlug: z.string(),
    legKey: z.string(),
    grain: z.literal("fleet"),
    computedAt: z.string().nullable(),
    maturity: z.object({
      durationDays: z.number(),
      outcomesRequired: z.number(),
      cutoffIso: z.string().nullable(),
      measured: z.boolean(),
    }),
    rows: z.array(
      z.object({
        rank: z.number(),
        workflowDynastySlug: z.string(),
        workflowDynastyName: z.string().nullable(),
        assignment: z.string(),
        selectable: z.boolean(),
        isMature: z.boolean().nullable(),
        costPerOutcomeUsd: z.number().nullable(),
        conversionRatePct: z.number().nullable(),
        outcomes: z.number(),
        spentUsd: z.number(),
        roiMultiple: z.number().nullable(),
        goesFirst: z.boolean(),
        moneyGoesHere: z.boolean(),
      }),
    ),
  })
  .passthrough();

export type LegWorkflowRanking = z.infer<typeof LegWorkflowRankingSchema>;

/**
 * EVERY WORKFLOW ON ONE LEG, RANKED AT THE FLEET GRAIN (features-service
 * `/public/stats/leg-workflow-ranking`, via api-service). Names no org, brand, offer,
 * campaign or audience: the Research pages read it so nothing they state depends on who
 * is looking. `computedAt: null` = the producer has not built it yet (no rows).
 */
export async function getLegWorkflowRanking(featureSlug: string, legKey: string, token?: string): Promise<LegWorkflowRanking> {
  const query = new URLSearchParams({ featureSlug, leg: legKey });
  const raw = await apiCall<unknown>(`/public/features/leg-workflow-ranking?${query.toString()}`, { token });
  const parsed = LegWorkflowRankingSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getLegWorkflowRanking: invalid response shape", parsed.error.issues);
    throw new Error("[dashboard] getLegWorkflowRanking: invalid response shape");
  }
  return parsed.data;
}

/**
 * STAFF ONLY. The same fleet curve costed at what the vendors charged us before our
 * markup. It reveals our margin, so the gateway refuses anyone off the staff list.
 */
export async function getFleetWorkflowActualCostHistory(
  featureSlug: string,
  workflowDynastySlug: string,
  legKey?: string,
  token?: string,
): Promise<ActualCostHistory | null> {
  const query = fleetReturnQuery(featureSlug, workflowDynastySlug, legKey);
  const raw = await apiCall<unknown>(`/features/workflow-return-history/actual-cost?${query.toString()}`, { token });
  const parsed = z
    .object({
      actualCostHistory: z
        .object({
          daily: z.array(FLEET_POINT.extend({ cumulativeSpendUsd: z.coerce.number().nullable() })),
          unpricedBilledCostUsd: z.coerce.number(),
          unpricedFromDate: z.string().nullable(),
        })
        .passthrough()
        .nullable(),
    })
    .passthrough()
    .safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getFleetWorkflowActualCostHistory: invalid response shape", parsed.error.issues);
    throw new Error("[dashboard] getFleetWorkflowActualCostHistory: invalid response shape");
  }
  return parsed.data.actualCostHistory;
}

/** What a staff prompt edit produced, as workflow-service states it (#454). */
export interface WorkflowPromptEditResult {
  action: "upgraded" | "forked";
  /** The NEW row: a new dynasty on fork, a new version of the same one on upgrade. */
  workflow: { id: string; workflowDynastySlug: string; version: number; contentPromptType?: string | null };
  promptTemplate: { previousType: string | null; type: string };
}

/**
 * STAFF ONLY. Upgrade or fork a workflow dynasty's active version with an edited prompt.
 * The existing template is never modified: the edit becomes a new template type that
 * only the upgraded or forked workflow uses. The gateway refuses a non-staff caller.
 */
export async function editWorkflowPrompt(
  workflowDynastySlug: string,
  action: "upgrade" | "fork",
  prompt: string,
  token?: string,
): Promise<WorkflowPromptEditResult> {
  const raw = await apiCall<unknown>(`/workflows/dynasty/${encodeURIComponent(workflowDynastySlug)}/prompt-edit`, {
    token,
    method: "POST",
    body: { action, prompt },
  });
  const parsed = z
    .object({
      action: z.enum(["upgraded", "forked"]),
      workflow: z
        .object({ id: z.string(), workflowDynastySlug: z.string(), version: z.coerce.number(), contentPromptType: z.string().nullish() })
        .passthrough(),
      promptTemplate: z.object({ previousType: z.string().nullable(), type: z.string() }).passthrough(),
    })
    .passthrough()
    .safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] editWorkflowPrompt: invalid response shape", parsed.error.issues);
    throw new Error("[dashboard] editWorkflowPrompt: invalid response shape");
  }
  return parsed.data as WorkflowPromptEditResult;
}

export async function getPlatformPrompt(type: string, token?: string): Promise<PlatformPrompt> {
  const raw = await apiCall<unknown>(`/content/platform-prompts?type=${encodeURIComponent(type)}`, { token });
  const parsed = z
    .object({ id: z.string(), type: z.string(), prompt: z.string(), updatedAt: z.string() })
    .passthrough()
    .safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getPlatformPrompt: invalid response shape", parsed.error.issues);
    throw new Error("[dashboard] getPlatformPrompt: invalid response shape");
  }
  return parsed.data;
}

/** The generated email for ONE lead — initial body + follow-up `sequence` steps —
 *  read by leadId from content-generation-service via the api-service proxy.
 *  Powers the email content interleaved into the lead detail timeline. */
export interface LeadEmailGeneration {
  id: string;
  campaignId: string | null;
  subject: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  sequence: EmailSequenceStep[] | null;
  createdAt: string | null;
  leadId: string | null;
}

const LeadEmailGenerationSchema = z
  .object({
    id: z.string(),
    subject: z.string().nullable().optional(),
    bodyHtml: z.string().nullable().optional(),
    bodyText: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
  })
  .passthrough();

const GetLeadEmailResponseSchema = z.object({ generation: LeadEmailGenerationSchema.nullable() });

/** GET /v1/emails/by-lead/:leadId?brandId= → { generation } (null when the lead has no
 *  generated email yet). 404 is mapped to { generation: null } by the gateway.
 *  `brandId` scopes the generation to the brand being viewed: the same person can be a
 *  lead under several brands in one org (each with its OWN generated email), so without
 *  the scope the by-lead read returns whichever generation it finds — the wrong brand's
 *  email under the current brand's lead. Pass the viewed brand's id to disambiguate. */
export async function getLeadEmail(
  leadId: string,
  brandId?: string,
  campaignId?: string,
  token?: string,
): Promise<{ generation: LeadEmailGeneration | null }> {
  const params = new URLSearchParams();
  if (brandId) params.set("brandId", brandId);
  // Narrows the read to ONE campaign (content-generation-service, live). A person
  // contacted by several campaigns of one brand has one generation per campaign — 5,539
  // leads carry two or more — so without it this returns whichever the read picked and
  // the panel shows one campaign's copy under another's name. Absent leaves the read
  // exactly as it was.
  if (campaignId) params.set("campaignId", campaignId);
  const qs = params.toString() ? `?${params.toString()}` : "";
  const raw = await apiCall<unknown>(`/emails/by-lead/${leadId}${qs}`, { token });
  const parsed = GetLeadEmailResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getLeadEmail: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] getLeadEmail: invalid response shape");
  }
  return parsed.data as unknown as { generation: LeadEmailGeneration | null };
}

/**
 * The conversation actually exchanged with a lead — every message of the thread,
 * oldest first, read from instantly-service through the api-service proxy.
 *
 * This is what the lead panel could never show: the generation read above states
 * the emails we WROTE, and the delivery flags state that something happened to
 * them, while the words the prospect sent back — and the words we sent in answer —
 * lived nowhere a customer could reach. instantly-service holds them for BOTH
 * transports (the Instantly Unibox and our own SMTP/IMAP self-send) behind one
 * shape, so a reader never has to know which pipe carried a given lead.
 *
 * ⚠️ `campaignId` is the LEAD's own (`lead.campaignId`), never the URL's. See the
 * note in `lib/lead-conversation.ts`: a campaign as a customer knows it is dozens
 * of stored rows, the URL names the live one, and the thread is resolved against
 * the row the lead was actually served under.
 *
 * ⚠️ Every field is declared REQUIRED because the producer marks them required.
 * Declaring them optional is how a rename reads `undefined` forever and every
 * message silently vanishes; `accountEmail` is the one the producer itself makes
 * nullable (a row predating the mailbox persist), so it is nullable here too.
 *
 * The three outcomes stay distinguishable and the caller must keep them apart: a
 * 404 means nobody has this exchange on record, a 200 with no messages means the
 * sequence exists and nothing has been said yet, and a 502 means we hold the
 * thread and could not read it. Declares no cost — it is a read of what happened.
 */
const ConversationMessageSchema = z.object({
  direction: z.enum(["inbound", "outbound"]),
  from: z.string(),
  to: z.string(),
  at: z.string(),
  subject: z.string(),
  text: z.string(),
});

const LeadConversationSchema = z.object({
  campaignId: z.string(),
  instantlyCampaignId: z.string(),
  leadEmail: z.string(),
  accountEmail: z.string().nullable(),
  transport: z.enum(["instantly", "smtp"]),
  messageCount: z.number(),
  messages: z.array(ConversationMessageSchema),
});

const GetLeadConversationResponseSchema = z.object({
  success: z.literal(true),
  conversation: LeadConversationSchema,
});

/** GET /v1/conversations?campaign_id=&email= → the whole thread.
 *  The gateway named its own path; this conforms to what it deployed (api-service
 *  v0.103.1), which is the only authority on it — the downstream route it proxies
 *  is instantly-service's `/orgs/conversations`. */
export async function getLeadConversation(
  campaignId: string,
  email: string,
  token?: string,
): Promise<LeadConversation> {
  const qs = `?campaign_id=${encodeURIComponent(campaignId)}&email=${encodeURIComponent(email)}`;
  const raw = await apiCall<unknown>(`/conversations${qs}`, { token });
  const parsed = GetLeadConversationResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getLeadConversation: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] getLeadConversation: invalid response shape");
  }
  return parsed.data.conversation;
}

/** A past generated email surfaced as an EXAMPLE for a workflow (campaigns/new picker).
 *  `scope` is the cascade tier it was pulled from relative to the caller:
 *  "brand" (own brand) · "org" (same org, other brand) · "global" (any org — public examples).
 *  `brandName` labels the source brand for the cross-source tag (null for own brand). */

export type ManualQualificationClassification = "positive" | "negative" | "neutral";

// Workflows
export interface DAGNode {
  id: string;
  type: string;
  config?: Record<string, unknown>;
  inputMapping?: Record<string, string>;
  retries?: number;
}

export interface DAGEdge {
  from: string;
  to: string;
  condition?: string;
}

export interface DAG {
  nodes: DAGNode[];
  edges: DAGEdge[];
  onError?: string;
}

export interface Workflow {
  id: string;
  appId: string;
  workflowName: string;
  workflowSlug: string;
  workflowDynastyName: string;
  workflowDynastySlug: string;
  version: number;
  description: string | null;
  featureSlug: string | null;
  category?: string;
  channel?: string;
  audienceType?: string;
  workflowDynastySignatureName: string;
  dag: DAG | null;
  requiredProviders: string[];
  status?: "active" | "deprecated";
  upgradedTo?: string | null;
  forkedFrom?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowSummary {
  workflowSlug: string;
  summary: string;
  requiredProviders: string[];
  steps: string[];
}

export interface WorkflowKeyStatus {
  workflowSlug: string;
  ready: boolean;
  keys: { provider: string; configured: boolean; maskedKey: string | null; keySource: "org" | "platform" }[];
  missing: string[];
}

// Key source preferences
export interface KeySourcePreference {
  provider: string;
  keySource: "org" | "platform";
}

export async function listKeySources(token?: string): Promise<{ sources: KeySourcePreference[] }> {
  return apiCall<{ sources: KeySourcePreference[] }>("/keys/sources", { token });
}

export async function setKeySource(
  provider: string,
  keySource: "org" | "platform",
  token?: string
): Promise<{ provider: string; orgId: string; keySource: "org" | "platform"; message: string }> {
  return apiCall<{ provider: string; orgId: string; keySource: "org" | "platform"; message: string }>(
    `/keys/${provider}/source`,
    { token, method: "PUT", body: { keySource } }
  );
}

// Provider requirements
export interface ProviderRequirementEndpoint {
  service: string;
  method: string;
  path: string;
}

export interface ProviderRequirementResult {
  service: string;
  method: string;
  path: string;
  provider: string;
}

export async function queryProviderRequirements(
  endpoints: ProviderRequirementEndpoint[],
  token?: string
): Promise<{ requirements: ProviderRequirementResult[]; providers: string[] }> {
  return apiCall<{ requirements: ProviderRequirementResult[]; providers: string[] }>(
    "/keys/provider-requirements",
    { token, method: "POST", body: { endpoints } }
  );
}

// Platform discovery
export interface PlatformService {
  name: string;
  baseUrl: string;
  openapiUrl: string;
}

export interface LlmEndpointSummary {
  method: string;
  path: string;
  summary: string;
  params?: { name: string; in: string; required: boolean; type?: string }[];
  bodyFields?: string[];
}

export interface LlmServiceSummary {
  service: string;
  baseUrl: string;
  title?: string;
  description?: string;
  error?: string;
  endpoints: LlmEndpointSummary[];
}

export interface LlmContextResponse {
  _description: string;
  _usage: string;
  services: LlmServiceSummary[];
}

export async function getPlatformLlmContext(): Promise<LlmContextResponse> {
  return apiCall<LlmContextResponse>("/platform/llm-context");
}

export async function getPlatformServices(): Promise<{ services: PlatformService[] }> {
  return apiCall<{ services: PlatformService[] }>("/platform/services");
}

export async function getPlatformServiceSpec(service: string): Promise<Record<string, unknown>> {
  return apiCall<Record<string, unknown>>(`/platform/services/${service}`);
}

// Ranked workflows (family-aggregated stats from workflow-service)
export interface RankedWorkflowStats {
  totalCostInUsdCents: number;
  totalOutcomes: number;
  costPerOutcome: number | null;
  completedRuns: number;
}

export interface RankedWorkflowItem {
  workflow: {
    id: string;
    workflowSlug: string;
    workflowName: string;
    workflowDynastyName: string;
    workflowDynastySlug: string;
    version: number;
    createdForBrandId: string | null;
    featureSlug: string | null;
  };
  dag: DAG;
  stats: RankedWorkflowStats;
}

export interface RankedWorkflowResponse {
  results: RankedWorkflowItem[];
}

export async function fetchRankedWorkflows(params: {
  featureSlug: string;
  objective: string;
  groupBy: "workflow" | "brand";
  limit?: number;
}, token?: string): Promise<RankedWorkflowItem[]> {
  const query = new URLSearchParams();
  query.set("featureSlug", params.featureSlug);
  query.set("objective", params.objective);
  query.set("groupBy", params.groupBy);
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  const data = await apiCall<RankedWorkflowResponse>(`/features/ranked${qs ? `?${qs}` : ""}`, { token });
  return data.results;
}

/** GET /v1/public/features/ranked — cross-org/brand workflow performance leaderboard. */
export interface GlobalRankedWorkflowItem {
  workflow: {
    id: string;
    workflowSlug: string;
    workflowName: string;
    workflowDynastyName: string;
    workflowDynastySlug: string;
    version: number;
    createdForBrandId: string | null;
    featureSlug: string;
  };
  brand?: { id: string; name: string | null; domain: string | null };
  stats: Record<string, number | null>;
}

export interface GlobalRankedResponse {
  objective: string;
  sortDirection: "asc" | "desc";
  results: GlobalRankedWorkflowItem[];
}

// ── Workflow projection ─────────────────────────────────────────────────────
// features-service owns the per-workflow GLOBAL unit costs (contacted/reply/click $ — cross-org,
// feature-scoped, econ-INDEPENDENT) + the recommended workflow, AND returns a server-computed
// cost-per-close + count projection from the brand's SAVED economics. Consumers (brand overview,
// workflows page, onboarding) render those server values directly via getWorkflowProjection.
// Wire shape verified against the deployed contract via api-registry. safeParse per CLAUDE.md.
export type SalesObjective =
  | "meeting-booked"
  | "self-serve"
  | "form_submissions"
  | "website_visits"
  | "positive_replies"
  | "website_purchase"
  | "sales";

export function salesObjectiveForOptimizationGoal(
  goal: BrandOptimizationGoal,
): SalesObjective {
  // Each goal maps to features-service's native objective so the server computes the
  // right path: website_visits + positive_replies are SINGLE-STEP (visit→paid /
  // reply→paid, using visitToPaidClientPct / replyToPaidClientPct); form_submissions is
  // its own two-step; signups → self-serve (visit→signup→paid); sales_meetings →
  // meeting-booked. (features-service natively supports all — the old "borrow the
  // nearest family" workaround is gone; sending the real goal fixes cost-per-outcome,
  // cost-per-paid-client, ROI + CAC for the single-step goals.)
  if (goal === "form_submissions") return "form_submissions";
  if (goal === "website_visits") return "website_visits";
  if (goal === "positive_replies") return "positive_replies";
  // website_purchase → the native multi-step close (cost-per-paid-client).
  if (goal === "website_purchase") return "website_purchase";
  // sales → the combined goal (paying client via visit→paid OR reply→paid).
  if (goal === "sales") return "sales";
  if (goal === "sales_meetings") return "meeting-booked";
  return "self-serve";
}

/** Per-workflow count projection at the requested budget. All fields null where the route
 *  doesn't apply (replies/meetings for self-serve, visits with no click cost) or no data. */
const WorkflowCountProjectionSchema = z.object({
  contactedLeads: z.number().nullable(),
  replies: z.number().nullable(),
  visits: z.number().nullable(),
  // Expected form submissions (visits × visitToFormSubmissionPct). Optional to decouple the
  // features-service rollout; present once the form_submissions goal is live in prod.
  formSubmissions: z.number().nullable().optional(),
  meetings: z.number().nullable(),
  closes: z.number().nullable(),
  revenue: z.number().nullable(),
  /** (budget / revenue) × 100 — budget-invariant. */
  cacPct: z.number().nullable(),
  /** budget / closes (absolute cost per close) — budget-invariant. */
  cacAbs: z.number().nullable(),
});

const WorkflowProjectionItemSchema = z.object({
  workflowDynastySlug: z.string(),
  workflowDynastyName: z.string().nullable(),
  contactedUsd: z.number().nullable(),
  replyUsd: z.number().nullable(),
  clickUsd: z.number().nullable(),
  costPerSignupUsd: z.number().nullable().optional(),
  // Cost per form submission (form_submissions goal). Optional to decouple the rollout.
  costPerFormSubmissionUsd: z.number().nullable().optional(),
  // The GOAL metric the projection was queried for (resolved.costPerOutcomeUsd) — the
  // native per-goal cost features-service ranks on. Used by the form_submissions +
  // purchase unit-cost path where no dedicated grain field exists. Optional to decouple.
  costPerOutcomeUsd: z.number().nullable().optional(),
  costPerCloseUsd: z.number().nullable(),
  costPerMeetingBookedUsd: z.number().nullable().optional(),
  // Lifetime ROI multiple = LTR / costPerCloseUsd (= 100 / cacPct), budget-
  // independent — rendered VERBATIM instead of inverting cacPct client-side
  // (features-service#396). `.optional()` decouples the backend rollout.
  roiMultiple: z.number().nullable().optional(),
  // null when budgetUsd is absent/≤0 or the workflow has no usable data.
  projection: WorkflowCountProjectionSchema.nullable(),
});

const WorkflowProjectionResponseSchema = z.object({
  featureSlug: z.string(),
  objective: z.union([
    z.literal("meeting-booked"),
    z.literal("self-serve"),
    z.literal("form_submissions"),
    z.literal("website_visits"),
    z.literal("positive_replies"),
    z.literal("website_purchase"),
    z.literal("sales"),
  ]),
  workflows: z.array(WorkflowProjectionItemSchema),
  recommendedWorkflowDynastySlug: z.string().nullable(),
  recommendedBudgetUsd: z.number().nullable(),
});

export type WorkflowCountProjection = z.infer<typeof WorkflowCountProjectionSchema>;
export type WorkflowProjectionItem = z.infer<typeof WorkflowProjectionItemSchema>;
export type WorkflowProjectionResponse = z.infer<typeof WorkflowProjectionResponseSchema>;

/**
 * Adapt ONE ladder row (a workflow dynasty's brand-level row) into the legacy
 * `WorkflowProjectionItem`. Every value is read VERBATIM from the row's resolved grain
 * block (the finest present) — no arithmetic. The COUNT projection
 * (contactedLeads/replies/visits/meetings/closes/revenue) no longer exists in the
 * reshaped contract, so those are null (fail to "-", never fabricated); `cacPct`/`cacAbs`
 * carry the resolved values so any consumer reading them stays correct.
 */
function ladderRowToWorkflowItem(row: WorkflowProjectionRow): WorkflowProjectionItem {
  const block = row.estimatesByGrain[row.resolved.grain];
  return {
    workflowDynastySlug: row.workflow.workflowDynastySlug,
    workflowDynastyName: row.workflow.workflowDynastyName,
    contactedUsd: block?.unitCosts.costPerContactedUsd ?? null,
    replyUsd: block?.unitCosts.costPerPositiveReplyUsd ?? null,
    clickUsd: row.resolved.costPerClickUsd,
    costPerSignupUsd: block?.projected.costPerSignupUsd ?? null,
    costPerFormSubmissionUsd: null,
    costPerOutcomeUsd: row.resolved.costPerOutcomeUsd,
    costPerCloseUsd: row.resolved.costPerPaidClientUsd,
    costPerMeetingBookedUsd: row.resolved.costPerMeetingBookedUsd,
    roiMultiple: row.resolved.roiMultiple,
    projection: {
      contactedLeads: null,
      replies: null,
      visits: null,
      formSubmissions: null,
      meetings: null,
      closes: null,
      revenue: null,
      cacPct: row.resolved.cacPct,
      cacAbs: row.resolved.costPerPaidClientUsd,
    },
  };
}

/**
 * GET /features/:slug/workflow-projection — the recommended workflow + per-workflow
 * economics for a brand under one objective. features-service reshaped the endpoint
 * into a 3-grain ladder (rows[] + resolved); this reader fetches that ladder (via
 * `getWorkflowProjectionLadder`) and maps the brand-level rows (audienceId null) back
 * onto the legacy `workflows[]` shape so existing consumers (brand overview, workflows
 * page, onboarding, brand-status) keep reading server values verbatim. `budgetUsd` is
 * accepted for call-site compatibility; the ladder + `recommendedBudgetUsd` carry the
 * projection surface. New surfaces that want the per-audience grains (Strategy) should
 * call `getWorkflowProjectionLadder` directly.
 */
export async function getWorkflowProjection(
  params: {
    featureSlug: string;
    brandId: string;
    objective: SalesObjective;
    /** The leg this surface buys, when it states one. Wins over `objective` at the
     *  producer: a campaign is bought for exactly ONE leg. */
    leg?: string | null;
    budgetUsd?: number;
  },
  token?: string,
): Promise<WorkflowProjectionResponse> {
  const ladder = await getWorkflowProjectionLadder(
    {
      featureSlug: params.featureSlug,
      brandId: params.brandId,
      objective: params.objective,
      leg: params.leg,
    },
    token,
  );
  return {
    featureSlug: ladder.featureSlug,
    objective: params.objective,
    workflows: ladder.rows
      .filter((r) => r.audienceId == null)
      .map(ladderRowToWorkflowItem),
    recommendedWorkflowDynastySlug: ladder.recommendedWorkflowDynastySlug,
    recommendedBudgetUsd: ladder.recommendedBudgetUsd,
  };
}

// ── Strategy: 3-grain workflow-projection ladder ─────────────────────────────
// features-service folded the old /candidates grain INTO workflow-projection: one
// call now returns a row per (audienceId, workflow) carrying the cost estimate at
// each grain (crossOrg / brand / audience) PLUS the `resolved` block — the finest
// grain that has real evidence (brand-real when the brand has run enough, else the
// fleet benchmark). The Strategy page renders `resolved` VERBATIM; it never scales
// or recomputes a cost. Proxied via api-service /v1/features/:slug/workflow-projection.
export type WorkflowProjectionGrain = "crossOrg" | "brand" | "audience";

/** Observed run evidence at one grain — the denominator behind the floor-filled unit
 *  costs. `observedClicks === 0` ⇒ every unit cost is a FLOOR (spentUsd / max(…,1)),
 *  so a cost from that grain renders as a ">$X" lower bound. */
const WorkflowGrainEvidenceSchema = z.object({
  spentUsd: z.number(),
  observedContacted: z.number(),
  observedClicks: z.number(),
  observedPositiveReplies: z.number(),
});

/** Floor-filled unit costs at one grain — NEVER null (spentUsd / max(observed,1)). */
const WorkflowGrainUnitCostsSchema = z.object({
  costPerClickUsd: z.number(),
  costPerPositiveReplyUsd: z.number(),
  costPerContactedUsd: z.number(),
});

/** Projected economics at one grain — null where the objective doesn't apply or the
 *  brand has no saved conversion economics yet. */
const WorkflowGrainProjectedSchema = z.object({
  costPerSignupUsd: z.number().nullable(),
  costPerPaidClientUsd: z.number().nullable(),
  costPerMeetingBookedUsd: z.number().nullable(),
  roiMultiple: z.number().nullable(),
  cacPct: z.number().nullable(),
});

const WorkflowGrainBlockSchema = z.object({
  evidence: WorkflowGrainEvidenceSchema,
  unitCosts: WorkflowGrainUnitCostsSchema,
  projected: WorkflowGrainProjectedSchema,
});

/** The grain the backend RESOLVED to (brand-real when available, else fleet benchmark)
 *  + its cost numbers, ready to render. costPerClickUsd is floor-filled (never null);
 *  the projected costs are null where the objective / economics don't apply. */
const WorkflowResolvedSchema = z.object({
  grain: z.union([z.literal("crossOrg"), z.literal("brand"), z.literal("audience")]),
  costPerClickUsd: z.number(),
  costPerOutcomeUsd: z.number().nullable(),
  costPerPaidClientUsd: z.number().nullable(),
  costPerMeetingBookedUsd: z.number().nullable(),
  roiMultiple: z.number().nullable(),
  cacPct: z.number().nullable(),
});

// Every row reaching this schema is MEASURED — `measuredProjectionRows` drops the
// unmeasured ones on the way in, so `measured` itself is deliberately NOT declared here
// (it would parse as an always-true field nothing may branch on). That also means
// `resolved.grain` / `resolved.costPerClickUsd` stay non-nullable: only an unmeasured row
// nulls them, and one never gets this far.
const WorkflowProjectionRowSchema = z.object({
  /** null = the brand-level row for this workflow (the "Your best model" headline);
   *  non-null = a per-audience row (one per active audience). */
  audienceId: z.string().nullable(),
  workflow: z.object({
    workflowDynastySlug: z.string(),
    workflowDynastyName: z.string().nullable(),
  }),
  estimatesByGrain: z.object({
    crossOrg: WorkflowGrainBlockSchema.optional(),
    brand: WorkflowGrainBlockSchema.optional(),
    audience: WorkflowGrainBlockSchema.optional(),
  }),
  resolved: WorkflowResolvedSchema,
});

const WorkflowProjectionLadderResponseSchema = z.object({
  featureSlug: z.string(),
  objective: z.string().nullable().optional(),
  goal: z.string().nullable().optional(),
  /** MEASURED rows only. An UNMEASURED row (`measured: false`) is the backend's own
   *  serving affordance — an explore allowance so an active workflow with no history is
   *  reachable and can earn a first run — and it is the CHEAPEST row by construction,
   *  with no grain and no return. Ranking it would hand the "Your best model" headline
   *  to an unproven workflow. Dropped HERE, before the row schema, so every surface
   *  reads evidence-backed rows and no consumer type has to model a null grain. See
   *  lib/workflow-projection-measured.ts. */
  rows: z.preprocess(measuredProjectionRows, z.array(WorkflowProjectionRowSchema)),
  recommendedWorkflowDynastySlug: z.string().nullable(),
  recommendedBudgetUsd: z.number().nullable(),
});

export type WorkflowProjectionGrainBlock = z.infer<typeof WorkflowGrainBlockSchema>;
export type WorkflowProjectionResolved = z.infer<typeof WorkflowResolvedSchema>;
export type WorkflowProjectionRow = z.infer<typeof WorkflowProjectionRowSchema>;
export type WorkflowProjectionLadderResponse = z.infer<
  typeof WorkflowProjectionLadderResponseSchema
>;

/**
 * GET /features/:slug/workflow-projection — the 3-grain ladder: one row per
 * (audienceId, workflow) with its cost estimate at each grain plus the `resolved`
 * grain (brand-real when the brand has evidence, else the fleet benchmark). Powers
 * the Strategy "Your best model" card + "Estimates by audience" table. Every cost is
 * read VERBATIM from `resolved` — no client-side CPC / CPS / projection math.
 */
export async function getWorkflowProjectionLadder(
  params: {
    featureSlug: string;
    brandId: string;
    /**
     * The LEG to price on — what a surface that knows the one leg it buys sends. It
     * wins over `goal`/`objective` at the producer.
     */
    leg?: string | null;
    /**
     * DEPRECATED — the retired vocabulary, kept only for callers that state no leg. A
     * surface that KNOWS its leg sends `leg` and neither of these.
     */
    goal?: FeatureAudienceStatsGoal;
    /** DEPRECATED — see `goal`. */
    objective?: SalesObjective | string;
    audienceId?: string;
    /**
     * Price the leg for ONE offer of the brand, with no campaign yet (features-service
     * #1185). A brand selling several offers is refused without it or a campaign.
     */
    offerId?: string | null;
  },
  token?: string,
): Promise<WorkflowProjectionLadderResponse> {
  const query = new URLSearchParams();
  query.set("brandId", params.brandId);
  if (params.offerId) query.set("offerId", params.offerId);
  // leg WINS over goal/objective at the producer, so a caller that states one gets its
  // own leg priced whatever else it sends.
  if (params.leg) query.set("leg", params.leg);
  if (params.goal) query.set("goal", params.goal);
  if (params.objective) query.set("objective", params.objective);
  if (params.audienceId) query.set("audienceId", params.audienceId);
  // pricing=net — MUST match `fetchFeatureAudienceStats`. At 0 outcomes a
  // per-audience cost floors at max(own spend, best-workflow fleet cost), and
  // that fleet cost is the very number this ladder serves, so the Audiences
  // table and the Strategy page render the SAME benchmark. Omitting pricing
  // here defaulted the ladder to GROSS while audience-stats asked for NET, so
  // one benchmark showed at two prices (~9% apart once other orgs' frozen usage
  // discounts land in the fleet spend). Net is also what the org actually pays.
  query.set("pricing", "net");
  const raw = await apiCall<unknown>(
    `/features/${encodeURIComponent(params.featureSlug)}/workflow-projection?${query.toString()}`,
    { token },
  );
  const parsed = WorkflowProjectionLadderResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getWorkflowProjectionLadder: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getWorkflowProjectionLadder: invalid response shape");
  }
  return parsed.data;
}

// ── The RANK ladder: the same endpoint, read WIDE ────────────────────────────
/**
 * GET /features/:slug/workflow-projection — the SAME read as
 * `getWorkflowProjectionLadder`, kept as a SECOND reader because the two want
 * opposite things from the same body.
 *
 * Every OTHER dashboard surface must never render an UNMEASURED row: its
 * `resolved.costPerOutcomeUsd` is an explore allowance (the price of one outreach,
 * set so an unproven workflow is reachable), which makes it the cheapest row by
 * construction and would hand the "Your best model" headline to a workflow that has
 * never run. So that reader drops them before its schema, which is also what keeps
 * `resolved.grain` non-nullable for every consumer of it.
 *
 * The campaign Workflows page is the ONE surface that needs them — "this exists and
 * you have not tried it" is an answer a customer picking what to run next wants —
 * and it needs the fields that reader deliberately does not declare (`measured`,
 * `costBasis`, the per-grain `costBasis`/`resolvedOutcomeCount`, the `leg` echo).
 * Widening the existing schema to carry all of that would force every one of its
 * consumers to branch on a case none of them may render, so this is a separate
 * reader rather than a flag: the narrow path stays byte-identical.
 *
 * `leg` is what makes the answer the CAMPAIGN's: a campaign performs ONE leg. It WINS
 * over `goal` — so a caller states the narrowest thing it knows and nothing else.
 */
// Money fields are nullable for ONE reader: the staff ACTUAL-cost twin of this body
// (features-service #1193) states null where the grain's spend has no known vendor cost,
// never the billed figure. The billed read always carries a number.
const WorkflowRankEvidenceSchema = z.object({
  spentUsd: z.number().nullable(),
  observedContacted: z.number(),
  observedClicks: z.number(),
  observedPositiveReplies: z.number(),
});


const WorkflowRankGrainSchema = z.object({
  /** Which accounting question THIS grain answers — `charged` is the customer's own
   *  billed money, `incurred` the fleet benchmark where comped spend counts in full.
   *  Absent on an unmeasured row, where `estimatesByGrain` is empty. */
  costBasis: z.union([z.literal("charged"), z.literal("incurred")]).nullish(),
  evidence: WorkflowRankEvidenceSchema,
  /** Floor-filled unit costs — NEVER null (spend / max(observed, 1)), so a grain that
   *  observed nothing still states what it cost rather than a zero. */
  unitCosts: z.object({
    costPerClickUsd: z.number().nullable(),
    costPerPositiveReplyUsd: z.number().nullable(),
    costPerContactedUsd: z.number().nullable(),
  }),
  /** The grain's own PROJECTED outcome count — routinely fractional on a multi-step
   *  path, which is why no surface renders it as a count of people. */
  resolvedOutcomeCount: z.number().nullable(),
  /** THIS grain's figures for the LEG the request named, denominated in the leg's own
   *  step. Served only on a leg-keyed answer, which is the only kind this reader makes;
   *  `outcomeObserved` says whether the count was observed or walked through the
   *  brand's leg rates, and a leg the brand states no rate for is priced `null`. */
  legOutcome: z
    .object({
      costPerOutcomeUsd: z.number().nullable(),
      outcomeCount: z.number().nullable(),
      outcomeObserved: z.boolean(),
      spentUsd: z.number().nullable(),
    })
    .nullish(),
  projected: z.object({
    costPerSignupUsd: z.number().nullable(),
    costPerPaidClientUsd: z.number().nullable(),
    costPerMeetingBookedUsd: z.number().nullable(),
    roiMultiple: z.number().nullable(),
    cacPct: z.number().nullable(),
  }),
  /** THE MATURITY PAIR of this grain (features-service#1196), served on a LEG-keyed read.
   *  `mature` is the runs old enough for their outcomes to have arrived and every outcome
   *  of the leads they served; `isMature` is that grain's own verdict (its mature outcomes
   *  against the leg's count). The dashboard states the mature half and tags `Learning`
   *  exactly where `isMature` is false. Optional in the schema only because a goal-keyed
   *  body carries none, and a cached leg-keyed body may too (`assertLegMaturity` reports it). */
  basis: z.string().optional(),
  flash: LegOutcomeFiguresSchema.nullable().optional(),
  mature: LegOutcomeFiguresSchema.nullable().optional(),
  isMature: z.boolean().nullable().optional(),
});

/** The row's RESOLVED figure, on one half of its maturity pair. */
const RankResolvedFiguresSchema = z.object({
  grain: z.string().nullable(),
  costPerOutcomeUsd: z.number().nullable(),
  conversionRatePct: z.number().nullable(),
});

/**
 * `grain` and `costBasis` are NULLABLE here and non-nullable on the narrow reader,
 * and that is the whole difference: only an UNMEASURED row nulls them, and one never
 * reaches the narrow schema.
 */
const WorkflowRankResolvedSchema = z.object({
  grain: z
    .union([
      z.literal("crossOrg"),
      z.literal("brand"),
      // The producer gained this grain in v0.164.0 and states it as a provenance label
      // like any other. Declaring the old three would throw on every row of a
      // campaign-keyed read — the too-narrow-schema bug, loud rather than silent.
      z.literal("campaign"),
      z.literal("audience"),
    ])
    .nullable(),
  // Absent on the staff actual-cost body (the vendor basis is one basis).
  costBasis: z.union([z.literal("charged"), z.literal("incurred")]).nullish(),
  costPerClickUsd: z.number().nullable(),
  costPerOutcomeUsd: z.number().nullable(),
  costPerPaidClientUsd: z.number().nullable(),
  costPerMeetingBookedUsd: z.number().nullable(),
  roiMultiple: z.number().nullable(),
  cacPct: z.number().nullable(),
  conversionRatePct: z.number().nullable(),
});

/**
 * ONE PRICE features-service HOLDS for a workflow at one grain on one basis, its cascade
 * already walked (features-service #1241): `own` evidence, or `inherited` from the nearest
 * coarser grain (`fromGrain`). Null price ⟺ nothing held (`unpricedReason`). A page reads
 * this per (grain, basis) and never re-walks the cascade.
 */
const HeldPriceSchema = z
  .object({
    costPerOutcomeUsd: z.number().nullable(),
    source: z.string().nullable(),
    fromGrain: z.string().nullable(),
    unpricedReason: z.string().nullish(),
    vendorCostKnown: z.boolean().optional(),
  })
  .passthrough();

const WorkflowRankRowSchema = z.object({
  /** Every grain of the row's cascade priced on BOTH bases. `.optional()`: absent on a
   *  goal-keyed body and on a body cached before #1241 shipped. */
  priceByGrain: z
    .record(z.string(), z.object({ flash: HeldPriceSchema, mature: HeldPriceSchema }).passthrough())
    .optional(),
  audienceId: z.string().nullable(),
  workflow: z.object({
    workflowDynastySlug: z.string(),
    workflowDynastyName: z.string().nullable(),
  }),
  estimatesByGrain: z.object({
    crossOrg: WorkflowRankGrainSchema.optional(),
    brand: WorkflowRankGrainSchema.optional(),
    /** Present ⟺ the request named a campaign. It sits between brand and audience in
     *  the producer's cascade and answers for the campaign's whole IDENTITY. */
    campaign: WorkflowRankGrainSchema.optional(),
    /** Present ⟺ the named campaign states an offer: every campaign of this channel
     *  selling it, priced on the BRAND grain's basis (same spend, same outcomes, same
     *  floor), so on a one-offer brand it states the brand's figure. */
    offer: WorkflowRankGrainSchema.optional(),
    audience: WorkflowRankGrainSchema.optional(),
  }),
  resolved: WorkflowRankResolvedSchema,
  /** THE ROW's maturity (features-service#1196), on a LEG-keyed read. `resolved` and every
   *  legacy block field are on `basis`; `resolved` here carries both halves of the row's
   *  resolved figure and ITS verdict, which is what a cell states and tags. `isMature` at
   *  the top is the WORKFLOW's verdict on the fleet of its leg. Required on every leg-keyed
   *  read by `assertLegMaturity`; optional here because a goal-keyed body carries none. */
  maturity: z
    .object({
      basis: z.string(),
      isMature: z.boolean().nullable(),
      matureOutcomes: z.number().nullable(),
      resolved: maturityPairSchema(RankResolvedFiguresSchema),
    })
    .optional(),
  /** REQUIRED — the flag is the whole reason this reader exists. */
  measured: z.boolean(),
  /** THE PRODUCER'S OWN POSITION, and the reason nothing here re-derives one.
   *
   *  It is a property of the WORKFLOW, so every row of one dynasty carries the same
   *  number, and `recommendedWorkflowDynastySlug` is rank 1 by construction. Scored over
   *  every row the dynasty has — the brand row, the campaign row and each audience — so
   *  a page ranking only the rows it displays produces a DIFFERENT order: that is
   *  exactly how the recommended workflow came to sit 18th of 24.
   *
   *  `.nullish()` only because a goal-keyed body carries none; this reader
   *  always names a leg, so in practice it is always there. */
  rank: z.number().nullish(),
  /** THIS ROW'S POSITION WITHIN ITS OWN COLUMN (features-service v0.164.1).
   *
   *  `rank` and `scopeRank` DISAGREE on purpose and both are served: `rank` says what
   *  we would put the campaign on next, `scopeRank` says what the column the reader is
   *  looking at says. It orders on the row's OWN `resolved.costPerOutcomeUsd`, under
   *  the same objective and the same tie-break, and it is a TOTAL order per scope
   *  (1..N, no gaps, no ties, never-run workflows last) — verified across all 13 scopes
   *  in prod, which is what lets a per-audience list ascend on the figure it displays.
   *
   *  `.nullish()` for the same reason as `rank`: a goal-keyed body carries
   *  none, and a row without one states no position rather than claiming last place. */
  scopeRank: z.number().nullish(),
  /** WHETHER THE MODEL WRITING THIS WORKFLOW'S EMAILS IS RIGHT FOR THIS LEG
   *  (features-service v0.166.0).
   *
   *  Measured fleet-wide: the capability TIER of the model decides the outcome, and the
   *  direction depends on what the leg sells — the cheap tier badly underperforms on a
   *  leg selling a conversation, the strong and frontier tiers are wasted on one selling
   *  a website visit. The producer STATES the verdict and does not act on it, so
   *  campaign-service can filter its selection while this page can tell "this workflow is
   *  excluded" apart from "this workflow does not exist" — including for one that is
   *  excluded and has ALREADY RUN, whose money is this campaign's own history.
   *
   *  `.optional()` for the same reason as `rank`: a goal-keyed body carries
   *  none, and this reader always names a leg. An ABSENT block states no verdict and
   *  excludes nothing — never read as an exclusion. */
  modelEligibility: z
    .object({
      /** The chat-service alias the DAG names. Null ⟺ it names none — never a guess. */
      modelAlias: z.string().nullish(),
      /** Retiring: the verdict is moving from a model-TIER rule to a stored assignment of
       *  workflows to legs (features-service). Read as a plain string and tolerated absent so
       *  the producer can drop or rename it without this parse throwing the whole ladder. */
      modelTier: z.string().nullish(),
      /** FALSE ⟺ this workflow must not be picked on this leg. The producer owns why. */
      eligible: z.boolean(),
      ineligibleReason: z.string().nullish(),
      unknownTierReason: z.string().nullish(),
    })
    .passthrough()
    .optional(),
  /** WHETHER THIS WORKFLOW IS ON THIS LEG — a stored assignment the owner states per
   *  (channel, leg, workflow), features-service's answer (it replaced the model-tier rule).
   *  `state` is `active` (a new run may pick it), `deprecated` (retired on THIS leg only,
   *  history still served) or `unassigned` (never put on this leg). Read as a plain string
   *  so a new state parses; `.optional()` because a goal-keyed body carries none, and an
   *  ABSENT block states no verdict and hides nothing. */
  legAssignment: z
    .object({
      state: z.string(),
      selectable: z.boolean(),
      reason: z.string().nullish(),
      decidedBy: z.string().nullish(),
      decidedAt: z.string().nullish(),
    })
    .passthrough()
    .optional(),
});

/**
 * ONE PICK THE SELECTOR MADE — what actually ran, never what the campaign is configured
 * with. Every field is required by the producer; `workflowDynastyName` and `audienceId`
 * are nullable there and nullable here, and a null audience is a trigger older than the
 * audience write-tag rather than a pick without one.
 */
const ObservedPickSchema = z.object({
  campaignId: z.string(),
  workflowSlug: z.string(),
  workflowDynastySlug: z.string(),
  workflowDynastyName: z.string().nullable(),
  audienceId: z.string().nullable(),
  startedAt: z.string(),
});

const WorkflowRankLadderSchema = z.object({
  featureSlug: z.string(),
  objective: z.string().nullish(),
  goal: z.string().nullish(),
  /** Present ⟺ the request named a LEG. `toStep` is the customer-facing word for the
   *  outcome every figure on the body is about. */
  leg: z
    .object({
      legKey: z.string(),
      fromStep: z
        .object({ key: z.string(), label: z.string() })
        .nullable()
        .optional(),
      toStep: z.object({ key: z.string(), label: z.string() }),
      basis: z.string().nullish(),
    })
    .nullish(),
  rows: z.array(WorkflowRankRowSchema),
  /** THE LEG's maturity rule as the producer applied it to this body (features-service
   *  #1196): how old a run must be for its outcomes to count, how many outcomes make a
   *  scope mature, and the cutoff it used. Required on a leg-keyed read. */
  maturity: z
    .object({
      legKey: z.string(),
      durationDays: z.number(),
      outcomesRequired: z.number(),
      outcomeSignal: z.string().nullable(),
      source: z.string(),
      cutoffIso: z.string().nullable(),
      measured: z.boolean(),
      unmeasuredReason: z.string().nullable(),
    })
    .optional(),
  /** The producer's own pick: the argmin of `resolved.costPerOutcomeUsd` over the
   *  MEASURED rows. Nothing here re-derives it. */
  recommendedWorkflowDynastySlug: z.string().nullable(),
  /** Staff actual-cost body only: billed spend in scope with no known vendor cost. */
  unpricedBilledCostUsd: z.number().nullish(),
  recommendedBudgetUsd: z.number().nullable(),
  /** FALSE ⟺ this channel has measured nothing for this brand at all; the reason then
   *  names what is missing, and an empty ranking must never read as "no workflows". */
  measured: z.boolean().nullish(),
  unmeasuredReason: z.string().nullish(),
  /** WHAT ACTUALLY RAN (features-service v0.165.2), read live from the runs ledger.
   *
   *  Present ⟺ the request named a `campaignId` — which this reader always does when it
   *  names a leg — so in practice it is on every body this page gets. `.nullish()`
   *  carries the producer's own two absences: the block is ABSENT on a leg-less answer, and NULL when the ledger could not be read. Neither is a licence
   *  to fall back to the campaign's configured `workflowSlug`; that value is the bug
   *  this block exists to replace. */
  observedPicks: z
    .object({
      /** The most recent pick across the whole identity. Null ⟺ never triggered. */
      last: ObservedPickSchema.nullable(),
      /** The window, newest first. Same shape as `last`, merged across the identity. */
      recent: z.array(ObservedPickSchema),
      /** TRUE ⟺ the identity has more triggers than the window states. */
      truncated: z.boolean(),
    })
    .nullish(),
});

export type WorkflowRankLadder = z.infer<typeof WorkflowRankLadderSchema>;
/** The gateway's staff path suffix for the actual-cost ladder (api-service, see its PR). */
const ACTUAL_LADDER_SUFFIX = "/actual-cost";
export type WorkflowRankLadderRow = z.infer<typeof WorkflowRankRowSchema>;

export async function getWorkflowRankLadder(
  params: {
    featureSlug: string;
    brandId: string;
    /** STAFF ONLY: the same body with every money figure at vendor cost (features-service
     *  #1193). Rank and order are the billed ones; the route refuses `pricing`. */
    actual?: boolean;
    /** The campaign's own leg. */
    leg?: string | null;
    /** Adds the CAMPAIGN grain to every row's cascade, so one read answers for every
     *  grain a reader compares. The producer 400s it without a leg, so it rides the
     *  leg branch and nothing else. */
    campaignId?: string | null;
  },
  token?: string,
): Promise<WorkflowRankLadder> {
  const query = new URLSearchParams();
  query.set("brandId", params.brandId);
  if (params.leg) {
    query.set("leg", params.leg);
    // `campaign_requires_leg` — the producer refuses the pair rather than silently
    // dropping one, so the campaign grain is asked for ONLY alongside a leg.
    if (params.campaignId) query.set("campaignId", params.campaignId);
  }
  // net — the basis every money surface in this app reads, and what the org pays.
  if (!params.actual) query.set("pricing", "net");
  const raw = await apiCall<unknown>(
    `/features/${encodeURIComponent(params.featureSlug)}/workflow-projection${params.actual ? ACTUAL_LADDER_SUFFIX : ""}?${query.toString()}`,
    { token },
  );
  const parsed = WorkflowRankLadderSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getWorkflowRankLadder: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getWorkflowRankLadder: invalid response shape");
  }
  if (params.leg) assertLegMaturity(parsed.data, "getWorkflowRankLadder");
  return parsed.data;
}

/**
 * A LEG-keyed ladder is expected to carry its maturity pairs, and a body without them is
 * REPORTED loudly rather than refused. The producer declares every pair optional: a body
 * cached before the pairs shipped (a pre-deploy Gold cell, measured on the very deploy
 * that shipped them) or a read whose mature cut degraded carries none. Refusing it turned
 * the whole page into an error; reading it states `—` with no tag in every cell
 * (`cellFigure` on no pair), never the legacy figure, and a body whose top-level maturity
 * says it could not measure is stated on the page in words.
 */
export function assertLegMaturity(ladder: WorkflowRankLadder, label: string): void {
  const missing: string[] = [];
  if (!ladder.maturity) missing.push("maturity");
  for (const row of ladder.rows) {
    const where = `${row.workflow.workflowDynastySlug}|${row.audienceId ?? "campaign"}`;
    if (!row.maturity) missing.push(`rows[${where}].maturity`);
    for (const [grain, block] of Object.entries(row.estimatesByGrain)) {
      if (block && block.isMature === undefined) missing.push(`rows[${where}].estimatesByGrain.${grain}.isMature`);
    }
  }
  if (missing.length > 0) {
    console.error(`[dashboard] ${label}: leg-keyed ladder is missing its maturity pairs; those cells read "—"`, {
      missing: missing.slice(0, 20),
      count: missing.length,
    });
  }
}

// Create / Upgrade / Fork workflow via AI
export interface CreateWorkflowRequest {
  description: string;
  featureSlug: string;
  hints?: {
    services?: string[];
    nodeTypes?: string[];
    expectedInputs?: string[];
  };
}

export interface CreateWorkflowResult {
  workflow: {
    id: string;
    name: string;
    featureSlug: string;
    signature: string;
    workflowDynastySignatureName: string;
    action: "created" | "updated";
    humanId: string | null;
  };
  dag: { nodes: unknown[]; edges: unknown[] };
  generatedDescription: string;
}

// Create campaign
//
// A sales campaign is (offer x leg x channel), so it states the offer and the leg it is
// bought for; campaign-service 400s one that states neither a leg nor anything else.
export async function createCampaignWithoutBrandEnrichment(
  params: {
    name: string;
    workflowSlug: string;
    // Exactly one of brandUrls (website brand) or brandIds (no-website brand,
    // already created by name) — the gateway resolves/forwards accordingly.
    brandUrls?: string[];
    brandIds?: string[];
    // The proposition and the single LEG this campaign is bought for, as
    // features-service spells it.
    offerId: string | null;
    legKey: string;
    // There is deliberately no maxBudget* field here. A sales campaign's money is
    // billing's, stated per (offer, leg, acquisition channel) on the brand's daily
    // ceilings, and campaign-service 400s a sales-family campaign
    // that states a per-campaign ceiling. Declaring the fields invited a caller
    // to send one; the only caller did, and every launch failed.
  } & Record<string, unknown>,
  token?: string
): Promise<{ campaign: RawCampaign }> {
  return apiCall<{ campaign: RawCampaign }>("/campaigns", {
    token,
    method: "POST",
    body: params as unknown as Record<string, unknown>,
  });
}

// Billing — wire shape per billing-service post-rename hotfix.
// `*_cents` string fields are full-precision decimal strings (e.g. "100.4200000000").
// Use parseFloat for math; never Number().
// `balance_cents` = spendable funds (credited minus usage incl. provisioned holds);
// use it for depletion and budget checks.
// `actual_balance_cents` = credited minus actualized usage only; use it for the
// user-facing Credit Balance display when billing-service exposes it.
// `credited_cents` = lifetime credited (paid topups + local promos); display-only for "total credited".
// `topup_amount_cents` and `topup_threshold_cents` are integers in cents (or null).
// Live spec: https://billing.distribute.you/openapi.json
export interface BillingAccount {
  id: string;
  org_id: string;
  /**
   * How this org pays (billing-service `payment_mode`, the customer's explicit choice).
   * Optional because an older billing deploy states none; read through `paymentModeOf`.
   */
  payment_mode?: "prepaid" | "postpaid" | "subscription";
  credited_cents: string;
  usage_cents: string;
  balance_cents: string;
  actual_balance_cents?: string;
  topup_amount_cents: number | null;
  topup_threshold_cents: number | null;
  has_payment_method: boolean;
  has_auto_topup: boolean;
  // Additive (billing-service v0.40.0+): off_session auto-reload is impossible for cards
  // issued in some countries (e.g. India / RBI e-mandates). Absent on older billing deploys
  // => treat as supported (default to today's behavior); only an explicit `false` blocks it.
  auto_reload_supported?: boolean;
  auto_reload_unsupported_reason?: string | null;
  card_country?: string | null;
  // Saved-card display fields, sourced from the Stripe PaymentMethod. Additive
  // (billing-service): absent on older deploys => the Payment method section falls
  // back to the connected/country-only display. Never derived client-side.
  card_brand?: string | null;
  card_last4?: string | null;
  card_exp_month?: number | null;
  card_exp_year?: number | null;
  // Per-org usage discount rate (integer 0-100), frozen upstream at cost-declaration so
  // the balance/usage/next-charge numbers above are ALREADY net of it. null = no discount.
  // Absent on older billing deploys.
  usage_discount_pct?: number | null;
  /**
   * Free credit this org can still spend, in decimal cents: billing's own
   * max(0, min(gifted, balance)). Decides whether a flow may let the org start without
   * paying. Optional because an older billing deploy states none, which reads as none.
   * Not recomputed here.
   */
  free_credit_spendable_cents?: string;
  created_at: string;
  updated_at: string;
}

export interface BillingBalance {
  balance_cents: string;
  depleted: boolean;
}

export interface CheckoutSession {
  url: string;
  session_id: string;
  /** Present only when `apply_welcome_gift` was sent: what the gift took off. */
  welcome_discount_cents?: number;
  /** Present only when `apply_welcome_gift` was sent: what the buyer is asked to pay. */
  amount_due_cents?: number;
}

/**
 * An in-page prepaid top-up. Stripe orgs get Stripe's embedded checkout (no `mode`,
 * byte-identical to before); an org paying through Revolut gets Revolut's widget, with
 * the same field names as card_setup's `embedded_widget` (billing-service #526).
 */
export type EmbeddedCheckoutSession =
  | { mode?: undefined; client_secret: string; session_id: string }
  | {
      mode: "embedded_widget";
      script_url: string;
      environment: "prod" | "sandbox";
      token: string;
      save_payment_method_for: "merchant" | "customer";
      amount: number;
      currency: string;
      session_id: string;
    };

/**
 * Record how the org pays (billing-service `PUT /v1/accounts/payment_mode`). A new org
 * is POSTPAID by default, and a postpaid org with no card is stopped at once
 * (`no_chargeable_card`); a PREPAID org spends only what it holds and runs without a card.
 */
export async function setPaymentMode(
  payment_mode: "prepaid" | "postpaid",
  token?: string,
): Promise<{
  org_id: string;
  payment_mode: "prepaid" | "postpaid";
  /** Cents billing collected to settle what was owed before a switch to prepaid. */
  settled_cents?: string;
  auto_topup_enabled?: boolean;
}> {
  return apiCall("/billing/accounts/payment_mode", { token, method: "PUT", body: { payment_mode } });
}

// ── Subscription (monthly plan, 3-day trial; billing-service v0.81.28, billing#568) ──
// The landing's `subscription` arm pays through these. The card is saved through the
// ORDINARY card setup (`card_setup`, Revolut widget by default), then `start` opens the
// plan. The read SETTLES first and an hourly sweep also starts a checkout whose card is
// on file, so a missed `start` is caught.

const SubscriptionSchema = z.object({
  id: z.string(),
  status: z.string(),
  trial_end: z.string().nullable(),
  cancel_at_period_end: z.boolean(),
  current_period_start: z.string().nullish(),
  current_period_end: z.string().nullable(),
  ended_at: z.string().nullish(),
  next_charge_at: z.string().nullable(),
  monthly_amount_cents: z.coerce.number(),
  currency: z.string(),
  has_payment_method: z.boolean(),
  can_change_amount: z.boolean().nullish(),
  can_raise: z.boolean().nullish(),
  next_raise_monthly_amount_cents: z.coerce.number().nullish(),
});
export type Subscription = z.infer<typeof SubscriptionSchema>;

const SubscriptionReadSchema = z.object({
  org_id: z.string(),
  payment_mode: z.string().nullish(),
  subscription: SubscriptionSchema.nullable(),
  credits_remaining_cents: z.string().nullish(),
  trial_grant_cents: z.coerce.number().nullish(),
  expired_cents: z.string().nullish(),
});
export type SubscriptionRead = z.infer<typeof SubscriptionReadSchema>;

function parseSubscriptionRead(raw: unknown, where: string): SubscriptionRead {
  const parsed = SubscriptionReadSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[dashboard] ${where}: response shape mismatch`, { issues: parsed.error.issues, raw });
    throw new Error(`[dashboard] ${where}: invalid response shape`);
  }
  return parsed.data;
}

const SubscriptionCheckoutSchema = z.object({
  monthly_amount_cents: z.coerce.number(),
  currency: z.string(),
  trial_days: z.coerce.number().nullable(),
  card_required: z.boolean(),
  card_setup: z
    .object({ object: z.literal("card_setup"), mode: z.enum(["hosted_redirect", "embedded_checkout", "embedded_widget"]) })
    .passthrough()
    .nullable(),
});
export interface SubscriptionCheckout {
  monthly_amount_cents: number;
  trial_days: number | null;
  /** false (with no card_setup) = a chargeable card is already on file: start right away. */
  card_required: boolean;
  /** Exactly what `createEmbeddedCardSetup` answers: switch on `mode`. */
  card_setup: CardSetup | null;
}

/**
 * Begin the plan: nothing is charged. Saves the card through the ordinary card setup
 * when one is needed; call `startSubscription` once it is saved. Refusals are 409
 * `{ code }`: `subscription_exists` | `existing_paying_org`.
 */
export async function createSubscriptionCheckout(params: {
  monthly_amount_cents: number;
  ui_mode: "embedded" | "hosted";
  return_url?: string;
}): Promise<SubscriptionCheckout> {
  const raw = await apiCall<unknown>("/billing/accounts/subscription/checkout_session", {
    method: "POST",
    body: params,
  });
  const parsed = SubscriptionCheckoutSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] createSubscriptionCheckout: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] createSubscriptionCheckout: invalid response shape");
  }
  return { ...parsed.data, card_setup: parsed.data.card_setup as CardSetup | null };
}

/** Open the plan once the card is saved. 409 `card_required` = not confirmed yet, retry. */
export async function startSubscription(): Promise<SubscriptionRead> {
  const raw = await apiCall<unknown>("/billing/accounts/subscription/start", { method: "POST", body: {} });
  return parseSubscriptionRead(raw, "startSubscription");
}

export async function getSubscription(token?: string): Promise<SubscriptionRead> {
  return parseSubscriptionRead(await apiCall<unknown>("/billing/accounts/subscription", { token }), "getSubscription");
}

/** Change the monthly amount, up or down (ladder 9900 + k x 10000); applies from the next charge. */
export async function changeSubscriptionAmount(monthly_amount_cents: number): Promise<SubscriptionRead> {
  const raw = await apiCall<unknown>("/billing/accounts/subscription", {
    method: "PATCH",
    body: { monthly_amount_cents },
  });
  return parseSubscriptionRead(raw, "changeSubscriptionAmount");
}

/** Cancel at the end of the period: no further charge. */
export async function cancelSubscription(): Promise<SubscriptionRead> {
  const raw = await apiCall<unknown>("/billing/accounts/subscription/cancel", { method: "POST" });
  return parseSubscriptionRead(raw, "cancelSubscription");
}

/** Undo a pending cancel. */
export async function resumeSubscription(): Promise<SubscriptionRead> {
  const raw = await apiCall<unknown>("/billing/accounts/subscription/resume", { method: "POST" });
  return parseSubscriptionRead(raw, "resumeSubscription");
}

export async function getBillingAccount(token?: string): Promise<BillingAccount> {
  return apiCall<BillingAccount>("/billing/accounts", { token });
}

export async function getBillingBalance(token?: string): Promise<BillingBalance> {
  return apiCall<BillingBalance>("/billing/accounts/balance", { token });
}

export async function configureAutoTopup(
  topupAmountCents: number,
  topupThresholdCents?: number,
  token?: string
): Promise<BillingAccount> {
  const body: Record<string, unknown> = { topup_amount_cents: topupAmountCents };
  if (topupThresholdCents !== undefined) body.topup_threshold_cents = topupThresholdCents;
  return apiCall<BillingAccount>("/billing/accounts/auto_topup", { token, method: "PATCH", body });
}

export async function disableAutoTopup(token?: string): Promise<BillingAccount> {
  return apiCall<BillingAccount>("/billing/accounts/auto_topup", { token, method: "DELETE" });
}

/**
 * What billing-service answers when the card is gone.
 *
 * Conformed to the DEPLOYED contract rather than a shape guessed up front:
 * billing-service designed it (v0.80.3) and api-service proxies it field-for-field
 * (#942), so this reads what is actually served. `settled_cents` is what the
 * collection took on the way out, and `settle_skip_reason` is present exactly
 * when it took nothing — the two together are the only honest account of a
 * charge that never gates the removal.
 */
export interface SavedPaymentMethodRemoved {
  object: "saved_payment_method_removed";
  org_id: string;
  removed: number;
  already_removed: number;
  auto_topup_disarmed: boolean;
  settled_cents: number;
  settle_skip_reason?: string;
}

/**
 * Remove the card on file.
 *
 * billing-service orchestrates the two halves in the one order only it can put
 * them in: the outstanding balance is collected first, on the card that is about
 * to go, and then the card goes whatever that collection did. It refuses this for
 * nobody — no balance, no debt state, no failed charge blocks it — because a gate
 * here would trap the one customer it exists to protect us from, which is the
 * dead end #4195 removed from the card-change button.
 *
 * Nothing is forgiven: what is owed stays owed and stays owned by the existing
 * sweeps, and the org lands in the state billing already models for a lost card
 * (credit-line floor at 0, the customer told, staff notified, listed among the
 * uncollectable debts).
 *
 * A 502 means we could not tell whether the card is gone, which the caller must
 * surface rather than read as success.
 */
export async function removePaymentMethod(
  token?: string
): Promise<SavedPaymentMethodRemoved> {
  return apiCall<SavedPaymentMethodRemoved>("/billing/accounts/saved_payment_method", {
    token,
    method: "DELETE",
  });
}

// ── Credit grants ("gifts received") ──
// The org's own credit-grants ledger: welcome gift, staff bonuses, referral
// credits, promo redemptions. Source: billing-service
// GET /v1/credits/grants (scoped to x-org-id) via api-service gateway
// GET /v1/billing/credits/grants. `reason` is the grant kind (welcome,
// admin_grant, invite_*) or a promo code; `amountCents` is a
// string (Postgres numeric). Per-field schema verified against api-registry;
// safeParse turns wire-rot into a caught fetch-error per CLAUDE.md.
export interface CreditGrant {
  id: string;
  orgId: string;
  amountCents: string;
  reason: string;
  note: string | null;
  grantedBy: string | null;
  createdAt: string;
}

const CreditGrantSchema = z
  .object({
    id: z.string(),
    orgId: z.string(),
    amountCents: z.string(),
    reason: z.string(),
    note: z.string().nullable(),
    grantedBy: z.string().nullable(),
    createdAt: z.string(),
  })
  .passthrough();

const ListCreditGrantsResponseSchema = z.object({ grants: z.array(CreditGrantSchema) });

/** GET /billing/credits/grants — the active org's own credit-grants ledger. */
export async function getCreditGrants(token?: string): Promise<{ grants: CreditGrant[] }> {
  const raw = await apiCall<unknown>("/billing/credits/grants", { token });
  const parsed = ListCreditGrantsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getCreditGrants: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getCreditGrants: invalid response shape");
  }
  return parsed.data as unknown as { grants: CreditGrant[] };
}

// ── Org usage by category ──
//
// What the org has been billed, grouped into categories a customer recognises
// (setting up, finding contacts, writing, sending, reading replies...).
// features-service classifies every cost row and sums them; the Billing page only
// renders. `totalBilledUsd` is the same net actual spend billing reports as
// "Billed", so the Usage section's Total row matches the figure at the top.
const OrgUsageCategorySchema = z.object({
  key: z.string(),
  label: z.string(),
  billedUsd: z.number(),
  setAsideUsd: z.number(),
});
const OrgUsageResponseSchema = z.object({
  basis: z.string(),
  totalBilledUsd: z.number(),
  totalSetAsideUsd: z.number(),
  categories: z.array(OrgUsageCategorySchema),
});
export type OrgUsage = z.infer<typeof OrgUsageResponseSchema>;

export async function getOrgUsage(token?: string): Promise<OrgUsage> {
  const raw = await apiCall<unknown>("/features/orgs/usage", { token });
  const parsed = OrgUsageResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getOrgUsage: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getOrgUsage: invalid response shape");
  }
  return parsed.data;
}

// --- Referral invites ---------------------------------------------------------
//
// The invite code is the org's slug, owned by client-service and reached through
// the gateway's org-scoped passthrough. BOTH routes take the org's INTERNAL UUID
// in the path (verified against the deployed registry: "Org UUID (must match
// authenticated org)"), NOT the Clerk org id the dashboard URL carries — so the
// caller sources it from `BillingAccount.org_id`, which is already fetched on
// every dashboard page and therefore dedupes.
//
// The gateway is a passthrough and publishes no response schema for either
// route, so these readers conform to what client-service actually serves and
// declare everything they do not themselves need as optional. That is
// load-bearing right now: a sibling workspace is lifting the three-invite cap,
// which retires the quota fields. Only `code` is required, because only `code`
// builds the link.

export interface InviteStatus {
  /** The org's own invite code. */
  code: string;
}

const InviteStatusResponseSchema = z
  .object({
    code: z.string(),
    // Quota fields from the capped era. Optional on purpose: the cap is being
    // lifted, and a reader that required them would break the moment it lands.
    used: z.number().optional(),
    total: z.number().optional(),
    expired: z.boolean().optional(),
  })
  .passthrough();

/** GET /orgs/:orgId/invites/status — this org's referral code. `orgId` is the internal UUID. */
export async function getInviteStatus(orgId: string, token?: string): Promise<InviteStatus> {
  const raw = await apiCall<unknown>(`/orgs/${encodeURIComponent(orgId)}/invites/status`, {
    token,
  });
  const parsed = InviteStatusResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getInviteStatus: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getInviteStatus: invalid response shape");
  }
  return { code: parsed.data.code };
}

/**
 * POST /orgs/:orgId/invites/claim — record that this org signed up through `code`.
 *
 * The response is not read. What matters is whether it succeeded, because that
 * is what decides if the stored code may be dropped (see `isTerminalClaimRejection`
 * in lib/invite-link). Errors propagate as `ApiError` carrying the status.
 */
export async function claimInvite(orgId: string, code: string, token?: string): Promise<void> {
  await apiCall<unknown>(`/orgs/${encodeURIComponent(orgId)}/invites/claim`, {
    method: "POST",
    body: { code },
    token,
  });
}

export interface InviteValidation {
  valid: boolean;
  /** The inviter's org name, when client-service has one. Usually absent. */
  inviterOrgName: string | null;
}

const ValidateInviteResponseSchema = z
  .object({ valid: z.boolean(), inviterOrgName: z.string().optional() })
  .passthrough();

/**
 * POST /invites/validate — is this code owned by a real org?
 *
 * Used before onboarding promises a referred signup the larger total, so the
 * promise is only ever made on a code that resolves. Since the invite cap was
 * lifted, `valid: false` means one thing only: no org owns this code.
 *
 * The gateway route is public, so this works before the org exists.
 */
export async function validateInvite(code: string, token?: string): Promise<InviteValidation> {
  const raw = await apiCall<unknown>("/invites/validate", {
    method: "POST",
    body: { code },
    token,
  });
  const parsed = ValidateInviteResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] validateInvite: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] validateInvite: invalid response shape");
  }
  return { valid: parsed.data.valid, inviterOrgName: parsed.data.inviterOrgName ?? null };
}

// --- Free-credit promises -----------------------------------------------------
//
// Every free credit this org is still WAITING on: the welcome remainder, plus a
// $500 promise for each converting referral. A promise is a promise, not money —
// billing keeps it out of `credited` / `balance` / spendable until it is granted,
// so this never double-counts against the balance shown beside it.
//
// Shape conforms to the deployed billing-service route (verified in the prod
// registry, v0.59.0). Cents are STRINGS on this wire, as everywhere in billing.

export interface FreeCreditPromise {
  id: string;
  /** Which offer opened it, e.g. the welcome remainder or a referral reward. */
  kind: string;
  amountCents: string;
  /** Cumulative payments that unlock it. */
  paidTriggerCents: string;
  paidSoFarCents: string;
  remainingToUnlockCents: string;
  progressPct: number;
  /** The org whose conversion opened this promise, when it came from a referral. */
  referredOrgId: string | null;
  /** The org that referred us, on the invitee's own referral promise. */
  referrerOrgId: string | null;
  /**
   * Display identity for the org named above, so a row can show WHO earned it
   * rather than three identical $500 lines. Optional because billing resolves it
   * in a follow-up: absent until that ships, and absent for good whenever the
   * other org has no brand to resolve. Never fabricated, so a missing name simply
   * renders no name.
   */
  referredOrgName?: string | null;
  referredOrgDomain?: string | null;
  createdAt: string;
}

const FreeCreditPromiseSchema = z
  .object({
    id: z.string(),
    kind: z.string(),
    amount_cents: z.string(),
    paid_trigger_cents: z.string(),
    paid_so_far_cents: z.string(),
    remaining_to_unlock_cents: z.string(),
    progress_pct: z.coerce.number(),
    referred_org_id: z.string().nullable(),
    referrer_org_id: z.string().nullable(),
    // Additive, shipping in a billing follow-up. Optional so this reader works
    // against both the current deploy and the next one, with no rollout gate.
    referred_org_name: z.string().nullable().optional(),
    referred_org_domain: z.string().nullable().optional(),
    created_at: z.string(),
  })
  .passthrough();

const FreeCreditPromisesResponseSchema = z.object({
  org_id: z.string(),
  paid_topups_cents: z.string(),
  // The TOTAL still outstanding across the promises below, summed by billing on
  // the same basis and in the same units as the rows it ships with, so a heading
  // reading this can never disagree with the list under it. Optional because it
  // is additive and shipped after the rows did; absent simply means the deploy
  // serving this body predates it. Never summed here.
  outstanding_total_cents: z.string().optional(),
  promises: z.array(FreeCreditPromiseSchema),
});

/** GET /billing/free-credit-promises — the free credits this org is still waiting on. */
export async function getFreeCreditPromises(
  token?: string,
): Promise<{
  paidTopupsCents: string;
  outstandingTotalCents: string | null;
  promises: FreeCreditPromise[];
}> {
  const raw = await apiCall<unknown>("/billing/free-credit-promises", { token });
  const parsed = FreeCreditPromisesResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getFreeCreditPromises: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getFreeCreditPromises: invalid response shape");
  }
  return {
    paidTopupsCents: parsed.data.paid_topups_cents,
    outstandingTotalCents: parsed.data.outstanding_total_cents ?? null,
    promises: parsed.data.promises.map((p) => ({
      id: p.id,
      kind: p.kind,
      amountCents: p.amount_cents,
      paidTriggerCents: p.paid_trigger_cents,
      paidSoFarCents: p.paid_so_far_cents,
      remainingToUnlockCents: p.remaining_to_unlock_cents,
      progressPct: p.progress_pct,
      referredOrgId: p.referred_org_id,
      referrerOrgId: p.referrer_org_id,
      referredOrgName: p.referred_org_name ?? null,
      referredOrgDomain: p.referred_org_domain ?? null,
      createdAt: p.created_at,
    })),
  };
}

// A single customer payment (a Stripe PaymentIntent = a one-off top-up the
// customer paid). Read from the api-service gateway payments route, which
// forwards the org's PaymentIntents mirrored server-side in stripe-service.
// NOTE: shape verified against api-registry (live) before merge — the gateway
// owns the wire shape; this reader conforms to the deployed route.
export interface Payment {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string; // ISO 8601
  description: string | null;
  // Settled refunds + lost disputes on this payment, minor units. Stripe leaves a
  // refunded payment `succeeded` at its full amount, so this is the only signal
  // that the money came back. See lib/payment-return.ts.
  amountReturnedCents: number;
  // Why the card was refused, straight off Stripe's `last_payment_error`. Null on
  // a payment that was never attempted against a card (an abandoned checkout) and
  // on most successful ones. NOT null-implies-success: Stripe keeps the error of
  // an earlier attempt on an intent that later succeeded, which is why
  // lib/payment-failure.ts reads the status alongside it.
  declineMessage: string | null;
  // `decline_code` when Stripe sent one (`insufficient_funds`), else its coarser
  // `code` (`card_declined`). Diagnostics — the message is what a person reads.
  declineCode: string | null;
}

// stripe-service mirrors raw Stripe PaymentIntents; `amount` is cents (number),
// `created` is unix-seconds. `.passthrough()` keeps unmodeled Stripe fields.
const PaymentIntentSchema = z
  .object({
    id: z.string(),
    amount: z.coerce.number(),
    currency: z.string(),
    status: z.string(),
    created: z.coerce.number(),
    description: z.string().nullable().optional(),
    // stripe-service v0.27.0 derives this on every mirrored PaymentIntent. Required
    // on purpose: an absent value would silently read as "nothing came back", which
    // is exactly the wrong story to tell. Absent => loud shape mismatch.
    amount_returned: z.coerce.number(),
    // Raw Stripe. Present only on an intent whose charge was actually attempted
    // and refused, so `.nullish()` here is the producer's own contract, not a
    // tolerance: Stripe omits the key entirely on an intent nobody ever charged.
    last_payment_error: z
      .object({
        code: z.string().nullish(),
        decline_code: z.string().nullish(),
        message: z.string().nullish(),
      })
      .passthrough()
      .nullish(),
  })
  .passthrough();

const ListPaymentsResponseSchema = z.object({
  object: z.literal("list"),
  data: z.array(PaymentIntentSchema),
  has_more: z.boolean(),
  url: z.string(),
});

/**
 * GET /billing/payments — the active org's payment history (its Stripe
 * PaymentIntents / top-ups). Backs the billing page "Payments" card.
 */
export async function getBillingPayments(token?: string): Promise<{ payments: Payment[] }> {
  const raw = await apiCall<unknown>("/billing/payments", { token });
  const parsed = ListPaymentsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getBillingPayments: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getBillingPayments: invalid response shape");
  }
  const payments: Payment[] = parsed.data.data.map((pi) => ({
    id: pi.id,
    amountCents: pi.amount,
    currency: (pi.currency ?? "usd").toUpperCase(),
    status: pi.status,
    createdAt: new Date(pi.created * 1000).toISOString(),
    description: pi.description ?? null,
    amountReturnedCents: pi.amount_returned,
    declineMessage: pi.last_payment_error?.message ?? null,
    // decline_code is the specific one ("insufficient_funds"); code is the family
    // ("card_declined"). Prefer the specific, fall back to the family.
    declineCode: pi.last_payment_error?.decline_code ?? pi.last_payment_error?.code ?? null,
  }));
  // Most recent first.
  payments.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return { payments };
}

export async function createCheckoutSession(
  params:
    | {
        topup_amount_cents: number;
        mode?: "payment";
        /**
         * Hand the welcome-gift deduction to billing (billing-service v0.81.15): send
         * the FULL budget as `topup_amount_cents` and billing applies the gift as a
         * Stripe discount, so the hosted page reads budget, "Welcome credit -$30",
         * total. Never combine with an amount the gift was already taken off.
         */
        apply_welcome_gift?: boolean;
        success_url: string;
        cancel_url: string;
      }
    | { mode: "setup"; success_url: string; cancel_url: string },
  token?: string
): Promise<CheckoutSession> {
  return apiCall<CheckoutSession>("/billing/checkout-sessions", {
    token,
    method: "POST",
    body: params as unknown as Record<string, unknown>,
  });
}

/**
 * Create an EMBEDDED Stripe Checkout session — card is captured in an in-app modal
 * (iframe), no redirect to a hosted Stripe page. Returns a `client_secret` the
 * front-end mounts via @stripe/react-stripe-js <EmbeddedCheckout>. The card is saved
 * off-session (auto-topup) and `topup_amount_cents` charged; credit lands via the
 * existing checkout.session.completed webhook (same accounting as the hosted path).
 */
export async function createEmbeddedCheckoutSession(
  topup_amount_cents: number,
  token?: string
): Promise<EmbeddedCheckoutSession> {
  return apiCall<EmbeddedCheckoutSession>("/billing/checkout-sessions", {
    token,
    method: "POST",
    body: { ui_mode: "embedded", topup_amount_cents },
  });
}

/**
 * How this org's customer adds a card.
 *
 * Not a URL, because not every payment provider does this the same way: some
 * host a page we redirect to, others have no hosted page at all and save a card
 * only through a widget this app mounts itself. The backend resolves which one
 * applies and describes the mechanism; the UI switches on `mode` and never
 * needs to know which provider is behind it.
 *
 * The hosted case still carries `url` where it always did, so this stayed
 * backwards compatible while the backend rolled out.
 */
export type CardSetup = CardSetupSettlement &
  (
  | { object: "card_setup"; mode: "hosted_redirect"; url: string }
  /**
   * An in-page card save that charges nothing (stripe-service v0.53.0, relayed by
   * billing v0.81.7), asked for with `ui_mode: "embedded"`. Mounted with Stripe's
   * embedded checkout; completion arrives on `onComplete`, never a redirect.
   */
  | { object: "card_setup"; mode: "embedded_checkout"; client_secret: string }
  | {
      object: "card_setup";
      mode: "embedded_widget";
      /**
       * The provider's browser SDK and the environment to load it in. Served
       * rather than hardcoded so the environment is decided next to the key that
       * created the order, instead of in a dashboard build.
       */
      script_url: string;
      environment: "prod" | "sandbox";
      /**
       * The PER-ORDER public identifier the SDK is initialised with. The only
       * credential the browser gets, scoped to this one order, and not a secret.
       *
       * There used to be a `public_key` here. It was REMOVED at the provider
       * (stripe-service v0.48.0) because the merchant key belongs to the entry
       * points that cannot save a card, so this flow has no use for it. Do not
       * re-add it: a field this page does not need is a credential it should not
       * hold.
       */
      token: string;
      save_payment_method_for: "merchant";
      /** Prefilled so the provider does not ask for what we already know. */
      customer_name?: string | null;
      customer_email?: string | null;
    }
  );

/**
 * What billing-service did about the outstanding balance while minting the
 * session (see `cardSessionSettleProblem` in lib/card-change-settle). Optional
 * on purpose: an older billing deploy states none of it, which reads as nothing
 * to say. `settle_result` is a plain string so a value billing adds later parses.
 */
export interface CardSetupSettlement {
  settle_result?: string;
  settled_cents?: number;
  settle_skip_reason?: string;
  settle_decline_message?: string | null;
}

/**
 * Opening the card page is never refused, whatever happens to the money we try
 * to collect at that moment. billing-service still charges an outstanding
 * balance to the card on file on this call, and hands the session over whether
 * that charge lands or declines: a customer whose card is dead is exactly the
 * one who came here to replace it, so refusing them the page is the one thing
 * that makes the debt uncollectable. Collection stays with the sweeps.
 */
/**
 * An in-page card save, charging nothing, for the "New organization" modal's postpaid
 * option: a redirect would lose the modal. A Stripe org answers `embedded_checkout`,
 * a second-acquirer org its `embedded_widget`, so the caller switches on `mode`. Like
 * every card session, billing first tries to collect an outstanding negative balance
 * (never blocking); a brand-new org owes nothing.
 */
export async function createEmbeddedCardSetup(token?: string): Promise<CardSetup> {
  return apiCall<CardSetup>("/billing/accounts/card_setup", {
    token,
    method: "POST",
    body: { ui_mode: "embedded" },
  });
}

/**
 * Make Revolut Business the org's acquirer before any card save or payment
 * (owner-decided 2026-09-29: Revolut by default everywhere a card or money is asked
 * for, not only in the New organization modal). Idempotent. An org already holding
 * a chargeable card on another acquirer stays there: billing answers
 * `card_elsewhere`, which is an answer, not a failure. Anything else throws, and
 * the caller's own error line says so (never this body).
 *
 * A raw fetch rather than `apiCall` because the route is ours, not the gateway's,
 * and it carries THIS tab's token so it pins the org the page is on.
 */
export async function declareRevolutDefault(): Promise<"pinned" | "card_elsewhere"> {
  const token = await getTabSessionToken();
  const res = await fetch("/api/orgs/revolut", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    console.error(`[dashboard] Revolut acquirer declaration failed: ${res.status}`);
    throw new Error("We could not prepare the payment. Please try again.");
  }
  const body = (await res.json()) as { result?: string };
  return body.result === "card_elsewhere" ? "card_elsewhere" : "pinned";
}

export async function createPortalSession(
  returnUrl: string,
  token?: string
): Promise<CardSetup> {
  return apiCall<CardSetup>("/billing/portal-sessions", {
    token,
    method: "POST",
    body: { return_url: returnUrl },
  });
}

// Press Kits
export type MediaKitStatus = "drafted" | "generating" | "validated" | "denied" | "failed" | "archived";

/** Summary returned by list endpoints (no mdxPageContent) */
export interface MediaKitSummary {
  id: string;
  title: string | null;
  status: MediaKitStatus;
  contentExcerpt: string | null;
  organizationId: string | null;
  orgId: string | null;
  brandId: string | null;
  campaignId: string | null;
  iconUrl: string | null;
  shareToken: string | null;
  publicUrl: string | null;
  parentMediaKitId: string | null;
  featureSlug: string | null;
  workflowSlug: string | null;
  denialReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Full detail returned by GET /media-kits/:id */
export interface MediaKit extends MediaKitSummary {
  mdxPageContent: string | null;
}

/** View stats for press kits */
export interface MediaKitViewStats {
  totalViews: number;
  uniqueVisitors: number;
  lastViewedAt: string | null;
  firstViewedAt: string | null;
}

export interface MediaKitViewStatsGrouped {
  groups: Array<{
    key: string;
    totalViews: number;
    uniqueVisitors: number;
    lastViewedAt: string | null;
  }>;
}

/** Upsert org in press-kits-service (idempotent, call before listing kits) */
export async function upsertPressKitOrg(
  orgId: string,
  name?: string,
  token?: string
): Promise<void> {
  await apiCall<Record<string, unknown>>("/press-kits/organizations", {
    token,
    method: "POST",
    body: { orgId, ...(name ? { name } : {}) },
  });
}

/** List media kits filtered by org_id */
export async function listMediaKits(orgId: string, token?: string): Promise<MediaKitSummary[]> {
  const res = await apiCall<{ mediaKits: MediaKitSummary[] }>(`/press-kits/media-kits?org_id=${orgId}`, { token });
  return res.mediaKits;
}

/** List media kits filtered by brand_id */
export async function listBrandMediaKits(brandId: string, token?: string): Promise<MediaKitSummary[]> {
  const res = await apiCall<{ mediaKits: MediaKitSummary[] }>(`/press-kits/media-kits?brand_id=${brandId}`, { token });
  return res.mediaKits;
}

export async function getMediaKit(id: string, options?: { token?: string; headers?: Record<string, string> }): Promise<MediaKit> {
  return apiCall<MediaKit>(`/press-kits/media-kits/${id}`, { token: options?.token, headers: options?.headers });
}

/** Initiate media kit generation (org via x-org-id, brand via x-brand-id header) */
export async function editMediaKit(
  params: { instruction: string; headers?: Record<string, string> },
  token?: string
): Promise<{ mediaKitId: string }> {
  const { instruction, headers } = params;
  return apiCall<{ mediaKitId: string }>("/press-kits/media-kits", {
    token,
    method: "POST",
    body: { instruction },
    headers,
  });
}

/** Update MDX content of a media kit */
export async function updateMediaKitMdx(
  mediaKitId: string,
  mdxContent: string,
  options?: { token?: string; headers?: Record<string, string> }
): Promise<void> {
  await apiCall<Record<string, unknown>>(`/press-kits/media-kits/${mediaKitId}/mdx`, {
    token: options?.token,
    method: "PATCH",
    body: { mdxContent },
    headers: options?.headers,
  });
}

/** Update media kit status */
export async function updateMediaKitStatus(
  mediaKitId: string,
  status: MediaKitStatus,
  options?: { denialReason?: string; token?: string; headers?: Record<string, string> }
): Promise<void> {
  await apiCall<Record<string, unknown>>(`/press-kits/media-kits/${mediaKitId}/status`, {
    token: options?.token,
    method: "PATCH",
    body: { status, ...(options?.denialReason ? { denialReason: options.denialReason } : {}) },
    headers: options?.headers,
  });
}

/** Validate a media kit (moves to validated status) */
export async function validateMediaKit(
  mediaKitId: string,
  options?: { token?: string; headers?: Record<string, string> }
): Promise<void> {
  await apiCall<Record<string, unknown>>(`/press-kits/media-kits/${mediaKitId}/validate`, {
    token: options?.token,
    method: "POST",
    headers: options?.headers,
  });
}

/** Cancel a draft media kit */
export async function cancelDraftMediaKit(
  mediaKitId: string,
  options?: { token?: string; headers?: Record<string, string> }
): Promise<void> {
  await apiCall<Record<string, unknown>>(`/press-kits/media-kits/${mediaKitId}/cancel`, {
    token: options?.token,
    method: "POST",
    headers: options?.headers,
  });
}

/** Get view stats for press kits */
export async function getMediaKitViewStats(
  params: { brandId?: string; mediaKitId?: string; from?: string; to?: string; groupBy?: "country" | "mediaKitId" | "day" },
  options?: { token?: string; headers?: Record<string, string> }
): Promise<MediaKitViewStats & Partial<MediaKitViewStatsGrouped>> {
  const qs = new URLSearchParams();
  if (params.brandId) qs.set("brandId", params.brandId);
  if (params.mediaKitId) qs.set("mediaKitId", params.mediaKitId);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.groupBy) qs.set("groupBy", params.groupBy);
  return apiCall<MediaKitViewStats & Partial<MediaKitViewStatsGrouped>>(
    `/press-kits/media-kits/stats/views?${qs.toString()}`,
    { token: options?.token, headers: options?.headers },
  );
}


// --- Discovery types ---

/** Cumulative outlet status counts from outlets-service */
export interface OutletStatusCounts {
  open: number;
  served: number;
  skipped: number;
  contacted: number;
  sent: number;
  delivered: number;
  clicked: number;
  replied: number;
  repliesPositive: number;
  repliesNegative: number;
  repliesNeutral: number;
  bounced: number;
  unsubscribed: number;
}

/** Structured outlet status from outlets-service */
export interface OutletStatus {
  outletStatus: "open" | "served" | "skipped";
  statusReason: "discovered" | "buffer_claimed" | null;
  statusDetail: string | null;
  totalJournalists?: number;
  brand?: OutletStatusCounts | null;
  byCampaign?: Record<string, OutletStatusCounts> | null;
  campaign?: OutletStatusCounts | null;
  global?: { bounced: number; unsubscribed: number };
}

/** Per-campaign data nested inside a deduplicated outlet */
export interface OutletCampaign {
  campaignId: string;
  featureSlug: string;
  brandIds: string[];
  relevanceScore: number;
  whyRelevant?: string;
  whyNotRelevant?: string;
  statusReason: string | null;
  statusDetail: string | null;
  overallRelevance?: string | null;
  relevanceRationale?: string | null;
  runId?: string | null;
  updatedAt: string;
}

/** Deduplicated outlet returned by GET /v1/outlets */
export interface DeduplicatedOutlet {
  id: string;
  outletName: string;
  outletUrl: string;
  outletDomain: string;
  createdAt: string;
  status: OutletStatus;
  pricing?: {
    sellPriceCents: number | null;
    currency: string | null;
  } | null;
  priceRequestStatus: "ongoing" | "received" | null;
  relevanceScore: number;
  campaigns: OutletCampaign[];
  // Ahrefs enrichment, present only when the request passes `enrich=ahref`
  // (outlets-service joins these server-side, resilient/chunked). null when
  // ahref has no trustworthy cached value for the domain.
  domainRating?: number | null;
  trafficMonthlyAvg?: number | null;
}

export interface OutletPriceRequestResult {
  outletId: string;
  status: "ongoing" | "error";
  editorialEmail?: string;
  messageId?: string;
  error?: string;
}

export interface OutletListResponse {
  outlets: DeduplicatedOutlet[];
  total: number;
  byOutreachStatus?: Record<string, number>;
}

/** Flat outlet returned by GET /v1/campaigns/{id}/outlets */
export interface CampaignOutlet {
  id: string;
  outletName: string;
  outletUrl: string;
  outletDomain: string;
  relevanceScore: number;
  whyRelevant: string | null;
  outletStatus: "open" | "served" | "contacted" | "delivered" | "replied" | "skipped" | "denied" | "ended" | null;
  replyClassification?: "positive" | "negative" | "neutral" | null;
}

export interface DiscoveredJournalist {
  id: string;
  entityType: "individual" | "organization";
  journalistName: string;
  firstName: string | null;
  lastName: string | null;
  outletName?: string;
  outletDomain?: string;
  createdAt: string;
  updatedAt: string;
}

export async function listBrandOutlets(
  brandId: string,
  featureSlug?: string,
  token?: string,
  campaignId?: string,
  enrich?: boolean,
): Promise<OutletListResponse> {
  const params = new URLSearchParams({ brandId });
  if (featureSlug) params.set("featureSlug", featureSlug);
  if (campaignId) params.set("campaignId", campaignId);
  // enrich=ahref → each outlet carries domainRating + trafficMonthlyAvg
  // (server-side resilient join). Opt-in so the high-frequency sidebar count
  // query stays cheap.
  if (enrich) params.set("enrich", "ahref");
  const data = await apiCall<OutletListResponse>(
    `/outlets?${params}`,
    { token },
  );
  return {
    ...data,
    outlets: withAverageCampaignRelevanceScores(data.outlets),
  };
}

export async function requestOutletPurchasePrices(
  outletIds: string[],
  token?: string,
): Promise<{ results: OutletPriceRequestResult[] }> {
  return apiCall<{ results: OutletPriceRequestResult[] }>(
    "/outlets/price-requests",
    { token, method: "POST", body: { outletIds } },
  );
}

export interface BrandJournalist {
  id: string;
  journalistId: string;
  campaignId: string;
  outletId: string;
  orgId: string;
  brandId: string;
  featureSlug: string | null;
  relevanceScore: string;
  whyRelevant: string;
  whyNotRelevant: string;
  articleUrls: string[] | null;
  outreachStatus: "buffered" | "claimed" | "served" | "contacted" | "delivered" | "replied" | "bounced" | "skipped";
  createdAt: string;
  journalistName: string;
  firstName: string | null;
  lastName: string | null;
  entityType: "individual" | "organization";
}

// --- Enriched journalist types (from GET /v1/journalists/list) ---

export interface EmailDeliveryScopeStatus {
  contacted: boolean;
  delivered: boolean;
  replied: boolean;
  replyClassification: "positive" | "negative" | "neutral" | null;
  bounced: boolean;
  unsubscribed: boolean;
  lastDeliveredAt: string | null;
}

export interface EmailDeliveryGlobalStatus {
  email: { bounced: boolean; unsubscribed: boolean };
}

export interface EmailStatus {
  broadcast: {
    campaign: EmailDeliveryScopeStatus | null;
    brand: EmailDeliveryScopeStatus | null;
    global: EmailDeliveryGlobalStatus;
  };
  transactional: {
    campaign: EmailDeliveryScopeStatus | null;
    brand: EmailDeliveryScopeStatus | null;
    global: EmailDeliveryGlobalStatus;
  };
}

export interface JournalistCost {
  totalCostInUsdCents: number;
  actualCostInUsdCents: number;
  provisionedCostInUsdCents: number;
  runCount: number;
}

export interface JournalistCampaignEntry {
  id: string;
  campaignId: string;
  featureSlug: string | null;
  workflowSlug: string | null;
  relevanceScore: string;
  whyRelevant: string;
  whyNotRelevant: string;
  articleUrls: string[] | null;
  email: string | null;
  apolloPersonId: string | null;
  statusReason: string | null;
  statusDetail: string | null;
  runId: string | null;
  createdAt: string;
}

export interface JournalistStatusBooleans {
  buffered: boolean;
  claimed: boolean;
  served: boolean;
  skipped: boolean;
  contacted: boolean;
  sent: boolean;
  delivered: boolean;
  clicked: boolean;
  replied: boolean;
  replyClassification: "positive" | "negative" | "neutral" | null;
  bounced: boolean;
  unsubscribed: boolean;
  lastDeliveredAt: string | null;
}

export interface EnrichedJournalist {
  journalistId: string;
  journalistName: string;
  firstName: string | null;
  lastName: string | null;
  entityType: "individual" | "organization";
  outletId: string;
  outletName: string | null;
  outletDomain: string | null;
  email: string | null;
  apolloPersonId: string | null;
  brand: JournalistStatusBooleans | null;
  byCampaign: Record<string, JournalistStatusBooleans> | null;
  campaign: JournalistStatusBooleans | null;
  global: { bounced: boolean; unsubscribed: boolean } | null;
  cost: JournalistCost | null;
  campaigns: JournalistCampaignEntry[];
}

/** Check if a journalist has been contacted at a given scope */
export function isJournalistContacted(
  emailStatus: EmailStatus | null,
  scope: "campaign" | "brand",
): boolean {
  if (!emailStatus) return false;
  const bc = emailStatus.broadcast[scope];
  const tc = emailStatus.transactional[scope];
  return (
    (bc?.contacted ?? false) ||
    (tc?.contacted ?? false)
  );
}

export async function listJournalistsEnriched(
  brandId: string,
  options?: { campaignId?: string; featureSlug?: string; token?: string },
): Promise<{ journalists: EnrichedJournalist[]; total?: number; byOutreachStatus?: Record<string, number> }> {
  const params = new URLSearchParams({ brandId });
  if (options?.campaignId) params.set("campaignId", options.campaignId);
  if (options?.featureSlug) params.set("featureSlug", options.featureSlug);
  return apiCall<{ journalists: EnrichedJournalist[]; total?: number; byOutreachStatus?: Record<string, number> }>(
    `/journalists/list?${params}`,
    { token: options?.token },
  );
}

export async function listBrandJournalists(
  brandId: string,
  campaignId?: string,
  token?: string,
): Promise<{ campaignJournalists: BrandJournalist[] }> {
  const params = new URLSearchParams({ brandId });
  if (campaignId) params.set("campaignId", campaignId);
  return apiCall<{ campaignJournalists: BrandJournalist[] }>(
    `/journalists?${params}`,
    { token },
  );
}

// --- Discovery actions & cost stats ---

export async function discoverOutlets(
  brandId: string,
  campaignId: string,
  count?: number,
): Promise<{ runId: string; discovered: number }> {
  return apiCall<{ runId: string; discovered: number }>(
    `/outlets/discover`,
    {
      method: "POST",
      body: count ? { count } : {},
      headers: {
        "x-brand-id": brandId,
        "x-campaign-id": campaignId,
      },
    },
  );
}

export async function discoverJournalists(
  brandId: string,
  campaignId: string,
  outletId: string,
  maxArticles?: number,
): Promise<{ runId: string; discovered: number }> {
  return apiCall<{ runId: string; discovered: number }>(
    `/journalists/discover`,
    {
      method: "POST",
      body: { outletId, ...(maxArticles ? { maxArticles } : {}) },
      headers: {
        "x-brand-id": brandId,
        "x-campaign-id": campaignId,
      },
    },
  );
}

export async function getOutletStatsCosts(
  brandId: string,
  groupBy?: string,
  featureSlug?: string,
  token?: string,
  campaignId?: string,
): Promise<{ groups: CostStatsGroup[] }> {
  const params = new URLSearchParams({ brandId });
  if (groupBy) params.set("groupBy", groupBy);
  if (featureSlug) params.set("featureSlug", featureSlug);
  if (campaignId) params.set("campaignId", campaignId);
  return apiCall<{ groups: CostStatsGroup[] }>(
    `/outlets/stats/costs?${params}`,
    { token },
  );
}

export async function getJournalistStatsCosts(
  brandId: string,
  groupBy?: string,
  campaignId?: string,
  token?: string,
): Promise<{ groups: CostStatsGroup[] }> {
  const params = new URLSearchParams({ brandId });
  if (groupBy) params.set("groupBy", groupBy);
  if (campaignId) params.set("campaignId", campaignId);
  return apiCall<{ groups: CostStatsGroup[] }>(
    `/journalists/stats/costs?${params}`,
    { token },
  );
}

export async function getMediaKitStatsCosts(
  brandId: string,
  groupBy?: string,
  token?: string,
): Promise<{ groups: CostStatsGroup[] }> {
  const params = new URLSearchParams({ brandId });
  if (groupBy) params.set("groupBy", groupBy);
  return apiCall<{ groups: CostStatsGroup[] }>(
    `/press-kits/media-kits/stats/costs?${params}`,
    { token },
  );
}

// --- Article discovery types ---

export interface ArticleDiscoveryItem {
  discovery: {
    id: string;
    articleId: string;
    orgId: string;
    brandId: string;
    featureSlug: string;
    campaignId: string;
    outletId: string | null;
    journalistId: string | null;
    topicId: string | null;
    createdAt: string;
  };
  article: {
    id: string;
    articleUrl: string;
    snippet: string | null;
    ogDescription: string | null;
    twitterCreator: string | null;
    newsKeywords: string | null;
    articlePublished: string | null;
    articleChannel: string | null;
    twitterTitle: string | null;
    articleSection: string | null;
    author: string | null;
    ogTitle: string | null;
    articleAuthor: string | null;
    twitterDescription: string | null;
    articleModified: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

export async function listBrandArticles(
  brandId: string,
  featureSlug?: string,
  token?: string,
): Promise<{ discoveries: ArticleDiscoveryItem[] }> {
  const params = new URLSearchParams({ brandId });
  if (featureSlug) params.set("featureSlug", featureSlug);
  return apiCall<{ discoveries: ArticleDiscoveryItem[] }>(
    `/discoveries?${params}`,
    { token },
  );
}

/** Check if orgs exist in press-kits-service */
export async function checkPressKitOrgsExist(
  orgIds: string[],
  token?: string
): Promise<Record<string, boolean>> {
  return apiCall<Record<string, boolean>>(
    `/press-kits/organizations/exists?orgIds=${orgIds.join(",")}`,
    { token },
  );
}

function buildQuery(params: object): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      qs.set(key, String(value));
    }
  }
  const out = qs.toString();
  return out ? `?${out}` : "";
}

// ─── Ahref domain metrics (ahref-service via api-service proxy) ─────────────
// Domain-keyed Ahrefs cache: organic-traffic monthly history, latest DR, and
// latest estimated traffic value. Read-only GET pass-throughs (no paid scrape
// on view — the POST compute/ai-visibility endpoints are intentionally not
// proxied). safeParse per the DIS-74 wire-shape-rot rule: throw on mismatch so
// React Query surfaces a fetch error instead of crashing at render.

const MonthlyOrganicTrafficPointSchema = z.object({
  month: z.string(), // First day of the month (YYYY-MM-DD).
  // ahref-service declares this `integer` but serializes Postgres numeric as a
  // string ("0") on the wire; coerce so a string OR number parses. nullable()
  // short-circuits null before coerce (null -> null, not 0).
  organicTraffic: z.coerce.number().nullable(),
});

const DomainTrafficHistorySchema = z.object({
  domain: z.string(),
  hasData: z.boolean(),
  latestDataCapturedAt: z.string().nullable(),
  // Same numeric-string wire shape as organicTraffic above.
  trafficMonthlyAvg: z.coerce.number().nullable(),
  trafficValueMonthlyAvg: z.coerce.number().nullable(),
  monthlyOrganicTraffic: z.array(MonthlyOrganicTrafficPointSchema),
});

export type DomainTrafficHistory = z.infer<typeof DomainTrafficHistorySchema>;

const DomainDrStatusSchema = z.object({
  domain: z.string(),
  latestValidDr: z.number().nullable(),
  latestValidDrDate: z.string().nullable(),
});

export type DomainDrStatus = z.infer<typeof DomainDrStatusSchema>;

/**
 * GET /v1/orgs/domains/traffic-history — Ahrefs traffic for a single domain:
 * latest snapshot (avg traffic + estimated value) plus the monthly organic
 * series. Returns null when the domain isn't in the cache yet (empty array).
 */
export async function getDomainTrafficHistory(
  domain: string,
  token?: string,
): Promise<DomainTrafficHistory | null> {
  const data = await getDomainTrafficHistories([domain], token);
  return data[0] ?? null;
}

// Both domain cache-readers take a `?domains=a.com,b.com,…` query string. A
// brand can own thousands of outlet domains (12k+ seen in prod), and passing
// every domain in ONE request blows the URL/header size limit → the request
// fails → the DR / Monthly-Visits maps come back empty (blank columns in the
// CSV + cards). Split into bounded chunks fetched with limited concurrency.
//
// ahref-service prod runs on a tiny fixed compute (0.25 CU, small pg pool) with
// Neon scale-to-zero, so a burst of chunk requests hits cold-start +
// pool-saturation transients (ECONNRESET / 5xx / "timeout exceeded when trying
// to connect"). The reads are idempotent GETs, so each chunk RETRIES transient
// failures with backoff; only a chunk that still fails after all attempts
// throws (fail loud). Without the retry, ONE dropped chunk would empty the whole
// enrichment map (the merge awaits every chunk), which is exactly how DR +
// Monthly Visits went blank for the 12k-outlet brand even after chunking.
const DOMAIN_READ_CHUNK_SIZE = 200;
const DOMAIN_READ_CONCURRENCY = 4;
const DOMAIN_READ_RETRIES = 2;
const DOMAIN_READ_BACKOFF_MS = [400, 1200];
const DOMAIN_READ_TIMEOUT_MS = 12_000;

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

// ahref-service `normalizeDomain` rejects anything that isn't a bare host with a
// 400 ("not a valid domain: -"), and that 400 fails the ENTIRE chunk it lands in
// — blanking DR / Monthly Visits for up to DOMAIN_READ_CHUNK_SIZE valid domains
// sharing the chunk. Outlet records carry a "-" placeholder for "no domain" and
// occasionally a path-bearing value (a.com/section); `.sort()` puts "-" first, so
// it poisons chunk 0 on every load. Filter to bare, dotted hosts BEFORE chunking
// so one junk value can't take down its chunk-mates. Dropping a non-domain loses
// nothing — ahref can't enrich it anyway.
function isQueryableDomain(domain: string): boolean {
  return domain.length > 0 && domain !== "-" && domain.includes(".") && !/[/\s]/.test(domain);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Bound a request so it can never hang forever. ahref-service prod is a tiny
// 0.25 CU compute; a single slow/queued chunk with no timeout left the whole
// enrichment query PENDING indefinitely (blank DR/Visits + a stuck "Loading"
// button), which retry alone could not fix because a hang never throws.
function withTimeout<O>(promise: Promise<O>, ms: number, label: string): Promise<O> {
  return new Promise<O>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`[dashboard] ${label}: request timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

// Retry an idempotent, time-bounded read on a thrown transport/5xx/timeout
// error. Throws the last error once attempts are exhausted; the CALLER decides
// whether a persistently-failing chunk drops to empty (best-effort enrichment)
// or propagates.
async function retryTransientRead<O>(fn: () => Promise<O>, label: string): Promise<O> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= DOMAIN_READ_RETRIES; attempt++) {
    try {
      return await withTimeout(fn(), DOMAIN_READ_TIMEOUT_MS, label);
    } catch (err) {
      lastError = err;
      if (attempt < DOMAIN_READ_RETRIES) {
        await sleep(DOMAIN_READ_BACKOFF_MS[Math.min(attempt, DOMAIN_READ_BACKOFF_MS.length - 1)]);
      }
    }
  }
  throw lastError;
}

async function mapWithConcurrency<I, O>(
  items: I[],
  limit: number,
  fn: (item: I) => Promise<O>,
): Promise<O[]> {
  const results: O[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const current = next++;
      results[current] = await fn(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function getDomainTrafficHistories(
  domains: string[],
  token?: string,
): Promise<DomainTrafficHistory[]> {
  const queryable = domains.filter(isQueryableDomain);
  if (queryable.length < domains.length) {
    console.warn("[dashboard] getDomainTrafficHistories: dropped non-queryable domains before ahref call", {
      dropped: domains.filter((d) => !isQueryableDomain(d)),
    });
  }
  if (queryable.length === 0) return [];
  const batches = chunkArray(queryable, DOMAIN_READ_CHUNK_SIZE);
  // Best-effort enrichment: a chunk that stays unreachable after retries drops
  // to [] (those domains render blank) instead of throwing and blanking EVERY
  // domain. The failure is logged loudly, not swallowed silently.
  const batchResults = await mapWithConcurrency(batches, DOMAIN_READ_CONCURRENCY, async (batch) => {
    try {
      const raw = await retryTransientRead(
        () => apiCall<unknown>(`/orgs/domains/traffic-history?${new URLSearchParams({ domains: batch.join(",") })}`, { token }),
        "getDomainTrafficHistories",
      );
      const parsed = z.array(DomainTrafficHistorySchema).safeParse(raw);
      if (!parsed.success) {
        console.error("[dashboard] getDomainTrafficHistories: response shape mismatch", {
          issues: parsed.error.issues,
          raw,
        });
        return [];
      }
      return parsed.data;
    } catch (err) {
      console.error("[dashboard] getDomainTrafficHistories: chunk unreachable, rendering its domains blank", err);
      return [];
    }
  });
  return batchResults.flat();
}

/**
 * GET /v1/orgs/domains/dr-status — Ahrefs Domain Rating status for a single
 * domain. Only the latest DR is exposed (no historical series), so the UI shows
 * it as a single big number. Returns null when the domain isn't cached yet.
 */
export async function getDomainDrStatus(
  domain: string,
  token?: string,
): Promise<DomainDrStatus | null> {
  const data = await getDomainDrStatuses([domain], token);
  return data[0] ?? null;
}

/**
 * GET /v1/orgs/domains/dr-status — Ahrefs Domain Rating status for many
 * domains. Cache read only: this does not trigger a paid Ahrefs scrape.
 */
export async function getDomainDrStatuses(
  domains: string[],
  token?: string,
): Promise<DomainDrStatus[]> {
  const queryable = domains.filter(isQueryableDomain);
  if (queryable.length < domains.length) {
    console.warn("[dashboard] getDomainDrStatuses: dropped non-queryable domains before ahref call", {
      dropped: domains.filter((d) => !isQueryableDomain(d)),
    });
  }
  if (queryable.length === 0) return [];
  const batches = chunkArray(queryable, DOMAIN_READ_CHUNK_SIZE);
  // Best-effort enrichment (see getDomainTrafficHistories): an unreachable chunk
  // drops to [] (blank for its domains) instead of blanking every domain.
  const batchResults = await mapWithConcurrency(batches, DOMAIN_READ_CONCURRENCY, async (batch) => {
    try {
      const raw = await retryTransientRead(
        () => apiCall<unknown>(`/orgs/domains/dr-status?${new URLSearchParams({ domains: batch.join(",") })}`, { token }),
        "getDomainDrStatuses",
      );
      const parsed = z.array(DomainDrStatusSchema).safeParse(raw);
      if (!parsed.success) {
        console.error("[dashboard] getDomainDrStatuses: response shape mismatch", {
          issues: parsed.error.issues,
          raw,
        });
        return [];
      }
      return parsed.data;
    } catch (err) {
      console.error("[dashboard] getDomainDrStatuses: chunk unreachable, rendering its domains blank", err);
      return [];
    }
  });
  return batchResults.flat();
}

// ─── On-demand Ahrefs fetch (get-or-fetch-if-never-seen) ────────────────────
// The GET readers above hit ahref-service's CACHE only; for a domain that was
// never scraped the cache is empty forever. These POST endpoints make
// AhrefService actually go check Ahrefs (declares cost + authorizes the scrape
// server-side). The dashboard fires them once per never-seen domain so we at
// least try the source. Compute responses are supersets of the read shapes;
// the read schemas strip the extra fields, so callers get the same type.

/**
 * POST /v1/orgs/domains/traffic-compute — on-demand Ahrefs traffic scrape for a
 * single domain. Returns the post-scrape traffic history (same shape as
 * getDomainTrafficHistory). null when Ahrefs has nothing for the domain.
 */
export async function computeDomainTraffic(
  domain: string,
  token?: string,
): Promise<DomainTrafficHistory | null> {
  const data = await computeDomainTrafficHistories([domain], token);
  return data[0] ?? null;
}

export async function computeDomainTrafficHistories(
  domains: string[],
  token?: string,
): Promise<DomainTrafficHistory[]> {
  const queryable = domains.filter(isQueryableDomain);
  if (queryable.length === 0) return [];
  const raw = await apiCall<unknown>("/orgs/domains/traffic-compute", {
    token,
    method: "POST",
    body: { domains: queryable },
  });
  const parsed = z.array(DomainTrafficHistorySchema).safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] computeDomainTrafficHistories: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] computeDomainTrafficHistories: invalid response shape");
  }
  return parsed.data;
}

export async function computeDomainDrStatuses(
  domains: string[],
  token?: string,
): Promise<DomainDrStatus[]> {
  const queryable = domains.filter(isQueryableDomain);
  if (queryable.length === 0) return [];
  const raw = await apiCall<unknown>("/orgs/domains/dr-compute", {
    token,
    method: "POST",
    body: { domains: queryable },
  });
  const parsed = z.array(DomainDrStatusSchema).safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] computeDomainDrStatuses: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] computeDomainDrStatuses: invalid response shape");
  }
  return parsed.data;
}

/**
 * POST /v1/orgs/domains/dr-compute — on-demand Ahrefs Domain Rating scrape for a
 * single domain. Returns the post-scrape DR status (same shape as
 * getDomainDrStatus). null when Ahrefs has nothing for the domain.
 */
export async function computeDomainDr(
  domain: string,
  token?: string,
): Promise<DomainDrStatus | null> {
  const data = await computeDomainDrStatuses([domain], token);
  return data[0] ?? null;
}

// Ahrefs Brand-Radar AI-visibility. Two surfaces, one lean shape (the wire also
// carries per-engine + competitor breakdowns + scrape metadata; the schema strips
// them — the card only surfaces the global mention count):
//   • GET  …/ai-visibility?domains=<csv>  — read-only CACHE (array, one element per
//     domain; fast, no scrape, no cost). The card's display reader.
//   • POST …/ai-visibility {domain}        — get-or-refresh (scrapes on cache-miss,
//     cost-declared + authorized). The getOrFetchIfNeverSeen trigger only.
const DomainAiVisibilitySchema = z.object({
  domain: z.string(),
  snapshotDate: z.string().nullable(),
  mentionsTotal: z.number(),
});

export type DomainAiVisibility = z.infer<typeof DomainAiVisibilitySchema>;

/**
 * GET /v1/orgs/domains/ai-visibility — read-only Ahrefs Brand-Radar cache for a
 * single domain (array response, one element per requested domain). No scrape, no
 * cost. null when the domain has no cached snapshot.
 */
export async function getDomainAiVisibility(
  domain: string,
  token?: string,
): Promise<DomainAiVisibility | null> {
  const raw = await apiCall<unknown>(
    `/orgs/domains/ai-visibility?domains=${encodeURIComponent(domain)}`,
    { token },
  );
  const parsed = z.array(DomainAiVisibilitySchema).safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getDomainAiVisibility: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getDomainAiVisibility: invalid response shape");
  }
  return parsed.data[0] ?? null;
}

/**
 * POST /v1/orgs/domains/ai-visibility — get-or-refresh Ahrefs Brand-Radar
 * AI-visibility for a single domain (scrapes on cache-miss; ahref-service declares
 * cost + authorizes). Used ONLY as the on-demand getOrFetchIfNeverSeen trigger; the
 * card displays the GET cache read above, never this POST on the render path.
 */
export async function computeDomainAiVisibility(
  domain: string,
  token?: string,
): Promise<DomainAiVisibility> {
  const raw = await apiCall<unknown>("/orgs/domains/ai-visibility", {
    token,
    method: "POST",
    body: { domain },
  });
  const parsed = DomainAiVisibilitySchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] computeDomainAiVisibility: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] computeDomainAiVisibility: invalid response shape");
  }
  return parsed.data;
}


// ─── Runs (dashboard v2 crew + work) ───────────────────────────────────────
//
// runs-service is the ledger of every step a campaign's workflow took. v2 reads
// it two ways, both served whole: the per-campaign roll-up over a window (a run
// count, the spend those runs carried, when the last one started) and the list of
// runs themselves, newest first. Nothing here counts or divides.

const CampaignRunGroupSchema = z.object({
  dimensions: z.object({ campaignId: z.string().nullable() }).passthrough(),
  totalCostInUsdCents: z.string(),
  runCount: z.number(),
  maxStartedAt: z.string().nullish(),
});

export interface CampaignRunGroup {
  campaignId: string | null;
  runCount: number;
  totalCostInUsdCents: number;
  maxStartedAt: string | null;
}

export async function getBrandRunsByCampaign(
  brandId: string,
  window: { startedAfter: string; startedBefore?: string },
): Promise<CampaignRunGroup[]> {
  const query = new URLSearchParams({ brandId, groupBy: "campaignId", startedAfter: window.startedAfter });
  if (window.startedBefore) query.set("startedBefore", window.startedBefore);
  const raw = await apiCall<unknown>(`/runs/stats/costs?${query}`);
  const parsed = z.object({ groups: z.array(CampaignRunGroupSchema) }).safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getBrandRunsByCampaign: invalid response shape", parsed.error.issues);
    throw new Error("[dashboard] getBrandRunsByCampaign: invalid response shape");
  }
  return parsed.data.groups.map((g) => ({
    campaignId: g.dimensions.campaignId ?? null,
    runCount: g.runCount,
    totalCostInUsdCents: Number(g.totalCostInUsdCents),
    maxStartedAt: g.maxStartedAt ?? null,
  }));
}

const RunRowSchema = z.object({
  id: z.string(),
  campaignId: z.string().nullable(),
  workflowSlug: z.string().nullable(),
  featureSlug: z.string().nullable(),
  serviceName: z.string(),
  taskName: z.string(),
  status: z.string(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  ownCostInUsdCents: z.string(),
  /** Billed cost of the run's whole SUBTREE; present only when asked with
   *  `include=subtreeCost` (runs-service v0.47.15). A workflow run has no own cost rows,
   *  so this, not `ownCostInUsdCents`, is what it cost. */
  totalCostInUsdCents: z.string().optional(),
});

export type RunRow = z.infer<typeof RunRowSchema>;

const VendorRunRowSchema = RunRowSchema.extend({
  /** Billed cost of the run's whole subtree (a workflow run's own rows are empty: its cost
   *  lives on the runs it spawned). */
  totalCostInUsdCents: z.coerce.string(),
  /** The same subtree at vendor cost, over the rows whose vendor cost is known. */
  vendorTotalCostInUsdCents: z.coerce.string(),
  /** Cost names with billed rows of no known vendor cost; empty = the vendor figure is the whole run. */
  unpricedCostNames: z.array(z.string()),
}).passthrough();
export type VendorRunRow = z.infer<typeof VendorRunRowSchema>;

/**
 * STAFF ONLY. The same run list as `listBrandRunLedger`, each run carrying its subtree cost
 * billed AND at vendor cost (runs-service #252/#256, gateway `/runs/vendor`, which scopes it to
 * the org the gateway resolves).
 */
export async function listBrandRunLedgerVendor(
  brandId: string,
  opts: { limit: number; workflowSlug?: string; taskName?: string },
): Promise<VendorRunRow[]> {
  const query = new URLSearchParams({ brandId, limit: String(opts.limit) });
  if (opts.workflowSlug) query.set("workflowSlug", opts.workflowSlug);
  if (opts.taskName) query.set("taskName", opts.taskName);
  const raw = await apiCall<unknown>(`/runs/vendor?${query}`);
  const parsed = z.object({ runs: z.array(VendorRunRowSchema) }).safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] listBrandRunLedgerVendor: invalid response shape", parsed.error.issues);
    throw new Error("[dashboard] listBrandRunLedgerVendor: invalid response shape");
  }
  return parsed.data.runs;
}

/**
 * ONE run, as runs-service serves it by id: its own fields, its cost rolled up over
 * everything it spawned, and those spawned runs (the steps it took). Read through the
 * gateway, org-scoped there. Fields the page does not read ride along untouched.
 */
const RunDetailCostSchema = z
  .object({
    costName: z.string(),
    totalCostInUsdCents: z.coerce.string(),
    quantity: z.coerce.number().nullish(),
  })
  .passthrough();

const RunDetailSchema = z
  .object({
    id: z.string(),
    serviceName: z.string(),
    taskName: z.string(),
    status: z.string(),
    startedAt: z.string(),
    completedAt: z.string().nullable(),
    campaignId: z.string().nullish(),
    workflowSlug: z.string().nullish(),
    featureSlug: z.string().nullish(),
    audienceId: z.string().nullish(),
    totalCostInUsdCents: z.coerce.string(),
    costs: z.array(RunDetailCostSchema).default([]),
    descendantRuns: z
      .array(
        z
          .object({
            id: z.string(),
            parentRunId: z.string().nullish(),
            serviceName: z.string(),
            taskName: z.string(),
            status: z.string(),
            startedAt: z.string().nullish(),
            completedAt: z.string().nullish(),
            ownCostInUsdCents: z.coerce.string(),
            costs: z.array(RunDetailCostSchema).default([]),
          })
          .passthrough(),
      )
      .default([]),
  })
  .passthrough();

export type RunDetail = z.infer<typeof RunDetailSchema>;

export async function getRunDetail(runId: string): Promise<RunDetail> {
  const raw = await apiCall<unknown>(`/runs/${encodeURIComponent(runId)}`);
  const parsed = RunDetailSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getRunDetail: invalid response shape", parsed.error.issues);
    throw new Error("[dashboard] getRunDetail: invalid response shape");
  }
  return parsed.data;
}

/**
 * What ONE run wrote, as content-generation stores it: the generation row itself, which
 * states the model that actually ran (not the workflow's current alias), the prompt
 * template, the audience and the lead it was written for. Read through `/emails?runId=`.
 */
export interface RunGeneration {
  id: string;
  subject: string | null;
  model: string | null;
  promptType: string | null;
  audienceId: string | null;
  leadId: string | null;
  workflowSlug: string | null;
  campaignId: string | null;
  leadFirstName: string | null;
  leadLastName: string | null;
  leadCompany: string | null;
  leadTitle: string | null;
  createdAt: string | null;
  sequence: EmailSequenceStep[] | null;
}

const RunGenerationSchema = z.object({
  id: z.string(),
  subject: z.string().nullish(),
  model: z.string().nullish(),
  promptType: z.string().nullish(),
  audienceId: z.string().nullish(),
  leadId: z.string().nullish(),
  workflowSlug: z.string().nullish(),
  campaignId: z.string().nullish(),
  leadFirstName: z.string().nullish(),
  leadLastName: z.string().nullish(),
  leadCompany: z.string().nullish(),
  leadTitle: z.string().nullish(),
  createdAt: z.string().nullish(),
  sequence: z
    .array(z.object({ step: z.number(), bodyHtml: z.string().nullish(), bodyText: z.string().nullish(), daysSinceLastStep: z.number().nullish() }))
    .nullish(),
});

export async function listRunGenerations(brandId: string, runId: string): Promise<RunGeneration[]> {
  const query = new URLSearchParams({ brandId, runId });
  const raw = await apiCall<unknown>(`/emails?${query}`);
  const parsed = z.object({ emails: z.array(RunGenerationSchema) }).safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] listRunGenerations: invalid response shape", parsed.error.issues);
    throw new Error("[dashboard] listRunGenerations: invalid response shape");
  }
  return parsed.data.emails.map((e) => ({
    id: e.id,
    subject: e.subject ?? null,
    model: e.model ?? null,
    promptType: e.promptType ?? null,
    audienceId: e.audienceId ?? null,
    leadId: e.leadId ?? null,
    workflowSlug: e.workflowSlug ?? null,
    campaignId: e.campaignId ?? null,
    leadFirstName: e.leadFirstName ?? null,
    leadLastName: e.leadLastName ?? null,
    leadCompany: e.leadCompany ?? null,
    leadTitle: e.leadTitle ?? null,
    createdAt: e.createdAt ?? null,
    sequence: (e.sequence ?? null)?.map((s) => ({
      step: s.step,
      bodyHtml: s.bodyHtml ?? "",
      bodyText: s.bodyText ?? "",
      daysSinceLastStep: s.daysSinceLastStep ?? 0,
    })) ?? null,
  }));
}

export async function listBrandRunLedger(
  brandId: string,
  opts: {
    limit: number;
    startedAfter?: string;
    status?: string;
    campaignIds?: string[];
    /** One VERSIONED workflow slug — runs-service stores the version, not the dynasty. */
    workflowSlug?: string;
    taskName?: string;
    /** Ask each run's subtree cost (`totalCostInUsdCents`); runs-service caps the page at 500. */
    subtreeCost?: boolean;
  },
): Promise<RunRow[]> {
  const query = new URLSearchParams({ brandId, limit: String(opts.limit) });
  if (opts.subtreeCost) query.set("include", "subtreeCost");
  if (opts.workflowSlug) query.set("workflowSlug", opts.workflowSlug);
  if (opts.taskName) query.set("taskName", opts.taskName);
  if (opts.startedAfter) query.set("startedAfter", opts.startedAfter);
  if (opts.campaignIds) query.set("campaignIds", opts.campaignIds.join(","));
  if (opts.status) query.set("status", opts.status);
  const raw = await apiCall<unknown>(`/runs?${query}`);
  const parsed = z.object({ runs: z.array(RunRowSchema) }).safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] listBrandRunLedger: invalid response shape", parsed.error.issues);
    throw new Error("[dashboard] listBrandRunLedger: invalid response shape");
  }
  return parsed.data.runs;
}
