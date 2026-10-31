/**
 * The GTM path finder on `/gtm-automation` (GTM-PATH-FINDER-1031, owner 2026-10-31: « cette
 * animation est exceptionnelle, je veux la même pour le GTM »). A copy of treg.to/search:
 * a pixel-type question, an input, example chips, and every tool we run piled at the bottom
 * as logo tiles that fall in with real physics (matter.js, self-hosted). Picking a goal
 * shows every path that reaches it, the tools each one runs, and its EXPECTED cost per
 * outcome, cheapest priced path first.
 *
 * Every fact is READ at render, never typed here:
 * - the channels and the step each one moves a lead to: features-service `/public/channels`;
 * - the funnel steps: `/public/catalogue/steps` (the count on the pill);
 * - the expected cost per outcome of each channel: `/public/channel-outcome-economics`, a
 *   forward PROJECTION, so it is always labelled "expected" (landing CLAUDE.md);
 * - the tools: the public cost catalogue (`/v1/costs/platform-prices`), one tile per vendor,
 *   plus every platform and provider of treg (`treg.to/catalog/platforms`, public), which our
 *   agent reaches through one treg key. A failed treg read leaves only our own vendors.
 * A failed channel read drops the whole section (the page never states a path nobody
 * served); a failed economics read drops only the figures.
 *
 * The ROI of a path is NOT shown: the producer serves it (`/public/stats/outcome-return-on-spend`)
 * but this page reads only what the public gateway serves for this section today.
 *
 * Alias-free: the unit tests render it directly. Behaviour: `public/landing/v2/path-finder.js`;
 * styles: `public/landing/v2/path-finder.css`.
 */
import { catalogSections, type PlatformPrice } from "./catalog";

export const PATH_FINDER_TOKEN = "<!--gtm-path-finder-->";
export const PATH_FINDER_CSS_VERSION = 1;
export const PATH_FINDER_JS_VERSION = 2;

// ---------------------------------------------------------------------------
// Served shapes (only the fields this section reads)
// ---------------------------------------------------------------------------

export type PfStep = { key: string; label: string };
export type PfChannel = {
  slug: string;
  name: string;
  channelType: string;
  performedBy: string;
  displayOrder: number;
  transitions: { from: PfStep | null; to: PfStep }[];
};
/** One outcome of a channel: its expected cost and every route (leg keys) that reaches it. */
export type PfOutcome = { cost: number | null; routes: string[][]; roi: number | null };

/**
 * A figure measured on fewer outcomes than this is not ranked: one positive reply bought for
 * $2.18 once was crowned "best path" over a channel measured on 52 (owner 2026-10-31 review).
 * The same floor the proof cards use (MIN_DRAWN_OUTCOME). Below it the path reads "learning".
 */
export const MIN_MEASURED_OUTCOMES = 5;
export type PfEconomics = Map<string, Map<string, PfOutcome>>;
/** treg's public catalogue: its platforms and the providers behind them (slug -> name). */
export type TregCatalogue = { platforms: { slug: string; label: string }[]; providers: { slug: string; label: string }[] };
export type PathFinderData = {
  treg?: TregCatalogue | null;
  channels: PfChannel[];
  stepLabels: Map<string, string>;
  economics: PfEconomics | null;
  prices: PlatformPrice[] | null;
};

function obj(v: unknown, what: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new Error(`[landing] path finder: ${what} is not an object`);
  return v as Record<string, unknown>;
}
function str(v: unknown, what: string): string {
  if (typeof v !== "string" || !v) throw new Error(`[landing] path finder: ${what} is not a string`);
  return v;
}
function step(v: unknown, what: string): PfStep {
  const o = obj(v, what);
  return { key: str(o.key, `${what}.key`), label: str(o.label, `${what}.label`) };
}

