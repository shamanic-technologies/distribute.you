/**
 * The lab's offer (owner 2026-11-25, LAB-SOLO-PIVOT-1125), stated on every page of `lab-distry`.
 * The buyer is a solo founder; the doors are an AI (MCP / API), WhatsApp or Telegram, and email.
 *
 * - Free: their own keys, sent through the MCP (the agent asks for exactly the keys a
 *   campaign's plan needs), every LLM step on their own Claude subscription if they want.
 * - $99/month, 3-day free trial: $99 of credit on OUR keys, 0% markup, every expense
 *   (payment fees, AI chat) paid from it. More budget = +$100/month layers;
 *   an upgrade restarts the month that day and takes the unspent credit off the price.
 * - Killed (owner: "on supprime tout le reste"): Managed, $499, money back, any Agency
 *   offer, Book a call, the dashboard as a product, the Mac app, Make/n8n/Zapier/Cursor.
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
/** The site's "Book a call" link (`BOOK_A_CALL` in `site-chrome.ts`; a test pins them equal): the lab removes every link to it. */
export const LAB_BOOK_A_CALL = "https://calendar.app.google/BkmyoA7ujMFFDg1s9";
/** Where the lab sends "get started": the visitor's own AI (the integration pages). */
export const LAB_START = "/docs/integrations";
/**
 * The web sign-up walk in the lab's own skin (owner 2026-11-25: keep the web onboarding, its
 * main button first; ONBOARDING-CHANNEL-HANDOFF-1125). The one dashboard address the lab
 * links to: the walk ends by handing the founder to WhatsApp, Telegram or their AI.
 */
export const LAB_WALK = `${LAB_SIGN_UP}?skin=distry`;

/**
 * Articles the lab does not serve: an article whose SUBJECT is the old offer cannot be
 * restated without rewriting what it is about. The lab sends its readers to `/blog`.
 */
export const LAB_HIDDEN_ARTICLES: readonly string[] = ["/blog/ai-gtm"];

/**
 * Pages the lab does not serve, each with everything under it (its `vs/`, `alternatives/`
 * and `best/` pages), answered with the lab home (owner 2026-11-25, LAB-SOLO-PIVOT-1125:
 * « on supprime tout le reste qu'on n'a pas cité »): every Agency page, every automation
 * page a solo founder does not buy (kept: meetings booked `/ai-sdr`, signups, website
 * visits), the Mac app, the archived `/lp` product pages, and the integrations the pivot
 * does not name.
 */
export const LAB_HIDDEN_SECTIONS: readonly string[] = [
  // Agency pages (Agency offer killed).
  "/gtm-agency",
  "/revenue-agency",
  "/lead-generation-agency",
  "/cold-email-agency",
  "/ppc-agency",
  "/appointment-setting-agency",
  "/database-reactivation-agency",
  "/customer-success-agency",
  "/website-traffic-agency",
  "/user-acquisition-agency",
  // Automation pages beyond meetings, signups and website visits.
  "/gtm-automation",
  "/cold-email-automation",
  "/ai-lead-generation",
  "/lead-nurturing-automation",
  "/ai-customer-success",
  "/ai-ad-management",
  // The rankings: each one names distribute.you an agency ("the best lead generation agency is distribute.you").
  "/best",
  // The brand kit page: not linked from the site, and its structured data states the old offer.
  "/brand",
  // Products killed: the Mac app, the /lp product pages (concierge, assistant, instinct).
  "/desktop",
  "/lp",
  // Integrations the pivot does not name (Claude Code is reached through Conductor).
  "/docs/integrations/claude",
  "/docs/integrations/cursor",
  "/docs/integrations/make",
  "/docs/integrations/n8n",
  "/docs/integrations/zapier",
];

/** Every page the lab does not serve, as a list (tests, card removal). */
export const LAB_HIDDEN_PAGES: readonly string[] = [...LAB_HIDDEN_ARTICLES, ...LAB_HIDDEN_SECTIONS];

/**
 * Pages the lab serves with the old offer LEFT IN, on purpose: `/terms` is the contract
 * accounts sign today (prepaid credit, automatic reload). Rewriting it into the lab's offer
 * would put legal terms in front of a reader that no account can get yet.
 */
