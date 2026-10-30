/**
 * The Signup Automation page's own comparison cluster (PAGE-SIGNUP-AUTOMATION-1030):
 * `/signup-automation/alternatives` and one `/signup-automation/vs/<slug>` per tool in
 * `signup-tools.ts`. Every figure about a tool is read from its own site, shown with its source
 * link and the day it was read; our column is `OUR_SIGNUP_ROW`.
 *
 * Light, like the AI Agent compare pages (`compare-page.ts` shape: side by side table, their
 * plans with the source, where each wins, choose X if, FAQ + FAQPage JSON-LD). Signature (refs
 * #18, the default.com pricing table): the table's rows dissolve in one by one as it enters
 * (`reveal` with stagger; the HTML is the final state).
 *
 * Alias-free: the unit tests render it directly.
 */
import {
  OUR_SIGNUP_ROW,
  SIGNUP_ALTERNATIVES_PATH,
  SIGNUP_PAGE_PATH,
  SIGNUP_TOOLS,
  signupVsPath,
  type SignupTool,
} from "../signup-tools";
import { SIGN_UP, SITE, breadcrumb, esc, shell, whyLine } from "../v2-shell";
import { signupHead, verifiedLabel } from "./signup-automation";

const LOGO_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";
const logo = (domain: string, size = 40) =>
  `<img src="https://img.logo.dev/${domain}?token=${LOGO_TOKEN}&size=${size * 2}&format=png" alt="" width="${size}" height="${size}">`;

const PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';

const OUR_WINS = [
  "The agent reaches buyers who have never heard of you, by cold email and WhatsApp.",
  "Every visit and every signup gets its next message, until the person pays.",
  "Free for one user, every action at the API price with 0% markup.",
];

const CHOOSE_US = [
  "You want new people signing up, not only friends of your users.",
  "You want every signup followed up until they pay, without building flows.",
];

function bullets(items: readonly string[], tone: "yes" | "no"): string {
  const mark = tone === "yes" ? "✓" : "·";
  return `<ul>${items.map((t) => `<li><i>${mark}</i><span>${esc(t)}</span></li>`).join("")}</ul>`;
}

function faqFor(t: SignupTool): { q: string; a: string }[] {
  return [
    {
      q: `How much does ${t.name} cost?`,
      a: `${t.name} starts at ${t.entryPrice.replace(/^From /, "").replace(/^Free, then from /, "free, then ")}. ${t.prices.map((p) => `${p.plan}: ${p.price}`).join(". ")}. distribute.you is free for one user, and every action is billed at the vendor's API price with 0% markup.`,
    },
    { q: `What does ${t.name} do best?`, a: t.whereTheyWin.join(" ") },
    {
      q: `Can I keep ${t.name} and add distribute.you?`,
      a: `Yes. Keep ${t.name} for what it does well, and let our AI agent bring new buyers to sign up and follow each signup by email or WhatsApp until they pay.`,
    },
  ];
}

function faqList(faq: { q: string; a: string }[]): string {
  return faq
    .map(
      (f, i) => `<div class="faq-item${i === 0 ? " open" : ""}">
        <button class="faq-q" type="button" aria-expanded="${i === 0}">${esc(f.q)}${PLUS}</button>
        <div class="faq-a"><p>${esc(f.a)}</p></div>
      </div>`,
    )
    .join("\n");
}

function row(label: string, ours: string, theirs: string): string {
  return `<tr><th scope="row">${esc(label)}</th><td class="us">${esc(ours)}</td><td>${esc(theirs)}</td></tr>`;
}