/** `GET /v1/public/channels`: throws on a shape it cannot read (the caller logs and drops the section). */
export function parseChannels(body: unknown): PfChannel[] {
  const list = obj(body, "channels body").channels;
  if (!Array.isArray(list)) throw new Error("[landing] path finder: channels body has no channels list");
  return list.map((raw, i) => {
    const c = obj(raw, `channel ${i}`);
    const st = Array.isArray(c.stepTransitions) ? c.stepTransitions : [];
    return {
      slug: str(c.slug, `channel ${i}.slug`),
      name: str(c.name, `channel ${i}.name`),
      channelType: typeof c.channelType === "string" ? c.channelType : "other",
      performedBy: typeof c.performedBy === "string" ? c.performedBy : "software",
      displayOrder: typeof c.displayOrder === "number" ? c.displayOrder : 999,
      transitions: st.map((t, j) => {
        const o = obj(t, `channel ${i} transition ${j}`);
        return { from: o.from == null ? null : step(o.from, `transition ${j}.from`), to: step(o.to, `transition ${j}.to`) };
      }),
    };
  });
}

/** `GET /v1/public/catalogue/steps`: every funnel step's name, by key. */
export function parseSteps(body: unknown): Map<string, string> {
  const rows = obj(body, "steps body").rows;
  if (!Array.isArray(rows)) throw new Error("[landing] path finder: steps body has no rows");
  return new Map(
    rows.map((r, i) => {
      const o = obj(r, `step ${i}`);
      return [str(o.key, `step ${i}.key`), str(o.name, `step ${i}.name`)] as [string, string];
    }),
  );
}

/** `GET /v1/public/channel-outcome-economics`: channel slug -> step key -> expected cost (USD, or null) and its routes. */
export function parseEconomics(body: unknown): PfEconomics {
  const list = obj(body, "economics body").channels;
  if (!Array.isArray(list)) throw new Error("[landing] path finder: economics body has no channels list");
  const out: PfEconomics = new Map();
  for (const raw of list) {
    const c = obj(raw, "economics channel");
    const per = new Map<string, PfOutcome>();
    for (const o of Array.isArray(c.outcomes) ? c.outcomes : []) {
      const oc = obj(o, "economics outcome");
      const v = oc.costPerOutcomeUsd;
      const routes = (Array.isArray(oc.paths) ? oc.paths : [])
        .map((x) => obj(x, "economics path").legKeys)
        .filter((k): k is string[] => Array.isArray(k) && k.every((x) => typeof x === "string"));
      const key = step(oc.step, "economics outcome.step").key;
      // The evidence behind the figure: website visits for a visit, positive replies for the
      // reply and everything priced through it.
      const ev = typeof c.evidence === "object" && c.evidence !== null ? (c.evidence as Record<string, unknown>) : {};
      const n = key === "website_visit" ? ev.websiteVisitsProduced : ev.conversationsProduced;
      const measured = typeof n === "number" && n >= MIN_MEASURED_OUTCOMES;
      const r = c.returnPerDollar;
      per.set(key, {
        cost: measured && typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null,
        routes,
        roi: measured && typeof r === "number" && Number.isFinite(r) && r > 0 ? r : null,
      });
    }
    out.set(str(c.channelSlug, "economics channelSlug"), per);
  }
  return out;
}

/** `GET https://treg.to/catalog/platforms`. */
export function parseTreg(body: unknown): TregCatalogue {
  const o = obj(body, "treg body");
  if (!Array.isArray(o.platforms)) throw new Error("[landing] path finder: treg body has no platforms");
  const providers = obj(o.providers, "treg providers");
  return {
    platforms: o.platforms.map((x, i) => {
      const p = obj(x, `treg platform ${i}`);
      return { slug: str(p.slug, `treg platform ${i}.slug`), label: str(p.label, `treg platform ${i}.label`) };
    }),
    providers: Object.entries(providers).map(([slug, label]) => ({ slug, label: str(label, `treg provider ${slug}`) })),
  };
}

// ---------------------------------------------------------------------------
// The model: tiles, goals and their paths
// ---------------------------------------------------------------------------

/** A tool: its logo is the domain's (logo.dev) or, for a treg tile, treg's own `src`. */
export type Tool = { key: string; label: string; domain: string | null; src?: string };
export type PfPath = {
  slug: string;
  name: string;
  /** The steps a lead walks on this path, ending at the goal: `Lead, Positive reply, Meeting booked`. */
  route: string[];
  /** How many different routes this channel has to the goal (the ramifications). */
  routes: number;
  to: string;
  who: string;
  tools: Tool[];
  expectedUsd: number | null;
  /** The served expected return per dollar spent (a projection, labelled so), or null. */
  expectedReturn: number | null;
};
export type PfGoal = { key: string; chip: string; step: string; plural: string; paths: PfPath[] };

