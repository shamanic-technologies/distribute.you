import { SITE, breadcrumb, docPage, esc } from "../v2-shell";

/**
 * `/catalog`: why we bill per tool used rather than per email sent, and the live
 * unit price of every tool behind an email.
 *
 * Owner 2026-10-06, after a client compared our cost per email sent with a flat
 * per-email tool. Modelled on treg.to's footer "Catalog" (same reprice mechanism):
 * the page is never called "pricing", because the plan lives in the homepage's
 * `#pricing` section and changes on its own schedule. This page names no plan.
 *
 * The list is READ at render from the public cost catalogue
 * (`/v1/costs/platform-prices`), never typed here: a price moves in costs-service and
 * this page follows. The served `type` is the readable label; the internal cost name
 * is never shown. Alias-free so the unit tests render it directly.
 */

/** One row of `GET /v1/costs/platform-prices`, the fields this page reads. */
export type PlatformPrice = {
  name: string;
  pricePerUnitInUsdCents: string;
  provider: string;
  providerDomain?: string | null;
  type: string;
  unit: string;
  pricingBasis: string;
  /** costs-service v0.76.0: "retired" rows stay served for history. */
  status: "current" | "retired";
};

/** The served list, read strictly: a row whose `status` is not one we know fails the read. */
export function parsePlatformPrices(body: unknown): PlatformPrice[] {
  if (!Array.isArray(body)) throw new Error("body is not an array");
  for (const row of body as PlatformPrice[]) {
    if (row?.status !== "current" && row?.status !== "retired") {
      throw new Error(`row ${row?.name} has status ${JSON.stringify(row?.status)}`);
    }
  }
  return body as PlatformPrice[];
}

/** The sections of the price list, in the order an email uses them. */
export const CATALOG_GROUPS = [
  { key: "leads", title: "Lead data", note: "Finding the right people and checking their email." },
  { key: "research", title: "Web research", note: "Reading each prospect's site and news before writing." },
  { key: "ai", title: "AI writing", note: "Writing and checking each email. Priced per million tokens." },
  { key: "sending", title: "Sending", note: "Each email and follow-up, sent from our own inboxes. Every email carries both lines: the inbox and the sending domain." },
  { key: "calls", title: "Calls and messages", note: "Calling or texting a prospect who asked for it." },
  { key: "notifications", title: "Emails we send you", note: "Replies forwarded to you, alerts and digests about your campaigns." },
  { key: "storage", title: "Storage", note: "Keeping files and pages we generate." },
  { key: "other", title: "Other tools", note: "Tools added to the catalogue since this page was last sorted." },
] as const;

export type CatalogGroupKey = (typeof CATALOG_GROUPS)[number]["key"];

const PROVIDER_GROUP: Record<string, CatalogGroupKey> = {
  apollo: "leads",
  apify: "leads",
  explee: "leads",
  firecrawl: "research",
  "scrape-do": "research",
  "serper-dev": "research",
  instantly: "sending",
  // Postmark carries our own mail to clients (reply forwards, alerts, digests), never
  // a cold email: runs-service 2026-10-06, every postmark run is a transactional-email job.
  postmark: "notifications",
  twilio: "calls",
  cloudflare: "storage",
};

/**
 * Providers whose rows are NOT tools behind an email, so they stay off the page:
 * channels we do not sell (positioning: a cold email agency, no other channel on a
 * public surface), and treg, whose unit is a dollar of another vendor's price.
 * Media spend and payment fees are excluded by their basis, not listed here.
 */
const NOT_AN_EMAIL_TOOL = new Set(["x", "featured", "treg"]);

const PROVIDER_NAME: Record<string, string> = {
  anthropic: "Anthropic",
  google: "Google",
  openai: "OpenAI",
  deepseek: "DeepSeek",
  zai: "Z.ai",
  moonshot: "Moonshot",
  typesafe: "TypeSafe",
  apollo: "Apollo",
  apify: "Apify",
  explee: "Explee",
  firecrawl: "Firecrawl",
  "scrape-do": "Scrape.do",
  "serper-dev": "Serper",
  instantly: "Instantly",
  postmark: "Postmark",
  twilio: "Twilio",
  cloudflare: "Cloudflare",
};

