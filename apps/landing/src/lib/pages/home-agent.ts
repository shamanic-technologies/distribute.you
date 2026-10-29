/**
 * The live parts of the homepage, the Revenue AI Agent page (PAGE-REVENUE-AGENT-1029,
 * owner 2026-10-29): "Revenue Automation Done For You", sold to the SaaS founder at the
 * API price with 0% markup, open source, run locally if they want.
 *
 * The page itself is hand-written HTML (`public/landing/index-v2.html`). This module
 * resolves its one live block: the price of each kind of action, READ at render from
 * the public cost catalogue (`/v1/costs/platform-prices`, the list `/catalog` prints),
 * never typed here. A failed read leaves a line pointing at the catalog: the page never
 * prints a price nobody served.
 *
 * Alias-free: the unit tests render it directly.
 */
import { catalogSections, type CatalogGroupKey, type PlatformPrice } from "./catalog";

/** Where the price list goes in `index-v2.html`. */
export const ACTION_PRICES_TOKEN = "<!--action-prices-->";

/** The kinds of action the homepage prices, in the order a campaign uses them. */
export const HOME_PRICE_GROUPS: CatalogGroupKey[] = ["leads", "research", "ai", "sending"];

/** What each kind of action is called on the homepage (the catalog's own titles are longer). */
const ACTION_LABEL: Partial<Record<CatalogGroupKey, string>> = {
  leads: "Find a lead and check the email",
  research: "Read a prospect's website",
  ai: "Write and answer with AI",
  sending: "Send an email from our domains",
};

function esc(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function logo(domain: string | null): string {
  if (!domain) return `<span aria-hidden="true"></span>`;
  return `<img src="https://img.logo.dev/${esc(domain)}?token=pk_J1iY4__HSfm9acHjR8FibA&size=64&format=png" alt="" width="32" height="32" loading="lazy">`;
}

export type ActionPrice = { group: CatalogGroupKey; label: string; tool: string; domain: string | null; what: string; price: string };

/**
 * One line per kind of action: its CHEAPEST served line, stated "from". The rows come
 * from the same `catalogSections` the catalog page draws, so the homepage cannot show a
 * line the catalog hides (idle 30 days, retired, a channel we do not sell).
 */
export function actionPrices(prices: PlatformPrice[]): ActionPrice[] {
  const sections = catalogSections(prices);
  return HOME_PRICE_GROUPS.flatMap((key) => {
    const s = sections.find((x) => x.key === key);
    const row = s?.rows.find((r) => Number.isFinite(r.usd));
    if (!s || !row) return [];
    return [{ group: key, label: ACTION_LABEL[key] ?? s.title, tool: row.tool, domain: row.domain, what: row.what, price: row.price }];
  });
}

/** The price list block, or a line pointing at the catalog when the read failed. */
export function actionPricesHtml(prices: PlatformPrice[] | null): string {
  const rows = prices ? actionPrices(prices) : [];
  if (!rows.length) {
    return `<div class="price-list-wrap" data-motion="reveal"><p class="price-foot">Every price is live on our <a href="/catalog">catalog</a>.</p></div>`;
  }
  const items = rows
    .map(
      (r) =>
        `<li data-group="${esc(r.group)}">${logo(r.domain)}<div class="what"><b>${esc(r.label)}</b><span>${esc(r.tool)}, ${esc(r.what)}</span></div><div class="price">from ${esc(r.price)}<small>API price, 0% markup</small></div></li>`,
    )
    .join("");
  return `<div class="price-list-wrap" data-motion="reveal"><ul class="price-list">${items}</ul><p class="price-foot">The cheapest line of each kind, read live. The full list is on our <a href="/catalog">catalog</a>.</p></div>`;
}

/** Resolves the homepage's price slot. */
export function withActionPrices(html: string, prices: PlatformPrice[] | null): string {
  return html.replaceAll(ACTION_PRICES_TOKEN, actionPricesHtml(prices));
}
