/**
 * One Telegram message per human visit that reached onboarding, sent once the
 * visit is over (owner 2026-10-03: the old "someone opened onboarding" ping told
 * him nothing). The message reads at a glance: country flag, how long, how far
 * they got (landing, onboarding, signup, payment, dashboard), time on each stage
 * and the buttons/links they clicked there. No URL, no id.
 *
 * This module is the pure half (alias-free, unit tested): PostHog events in,
 * message text out. `visit-recap-job.ts` fetches the events and sends.
 */

export interface VisitEvent {
  timestamp: string;
  event: string;
  host: string | null;
  pathname: string | null;
  currentUrl: string | null;
  elText: string | null;
  title: string | null;
  country: string | null;
  referringDomain: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmTerm: string | null;
  gclid: string | null;
  /** The website the visitor typed: `domain` (v1 onboarding) or `website` (v2). */
  website: string | null;
  /** The signed-up person (PostHog person properties, set by `posthog.identify`). */
  email: string | null;
  personName: string | null;
  /** The credit amount a `get_started_topup_opened` event opened the card form for. */
  topupUsd: number | null;
}

/**
 * Who the company behind a visit is (owner 2026-10-04), as apollo-service serves
 * it for the visit's domain. Every field is independently unknown.
 */
export interface Firmographics {
  /** ISO-2 code of the headquarters country. */
  hqCountry: string | null;
  industry: string | null;
  employeeRange: string | null;
  revenueRange: string | null;
  /** B2B SaaS | B2B Agency | B2C | Other. */
  category: string | null;
  /** The signed-up person's role at the company, only when matched. */
  role: string | null;
}

export interface VisitPerson {
  domain: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

export const STAGES = ["Landing", "Onboarding", "Signup", "Payment", "Dashboard"] as const;
export type Stage = (typeof STAGES)[number];

const LANDING_HOST = "distribute.you";
const ONBOARDING_PATHS = new Set(["/get-started", "/onboarding"]);
const SIGNUP_EVENT = /^(get_started_)?sign(up|in)_/;
const SIGNUP_DONE = new Set([
  "signup_completed",
  "signin_completed",
  "signin_email_completed",
  "signup_email_verified",
  "get_started_signup_verified",
]);
const PAYMENT_DONE = new Set(["get_started_card_saved", "get_started_launched"]);
// The card form opened for a top-up (Revolut pays inside the page, no return URL):
// the visitor reached payment, which is not having paid.
const CHECKOUT_OPENED = "get_started_topup_opened";

function queryParam(url: string | null, key: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).searchParams.get(key);
  } catch {
    return null;
  }
}

/** Back from Stripe: `launch_checkout=success|cancelled` (onboarding) or `success=true` (billing). */
function stripeReturn(e: VisitEvent): "paid" | "cancelled" | null {
  if (e.event !== "$pageview") return null;
  const launch = queryParam(e.currentUrl, "launch_checkout");
  if (launch === "success" || queryParam(e.currentUrl, "success") === "true") return "paid";
  if (launch) return "cancelled";
  return null;
}

/** Which stage an event belongs to. */
export function stageOf(e: VisitEvent): Stage {
  if (e.host === LANDING_HOST || e.host === `www.${LANDING_HOST}`) return "Landing";
  if (PAYMENT_DONE.has(e.event) || e.event === CHECKOUT_OPENED || stripeReturn(e)) return "Payment";
  const path = e.pathname ?? "";
  if (path.startsWith("/sign-in") || path.startsWith("/sign-up") || SIGNUP_EVENT.test(e.event)) return "Signup";
  if (ONBOARDING_PATHS.has(path)) return "Onboarding";
  return "Dashboard";
}

const COUNTRY_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

/** 🇫🇷 France, from a two-letter code. */
export function countryLabel(code: string | null): string {
  const cc = code?.trim().toUpperCase();
  if (!cc || !/^[A-Z]{2}$/.test(cc) || cc === "XX") return "🌍 Unknown country";
  const flag = String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
  let name = cc;
  try {
    name = COUNTRY_NAMES.of(cc) ?? cc;
  } catch {
    // An unassigned code: keep the letters.
  }
  return `${flag} ${name}`;
}

/** "45 s", "3 min 20", "1 h 05". */
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) {
    const rest = s % 60;
    return rest ? `${m} min ${String(rest).padStart(2, "0")}` : `${m} min`;
  }
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}