/** Token rows are priced per token and read per million, like every model vendor. */
const TOKEN_UNIT = "1M tokens";

export function providerName(p: PlatformPrice): string {
  return PROVIDER_NAME[p.provider] ?? p.providerDomain ?? p.provider;
}

/** Which section a row sits in, or null when the row is not a tool behind an email. */
export function catalogGroup(p: PlatformPrice): CatalogGroupKey | null {
  // Media spend and payment fees are a dollar for a dollar, not a tool we run.
  if (p.pricingBasis === "pass-through") return null;
  if (NOT_AN_EMAIL_TOOL.has(p.provider)) return null;
  // A replaced tool stays in the served list for history; it is not one we run.
  if (p.status !== "current") return null;
  if (p.unit === TOKEN_UNIT) return "ai";
  if (p.unit === "search" || p.unit === "query") return "research";
  const group = PROVIDER_GROUP[p.provider];
  if (group) return group;
  console.error(
    `[landing] /catalog: provider "${p.provider}" (${p.name}) has no section, listed under Other tools`,
  );
  return "other";
}

/** Dollars per displayed unit: a token row is restated per million tokens. */
export function unitPriceUsd(p: PlatformPrice): number {
  const cents = Number(p.pricePerUnitInUsdCents);
  if (!Number.isFinite(cents)) {
    throw new Error(`[landing] /catalog: unreadable price "${p.pricePerUnitInUsdCents}" for ${p.name}`);
  }
  return p.unit === TOKEN_UNIT ? (cents * 1_000_000) / 100 : cents / 100;
}

/** `$4.00`, `$0.0299`, `$0.000000720`: two decimals from a dollar up, else three significant digits. */
export function formatUsd(usd: number): string {
  if (usd === 0) return "Free";
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  return `$${Number(usd.toPrecision(3)).toFixed(Math.max(2, -Math.floor(Math.log10(usd)) + 2))}`;
}

export function formatPrice(p: PlatformPrice): string {
  const usd = unitPriceUsd(p);
  return usd === 0 ? "Free" : `${formatUsd(usd)} / ${p.unit}`;
}

type Row = { tool: string; domain: string | null; what: string; price: string };