export function renderSignupVsPage(t: SignupTool): string {
  const path = signupVsPath(t);
  const verified = verifiedLabel(t.verifiedOn);
  const faq = faqFor(t);
  const others = SIGNUP_TOOLS.filter((x) => x.slug !== t.slug)
    .map((x) => `<a href="${signupVsPath(x)}">distribute.you vs ${esc(x.name)}</a>`)
    .join(" · ");
  const prices = `<table class="roi-table cmp-prices">
    <thead><tr><th>${esc(t.name)} plan</th><th>Price</th><th>What it buys</th></tr></thead>
    <tbody>${t.prices.map((p) => `<tr><td>${esc(p.plan)}</td><td class="roi">${esc(p.price)}</td><td>${esc(p.note)}</td></tr>`).join("")}</tbody>
  </table>
  <p class="cmp-source">Read from <a href="${esc(t.sourceUrl)}" rel="nofollow noopener" target="_blank">${esc(t.sourceUrl.replace(/^https?:\/\//, ""))}</a> on ${verified}. Prices change; the link is the authority.</p>`;

  const body = `<section class="hero cmp-hero">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-inner">
    <span class="eyebrow">Signup automation · Verified ${verified}</span>
    <div class="cmp-logos" aria-hidden="true"><span class="cmp-logo"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="40" height="40"></span><span class="cmp-vs">vs</span><span class="cmp-logo">${logo(t.domain)}</span></div>
    <h1>distribute.you <span class="accent">vs</span> ${esc(t.name)}</h1>
    <p class="hero-sub">${esc(t.name)}: ${esc(t.oneLiner)} distribute.you is the AI signup agent: it invites new buyers by cold email and WhatsApp, then follows every visit and signup until they pay.</p>
    ${whyLine()}
    <div class="cmp-cta"><a class="btn btn-accent btn-lg" href="${SIGN_UP}">Start free</a><a class="btn btn-outline btn-lg" href="#table">See the table</a></div>
  </div>
</section>

<section class="framed tint" id="table">
  <div class="wrap">
    <div class="section-head"><span class="eyebrow">Side by side</span><h2>distribute.you vs ${esc(t.name)}, row by row</h2><p>Our column is the same on every comparison page; theirs is read from their own site.</p></div>
    <div class="cmp-table-wrap">
      <table class="cmp-table">
        <thead><tr><th scope="col">What you are comparing</th><th scope="col" class="us">distribute.you</th><th scope="col">${esc(t.name)}</th></tr></thead>
        <tbody data-motion="reveal" data-motion-stagger>
          ${row("Entry price", OUR_SIGNUP_ROW.entryPrice, t.entryPrice)}
          ${row("Free to start", OUR_SIGNUP_ROW.freeTier, t.freeTier)}
          ${row("Where signups come from", OUR_SIGNUP_ROW.how, t.how)}
          ${row("Who does the work", OUR_SIGNUP_ROW.whoWorks, "You set it up and run it")}
          ${row("What it reads", OUR_SIGNUP_ROW.signals, "The events and flows you set up")}
        </tbody>
      </table>
    </div>
  </div>
</section>

<section class="framed" id="pricing">
  <div class="wrap">
    <div class="section-head"><span class="eyebrow">Pricing</span><h2>${esc(t.name)} pricing, and ours</h2><p>${esc(OUR_SIGNUP_ROW.pricing)}</p></div>
    <div class="cmp-cols">
      <div class="panel rv"><span class="c"></span>${prices}</div>
      <div class="plan rv">
        <span class="plan-tag">distribute.you</span>
        <div class="plan-price">Free<small>for one user</small></div>
        <p class="plan-desc">Every action at the API price, 0% markup. Start with $10. Pause or cancel anytime.</p>
        <a class="btn btn-accent" href="${SIGN_UP}">Start free</a>
        <div class="plan-included">Included in the plan</div>
        <ul><li><i></i>Cold email from our domains, and WhatsApp</li><li><i></i>PostHog, Clerk and Stripe connectors</li><li><i></i>Every signup followed up until they pay</li><li><i></i>Open source under MIT</li></ul>
        <div class="plan-foot">Teams are $9 per user each month.</div>
      </div>
    </div>
  </div>
</section>

<section class="framed tint" id="wins">
  <div class="wrap">
    <div class="section-head"><span class="eyebrow">Where each one wins</span><h2>A tool you run, or an agent that brings the signups</h2></div>
    <div class="fit">
      <div class="fit-card yes rv"><h3>Where distribute.you wins</h3>${bullets(OUR_WINS, "yes")}</div>
      <div class="fit-card no rv"><h3>Where ${esc(t.name)} wins</h3>${bullets(t.whereTheyWin, "no")}</div>
    </div>
    <div class="fit" style="margin-top:20px">
      <div class="fit-card yes rv"><h3>Choose distribute.you if</h3>${bullets(CHOOSE_US, "yes")}</div>
      <div class="fit-card no rv"><h3>Choose ${esc(t.name)} if</h3>${bullets(t.chooseThemIf, "no")}</div>
    </div>
  </div>
</section>

__HOT_LEAD_BAND__

<section class="framed" id="faq">
  <div class="wrap">
    <div class="section-head center rv"><h2>Questions about ${esc(t.name)} and distribute.you</h2></div>
    <div class="faq-list rv">${faqList(faq)}</div>
    <p class="cmp-more rv">More comparisons: ${others} · <a href="${SIGNUP_ALTERNATIVES_PATH}">Signup automation alternatives</a> · <a href="${SIGNUP_PAGE_PATH}">Signup Automation</a></p>
  </div>
</section>`;

  return shell({
    title: `${t.name} alternative: distribute.you vs ${t.name} for signup automation`,
    description: `Looking at ${t.name} alternatives? distribute.you's AI signup agent invites new buyers and follows every signup until they pay, free for one user. Compare prices.`,
    path,
    head: signupHead(),
    bodyClass: "signups",
    body,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      breadcrumb([
        { name: "Signup Automation", path: SIGNUP_PAGE_PATH },
        { name: `distribute.you vs ${t.name}`, path },
      ]),
    ],
  });
}

