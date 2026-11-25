/**
 * The lab's offer (owner 2026-11-25), stated on every page of `lab-distry`:
 *
 * - Self-served: $99/month, 3-day free trial.
 * - Managed: from $499/month, our team runs it, 100% money back on fixed outcome prices
 *   (interested lead, meeting booked, signup, website visit).
 *
 * The live site still states the offer in force in production (usage based, 0% markup,
 * $10 prepaid, open source plan). The lab serves the LIVE pages through the Distry skin,
 * so `withLabOffer` rewrites those claims on the way: whole blocks where a page builds a
 * section around the old offer (the plan cards, the "at the API price" section), then
 * the sentences the page builders share, then the short phrases left inside other
 * sentences. Nothing here is reachable from `staticResponse`: production is untouched.
 *
 * `withLabHome` is the same idea for the lab's own home (`prototypes/distry`): the
 * client cards state meetings booked only, and the two brand-proof sections join the
 * page's day band.
 *
 * Alias-free: unit-tested directly.
 */

export const LAB_SIGN_UP = "https://dashboard.distribute.you/get-started";
/** The site's "Book a call" link (`BOOK_A_CALL` in `site-chrome.ts`; a test pins them equal). */
export const LAB_BOOK_A_CALL = "https://calendar.app.google/BkmyoA7ujMFFDg1s9";