/**
 * The goals a visitor can pick, each keyed on a SERVED step. A goal whose step no channel
 * reaches is dropped. The first one is the input's placeholder (treg's pattern).
 */
export const GOALS: readonly { step: string; chip: string; plural: string }[] = [
  { step: "meeting_booked", chip: "Book 20 meetings with US SaaS heads of growth", plural: "booked meetings" },
  { step: "signup", chip: "1,000 signups for my app", plural: "signups" },
  { step: "conversation", chip: "Interested replies from my buyers", plural: "positive replies" },
  { step: "website_visit", chip: "Buyers on my website", plural: "website visits" },
  { step: "paid_client", chip: "Turn my leads into paying clients", plural: "paying clients" },
  { step: "lead_found", chip: "Leads with a verified email", plural: "leads" },
];

/** Platforms a channel runs ON, by a word of its slug: the tile wears the platform's logo. */
const PLATFORM_DOMAIN: Record<string, string> = {
  linkedin: "linkedin.com",
  x: "x.com",
  instagram: "instagram.com",
  reddit: "reddit.com",
  whatsapp: "whatsapp.com",
  google: "google.com",
  meta: "facebook.com",
  tiktok: "tiktok.com",
  youtube: "youtube.com",
  bing: "bing.com",
  quora: "quora.com",
  threads: "threads.net",
  apollo: "apollo.io",
};

export function channelDomain(slug: string): string | null {
  for (const w of slug.split("-")) if (PLATFORM_DOMAIN[w]) return PLATFORM_DOMAIN[w];
  return null;
}

/** The vendors of each kind we run, read off the cost catalogue (cheapest line first). */
function vendorsByKind(prices: PlatformPrice[] | null): Record<string, Tool[]> {
  const out: Record<string, Tool[]> = {};
  if (!prices) return out;
  for (const s of catalogSections(prices)) {
    const seen = new Set<string>();
    out[s.key] = s.rows
      .filter((r) => !seen.has(r.tool) && seen.add(r.tool))
      .map((r) => ({ key: `v:${r.tool}`, label: r.tool, domain: r.domain }));
  }
  return out;
}

/** The ad platform a paid channel buys from: the served price whose provider names the channel. */
function adVendor(slug: string, prices: PlatformPrice[] | null): Tool | null {
  const p = prices?.find(
    (x) => x.status === "current" && (x.provider === slug || slug.startsWith(x.provider) || x.provider.startsWith(slug.replace(/s$/, ""))),
  );
  if (!p) return null;
  return { key: `v:${p.provider}`, label: p.type.replace(/ platform spend$| spend$/i, ""), domain: p.providerDomain ?? null };
}

/**
 * The tools a path runs, by the KIND of work its channel does. A person-run channel runs
 * no tool here (a specialist or the client's team is the tool). Vendors come from the
 * live catalogue, so a vendor we stop running leaves every path at once.
 */
export function pathTools(c: PfChannel, prices: PlatformPrice[] | null): Tool[] {
  if (c.performedBy === "person") return [];
  const k = vendorsByKind(prices);
  const take = (key: string, n: number) => (k[key] ?? []).slice(0, n);
  const words = new Set(c.slug.split("-"));
  const platform = channelDomain(c.slug);
  const tools: Tool[] = [];
  if (platform) tools.push({ key: `c:${platform}`, label: c.name, domain: platform });
  if (c.channelType === "sourcing") tools.push(...take("leads", 3));
  else if (c.channelType === "paid") {
    const ad = adVendor(c.slug, prices);
    if (ad && ad.domain !== platform) tools.push(ad);
    tools.push(...take("ai", 2));
  } else if (words.has("email") || words.has("hello") || words.has("proposal")) {
    if (c.channelType === "outbound") tools.push(...take("leads", 1));
    tools.push(...take("research", 1), ...take("ai", 2), ...take("sending", 1));
  } else if (words.has("sms") || words.has("call")) tools.push(...take("ai", 2), ...take("calls", 1));
  else tools.push(...take("ai", 2));
  const seen = new Set<string>();
  return tools.filter((t) => !seen.has(t.key) && seen.add(t.key));
}

function whoRuns(c: PfChannel): string {
  if (c.performedBy !== "person") return "Our AI agent";
  return c.slug.startsWith("your-team") ? "Your team" : "Our specialist";
}

