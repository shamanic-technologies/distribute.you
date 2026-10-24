/**
 * A NEWSLETTER LINK SAYS WHO CLICKED.
 *
 * Every distribute.you link in a mailing-list send carries `dy_sub=<linkId>`
 * (transactional-email-service, its PR #236): an opaque id, one per subscriber.
 * Without it a subscriber who clicks, reads the blog and starts the onboarding stays
 * "Visitor from <domain>" in our Unibox, and no campaign of ours can reach them.
 *
 * THE EMAIL NEVER REACHES THE BROWSER. The browser only hands the opaque id and its
 * own PostHog distinct id to our server (`/api/public/subscriber-link`, same path on
 * the landing and the dashboard). The server resolves the id through the api-service
 * gateway and sets the email on that PostHog person with a server-side capture. The
 * route answers 204 whatever the verdict, so it is no oracle for "is this id valid".
 * crm-service's PostHog connector then ties the visit and every onboarding event of
 * that person to the subscriber.
 *
 * ONE VISIT, TWO HOSTS. posthog-js keeps its distinct id in a cookie on
 * `.distribute.you`, so the landing and the dashboard share it. The id is parked in
 * a session cookie on the same registrable domain, so `/get-started` reached from
 * the landing (the hero form is a plain GET) still carries it, and it is stripped
 * from the address bar as soon as it is read.
 *
 * ONE SCRIPT, TWO APPS. The landing renders this module's byte-equal copy
 * (`apps/landing/src/lib/subscriber-link.ts`), pinned by a landing test.
 *
 * Alias-free on purpose: unit tests import it directly and run the shipped script.
 */

export const SUBSCRIBER_LINK_PARAM = "dy_sub";
export const SUBSCRIBER_LINK_COOKIE = "distribute_dy_sub";
export const SUBSCRIBER_LINK_ROUTE = "/api/public/subscriber-link";

/** The opaque link id as the producer mints it (base64url), or nothing. The
 *  producer is the judge of validity (it answers tampered / unknown / revoked):
 *  this only keeps junk out of a URL path and a cookie. */
export function readSubscriberLinkId(raw: unknown): string | null {
  return typeof raw === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(raw) ? raw : null;
}

/** A distinct id as posthog-js mints it, or nothing: never an arbitrary string
 *  from the request body used as a person key. Same rule as anon-org-created-event. */
export function readDistinctId(raw: unknown): string | null {
  return typeof raw === "string" && /^[A-Za-z0-9_.:-]{8,200}$/.test(raw) ? raw : null;
}

/**
 * The capture IIFE, rendered into `<head>` on the landing (static pages and React
 * pages) and the dashboard.
 *
 * ES5, one `try`: a capture that throws must never break a page. It
 *  1. reads `dy_sub` from the URL, removes it from the address bar, parks it in a
 *     session cookie on `.distribute.you` (or reads the parked one);
 *  2. waits up to ~10 s for posthog-js to write its distinct id cookie
 *     (`ph_<token>_posthog`), since this runs before PostHog initialises;
 *  3. posts `{linkId, distinctId}` to our own server once per tab session.
 */
export const SUBSCRIBER_LINK_CAPTURE_SCRIPT = `(function(){try{
var P="${SUBSCRIBER_LINK_PARAM}",N="${SUBSCRIBER_LINK_COOKIE}",S="distribute_dy_sub_sent";
function ok(v){return typeof v==="string"&&/^[A-Za-z0-9_-]{16,64}$/.test(v);}
var id=null;
var u=new URL(location.href);
if(u.searchParams.has(P)){id=u.searchParams.get(P);u.searchParams.delete(P);try{history.replaceState(null,"",u.pathname+u.search+u.hash);}catch(e){}}
if(ok(id)){
  var dom=/(^|\\.)distribute\\.you$/.test(location.hostname)?";Domain=.distribute.you":"";
  var sec=location.protocol==="https:"?";Secure":"";
  document.cookie=N+"="+id+";Path=/;SameSite=Lax"+dom+sec;
}else{
  var m=document.cookie.match(new RegExp("(?:^|;\\\\s*)"+N+"=([^;]*)"));
  id=m?m[1]:null;
}
if(!ok(id))return;
try{if(sessionStorage.getItem(S)===id)return;}catch(e){}
function did(){var c=document.cookie.match(/(?:^|;\\s*)ph_[^=]+_posthog=([^;]*)/);if(!c)return null;try{var d=JSON.parse(decodeURIComponent(c[1])).distinct_id;return typeof d==="string"&&d?d:null;}catch(e){return null;}}
var n=0;
(function send(){
  var d=did();
  if(!d){if(++n<40)setTimeout(send,250);return;}
  fetch("${SUBSCRIBER_LINK_ROUTE}",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({linkId:id,distinctId:d}),keepalive:true,credentials:"omit"}).then(function(r){if(r.ok){try{sessionStorage.setItem(S,id);}catch(e){}}}).catch(function(){});
})();
}catch(e){}})();`;

/** What the gateway says about a link id. Only `valid` carries a subscriber. */
export type SubscriberLinkResolution =
  | { status: "valid"; email: string; name: string | null; listSlug: string | null }
  | { status: "revoked" | "unknown" | "tampered" }
  | { status: "error"; detail: string };

/**
 * Asks the api-service gateway (`GET /v1/subscriber-links/{linkId}`, its PR #1371)
 * who a link id names. Platform key ONLY and no identity header: the gateway
 * refuses 403 any request carrying one, which is what keeps the browser-facing
 * proxies (dashboard `/api/v1`, `/api/anon/v1`) from ever reading an email. The
 * gateway passes the producer's verdict through: 200 valid, 400 tampered, 404
 * unknown, 410 revoked.
 */