const AI = /chatgpt|openai|perplexity|claude\.ai|gemini|copilot|grok|deepseek|you\.com|phind|mistral/;
const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|brave|qwant)\./;

function pageLabel(e: VisitEvent): string {
  if (!e.pathname || e.pathname === "/") return "the homepage";
  const stage = stageOf(e);
  if (stage === "Onboarding") return "onboarding";
  if (stage === "Signup") return "the sign-in page";
  if (stage === "Payment") return "the payment step";
  if (stage !== "Landing") return "the dashboard";
  const title = e.title?.replace(/\s*[|·-]\s*distribute\.you.*$/i, "").trim();
  if (!title) return e.pathname;
  return `"${title.length > 60 ? `${title.slice(0, 59)}…` : title}"`;
}

/** Where the visit came from, in words, from its first page view. */
export function sourceLine(first: VisitEvent): string {
  const utm = (first.utmSource ?? "").toLowerCase();
  const medium = (first.utmMedium ?? "").toLowerCase();
  const ref = (first.referringDomain ?? "").toLowerCase().replace(/^\$direct$/, "");
  const landed = `landed on ${pageLabel(first)}`;
  const term = first.utmTerm?.trim();

  if (first.gclid || ref.includes("googleadservices") || ref.includes("syndicatedsearch") || (utm === "google" && /cpc|ppc|paid/.test(medium))) {
    return `Came from Google Ads${term ? ` ("${term}")` : ""}, ${landed}`;
  }
  if (AI.test(utm) || AI.test(ref)) return `Came from an AI assistant (${ref || utm}), ${landed}`;
  if (utm) {
    if (utm.includes("newsletter") || utm.includes("postmark")) return `Came from our newsletter, ${landed}`;
    if (utm.includes("cold") || utm.includes("instantly") || utm.includes("outbound")) return `Came from a cold email, ${landed}`;
    if (utm.includes("linkedin")) return `Came from LinkedIn, ${landed}`;
    if (utm === "x" || utm === "twitter" || utm === "t.co") return `Came from X, ${landed}`;
    return `Came from ${first.utmSource}${term ? ` ("${term}")` : ""}, ${landed}`;
  }
  if (!ref || ref.endsWith(LANDING_HOST)) return `Came direct, ${landed}`;
  if (SEARCH.test(`.${ref}`)) {
    const engine = ref.replace(/^www\./, "").split(".")[0];
    return `Came from ${engine[0].toUpperCase()}${engine.slice(1)} search, ${landed}`;
  }
  if (ref.includes("linkedin") || ref.includes("lnkd")) return `Came from LinkedIn, ${landed}`;
  if (ref === "t.co" || ref === "x.com" || ref === "twitter.com") return `Came from X, ${landed}`;
  if (ref.includes("checkout.stripe.com")) return `Came back from Stripe, ${landed}`;
  return `Came from ${ref.replace(/^www\./, "")}, ${landed}`;
}

const EMAIL = /\S+@\S+\.\S+/;
const MAX_CLICKS_PER_STAGE = 8;

function cleanClick(text: string | null): string | null {
  const t = text?.replace(/\s+/g, " ").trim();
  if (!t || EMAIL.test(t)) return null;
  return t.length > 40 ? `${t.slice(0, 39)}…` : t;
}

/** `"Start", "Continue" ×5, "See what we built"` (repeats collapsed, capped). */
function clickList(clicks: string[]): string {
  const counted: { text: string; n: number }[] = [];
  for (const c of clicks) {
    const hit = counted.find((x) => x.text === c);
    if (hit) hit.n += 1;
    else counted.push({ text: c, n: 1 });
  }
  const shown = counted.slice(0, MAX_CLICKS_PER_STAGE).map((x) => `"${x.text}"${x.n > 1 ? ` ×${x.n}` : ""}`);
  const more = counted.length - MAX_CLICKS_PER_STAGE;
  return shown.join(", ") + (more > 0 ? ` +${more} more` : "");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/** `acme.com` from what the visitor typed, else from their signed-up email. */
export function companyDomain(website: string | null, email: string | null): string | null {
  const typed = website
    ?.trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0];
  if (typed && DOMAIN.test(typed)) return typed;
  const fromEmail = email?.trim().toLowerCase().split("@")[1];
  return fromEmail && DOMAIN.test(fromEmail) ? fromEmail : null;
}

