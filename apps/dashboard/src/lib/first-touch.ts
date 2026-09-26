/**
 * FIRST TOUCH: which channel brought a visitor, recorded once in the browser and
 * handed to client-service when their organisation comes into being.
 *
 * WHY A COOKIE ON `.distribute.you`. The visitor usually arrives on the landing
 * (`distribute.you?utm_source=newsletter`) and signs up on
 * `dashboard.distribute.you`, a different subdomain, often a Clerk redirect and
 * several page views later. The query string does not survive that trip and
 * `document.referrer` on the dashboard says "the landing". A cookie on the
 * registrable domain is the one carrier both hosts read, and the dashboard's
 * SERVER reads it too, which is where the hand-over happens.
 *
 * FIRST TOUCH, NEVER OVERWRITTEN. The script writes the cookie only when there is
 * none. A later visit from a search, a retargeting ad or a second newsletter is
 * not a new acquisition, and moving the credit to it would make every channel
 * that brings people in look worse than the one that happened to be last.
 *
 * "DIRECT" IS AN ANSWER, not an absence: a visitor with no referrer and no tag is
 * recorded as `direct`. A hand-over with NO cookie at all (cookies blocked, a
 * signup older than this) sends `unknown`. Both are distinct from an org nobody
 * ever recorded anything for, which reads as absent at client-service.
 *
 * ONE SCRIPT, TWO APPS. The landing renders the same string
 * (`apps/landing/src/lib/first-touch-script.ts`), pinned byte-equal by a landing
 * test, so both hosts classify a visit the same way.
 *
 * Alias-free on purpose: the shipped script is exercised by real unit tests with
 * `new Function`, and the parser is imported by the landing's parity guard.
 */

export const FIRST_TOUCH_COOKIE = "distribute_first_touch";
export const FIRST_TOUCH_VERSION = 1;

/**
 * The channel vocabulary. A plain string on the wire and at client-service: the
 * set may grow, and a reader that closes it throws the day it does.
 */
export type FirstTouchChannel =
  | "newsletter"
  | "cold_email"
  | "paid_search"
  | "paid_social"
  | "organic_search"
  | "ai_assistant"
  | "social"
  | "email"
  | "partner"
  | "referral"
  | "other"
  | "direct"
  | "unknown";

/** What the dashboard hands to client-service. Every field but `channel` and
 *  `firstSeenAt` is optional: a direct visit carries nothing else. */
export interface FirstTouch {
  channel: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  /** External referrer HOST only (never the path, which can carry a search query). */
  referrer?: string;
  /** The page they landed on, path only. */
  landingPath?: string;
  /** The homepage A/B arm they were shown (`control` / `assistant` / `concierge`). */
  homepageVariant?: string;
  /** The Google Ads click id, when they arrived from an ad (URL param or `_gcl_aw`). */
  gclid?: string;
  /** Partner referral key (`?via=`). */
  referralCode?: string;
  /** When the visit happened, ISO-8601. */
  firstSeenAt: string;
}

/**
 * The capture IIFE, rendered into `<head>` on the landing and the dashboard.
 *
 * ES5 on purpose (it runs before any bundle, in every browser that reaches the
 * page) and wrapped in one `try`: a capture that throws must never break a page,
 * and failing here means the hand-over later says `unknown`, which is true.
 *
 * Cookie keys are short because the cookie rides every request to the domain.
 */