export function renderSignupAlternativesPage(): string {
  const names = SIGNUP_TOOLS.map((t) => t.name).join(", ");
  const newest = SIGNUP_TOOLS.map((t) => t.verifiedOn).sort().at(-1) ?? "";
  const rows = SIGNUP_TOOLS.map(
    (t) =>
      `<tr><th scope="row"><a href="${signupVsPath(t)}">${logo(t.domain, 20)}${esc(t.name)}</a></th><td>${esc(t.entryPrice)}</td><td>${esc(t.how)}</td><td><a href="${esc(t.sourceUrl)}" rel="nofollow noopener" target="_blank">${esc(t.domain)}</a></td></tr>`,
  ).join("");
  const cards = SIGNUP_TOOLS.map(
    (t) => `<a class="cmp-card rv" href="${signupVsPath(t)}">
    <div class="cmp-card-top">${logo(t.domain, 32)}<div><b>${esc(t.name)} alternative</b><small>${esc(t.entryPrice)}</small></div></div>
    <p>${esc(t.oneLiner)}</p>
  </a>`,
  ).join("");
  const body = `<section class="hero cmp-hero">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-inner">
    <span class="eyebrow">Signup automation alternatives · Verified ${verifiedLabel(newest)}</span>
    <h1>Signup automation alternatives, side by side</h1>
    <p class="hero-sub">The price of each signup and user acquisition tool, and where its signups come from, read from their own sites. Ours is first: an AI agent that invites new buyers and follows each signup until they pay.</p>
    ${whyLine()}
  </div>
</section>
<section class="framed tint">
  <div class="wrap">
    <div class="cmp-table-wrap">
      <table class="cmp-table cmp-alt-table">
        <thead><tr><th scope="col">Tool</th><th scope="col">Entry price</th><th scope="col">Where signups come from</th><th scope="col">Source</th></tr></thead>
        <tbody data-motion="reveal" data-motion-stagger>
          <tr class="us-row"><th scope="row"><a href="${SIGNUP_PAGE_PATH}"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="20" height="20">distribute.you</a></th><td class="us">${esc(OUR_SIGNUP_ROW.entryPrice)}</td><td class="us">${esc(OUR_SIGNUP_ROW.how)}</td><td class="us"><a href="/catalog">Our catalog</a></td></tr>
          ${rows}
        </tbody>
      </table>
    </div>
  </div>
</section>
<section class="framed">
  <div class="wrap"><div class="cmp-grid">${cards}</div></div>
</section>
__HOT_LEAD_BAND__`;
  return shell({
    title: `Signup automation alternatives: ${names} and distribute.you`,
    description: `The best signup automation alternatives: ${names} and distribute.you, with prices read from each tool's own site.`,
    path: SIGNUP_ALTERNATIVES_PATH,
    head: signupHead(),
    bodyClass: "signups",
    body,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Signup automation alternatives",
        url: `${SITE}${SIGNUP_ALTERNATIVES_PATH}`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "distribute.you", url: `${SITE}${SIGNUP_PAGE_PATH}` },
          ...SIGNUP_TOOLS.map((t, i) => ({ "@type": "ListItem", position: i + 2, name: t.name, url: `${SITE}${signupVsPath(t)}` })),
        ],
      },
      breadcrumb([
        { name: "Signup Automation", path: SIGNUP_PAGE_PATH },
        { name: "Alternatives", path: SIGNUP_ALTERNATIVES_PATH },
      ]),
    ],
  });
}