export async function resolveSubscriberLink(
  linkId: string,
  cfg: { apiUrl: string; apiKey: string | undefined; fetchImpl?: typeof fetch },
): Promise<SubscriberLinkResolution> {
  if (!cfg.apiKey) return { status: "error", detail: "ADMIN_DISTRIBUTE_API_KEY not set" };
  const f = cfg.fetchImpl ?? fetch;
  const res = await f(`${cfg.apiUrl.replace(/\/$/, "")}/v1/subscriber-links/${encodeURIComponent(linkId)}`, {
    headers: { "X-API-Key": cfg.apiKey, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (res.status === 400) return { status: "tampered" };
  if (res.status === 404) return { status: "unknown" };
  if (res.status === 410) return { status: "revoked" };
  if (!res.ok) return { status: "error", detail: `gateway ${res.status}` };
  const body = (await res.json().catch(() => null)) as {
    status?: unknown;
    subscriber?: { email?: unknown; name?: unknown } | null;
    list?: { slug?: unknown } | null;
  } | null;
  const email = body?.subscriber?.email;
  if (body?.status !== "valid" || typeof email !== "string" || !email.includes("@")) {
    return { status: "error", detail: `unexpected 200 body (status ${String(body?.status)})` };
  }
  const name = body.subscriber?.name;
  const slug = body.list?.slug;
  return {
    status: "valid",
    email,
    name: typeof name === "string" && name.trim() ? name : null,
    listSlug: typeof slug === "string" && slug ? slug : null,
  };
}

/** Sends one capture to PostHog's ingestion endpoint (same host the browser uses). */
export async function capturePosthog(
  payload: unknown,
  cfg: { host: string | undefined; fetchImpl?: typeof fetch },
): Promise<{ ok: boolean; status: number }> {
  if (!cfg.host) return { ok: false, status: 0 };
  const f = cfg.fetchImpl ?? fetch;
  const res = await f(`${cfg.host.replace(/\/$/, "")}/i/v0/e/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(3000),
  });
  return { ok: res.ok, status: res.status };
}

/**
 * The PostHog capture that tells the visitor's person who they are.
 *
 * `$set_once`, never `$set`: a person PostHog already knows by an email (a user who
 * signed up, then clicked a newsletter forwarded by a colleague) keeps theirs.
 * `name` rides only when the producer serves one (null today, no fake value).
 */
export function subscriberPersonPayload(
  apiKey: string,
  distinctId: string,
  r: { email: string; name: string | null; listSlug: string | null },
) {
  const once: Record<string, string> = { email: r.email.trim().toLowerCase() };
  if (r.name && r.name.trim()) once.name = r.name.trim();
  return {
    api_key: apiKey,
    event: "newsletter_link_identified",
    distinct_id: distinctId,
    properties: {
      $set_once: once,
      ...(r.listSlug ? { newsletter_list: r.listSlug } : {}),
      source: "server",
    },
  };
}

export interface SubscriberLinkDeps {
  resolve: (linkId: string) => Promise<SubscriberLinkResolution>;
  capture: (payload: ReturnType<typeof subscriberPersonPayload>) => Promise<{ ok: boolean; status: number }>;
  posthogApiKey: string | undefined;
  log: (msg: string) => void;
}

/** What happened, for the log line and the tests. Never sent to the browser. */
export type SubscriberLinkOutcome =
  | "identified"
  | "revoked"
  | "unknown"
  | "tampered"
  | "bad-request"
  | "resolve-failed"
  | "capture-failed"
  | "not-configured";

/**
 * Resolves one click and identifies the PostHog person. Never throws: a page view
 * is never blocked or failed by this, and every non-identified path logs why (with
 * the opaque id, never an email).
 */
export async function identifySubscriberClick(
  body: unknown,
  deps: SubscriberLinkDeps,
): Promise<SubscriberLinkOutcome> {
  const b = (body && typeof body === "object" ? body : {}) as { linkId?: unknown; distinctId?: unknown };
  const linkId = readSubscriberLinkId(b.linkId);
  const distinctId = readDistinctId(b.distinctId);
  if (!linkId || !distinctId) {
    deps.log(`[subscriber-link] bad request (linkId ${linkId ? "ok" : "invalid"}, distinctId ${distinctId ? "ok" : "invalid"})`);
    return "bad-request";
  }
  if (!deps.posthogApiKey) {
    deps.log(`[subscriber-link] PostHog not configured: link ${linkId} not identified`);
    return "not-configured";
  }
  let r: SubscriberLinkResolution;
  try {
    r = await deps.resolve(linkId);
  } catch (err) {
    r = { status: "error", detail: err instanceof Error ? err.message : String(err) };
  }
  if (r.status === "error") {
    deps.log(`[subscriber-link] resolve failed for link ${linkId}: ${r.detail}`);
    return "resolve-failed";
  }
  if (r.status !== "valid") {
    deps.log(`[subscriber-link] link ${linkId} is ${r.status}: nothing set`);
    return r.status;
  }
  try {
    const res = await deps.capture(subscriberPersonPayload(deps.posthogApiKey, distinctId, r));
    if (!res.ok) {
      deps.log(`[subscriber-link] PostHog ${res.status}: link ${linkId} not identified`);
      return "capture-failed";
    }
  } catch (err) {
    deps.log(`[subscriber-link] PostHog unreachable: link ${linkId} not identified (${err instanceof Error ? err.message : String(err)})`);
    return "capture-failed";
  }
  return "identified";
}