/**
 * A route's leg keys (`lead_found_to_conversation`, `conversation_to_meeting_booked`, ...)
 * read as the step keys a lead walks, cut at the goal. A route that never reaches the goal
 * is null.
 */
export function routeSteps(legKeys: string[], goal: string): string[] | null {
  const out: string[] = [];
  for (const leg of legKeys) {
    const [from, to] = leg.split("_to_");
    if (!to) continue;
    if (!out.length) out.push(from);
    out.push(to);
    if (to === goal) return out;
  }
  return null;
}

/**
 * Every channel that can bring a lead to a step, through any of its served routes:
 * priced paths cheapest first, then the rest in catalogue order.
 */
export function pathsTo(stepKey: string, d: PathFinderData): PfPath[] {
  const label = (k: string) => d.stepLabels.get(k) ?? k.replaceAll("_", " ");
  // A leg "from nothing" is keyed `start_to_<step>`: `start` is not a step a lead stands on.
  const onSteps = (steps: string[]) => steps.filter((k) => k !== "start");
  const out: { p: PfPath; order: number }[] = [];
  for (const c of d.channels) {
    const eco = d.economics?.get(c.slug)?.get(stepKey) ?? null;
    const walks = new Map<string, string[]>();
    for (const r of eco?.routes ?? []) {
      const steps = routeSteps(r, stepKey);
      if (steps) walks.set(onSteps(steps).join(">"), onSteps(steps));
    }
    const direct = c.transitions.find((x) => x.to.key === stepKey);
    if (direct && !walks.size) walks.set("direct", direct.from ? [direct.from.key, stepKey] : [stepKey]);
    if (!walks.size) continue;
    // The shortest route leads the card; the others are counted.
    const route = [...walks.values()].sort((a, b) => a.length - b.length)[0];
    out.push({
      order: c.displayOrder,
      p: {
        slug: c.slug,
        name: c.name,
        route: route.map(label),
        routes: walks.size,
        to: label(stepKey),
        who: whoRuns(c),
        tools: pathTools(c, d.prices),
        expectedUsd: eco?.cost ?? null,
        expectedReturn: eco?.roi ?? null,
      },
    });
  }
  return out
    .sort((a, b) => {
      const x = a.p.expectedUsd, y = b.p.expectedUsd;
      if (x !== null && y !== null) return x - y;
      if (x !== null) return -1;
      if (y !== null) return 1;
      return a.order - b.order;
    })
    .map((r) => r.p);
}

export function goals(d: PathFinderData): PfGoal[] {
  return GOALS.map((g) => ({ key: g.step, chip: g.chip, step: g.step, plural: g.plural, paths: pathsTo(g.step, d) })).filter(
    (g) => g.paths.length > 0,
  );
}

const TREG_LOGOS = "https://treg.to/logos/";

/** A treg slug that names one of our own logos (`apollo`, `linkedin`, `meta-ads`) is already on the pile. */
function stemOf(domainOrSlug: string): string {
  return domainOrSlug.replace(/^ads\./, "").split(".")[0].replace(/-ads$/, "");
}

/**
 * One tile per vendor we run and per platform a channel runs on, deduplicated by logo
 * (treg piles logos only), then treg's platforms and providers that are not already there.
 */
export function tiles(d: PathFinderData): Tool[] {
  const out = new Map<string, Tool>();
  for (const t of Object.values(vendorsByKind(d.prices)).flat()) if (t.domain) out.set(t.domain, t);
  for (const p of d.prices ?? []) {
    if (p.status === "current" && p.providerDomain && !out.has(p.providerDomain)) {
      out.set(p.providerDomain, { key: `v:${p.provider}`, label: p.provider, domain: p.providerDomain });
    }
  }
  for (const c of d.channels) {
    const dom = channelDomain(c.slug);
    if (dom && !out.has(dom)) out.set(dom, { key: `c:${dom}`, label: c.name, domain: dom });
  }
  const stems = new Set([...out.keys()].map(stemOf));
  for (const p of d.treg?.platforms ?? []) {
    if (stems.has(stemOf(p.slug))) continue;
    stems.add(stemOf(p.slug));
    out.set(`t:p:${p.slug}`, { key: `t:p:${p.slug}`, label: p.label, domain: null, src: `${TREG_LOGOS}platforms/${p.slug}.svg` });
  }
  for (const p of d.treg?.providers ?? []) {
    if (stems.has(stemOf(p.slug))) continue;
    stems.add(stemOf(p.slug));
    out.set(`t:v:${p.slug}`, { key: `t:v:${p.slug}`, label: p.label, domain: null, src: `${TREG_LOGOS}${p.slug}.svg` });
  }
  return [...out.values()];
}