export const LAB_UNRESTATED_PAGES: readonly string[] = ["/terms"];

/** What a visitor must never read on the lab: the claims of the offer it replaces. */
export const OLD_OFFER: readonly RegExp[] = [
  /\$1K\/month \+ 10% of budget/,
  /usage[- ]based/i,
  /\b0% ?additional fee/i,
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
  // Killed by the solo-founder pivot (owner 2026-11-25): the Managed plan, Book a call, the Agency offer.
  /\bSelf-served\b/,
  /\bManaged (?:starts at|from \$)/,
  /\bfrom \$499\b/i,
  /\b100% money back\b/i,
  /\bBook a call\b/i,
  /\bOur GTM agency\b|\bThe GTM agency is\b/i,
  /\b(?:on|in) your dashboard\b|\b(?:your|the) dashboard (?:shows|is optional)\b/i,
  /\b(?:our|distribute\.you) (?:GTM|PPC|Cold Email|Lead Generation|Appointment Setting|Database Reactivation|Customer Success|Website Traffic|User Acquisition) Agency\b/i,
];

const A = "(?:'|&#39;|&#x27;|&apos;|’)";
const FREE_SENTENCE = "Free with your own keys or your Claude subscription.";
const PAID_SENTENCE = "Or $99/month on our keys at 0% markup, with a 3-day free trial.";
/** The whole offer, in two sentences. */
export const LAB_OFFER = `${FREE_SENTENCE} ${PAID_SENTENCE}`;

/** The two plan cards, in the live site's own card markup. */
export const LAB_PLANS = `<div class="plans">
      <article class="plan rv">
        <span class="plan-tag"><i></i>Free</span>
        <div class="plan-price">$0<small>With your own keys</small></div>
        <p class="plan-desc">Run every campaign on your own accounts.</p>
        <a class="btn btn-accent btn-lg" href="${LAB_START}">Get started from your AI</a>
        <div class="plan-included">What's included</div>
        <ul>
          <li><i></i>Every feature of the agent</li>
          <li><i></i>Distry asks for the keys each campaign needs</li>
          <li><i></i>Every AI step can run on your Claude subscription</li>
          <li><i></i>Each vendor bills you directly</li>
        </ul>
      </article>
      <article class="plan featured rv">
        <span class="plan-tag"><i></i>$99 per month</span>
        <div class="plan-price">3-day free trial<small>Then $99/month</small></div>
        <p class="plan-desc">We hold the keys for you.</p>
        <a class="btn btn-accent btn-lg" href="${LAB_WALK}">Start free trial</a>
        <div class="plan-included">What's included</div>
        <ul>
          <li><i></i>$99 of credit on our keys every month</li>
          <li><i></i>0% markup on every key</li>
          <li><i></i>Payment fees and AI chat paid from the same credit</li>
          <li><i></i>Need more? Add $100 a month at a time</li>
        </ul>
      </article>
    </div>`;

type Rule = readonly [RegExp, string | ((...m: string[]) => string)];