/** The company domain and the signed-up person behind a visit, if any. */
export function visitPerson(events: VisitEvent[]): VisitPerson | null {
  const website = events.find((e) => e.website)?.website ?? null;
  const person = events.find((e) => e.email);
  const email = person?.email ?? null;
  const domain = companyDomain(website, email);
  if (!domain) return null;
  const [firstName, ...rest] = (person?.personName ?? "").trim().split(/\s+/);
  return { domain, email, firstName: firstName || null, lastName: rest.join(" ") || null };
}

/** Two lines: HQ, category, industry / size, revenue, role. Unknown is said, never guessed. */
export function firmographicLines(f: Firmographics): string[] {
  const or = (v: string | null, unknown: string, suffix = "") => (v ? `${escapeHtml(v)}${suffix}` : unknown);
  return [
    [f.hqCountry ? `HQ ${countryLabel(f.hqCountry)}` : "HQ unknown", or(f.category, "Category unknown"), or(f.industry, "Industry unknown")].join(" · "),
    [or(f.employeeRange, "Size unknown", " employees"), or(f.revenueRange, "Revenue unknown", " revenue"), or(f.role, "Role unknown")].join(" · "),
  ];
}

/** The Telegram message (parse_mode HTML) for one visit, events in time order. */
export function visitRecap(events: VisitEvent[], companyLines: string[] = []): string {
  const sorted = [...events].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const first = sorted.find((e) => e.event === "$pageview") ?? sorted[0];
  const time = new Map<Stage, number>();
  const clicks = new Map<Stage, string[]>();
  const reached = new Set<Stage>();
  let paid = false;
  let signedUp = false;
  let website: string | null = null;

  sorted.forEach((e, i) => {
    const stage = stageOf(e);
    reached.add(stage);
    if (PAYMENT_DONE.has(e.event) || stripeReturn(e) === "paid") paid = true;
    if (SIGNUP_DONE.has(e.event)) signedUp = true;
    website = website ?? e.website;
    const next = sorted[i + 1];
    if (next) {
      // Time spent on Stripe shows up as the gap before the visitor comes back
      // (or before the card is saved): it belongs to Payment, not the page before.
      const gapStage = stageOf(next) === "Payment" && stage !== "Payment" ? "Payment" : stage;
      if (gapStage === "Payment") reached.add("Payment");
      time.set(gapStage, (time.get(gapStage) ?? 0) + Date.parse(next.timestamp) - Date.parse(e.timestamp));
    }
    if (e.event === "$autocapture") {
      const text = cleanClick(e.elText);
      if (text) clicks.set(stage, [...(clicks.get(stage) ?? []), text]);
    }
  });

  const total = Date.parse(sorted[sorted.length - 1].timestamp) - Date.parse(sorted[0].timestamp);
  const furthest = [...STAGES].reverse().find((s) => reached.has(s)) ?? "Landing";
  const opened = sorted.filter((e) => e.event === CHECKOUT_OPENED);
  const checkoutOpened = opened.length > 0;
  const checkoutUsd = opened.map((e) => e.topupUsd).filter((v): v is number => v != null).pop() ?? null;
  const checkout = checkoutUsd != null ? `$${checkoutUsd.toLocaleString("en-US")} checkout` : "checkout";
  const outcome = paid
    ? `<b>Paid${checkoutUsd != null ? ` $${checkoutUsd.toLocaleString("en-US")}` : ""} ✅</b>`
    : furthest === "Dashboard"
      ? "<b>Reached the dashboard</b>"
      : checkoutOpened
        ? `<b>Opened the ${checkout}, did not pay ❌</b>`
        : `<b>Left at ${furthest.toLowerCase()} ❌</b>`;

  const lines = [`${countryLabel(first.country)} · ${formatDuration(total)} · ${outcome}`];
  lines.push(escapeHtml(sourceLine(first)));
  if (website) lines.push(`Typed ${escapeHtml(website)}`);
  lines.push(...companyLines);

  for (const stage of STAGES) {
    if (!reached.has(stage)) continue;
    const label =
      stage === "Signup" && signedUp
        ? "Signup ✓"
        : stage === "Payment" && checkoutOpened
          ? `Payment ${paid ? "✓" : "✗"} · ${checkout} opened`
          : stage;
    lines.push("", `<b>${label}</b> · ${formatDuration(time.get(stage) ?? 0)}`);
    const list = clicks.get(stage);
    if (list?.length) lines.push(escapeHtml(clickList(list)));
  }
  const missed = STAGES.filter((s) => !reached.has(s));
  if (missed.length) lines.push("", `Not reached: ${missed.join(", ").toLowerCase()}`);
  return lines.join("\n");
}