/**
 * The pill's "tools": the vendors on our cost catalogue, plus treg's providers we do not
 * already run (all reached through one treg key). Null when the catalogue read failed.
 */
export function toolCount(prices: PlatformPrice[] | null, treg: TregCatalogue | null = null): number | null {
  if (!prices) return null;
  const ours = new Set(prices.filter((p) => p.status === "current").map((p) => p.provider));
  const stems = new Set([...ours].map(stemOf));
  const extra = (treg?.providers ?? []).filter((p) => !stems.has(stemOf(p.slug))).length;
  return ours.size + extra;
}

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/** `$1,161` from a dollar up, `$2.18` under $100: an expected figure never shows false precision. */
export function formatExpected(usd: number): string {
  return usd >= 100 ? `$${Math.round(usd).toLocaleString("en-US")}` : `$${usd.toFixed(2)}`;
}

/** The JSON the script reads: goals with their paths, and the tiles. Escaped for an inline script. */
export function pathFinderJson(d: PathFinderData): string {
  const payload = {
    goals: goals(d).map((g) => ({
      ...g,
      paths: g.paths.map((p) => ({
        ...p,
        expected: p.expectedUsd === null ? null : formatExpected(p.expectedUsd),
        roi: p.expectedReturn === null ? null : `${p.expectedReturn.toFixed(1)}x`,
      })),
    })),
    tiles: tiles(d),
  };
  return JSON.stringify(payload).replaceAll("<", "\\u003c");
}

export function pathFinderHtml(d: PathFinderData, signUp: string): string {
  const gs = goals(d);
  if (!gs.length) return "";
  const tools = toolCount(d.prices, d.treg ?? null);
  const count = [`${d.channels.length} channels`, tools ? `${tools} tools` : null, `${d.stepLabels.size} funnel steps`].filter(Boolean).join(" · ");
  const chips = gs
    .slice(1)
    .map((g) => `<button class="pf-chip" type="button" data-goal="${esc(g.key)}">${esc(g.chip)}</button>`)
    .join("");
  // A crawler and a visitor without the script read the paths as a plain list.
  const list = gs
    .map(
      (g) =>
        `<li><b>${esc(g.chip)}</b>: ${g.paths
          .slice(0, 6)
          .map((p) => esc(p.name))
          .join(", ")}${g.paths.length > 6 ? `, and ${g.paths.length - 6} more` : ""}</li>`,
    )
    .join("");
  return `<section class="pf" id="paths" data-path-finder aria-label="Find your best growth path">
  <div class="pf-top">
    <div class="pf-hero">
      <span class="pf-count">${esc(count)}</span>
      <h2>What does your growth<br><span>need to do?</span></h2>
    </div>
    <div class="pf-panel" hidden></div>
  </div>
  <div class="pf-ask">
    <form class="pf-in" action="${esc(signUp)}" method="get">
      <input id="pf-q" name="goal" type="text" autocomplete="off" aria-label="Your growth goal" placeholder="${esc(gs[0].chip)}" data-goal-default="${esc(gs[0].key)}">
      <button class="pf-go" type="submit" aria-label="Find my best path"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
    </form>
    <p class="pf-meta" aria-live="polite">Testing every path takes a PhD. Our agent reads them all, picks your best one and runs it with our best templates.</p>
    <div class="pf-chips">${chips}</div>
  </div>
  <ul class="pf-list">${list}</ul>
  <div class="pf-floor" aria-hidden="true"></div>
  <script type="application/json" id="pf-data">${pathFinderJson(d)}</script>
</section>`;
}

/** Resolves the section's slot; no data drops the section. */
export function withPathFinder(html: string, d: PathFinderData | null, signUp: string): string {
  return html.replaceAll(PATH_FINDER_TOKEN, d ? pathFinderHtml(d, signUp) : "");
}