/** Whole blocks a page builds around the old offer. */
const BLOCKS: readonly Rule[] = [
  // The structured-data offer every React page carries (root layout).
  [
    /"price":"10",("priceCurrency":"USD","description":")Usage based\. [^"]*?Start with \$10\. Pause or cancel anytime\."/g,
    (_m, mid) => `"price":"99",${mid}${LAB_OFFER} Pause or cancel anytime."`,
  ],
  // The /investors business model: both arms, as the lab sells them.
  [
    /The business model has two arms\. The(?:<!-- -->)? <strong([^>]*)>AI agent<\/strong> is usage based ?, with every action at the API price, 0% markup, prepaid\. The(?:<!-- -->)? <strong[^>]*>GTM agency<\/strong> is from \$1K a month plus 10% of the budget\./g,
    (_m, attrs) =>
      `The business model has one arm, the <strong${attrs}>AI agent</strong>. ${LAB_OFFER} More budget adds $100 a month at a time.`,
  ],
  // The Open source / Hosted pair of plan cards.
  [
    /<div class="plans">\s*(?:<article class="plan[\s\S]*?<\/article>\s*)+<\/div>/g,
    (block) => (block.includes("<i></i>Open source</span>") && block.includes("<i></i>Hosted</span>") ? LAB_PLANS : block),
  ],
  // The heading over them.
  [
    /(<section[^>]*id="pricing"[^>]*>\s*<div class="wrap">\s*<div class="section-head[^"]*">\s*<span class="eyebrow">Pricing<\/span>\s*<h2>)[^<]*(<\/h2>\s*<p>)[^<]*(<\/p>)/g,
    (_m, a, b, c) => `${a}Start free. Grow when the meetings come.${b}Every key at its vendor price, 0% markup. Pause or cancel anytime.${c}`,
  ],
  // The two notes beside the live price list.
  [
    /<h3>Your own key always wins<\/h3>\s*<p>Run the open source version[^<]*<\/p>/g,
    "<h3>Your own key always wins</h3>\n        <p>Bring your own keys for free. Every AI step can run on your Claude subscription.</p>",
  ],
  [
    new RegExp(`<h3 class="byok-2">Your balance is the cap<\\/h3>\\s*<p>Hosted accounts run on a prepaid balance\\.[^<]*<\\/p>`, "g"),
    '<h3 class="byok-2">Your credit is the cap</h3>\n        <p>When it runs out, your AI, WhatsApp and email reply with a link to add more.</p>',
  ],
  // The stat chips of an agent page's band.
  [/<li><b>0%<\/b><span>markup on [^<]*<\/span><\/li>/g, "<li><b>$99</b><span>a month, 3-day free trial</span></li>"],
  [/<li><b>MIT<\/b><span>open source, run it yourself<\/span><\/li>/g, "<li><b>$0</b><span>with your own keys</span></li>"],
  // Our single plan card beside a competitor's plans.
  [/<div class="plan-price">Usage based<small>0% markup<\/small><\/div>/g, '<div class="plan-price">3-day free trial<small>Then $99/month</small></div>'],
  [/<li><i><\/i>Open source under MIT<\/li>/g, "<li><i></i>Free with your own keys</li>"],
  // The live price list's rows (`actionPricesHtml`), filled by the route after the builder.
  [/<small>API price, 0% markup<\/small>/g, "<small>unit price</small>"],
  // The footer's link to a section the lab home no longer has.
  [/<li><a href="\/#open-source">Open source<\/a><\/li>/g, ""],
  // The structured-data offer: the plan's price, never the old first top-up.
  [/"price":\s*10,(\s*"priceCurrency":\s*"USD",\s*"description":\s*")[^"]*"/g, (_m, mid) => `"price":99,${mid}$0 with your own keys, or $99/month on ours."`],
];

/** Sentences the page builders share, whole. */
const SENTENCES: readonly Rule[] = [
  // The React pages (docs, blog, investors), before any shorter rule takes a piece of them.
  [/Paste your website, confirm what we found, and add your first \$10\./g, "Paste your website, confirm what we found, and start your 3-day free trial."],
  [
    new RegExp(
      `The AI agent is usage based\\. You pay as you go from a prepaid balance, starting with \\$10: each action is billed at the vendor${A}s API price with 0% markup, listed on (?:<a [^>]*>)?https://distribute\\.you/catalog(?:</a>)?, and each campaign`,
      "g",
    ),
    `${LAB_OFFER} Each campaign`,
  ],
  [/Every paid call is prepaid:/g, "Paid calls need an active account:"],
  [new RegExp(`, spent from the organization${A}s prepaid balance at the public per-action prices\\.`, "g"), "."],
  [/Read the prepaid account:/g, "Read the account:"],
  [/Prepaid balance and account settings/g, "Balance and account settings"],
  [/the automatic reload settings and/g, "the reload settings and"],
  [/<li>Every action at the API price, the return of each outcome shown<\/li>/g, "<li>The return of each outcome shown</li>"],
  [/Stripe and Revolut \(usage-based, auto top-up\)/g, "Stripe and Revolut"],
  [/Pricing is usage based\. You only pay for your outreach, prepaid (?:from \$10|at public catalog prices)\./g, "Free with your own keys, or $99/month on ours with a 3-day free trial."],
  [/Usage based, with 0% markup on the API price(, and (?:you can cancel anytime|we send from our own domains)|)/g, (_m, rest) => `Free with your own keys, or $99/month on ours${rest}`],
  [/, with 0% markup on the API price\./g, "."],
  [/Usage-based pricing is easy for vendors/g, "Pricing by usage is easy for vendors"],
  [/Usage based · 0% markup/g, "$99/month · 3-day free trial"],
  [
    new RegExp(`Usage based\\. Every \\w+ at the vendor${A}s API price, 0% markup, from a prepaid balance\\. Start with \\$10, cancel anytime\\.`, "g"),
    "Free with your own keys, or $99/month on ours after a 3-day free trial. Cancel anytime.",
  ],
  [/Every \w+ at the API price, 0% markup\. Start with \$10\. Pause or cancel anytime\./g, "Free with your own keys, or $99/month on ours. Pause or cancel anytime."],
  [/Free, and open source\. You pay only for the actions, at the API price, and your campaign starts sending on day one\./g, "A 3-day free trial. Your campaign starts sending on day one."],
  [/None\. Pause or cancel anytime; your credit is a hard cap\./g, "None. Pause or cancel anytime."],
  [/Paste your website, start with \$10\. Open source too\./g, "Paste your website. Start a 3-day free trial."],
  [/Start with \$10\. Open source too\./g, "Start a 3-day free trial."],
  [/API price, nothing added/g, "One plan at $99/month"],
  [/(<h2>Every [^<]*?),? at the API price\.(<\/h2>)/g, (_m, a, b) => `${a}, in one plan.${b}`],
  [/You pay what the vendor charges, with 0% markup\./g, "Use your own keys for free, or ours for $99/month."],
  // The price answer of every FAQ, on the page and in its structured data.
  [
    /(?:With us, p|P)ricing is usage based\. [^<"]*?start with \$10\.(?: Every price is on our (?:<a href=\\?"\/catalog\\?">)?catalog(?:<\/a>)?\.)?/g,
    `${LAB_OFFER}`,
  ],
  [/or let us host it, usage based with 0% markup\./g, "or use our keys for $99/month with a 3-day free trial."],
  [/Same agent, same API prices\./g, "One plan at $99/month."],
  [/Open source, usage based, 0% markup\./g, "$99/month, 3-day free trial."],
  [/Our AI agent runs it for you at the API price\./g, "Our AI agent runs it for you from $99/month."],
  [
    new RegExp(
      `The AI agent is usage based\\. Each action is billed at the vendor${A}s API price with 0% markup, read live on the <a href="/catalog">catalog</a>\\. You start with a \\$10 top-up, and automatic reload keeps the balance going\\. You choose how much goes to your outreach, and you can pause or cancel anytime\\.`,
      "g",
    ),
    `${LAB_OFFER} You can pause or cancel anytime.`,
  ],
  // /catalog: the unit prices stay, the price model is the plan.
  [new RegExp(`Every tool our AI agent uses, at the vendor${A}s API price with 0% markup\\.`, "g"), "Every tool our AI agent uses, with its live unit price."],
  [new RegExp(`Every tool behind your emails, at the vendor${A}s API price with 0% markup\\.`, "g"), "Every tool behind your emails, with its live unit price."],
  [
    new RegExp(`You pay for each tool by the unit, at the vendor${A}s price with 0% markup\\. The AI agent is usage based, with 0% markup\\.`, "g"),
    "Use your own keys for free, or ours for $99/month.",
  ],
  // The "how we compare" rows of the tool catalogues.
  [
    new RegExp(`Usage based\\. [^<".]*? at the vendor${A}s API price, 0% markup, from a prepaid balance you start with \\$10\\.`, "g"),
    "Free with your own keys, or $99/month on ours with a 3-day free trial.",
  ],
  [/Start with \$10, hosted\. Open source under MIT, free to run yourself\./g, "A 3-day free trial."],
  [/Usage based, 0% markup: what you spend covers the list, the emails and the sending, at the API price\./g, "Free with your own keys, or $99/month on ours with a 3-day free trial."],
  [/No\. You start with a \$10 balance and can pause or cancel anytime\./g, "No. You can pause or cancel anytime."],
  [
    new RegExp(`No\\. The AI agent is usage based, with 0% markup\\. You pay each action at the vendor${A}s API price, from a prepaid balance you can pause anytime\\.`, "g"),
    "No. Use your own keys for free, or ours for $99/month, and pause anytime.",
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
    "Your leads and results are yours to export anytime.",
  ],
  [/Run the open source version with your own [^<.]*keys\. Each vendor bills you directly(?:, and we see nothing)?\./g, "Bring your own keys for free, or start a 3-day free trial on ours."],
  [/Hosted accounts run on a prepaid balance\. Auto reload adds at least \$10 when the balance reaches \$0\./g, "When the credit runs out, Distry replies with a link to add more."],
  [/A daily budget is a hard cap\. Your prepaid balance is the ceiling\./g, "A daily budget is a hard cap."],
  [/The same agent runs them all, on one balance\./g, "Every channel runs from one account."],
];

/** What is left inside other sentences, most specific first. */
const PHRASES: readonly Rule[] = [
  // The Agency price: the lab has no Agency offer (owner 2026-11-25).
  [/,? from \$1K\/month \+ 10% of budget/g, ""],
  [/From \$1K\/month \+ 10% of budget/g, "Free with your own keys"],
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
  [/Your budget reaches buyers\. Pricing is usage based\./g, "Your budget reaches buyers. Start free with your own keys."],
  [/, usage based\b/g, ", from $99/month"],
  [/\bis usage based\b/g, "is $99/month"],
  [/, no markup<\/span>/g, "</span>"],
  [/, 0% markup\b/g, ""],
  [/\. 0% markup\./g, "."],
];

/**
 * The solo-founder pivot (owner 2026-11-25): no Agency offer, no dashboard sold as the
 * product, and only the AI clients the owner named (Conductor, Claude Desktop, ChatGPT,
 * Hermes, Grok Bot, Dots). Runs after the offer rules, on what they left.
 */
const PIVOT: readonly Rule[] = [
  // /about: the two arms become one, the Agency paragraph leaves.
  [/ You get it two ways\. Our AI agent runs it for you from \$99\/month\. Our GTM agency runs your whole go-to-market for you, from \$1K a month plus 10% of your budget\./g, ` Our AI agent runs it for you. ${LAB_OFFER}`],
  [/The GTM agency carries one promise: 6 booked meetings in 3 months or your paid media budget back\. Our <a href="\/terms">terms<\/a> explain how it works\. Beyond that promise, what we guarantee is the measurement:/g, "What we guarantee is the measurement:"],
  [/\s*<p>The GTM agency is from \$1K a month plus 10% of the budget you put into your campaigns\. Book a call and we take it from there\.<\/p>/g, ""],
  [/The AI agent talks to you on WhatsApp, like an agency would\. The dashboard is optional\. If you never want to log in, send us your website and we set the whole thing up at the same price\./g, "Talk to the AI agent from your own AI, on WhatsApp or Telegram, or by email. Send it your website and it sets the whole thing up."],
  // An outcome page's "can your team run it" answer named its Agency page.
  [/Yes\. Our [A-Z][A-Za-z ]+ Agency [^<"]*?\./g, "Distry runs it for you, from your AI, WhatsApp or email."],
  [/Can your team run it for me\?/g, "Who runs it?"],
  // The dashboard is not the product: results come to the founder.
  [/\b[Yy]our dashboard shows\b/g, "Distry shows you"],
  [/\bThe dashboard shows\b/g, "Distry shows you"],
  [/ (?:on|in) your dashboard\b/g, " in your results"],
  [/, live on your dashboard\b/g, ", live"],
  [/read off their own dashboards/g, "read off their own accounts"],
  [/See what each result cost you in the dashboard\./g, "Ask Distry what each result cost you."],
  [/Every offer and audience in one dashboard, ranked by return/g, "Every offer and audience ranked by return"],
  // The AI clients: the ones the owner named, never Cursor.
  [/Claude Code, Grok or Cursor/g, "Conductor, Claude Desktop or ChatGPT"],
  [/Claude Code, Claude Desktop, Cursor(,? (?:or|and) (?:any|every))/g, (_m, rest) => `Conductor, Claude Desktop, ChatGPT${rest}`],
  [/Claude Desktop,? Cursor,? and every other client/g, "Claude Desktop, ChatGPT and every other client"],
  [/For Claude Desktop or Cursor, register/g, "For Claude Desktop, ChatGPT or any other client, register"],
  [/Claude, Cursor or ChatGPT/g, "Claude, Hermes or ChatGPT"],
  [/Claude Code or Cursor/g, "Conductor or Claude Desktop"],
  [/\s*<span><img src="https:\/\/img\.logo\.dev\/cursor\.com[^"]*"[^>]*>Cursor<\/span>/g, ""],
  [/<h2>Cursor<\/h2>[\s\S]*?(?=<h2>)/g, ""],
  [/Claude, Cursor, n8n, Zapier, Make\.com/g, "Conductor, Claude Desktop, ChatGPT, Hermes, Grok Bot, Dots, WhatsApp, Telegram, email"],
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
  // The links leave first, so a sentence that named a hidden page is restated as plain words.
  return applyRules(applyRules(applyRules(applyRules(withLabChrome(html), BLOCKS), SENTENCES), PHRASES), PIVOT);
}

const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Is `pathname` a page the lab does not serve (an exact article, or a section and everything under it)? */
function isHiddenPath(pathname: string): boolean {
  const path = pathname.replace(/[?#].*$/, "").replace(/\/+$/, "") || "/";
  if (LAB_HIDDEN_ARTICLES.includes(path)) return true;
  return LAB_HIDDEN_SECTIONS.some((s) => path === s || path.startsWith(`${s}/`));
}

/** An `href` the lab removes: a hidden page (relative or on distribute.you), or the site's Book a call. */
const HIDDEN_HREF = new RegExp(
  `href="(?:${escapeRe(LAB_BOOK_A_CALL)}|(?:https://distribute\\.you)?(?:${LAB_HIDDEN_ARTICLES.map(escapeRe).join("|")}|(?:${LAB_HIDDEN_SECTIONS.map(escapeRe).join("|")})(?:/[^"#?]*)?)(?:[#?][^"]*)?)"`,
);

/**
 * Links to a page the lab does not serve. A link that IS an item (a card, a menu entry,
 * a footer line, a button) leaves the page; a link inside a sentence keeps its words.
 */
export function withoutHiddenCards(html: string): string {
  const anchor = new RegExp(`<a\\b(?=[^>]*${HIDDEN_HREF.source})([^>]*)>([\\s\\S]*?)<\\/a>`, "g");
  return html
    .replace(new RegExp(`<li\\b[^>]*>\\s*<a\\b[^>]*${HIDDEN_HREF.source}[^>]*>[\\s\\S]*?<\\/a>\\s*<\\/li>`, "g"), "")
    // An entry of a dotted link list ("a · b · c") leaves with its dot.
    .replace(new RegExp(`\\s*·\\s*<a\\b[^>]*${HIDDEN_HREF.source}[^>]*>[^<]*<\\/a>|<a\\b[^>]*${HIDDEN_HREF.source}[^>]*>[^<]*<\\/a>\\s*·\\s*`, "g"), "")
    .replace(anchor, (whole: string, attrs: string, inner: string, offset: number, all: string) => {
      // An item: styled, holding markup, a call to book, or standing alone between two tags (a menu entry).
      const alone = /(?:^|>)\s*$/.test(all.slice(Math.max(0, offset - 40), offset)) && /^\s*(?:<|$)/.test(all.slice(offset + whole.length, offset + whole.length + 40));
      return /\bclass="/.test(attrs) || /<[a-z]/i.test(inner) || attrs.includes(LAB_BOOK_A_CALL) || alone ? "" : inner;
    });
}

/** The element (a `<div>`) opening at `start`, closing tag included, found by counting nested divs. */
function divEnd(html: string, start: number): number {
  const tag = /<div\b|<\/div>/g;
  tag.lastIndex = start;
  let depth = 0;
  for (let m = tag.exec(html); m; m = tag.exec(html)) {
    depth += m[0] === "</div>" ? -1 : 1;
    if (depth === 0) return m.index + m[0].length;
  }
  return -1;
}

/** A menu group or footer column titled `Agency`, in the static and the React chrome alike. */
const AGENCY_GROUP = /<div\b[^>]*>(?:<button\b[^>]*>|<p\b[^>]*>|<h4\b[^>]*>)Agency(?:<svg\b|<\/p>|<\/h4>)/g;

/**
 * The site's menu and footer as the lab offers them: no Agency menu or column, no Book a
 * call, no link to a page the lab does not serve, and "use it from your AI" pointing at
 * the integrations the pivot names.
 */
export function withLabChrome(html: string): string {
  let out = withoutDashboard(html).replace(
    /href="\/docs\/integrations\/claude"([^>]*)>Use from Claude Code or Grok</g,
    (_m, attrs: string) => `href="${LAB_START}"${attrs}>Use it from your AI<`,
  );
  for (let m = AGENCY_GROUP.exec(out); m; m = AGENCY_GROUP.exec(out)) {
    const end = divEnd(out, m.index);
    if (end < 0) break;
    out = out.slice(0, m.index) + out.slice(end);
    AGENCY_GROUP.lastIndex = m.index;
  }
  // A footer column every link of which left (the rankings) leaves too.
  return withoutHiddenCards(out).replace(/<div>\s*<h4\b[^>]*>[^<]*<\/h4>\s*<ul\b[^>]*>\s*<\/ul>\s*<\/div>/g, "");
}

/**
 * The lab never links to the dashboard (owner 2026-11-25: « ne le connectons pas au sous
 * domaine lab, comme s'il n'existait pas »; production keeps every dashboard link).
 * "Log in" leaves; the sign-up walk stays (owner 2026-11-25, kept for the web onboarding;
 * `withSkinSignUp` then dresses it in the lab's skin); every other dashboard address
 * (sign-up, API keys) becomes the way in from your AI.
 */
export function withoutDashboard(html: string): string {
  // The sign-up walk stays (owner 2026-11-25), in the lab's skin; parked so the sweep below skips it.
  const WALK = "__LAB_WALK__";
  return html
    .replace(/(href|action)="https:\/\/dashboard\.distribute\.you\/get-started[^"]*"/g, (_m, attr: string) => `${attr}="${WALK}"`)
    .replace(/<a\b[^>]*href="https:\/\/dashboard\.distribute\.you\/sign-in[^"]*"[^>]*>[\s\S]*?<\/a>/g, "")
    .replace(/(href|action)="https:\/\/dashboard\.distribute\.you\/api-keys[^"]*"/g, (_m, attr: string) => `${attr}="/docs/quickstart"`)
    .replace(/(href|action)="https:\/\/dashboard\.distribute\.you[^"]*"/g, (_m, attr: string) => `${attr}="${LAB_START}"`)
    .replace(/(?:https:\/\/)?dashboard\.distribute\.you\/api-keys/g, "distribute.you/docs/quickstart")
    .replace(/(?:https:\/\/)?dashboard\.distribute\.you(?:\/[a-z-]+)*/g, `distribute.you${LAB_START}`)
    .replaceAll(`="${WALK}"`, `="${LAB_SIGN_UP}"`);
}

/** Where the lab sends a reader of a page it does not serve, or null when the page is served. */
export function labRedirectFor(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (LAB_HIDDEN_ARTICLES.includes(path)) return "/blog";
  return isHiddenPath(path) ? "/" : null;
}

/** A path the lab does not serve. */
export function isLabHiddenPage(pathname: string): boolean {
  return labRedirectFor(pathname) !== null;
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
      // A square mark names its outlet in the span beside it, a wordmark in its alt.
      const name = /<span title="([^"]*)"/.exec(li)?.[1] ?? /<img class="wordmark"[^>]* alt="([^"]+)"/.exec(li)?.[1];
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
  return withLabChrome(dressBrandProof(meetingsOnlyShowcase(html)));
}
