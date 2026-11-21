/**
 * The homepage's "our clients have worked at" wall and "As featured in" row,
 * rendered from brand-service's public brand proof (BRAND-PROOF-LOGOS-1121).
 *
 * Owner 2026-11-21: a learn2reinvent-style wall of companies where our paying
 * clients worked, plus the outlets that published our expert quotes, showing
 * ONLY famous logos (« logos connus, qui font un effet wow »), ranked by fame.
 * Both lists are produced by two Engines (« Client past employer found »,
 * « Press feature found ») and ranked by brand-service (Jev notoriety, then
 * traffic). This module ranks NOTHING: it draws in the producer's order.
 *
 * Alias-free on purpose so it carries real unit tests.
 */

/** The page this landing speaks for: the brand whose proof the wall shows. */
export const BRAND_PROOF_DOMAIN = "distribute.you";

/**
 * Owner 2026-11-21: no fame threshold, « affiche le top 24 c'est tout » for the wall,
 * and the top 3 outlets « quel que soit le score » for the press row. The producer's
 * ranking (notoriety, then traffic) decides the order; the landing cuts the press row
 * to its first 3.
 */
export const BRAND_PROOF_WALL_LIMIT = 24;
export const BRAND_PROOF_PRESS_LIMIT = 3;

/** One token for the whole section: no logo served, no section at all. */
export const BRAND_PROOF_TOKEN = "<!--brand-proof-->";

export interface BrandProofCompany {
  companyId: string;
  name: string | null;
  domain: string | null;
  logoUrl: string | null;
  notorietyScore: number;
  monthlyTraffic: number | null;
}

export interface BrandProofPress extends BrandProofCompany {
  article: { url: string; title: string | null; publishedAt: string | null };
}

export interface BrandProof {
  brandId: string;
  domain: string | null;
  employers: BrandProofCompany[];
  press: BrandProofPress[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Only an http(s) URL reaches an attribute: a served string is not trusted markup. */
function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : null;
}

/** A logo needs both a picture and a name to say what it is. */
function drawable<T extends BrandProofCompany>(c: T): boolean {
  return Boolean(safeUrl(c.logoUrl) && c.name && c.name.trim());
}

/**
 * logo.dev serves a square MARK, not a wordmark: a grey square alone is not
 * recognisable, so every mark carries the company name beside it.
 */
function logoImg(c: BrandProofCompany): string {
  const name = escapeHtml((c.name ?? "").trim());
  return `<img src="${escapeHtml(safeUrl(c.logoUrl)!)}" alt="" loading="lazy" decoding="async"><span>${name}</span>`;
}

/**
 * The whole section, or "" when the producer served nothing drawable.
 *
 * An empty wall is not drawn as a half-empty grid with a heading over it: the
 * section is simply absent, like the hot-lead band when its index is unmeasured.
 */
export function brandProofHtml(proof: BrandProof | null): string {
  if (!proof) return "";
  const employers = (proof.employers ?? []).filter(drawable).slice(0, BRAND_PROOF_WALL_LIMIT);
  const press = (proof.press ?? [])
    .filter((p) => drawable(p) && safeUrl(p.article?.url))
    .slice(0, BRAND_PROOF_PRESS_LIMIT);
  if (employers.length === 0 && press.length === 0) return "";

  const wall = employers.length
    ? '<div class="section-head center rv">' +
      "<h2>Our clients have worked at great companies</h2>" +
      "<p>Each logo is a company where a paying client of distribute.you worked.</p>" +
      "</div>" +
      `<ul class="logo-wall" data-brand-proof="employers">${employers
        .map((c) => `<li>${logoImg(c)}</li>`)
        .join("")}</ul>`
    : "";

  const featured = press.length
    ? `<div class="featured-in rv"><h3>As featured in</h3><ul class="featured-row" data-brand-proof="press">${press
        .map(
          (p) =>
            `<li><a href="${escapeHtml(safeUrl(p.article.url)!)}" target="_blank" rel="noopener">${logoImg(p)}</a></li>`,
        )
        .join("")}</ul></div>`
    : "";

  return `<section class="framed" id="clients"><div class="wrap">${wall}${featured}</div></section>`;
}