/** What a visitor must never read on the lab: the claims of the offer it replaces. */
export const OLD_OFFER: readonly RegExp[] = [
  /\$1K\/month \+ 10% of budget/,
  /usage[- ]based/i,
  /\b0% ?(?:additional fee|markup)/i,
  /\b(?:no|zero) markup\b/i,
  /\$0\.000 markup/i,
  /\bAPI prices?\b/i,
  /vendor(?:'s)? (?:API |list |public )?price with/i,
  /\bstart(?:s)? with (?:a )?\$10\b/i,
  /\bfirst \$10\b/i,
  /\$10 top-up/i,
  /\bauto(?:matic)?[- ]reload/i,
  /\bprepaid\b/i,
  /\bfree on your server\b/i,
  /\bopen source version\b/i,
  /\bopen source too\b/i,
];

const A = "(?:'|&#39;|&apos;|’)";
const SELF_SENTENCE = "Self-served is $99/month with a 3-day free trial.";
const MANAGED_SENTENCE = "Managed starts at $499/month, with 100% money back on fixed outcome prices.";

/** The two plan cards, in the live site's own card markup. */
export const LAB_PLANS = `<div class="plans">
      <article class="plan rv">
        <span class="plan-tag"><i></i>Self-served</span>
        <div class="plan-price">$99/month<small>3-day free trial</small></div>
        <p class="plan-desc">You run the agent.</p>
        <a class="btn btn-accent btn-lg" href="${LAB_SIGN_UP}">Start free trial</a>
        <div class="plan-included">What's included</div>
        <ul>
          <li><i></i>Every feature of the agent</li>
          <li><i></i>Outreach from our own warmed domains</li>
          <li><i></i>Replies answered until the meeting is booked</li>
          <li><i></i>Your dashboard, every report and your data export</li>
        </ul>
      </article>
      <article class="plan featured rv">
        <span class="plan-tag"><i></i>Managed</span>
        <div class="plan-price">From $499/month<small>100% money back</small></div>
        <p class="plan-desc">Our team runs it for you.</p>
        <a class="btn btn-accent btn-lg" href="${LAB_BOOK_A_CALL}" target="_blank" rel="noopener">Book a call</a>
        <div class="plan-included">What's included</div>
        <ul>
          <li><i></i>Everything in Self-served</li>
          <li><i></i>Our team runs every campaign</li>
          <li><i></i>A fixed price per interested lead, meeting booked, signup and website visit</li>
          <li><i></i>100% money back on every fixed outcome price</li>
        </ul>
      </article>
    </div>`;

type Rule = readonly [RegExp, string | ((...m: string[]) => string)];

/** Whole blocks a page builds around the old offer. */
const BLOCKS: readonly Rule[] = [
  // The Open source / Hosted pair of plan cards.
  [
    /<div class="plans">\s*(?:<article class="plan[\s\S]*?<\/article>\s*)+<\/div>/g,
    (block) => (block.includes("<i></i>Open source</span>") && block.includes("<i></i>Hosted</span>") ? LAB_PLANS : block),
  ],
  // The heading over them.
  [
    /(<section[^>]*id="pricing"[^>]*>\s*<div class="wrap">\s*<div class="section-head[^"]*">\s*<span class="eyebrow">Pricing<\/span>\s*<h2>)[^<]*(<\/h2>\s*<p>)[^<]*(<\/p>)/g,
    (_m, a, b, c) => `${a}More pipeline for your sales team.${b}Start on your own, or let our team run it. Pause or cancel anytime.${c}`,
  ],
  // The two notes beside the live price list.
  [
    /<h3>Your own key always wins<\/h3>\s*<p>Run the open source version[^<]*<\/p>/g,
    "<h3>Start with a free trial</h3>\n        <p>Self-served opens with a 3-day free trial. Your first outreach leaves the same day.</p>",
  ],
  [
    new RegExp(`<h3 class="byok-2">Your balance is the cap<\\/h3>\\s*<p>Hosted accounts run on a prepaid balance\\.[^<]*<\\/p>`, "g"),
    '<h3 class="byok-2">Managed, with a guarantee</h3>\n        <p>Managed sets a fixed price per outcome, with 100% money back.</p>',
  ],
  // The stat chips of an agent page's band.
  [/<li><b>0%<\/b><span>markup on [^<]*<\/span><\/li>/g, "<li><b>$99</b><span>a month, 3-day free trial</span></li>"],
  [/<li><b>MIT<\/b><span>open source, run it yourself<\/span><\/li>/g, "<li><b>100%</b><span>money back on Managed outcome prices</span></li>"],
  // Our single plan card beside a competitor's plans.
  [/<div class="plan-price">Usage based<small>0% markup<\/small><\/div>/g, '<div class="plan-price">$99/month<small>3-day free trial</small></div>'],
  [/<li><i><\/i>Open source under MIT<\/li>/g, "<li><i></i>Managed: from $499/month, 100% money back</li>"],
  // The live price list's rows (`actionPricesHtml`), filled by the route after the builder.
  [/<small>API price, 0% markup<\/small>/g, "<small>unit price</small>"],
  // The footer's link to a section the lab home no longer has.
  [/<li><a href="\/#open-source">Open source<\/a><\/li>/g, ""],
  // The structured-data offer: the plan's price, never the old first top-up.
  [/"price":\s*10,(\s*"priceCurrency":\s*"USD",\s*"description":\s*")[^"]*"/g, (_m, mid) => `"price":99,${mid}$99/month, 3-day free trial."`],
];

/** Sentences the page builders share, whole. */
const SENTENCES: readonly Rule[] = [
  [/Usage based · 0% markup/g, "$99/month · 3-day free trial"],
  [
    new RegExp(`Usage based\\. Every \\w+ at the vendor${A}s API price, 0% markup, from a prepaid balance\\. Start with \\$10, cancel anytime\\.`, "g"),
    "Self-served is $99/month after a 3-day free trial. Managed starts at $499/month. Cancel anytime.",
  ],
  [/Every \w+ at the API price, 0% markup\. Start with \$10\. Pause or cancel anytime\./g, "Self-served is $99/month. Pause or cancel anytime."],
  [/Free, and open source\. You pay only for the actions, at the API price, and your campaign starts sending on day one\./g, "A 3-day free trial. Your campaign starts sending on day one."],
  [/None\. Pause or cancel anytime; your credit is a hard cap\./g, "None. Pause or cancel anytime."],
  [/Paste your website, start with \$10\. Open source too\./g, "Paste your website. Start a 3-day free trial."],
  [/Start with \$10\. Open source too\./g, "Start a 3-day free trial."],
  [/API price, nothing added/g, "One plan at $99/month"],
  [/(<h2>Every [^<]*?),? at the API price\.(<\/h2>)/g, (_m, a, b) => `${a}, in one plan.${b}`],
  [/You pay what the vendor charges, with 0% markup\./g, "Self-served gives you every tool for $99/month."],
  // The price answer of every FAQ, on the page and in its structured data.
  [
    /(?:With us, p|P)ricing is usage based\. [^<"]*?start with \$10\.(?: Every price is on our (?:<a href=\\?"\/catalog\\?">)?catalog(?:<\/a>)?\.)?/g,
    `${SELF_SENTENCE} ${MANAGED_SENTENCE}`,
  ],
  [/or let us host it, usage based with 0% markup\./g, "or start Self-served at $99/month with a 3-day free trial."],
  [/Same agent, same API prices\./g, "One plan at $99/month."],
  [/Open source, usage based, 0% markup\./g, "$99/month, 3-day free trial."],
  [/Our AI agent runs it for you at the API price\./g, "Our AI agent runs it for you from $99/month."],
  [
    new RegExp(
      `The AI agent is usage based\\. Each action is billed at the vendor${A}s API price with 0% markup, read live on the <a href="/catalog">catalog</a>\\. You start with a \\$10 top-up, and automatic reload keeps the balance going\\. You choose how much goes to your outreach, and you can pause or cancel anytime\\.`,
      "g",
    ),
    `${SELF_SENTENCE} ${MANAGED_SENTENCE} You can pause or cancel anytime.`,
  ],
  // /catalog: the unit prices stay, the price model is the plan.
  [new RegExp(`Every tool our AI agent uses, at the vendor${A}s API price with 0% markup\\.`, "g"), "Every tool our AI agent uses, with its live unit price."],
  [new RegExp(`Every tool behind your emails, at the vendor${A}s API price with 0% markup\\.`, "g"), "Every tool behind your emails, with its live unit price."],
  [
    new RegExp(`You pay for each tool by the unit, at the vendor${A}s price with 0% markup\\. The AI agent is usage based, with 0% markup\\.`, "g"),
    "Self-served covers them in one plan at $99/month.",
  ],
  // The "how we compare" rows of the tool catalogues.
  [
    new RegExp(`Usage based\\. [^<".]*? at the vendor${A}s API price, 0% markup, from a prepaid balance you start with \\$10\\.`, "g"),
    "Self-served is $99/month with a 3-day free trial. Managed starts at $499/month.",
  ],
  [/Start with \$10, hosted\. Open source under MIT, free to run yourself\./g, "A 3-day free trial."],
  [/Usage based, 0% markup: what you spend covers the list, the emails and the sending, at the API price\./g, "Self-served is $99/month with a 3-day free trial."],
  [/No\. You start with a \$10 balance and can pause or cancel anytime\./g, "No. You can pause or cancel anytime."],
  [
    new RegExp(`No\\. The AI agent is usage based, with 0% markup\\. You pay each action at the vendor${A}s API price, from a prepaid balance you can pause anytime\\.`, "g"),
    "No. Self-served is one plan at $99/month, and you can pause anytime.",
  ],
  [new RegExp(`You want to pay the vendor${A}s API price for each action, nothing added\\.`, "g"), "You want one plan at $99/month."],
  [new RegExp(`You want every action at the vendor${A}s API price, with the code open source\\.`, "g"), "You want one plan at $99/month with a 3-day free trial."],
  [new RegExp(`You want to pay the vendor${A}s price for each lead, nothing added\\.`, "g"), "You want one plan at $99/month."],
  [new RegExp(`, and you pay Apollo${A}s own price per credit, shown live on our`, "g"), ", and its unit price is shown live on our"],
  [/You would rather pay each action at the API price than a seat\./g, "You want one plan at $99/month."],
  [/You want to start with \$10 and pay as you go\./g, "You want to start with a 3-day free trial."],
  [/You need a tool that stays: start with \$10, pay as you go\./g, "You need a tool that stays: $99/month after a 3-day free trial."],
  [new RegExp(`Every (?:action|message) at the vendor${A}s API price, 0% markup`, "g"), "Included in your plan"],
  [/Each action, at the API price, 0% markup/g, "Included in your plan"],
  [new RegExp(`Each lead found, at the vendor${A}s API price`, "g"), "Each lead found, included in your plan"],
  [
    /Run the open source version on your own server with your own keys\. Your [^<.]* stay in your own database\./g,
    "Every account comes with its dashboard, every report and a full data export.",
  ],
  [/Run the open source version with your own [^<.]*keys\. Each vendor bills you directly(?:, and we see nothing)?\./g, "Self-served opens with a 3-day free trial."],
  [/Hosted accounts run on a prepaid balance\. Auto reload adds at least \$10 when the balance reaches \$0\./g, "Managed sets a fixed price per outcome, with 100% money back."],
  [/A daily budget is a hard cap\. Your prepaid balance is the ceiling\./g, "A daily budget is a hard cap."],
  [/The same agent runs them all, on one balance\./g, "Every channel runs from one account."],
];

/** What is left inside other sentences, most specific first. */
const PHRASES: readonly Rule[] = [
  // The Agency price: on the lab, Managed starts at $499/month (owner 2026-11-25).
  [/,? from \$1K\/month \+ 10% of budget/g, ", from $499/month"],
  [/From \$1K\/month \+ 10% of budget/g, "From $499/month, 100% money back"],
  [new RegExp(`usage based: (?:every|each) [^.<"]*?(?:is |are )?(?:billed )?at the (?:vendor${A}s )?API price with 0% markup`, "g"), "$99/month with a 3-day free trial"],
  [/usage based, (?:with )?every (?:action|message) (?:is )?at the API price (?:with|and) 0% markup/g, "$99/month with a 3-day free trial"],
  [/usage based, at the API price with 0% markup/g, "$99/month with a 3-day free trial"],
  [/[Uu]sage based, every (?:action|message) at the API price(?: with 0% markup)?/g, "$99/month, 3-day free trial"],
  [/[Uu]sage based with 0% markup/g, "$99/month with a 3-day free trial"],
  [/[Uu]sage based, 0% markup(?:\. Every action at the API price\. Start with \$10\.)?/g, "$99/month, 3-day free trial"],
  [/,? at the API price with 0% markup/g, ", from $99/month"],
  [/Usage based\. Every \w+(?: \w+)? at the API price, 0% markup/g, "$99/month, 3-day free trial"],
  [/Usage based, pause anytime/g, "$99/month, pause anytime"],
  [/Usage based with no employee minimum/g, "$99/month with no employee minimum"],
  [/a usage based AI agent/g, "an AI agent at $99/month"],
  [/usage based: every dollar you choose goes to your campaign/g, "$99/month with a 3-day free trial"],
  [/is usage based: you choose/g, "is $99/month, and you choose"],
  [/Each lookup at the API price/g, "Included in your plan"],
  [new RegExp(`, each at the vendor${A}s API price\\.`, "g"), ", all in one plan."],
  [/Your budget reaches buyers\. Pricing is usage based\./g, "Your budget reaches buyers. Self-served is $99/month."],
  [/, usage based\b/g, ", from $99/month"],
  [/\bis usage based\b/g, "is $99/month"],
  [/, no markup<\/span>/g, "</span>"],
  [/, 0% markup\b/g, ""],
  [/\. 0% markup\./g, "."],
];

function applyRules(html: string, rules: readonly Rule[]): string {
  let out = html;
  for (const [pattern, replacement] of rules) {
    out = typeof replacement === "string" ? out.replace(pattern, () => replacement) : out.replace(pattern, replacement as (...m: string[]) => string);
  }
  return out;
}

/** A live page, restated in the lab's offer. A page stating none of the old offer comes back unchanged. */
export function withLabOffer(html: string): string {
  return applyRules(applyRules(applyRules(html, BLOCKS), SENTENCES), PHRASES);
}

/** What a reader sees: scripts (structured data kept) and styles dropped, tags stripped, entities read. */
export function readableText(html: string): string {
  return html
    .replace(/<script\b(?![^>]*ld\+json)[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#39;|&apos;|’/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

/** Every old-offer claim still readable in a page, each with a little of its sentence. */
export function oldOfferClaims(html: string): string[] {
  const text = readableText(html);
  const found: string[] = [];
  for (const pattern of OLD_OFFER) {
    for (const m of text.matchAll(new RegExp(pattern.source, "gi"))) {
      found.push(text.slice(Math.max(0, m.index - 60), m.index + m[0].length + 60).trim());
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// The lab home
// ---------------------------------------------------------------------------

const SHOW_CARD = /\s*<a class="show-card" href="[^"]*" data-live data-brand="([^"]+)"[^>]*>[\s\S]*?<\/a>/g;
const STEP_CELL = /\s*<span class="sf" data-step="([^"]+)"([^>]*)>\s*<b[^>]*>([^<]*)<\/b>[\s\S]*?<\/span>/g;

/**
 * The client cards state ONE figure: meetings booked (owner 2026-11-25). The shared
 * renderer draws two cells per client (`HERO_STEPS`), so the lab drops every other cell
 * after it. A client with no meeting booked would be a card with nothing on it, or a bare
 * zero: that card is not shown.
 */
export function meetingsOnlyShowcase(html: string): string {
  return html.replace(SHOW_CARD, (card, domain: string) => {
    let meetings: number | null = null;
    const kept = card.replace(STEP_CELL, (cell, step: string, attrs: string, figure: string) => {
      if (step !== "meeting_booked") return "";
      meetings = /\bdata-zero\b/.test(attrs) ? 0 : Number(figure.replace(/[^\d]/g, ""));
      return cell.replace(/data-n="\d+"/, 'data-n="0"');
    });
    if (!meetings || !Number.isFinite(meetings)) {
      console.warn(`[landing] lab client card dropped: ${domain} has no meeting booked to state`);
      return "";
    }
    return kept.replace(/data-steps="[^"]*"/, `data-steps="${meetings}"`).replace(/href="#proof"/, 'href="#pricing"');
  });
}

/** The four outlets the lab names, in this order, still (owner 2026-11-25: « arrête le défilement, que 4, les plus prestigieux »). */
export const LAB_PRESS = ["COO Insider", "CMO Times", "TechBullion", "Grit Daily News"] as const;

/** The served press band cut to `LAB_PRESS`, one still line: the marquee's copy and every other outlet leave. */
export function stillPress(html: string): string {
  return html.replace(/<div class="press-marquee"><ul class="press-track" data-brand-proof="press">([\s\S]*?)<\/ul><\/div>/, (_all, items: string) => {
    const byName = new Map<string, string>();
    for (const li of items.match(/<li>[\s\S]*?<\/li>/g) ?? []) {
      const name = /<span title="([^"]*)"/.exec(li)?.[1];
      if (name && !byName.has(name)) byName.set(name, li);
    }
    const kept = LAB_PRESS.map((name) => {
      const li = byName.get(name);
      if (!li) console.error(`[landing] lab press outlet not served: ${name}`);
      return li ?? "";
    }).join("");
    return `<div class="press-still"><ul class="press-track" data-brand-proof="press">${kept}</ul></div>`;
  });
}

/** The wall and the press band are rendered in the live site's markup: they join the lab home's day band. */
export function dressBrandProof(html: string): string {
  return stillPress(html)
    .replace('<section class="framed" id="clients">', '<section class="framed day" id="clients" data-sky="1" data-say="My clients come from great places.">')
    .replace('<section class="framed" id="featured">', '<section class="framed day" id="featured" data-sky="1" data-say="The press wrote about us.">')
    .replace("<h3>As featured in</h3>", "<h3>Featured in</h3>");
}

/** The lab home, after its live figures are in. */
export function withLabHome(html: string): string {
  return dressBrandProof(meetingsOnlyShowcase(html));
}