/** The rows of each section, deduplicated (several internal names share one label and price). */
export function catalogSections(prices: PlatformPrice[]) {
  const byGroup = new Map<CatalogGroupKey, Row[]>();
  const seen = new Set<string>();
  for (const p of prices) {
    const group = catalogGroup(p);
    if (!group) continue;
    // A unit we never charge for is not a price (Apollo's search credit, Instantly's
    // contact upload): listed, it reads as a second, free version of a paid line.
    if (unitPriceUsd(p) === 0) continue;
    const row = { tool: providerName(p), domain: p.providerDomain ?? null, what: p.type, price: formatPrice(p) };
    const key = `${group}|${row.tool}|${row.what}|${row.price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    byGroup.set(group, [...(byGroup.get(group) ?? []), row]);
  }
  return CATALOG_GROUPS.flatMap((g) => {
    const rows = byGroup.get(g.key);
    if (!rows) return [];
    rows.sort((a, b) => a.tool.localeCompare(b.tool) || a.what.localeCompare(b.what));
    return [{ ...g, rows }];
  });
}

const STYLE = `<style>
.catalog-list { max-width: 880px; display: grid; gap: 14px; }
.catalog-list details { border: 1px solid var(--hair); border-radius: 14px; background: var(--bg, #fff); }
.catalog-list summary { cursor: pointer; padding: 16px 20px; display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; font-size: 18px; color: var(--text); }
.catalog-list summary span { font-size: 15px; color: var(--muted); }
.catalog-list summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 14px; }
.catalog-scroll { overflow-x: auto; padding: 0 20px 16px; }
.catalog-list table { width: 100%; border-collapse: collapse; font-size: 15px; }
.catalog-list th { text-align: left; font-weight: 500; color: var(--muted); padding: 8px 12px 8px 0; border-bottom: 1px solid var(--hair); }
.catalog-list td { padding: 8px 16px 8px 0; border-bottom: 1px solid var(--hair); color: var(--text); vertical-align: top; }
.catalog-list td.tool { white-space: nowrap; }
.catalog-list td.tool img { display: inline-block; width: 20px; height: 20px; border-radius: 5px; vertical-align: -4px; margin-right: 8px; }
.catalog-list tr:last-child td { border-bottom: 0; }
.catalog-list td.price, .catalog-list th.price { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; padding-right: 0; }
.catalog-error { max-width: 680px; padding: 16px 20px; border: 1px solid var(--hair); border-radius: 14px; color: var(--text); }
</style>`;

/** Same publishable logo.dev token as the homepage's client logos. */
function logo(domain: string | null): string {
  if (!domain) return "";
  return `<img src="https://img.logo.dev/${esc(domain)}?token=pk_J1iY4__HSfm9acHjR8FibA&size=64&format=png" alt="" width="20" height="20" loading="lazy">`;
}

function priceListHtml(prices: PlatformPrice[] | null): string {
  if (prices === null) {
    return `<div class="catalog-error" role="alert">The live price list could not be read just now. Reload the page in a minute, or read it as JSON at <a href="https://api.distribute.you/v1/costs/platform-prices">api.distribute.you/v1/costs/platform-prices</a>.</div>`;
  }
  const sections = catalogSections(prices);
  const blocks = sections
    .map(
      (s) => `<details${s.key === "sending" ? " open" : ""}>
<summary>${esc(s.title)} <span>${esc(s.note)}</span></summary>
<div class="catalog-scroll"><table>
<thead><tr><th>Tool</th><th>What</th><th class="price">Price</th></tr></thead>
<tbody>${s.rows
        .map((r) => `<tr><td class="tool">${logo(r.domain)}${esc(r.tool)}</td><td>${esc(r.what)}</td><td class="price">${esc(r.price)}</td></tr>`)
        .join("")}</tbody>
</table></div>
</details>`,
    )
    .join("\n");
  return `<div class="catalog-list">${blocks}</div>
<div class="doc"><p>These are our public catalogue prices, read live. The same list is public as JSON at <a href="https://api.distribute.you/v1/costs/platform-prices">api.distribute.you/v1/costs/platform-prices</a>.</p></div>`;
}

const DESCRIPTION =
  "Every tool behind your cold emails, priced per unit with our margin included. Why we do not charge per email sent, and the live price list.";

/** `prices` is null when the live read failed: the page says so instead of listing nothing. */
export function renderCatalogPage(prices: PlatformPrice[] | null): string {
  const html = docPage({
    title: "Price catalog: what your cold emails cost | distribute.you",
    description: DESCRIPTION,
    path: "/catalog",
    eyebrow: "Price catalog",
    h1: "What your emails cost",
    lead: "Every tool behind your emails, billed at public catalogue prices. Our margin is included.",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "distribute.you price catalog",
        url: `${SITE}/catalog`,
        description: DESCRIPTION,
      },
      breadcrumb([
        { name: "distribute.you", path: "/" },
        { name: "Price catalog", path: "/catalog" },
      ]),
    ],
    sections: [
      {
        id: "per-email",
        h2: "Why we don't charge per email",
        tint: true,
        html: `<p>Most tools charge a flat price per email sent. We don't.</p>
<p>We test many ways to write and target each email: templates, angles, buying signals, AI models, lead sources. Some cost more to run than others.</p>
<p>A cheap email nobody answers costs you more than a pricier one that brings a customer.</p>`,
      },
      {
        id: "optimize",
        h2: "What we optimize",
        html: `<p>Your cost per new customer. Not your cost per email.</p>
<p>We keep the versions that win customers for less and stop the rest. You see what each customer cost you in your dashboard.</p>`,
      },
      {
        id: "pays-for",
        h2: "What you pay for",
        tint: true,
        html: `<p>Each email uses a few tools: lead data, research, AI writing, sending. You pay for each tool by the unit, our margin included. Nothing else.</p>
<p>Follow-ups are reserved when the first email goes out, so you see their cost before they are sent.</p>`,
      },
      {
        id: "timing",
        h2: "When results show up",
        html: `<p>Replies usually come 5 to 10 days after the first email. Many come after a follow-up.</p>
<p>Judge a campaign on its cost per customer once it has had that time.</p>`,
      },
      {
        id: "prices",
        h2: "Full price list",
        tint: true,
        html: priceListHtml(prices),
      },
    ],
  });
  return html.replace("</head>", `${STYLE}\n</head>`);
}
