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

/* ── The "why" rows (treg.to benefits, copied): live parts ─────────────────────────────── */

/** Where the seat-vs-action ledger rows go in `index-v2.html`. */
export const LEDGER_ROWS_TOKEN = "<!--ledger-rows-->";
/** Where the model-comparison scenarios go (JSON read by `v2/why.js`). */
export const CAP_DATA_TOKEN = "<!--cap-data-->";

/**
 * Each job a point tool sells as a monthly plan, beside what our agent pays for the same job.
 * The seat price is read on each vendor's pricing page (dated in the page); the action price
 * is the cheapest served line of its catalog group, never typed here.
 */
export const LEDGER_JOBS: { job: string; seatDomain: string; seat: string; group: CatalogGroupKey | null; same?: string }[] = [
  { job: "Lead data", seatDomain: "apollo.io", seat: "$49/user/mo", group: "leads" },
  { job: "Prospect research", seatDomain: "clay.com", seat: "$167/mo", group: "research" },
  { job: "Email sending", seatDomain: "instantly.ai", seat: "$47/mo", group: "sending" },
  { job: "Warmed mailboxes", seatDomain: "mailforge.ai", seat: "$3/mailbox/mo", group: null, same: "in the email price" },
  { job: "Writing every reply", seatDomain: "anthropic.com", seat: "your time", group: "ai" },
];

/** The ledger rows: seat price struck, then the live per-action price (a failed read says "API price"). */
export function ledgerRowsHtml(prices: PlatformPrice[] | null): string {
  const live = new Map((prices ? actionPrices(prices) : []).map((r) => [r.group, r]));
  return LEDGER_JOBS.map((j) => {
    const r = j.group ? live.get(j.group) : undefined;
    const ours = j.same ?? (r ? `from ${r.price}` : "at the API price");
    return `<div class="lrow"><span class="n"><img src="https://img.logo.dev/${esc(j.seatDomain)}?token=pk_J1iY4__HSfm9acHjR8FibA&size=64&format=png" alt="" width="18" height="18" loading="lazy"><b>${esc(j.job)}</b></span><span class="pr"><s>${esc(j.seat)}</s><em>${esc(ours)}</em></span></div>`;
  }).join("");
}

export type CapRow = { tool: string; domain: string | null; label: string; price: string };
export type CapScenario = { ask: string; title: string; count: string; rows: CapRow[]; res: string };

/** "Output tokens (Haiku 5.5)" / "Output tokens (DeepSeek V4.1 Flash, off-peak)" → the model's name. */
function modelOf(what: string): string | null {
  const m = /^Output tokens \(([^)]+)\)$/.exec(what);
  if (!m) return null;
  return m[1].split(",")[0].trim();
}

/** Spread `n` picks across a sorted list: the cheapest, the dearest, and evenly between. */
function spread<T>(rows: T[], n: number): T[] {
  if (rows.length <= n) return rows;
  return Array.from({ length: n }, (_, i) => rows[Math.round((i * (rows.length - 1)) / (n - 1))]);
}

/**
 * The comparison the agent makes before it acts, from the live catalog: the same unit priced by
 * every vendor that sells it. Cheapest first; the first row is the one the window marks.
 */
export function capScenarios(prices: PlatformPrice[] | null): CapScenario[] {
  if (!prices) return [];
  const sections = catalogSections(prices);
  const out: CapScenario[] = [];
  const ai = sections.find((s) => s.key === "ai");
  if (ai) {
    const byModel = new Map<string, (typeof ai.rows)[number]>();
    for (const r of ai.rows) {
      const model = modelOf(r.what);
      if (!model || !Number.isFinite(r.usd)) continue;
      const seen = byModel.get(model);
      if (!seen || r.usd < seen.usd) byModel.set(model, r);
    }
    const models = [...byModel.entries()].sort((a, b) => a[1].usd - b[1].usd);
    if (models.length >= 3) {
      const picked = spread(models, 5);
      out.push({
        ask: "write the first email to this lead",
        title: "Write with an AI model",
        count: `${models.length} models`,
        rows: picked.map(([model, r]) => ({ tool: model, domain: r.domain, label: r.tool, price: r.price.replace(" / 1M tokens", " / 1M out") })),
        res: `email drafted · <b>${esc(picked[0][1].price.replace(" / 1M tokens", " / 1M out"))} via ${esc(picked[0][0])}</b>`,
      });
    }
  }
  const research = sections.find((s) => s.key === "research");
  if (research) {
    const byTool = new Map<string, (typeof research.rows)[number]>();
    for (const r of research.rows) if (Number.isFinite(r.usd) && !byTool.has(r.tool)) byTool.set(r.tool, r);
    const rows = [...byTool.values()];
    if (rows.length >= 2) {
      out.push({
        ask: "read northwindhealth.com before writing",
        title: "Read a website",
        count: `${rows.length} vendors`,
        rows: rows.slice(0, 5).map((r) => ({ tool: r.tool, domain: r.domain, label: r.what, price: r.price })),
        res: `site read · <b>${esc(rows[0].price)} via ${esc(rows[0].tool)}</b>`,
      });
    }
  }
  return out;
}

/** JSON for `why.js`, safe inside a `<script type="application/json">`. */
export function capDataJson(prices: PlatformPrice[] | null): string {
  return JSON.stringify(capScenarios(prices)).replaceAll("<", "\\u003c");
}

/** Resolves the homepage's "why" slots. */
export function withHomeWhy(html: string, prices: PlatformPrice[] | null): string {
  const out = html.replaceAll(LEDGER_ROWS_TOKEN, ledgerRowsHtml(prices)).replaceAll(CAP_DATA_TOKEN, capDataJson(prices));
  // No comparison to play (failed read): the window says where the prices are, never sits empty.
  if (capScenarios(prices).length) return out;
  return out.replace('<div id="caprows"></div>', `<div id="caprows"><p class="cap-empty">Every price is live on our <a href="/catalog">catalog</a>.</p></div>`);
}
