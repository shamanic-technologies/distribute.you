/**
 * The homepage's "our clients come from" wall and, apart from it,
 * the "As featured in" scrolling band,
 * rendered from brand-service's public brand proof (BRAND-PROOF-LOGOS-1121).
 *
 * Owner 2026-11-21: a learn2reinvent-style wall of companies where our paying
 * clients worked, plus the outlets that published our expert quotes, showing
 * ONLY famous logos (« logos connus, qui font un effet wow »), ranked by fame.
 * Both lists are produced by two Engines (« Client past employer found »,
 * « Press feature found ») and ranked by brand-service (Jev notoriety, then
 * traffic). This module ranks NOTHING: it draws in the producer's order.
 *
 * Owner 2026-11-25 (BRANDMARK-WALL-1125): the wall reads like learn2reinvent's,
 * wide grey WORDMARKS with no name typed beside them. brand-service fills
 * `wordmarkUrl` gradually (best-ranked first); a company without one yet keeps
 * its square mark and its name, so the wall is never empty during the fill.
 *
 * Alias-free on purpose so it carries real unit tests.
 */

/** The page this landing speaks for: the brand whose proof the wall shows. */
export const BRAND_PROOF_DOMAIN = "distribute.you";

/**
 * Owner 2026-11-21: no fame threshold, « affiche le top 24 c'est tout » for the wall.
 * Owner 2026-11-25: the press row shows EVERY outlet served, as an endless scroll,
 * in its own place on the page (« pas collé au 24 logos »). One read asks the
 * producer's max so the press list is whole; the wall keeps its first 8
 * (owner 2026-11-25 later: « garde que le top 8 », one row of 8).
 */
export const BRAND_PROOF_WALL_LIMIT = 8;
/**
 * Owner 2026-11-25: « 8 par ligne », now one line (top 8). The wall is a grid of 8 columns
 * (4 on narrow screens), and it only draws FULL rows: fewer than 8 drawable logos
 * round down to a multiple of 8, so no logo ever sits alone on the last line.
 */
export const BRAND_PROOF_ROW = 8;
export const BRAND_PROOF_FETCH_LIMIT = 100;

/** The wall's token: no employer logo served, no wall at all. */
export const BRAND_PROOF_TOKEN = "<!--brand-proof-->";
/** The press band's token, placed apart from the wall. */
export const PRESS_PROOF_TOKEN = "<!--press-proof-->";

export interface BrandProofCompany {
  companyId: string;
  name: string | null;
  domain: string | null;
  logoUrl: string | null;
  /** Wide wordmark made for a LIGHT background, hosted by us. null or absent = none known yet. */
  wordmarkUrl?: string | null;
  /** Its dark-background twin. Both pages draw the wall on a light band, so nothing reads it yet. */
  wordmarkDarkUrl?: string | null;
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

/** A logo needs a picture (wordmark or square mark) and a name to say what it is. */
function drawable<T extends BrandProofCompany>(c: T): boolean {
  return Boolean((safeUrl(c.wordmarkUrl) || safeUrl(c.logoUrl)) && c.name && c.name.trim());
}

/**
 * A wordmark spells the company out: it is drawn alone, its name in the `alt`.
 * A logo.dev square MARK alone is not recognisable, so it keeps the name beside it.
 * The class sits on the `<img>` (the `<li>` stays bare) so each stylesheet sizes both kinds.
 */
function logoImg(c: BrandProofCompany): string {
  const name = escapeHtml((c.name ?? "").trim());
  const wordmark = safeUrl(c.wordmarkUrl);
  if (wordmark) return `<img class="wordmark" src="${escapeHtml(wordmark)}" alt="${name}" title="${name}" loading="lazy" decoding="async">`;
  return `<img src="${escapeHtml(safeUrl(c.logoUrl)!)}" alt="" loading="lazy" decoding="async"><span title="${name}">${name}</span>`;
}

/**
 * The "worked at" wall, or "" when the producer served no drawable employer.
 *
 * An empty wall is not drawn as a half-empty grid with a heading over it: the
 * section is simply absent, like the hot-lead band when its index is unmeasured.
 */
export function brandProofHtml(proof: BrandProof | null): string {
  if (!proof) return "";
  const drawn = (proof.employers ?? []).filter(drawable).slice(0, BRAND_PROOF_WALL_LIMIT);
  const employers = drawn.slice(0, drawn.length - (drawn.length % BRAND_PROOF_ROW));
  if (employers.length === 0) return "";
  return (
    '<section class="framed" id="clients"><div class="wrap">' +
    '<div class="section-head center rv">' +
    "<h2>Our clients come from great companies</h2>" +
    "<p>Each logo is a company where a paying client has worked.</p>" +
    "</div>" +
    `<ul class="logo-wall" data-brand-proof="employers">${employers.map((c) => `<li>${logoImg(c)}</li>`).join("")}</ul>` +
    "</div></section>"
  );
}

/**
 * The "As featured in" band: every served outlet, scrolling without end.
 *
 * The list is drawn twice in one track so the loop has no seam; the copy is
 * aria-hidden and unfocusable, so a screen reader and a keyboard meet each
 * outlet once. "" when nothing drawable is served.
 */
export function pressProofHtml(proof: BrandProof | null): string {
  if (!proof) return "";
  const press = (proof.press ?? []).filter((p) => drawable(p) && safeUrl(p.article?.url));
  if (press.length === 0) return "";
  const items = (copy: boolean) =>
    press
      .map(
        (p) =>
          `<li${copy ? ' aria-hidden="true"' : ""}><a href="${escapeHtml(safeUrl(p.article.url)!)}" target="_blank" rel="noopener"${copy ? ' tabindex="-1"' : ""}>${logoImg(p)}</a></li>`,
      )
      .join("");
  return (
    '<section class="framed" id="featured"><div class="wrap wide">' +
    '<div class="featured-in rv"><h3>As featured in</h3>' +
    `<div class="press-marquee"><ul class="press-track" data-brand-proof="press">${items(false)}${items(true)}</ul></div>` +
    "</div></div></section>"
  );
}