export const FIRST_TOUCH_CAPTURE_SCRIPT = `(function(){try{
var N="${FIRST_TOUCH_COOKIE}";
if(new RegExp("(?:^|;\\\\s*)"+N+"=").test(document.cookie))return;
var q=new URLSearchParams(location.search);
function g(k,m){var v=(q.get(k)||"").trim();return v?v.slice(0,m||100):"";}
function ck(k){var m=document.cookie.match(new RegExp("(?:^|;\\\\s*)"+k+"=([^;]*)"));return m?decodeURIComponent(m[1]):"";}
var src=g("utm_source").toLowerCase(),med=g("utm_medium").toLowerCase();
var ref="";try{if(document.referrer){var h=new URL(document.referrer).hostname.toLowerCase();if(h&&!/(^|\\.)distribute\\.you$/.test(h)&&h!==location.hostname)ref=h.slice(0,100);}}catch(e){}
var aw=document.cookie.match(/(?:^|;\\s*)_gcl_aw=GCL\\.\\d+\\.([A-Za-z0-9_-]+)/);
var gc=g("gclid",200)||g("gbraid",200)||g("wbraid",200)||(aw?aw[1].slice(0,200):"");
var via=g("via",60);
function any(s,list){for(var i=0;i<list.length;i++){if(s.indexOf(list[i])>=0)return true;}return false;}
var AI=["chatgpt","openai","perplexity","claude.ai","anthropic","gemini","copilot","you.com","phind","mistral","deepseek","grok"];
var SE=["google","bing","duckduckgo","yahoo","ecosia","yandex","baidu","brave","qwant","startpage","naver"];
var SO=["t.co","twitter","x.com","linkedin","lnkd.in","facebook","fb.me","instagram","reddit","ycombinator","youtube","tiktok","threads","bsky","producthunt","indiehackers"];
var ML=["mail.google","outlook","mail.yahoo","mail.proton"];
var ch="direct";
if(src||med){
  if(/newsletter/.test(src)||/newsletter/.test(med))ch="newsletter";
  else if(/cold.?email|outbound|instantly/.test(src)||/cold.?email|outbound/.test(med))ch="cold_email";
  else if(gc||/^(cpc|ppc|paid.?search|sem)$/.test(med))ch="paid_search";
  else if(/^(paid.?social|social.?paid|cpm)$/.test(med))ch="paid_social";
  else if(any(src,AI))ch="ai_assistant";
  else if(med==="email")ch="email";
  else if(any(src,SO)||med==="social")ch="social";
  else if(any(src,SE))ch="organic_search";
  else if(med==="referral"||med==="partner"||med==="affiliate")ch="referral";
  else ch="other";
}
else if(gc)ch="paid_search";
else if(via)ch="partner";
else if(ref){
  if(any(ref,AI))ch="ai_assistant";
  else if(any(ref,ML))ch="email";
  else if(any(ref,SE))ch="organic_search";
  else if(any(ref,SO))ch="social";
  else ch="referral";
}
var t={v:${FIRST_TOUCH_VERSION},ch:ch,at:new Date().toISOString(),lp:location.pathname.slice(0,120)};
if(src)t.src=src;if(med)t.med=med;
var c=g("utm_campaign");if(c)t.cmp=c;var ct=g("utm_content");if(ct)t.cnt=ct;var tm=g("utm_term");if(tm)t.trm=tm;
if(ref)t.ref=ref;if(gc)t.gc=gc;if(via)t.via=via;
var lv=ck("lp_variant");if(/^[a-z]{1,20}$/.test(lv))t.var=lv;
var dom=/(^|\\.)distribute\\.you$/.test(location.hostname)?";Domain=.distribute.you":"";
var sec=location.protocol==="https:"?";Secure":"";
document.cookie=N+"="+encodeURIComponent(JSON.stringify(t))+";Path=/;Max-Age=31536000;SameSite=Lax"+dom+sec;
}catch(e){}})();`;

const MAX_FIELD = 200;

function str(v: unknown, max = MAX_FIELD): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
}

/**
 * Read the cookie from a `Cookie` header (server side). The cookie is NOT
 * httpOnly, so it is user-writable input: every field is re-validated and
 * bounded, and anything unreadable returns null, which the caller hands over as
 * `unknown` rather than guessing.
 */
export function firstTouchFromCookieHeader(cookieHeader: string | null | undefined): FirstTouch | null {
  if (!cookieHeader) return null;
  const m = new RegExp(`(?:^|;\\s*)${FIRST_TOUCH_COOKIE}=([^;]*)`).exec(cookieHeader);
  if (!m) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(decodeURIComponent(m[1]));
  } catch {
    console.error("[first-touch] unreadable cookie");
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const channel = str(r.ch, 40);
  const firstSeenAt = str(r.at, 40);
  if (!channel || !/^[a-z_]+$/.test(channel) || !firstSeenAt || Number.isNaN(Date.parse(firstSeenAt))) {
    console.error("[first-touch] cookie missing channel or time");
    return null;
  }
  const touch: FirstTouch = { channel, firstSeenAt };
  const set = <K extends keyof FirstTouch>(k: K, v: FirstTouch[K] | undefined) => {
    if (v !== undefined) touch[k] = v;
  };
  set("utmSource", str(r.src));
  set("utmMedium", str(r.med));
  set("utmCampaign", str(r.cmp));
  set("utmContent", str(r.cnt));
  set("utmTerm", str(r.trm));
  set("referrer", str(r.ref));
  set("landingPath", str(r.lp));
  set("homepageVariant", str(r.var, 20));
  set("referralCode", str(r.via, 60));
  const gclid = str(r.gc);
  if (gclid && /^[A-Za-z0-9_-]+$/.test(gclid)) touch.gclid = gclid;
  return touch;
}

/**
 * What to hand over for a request: the recorded touch, or an explicit `unknown`
 * stamped now when there is none. Never null, so "we looked and found nothing"
 * reaches client-service as a statement rather than as a missing row.
 */
export function firstTouchForHandover(cookieHeader: string | null | undefined, now = new Date()): FirstTouch {
  return firstTouchFromCookieHeader(cookieHeader) ?? { channel: "unknown", firstSeenAt: now.toISOString() };
}
