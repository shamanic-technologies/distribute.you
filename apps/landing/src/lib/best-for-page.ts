/**
 * The "best X for Y" cluster: `/best/<slug>` and the `/best` hub, rendered from
 * `best-for.ts` at request time through the same pipeline and shell as the comparison
 * cluster (`renderedResponse`, `v2-shell`), so every page gets the analytics head, the
 * Organization JSON-LD, `Accept: text/markdown`, the edge cache and the live
 * `__HOT_LEAD_BAND__` figures without a second copy of any of it.
 *
 * Built for an answer engine first: it keeps roughly the H1 and the first paragraph and
 * runs no JavaScript. So the H1 states the question's answer, the paragraph under it
 * answers in two sentences, the date and the author sit right below, and the whole
 * ranked list is in the raw HTML.
 *
 * Every figure about a competitor (entry price, source URL, verified-on date) is read
 * from `competitors.ts` here; nothing in this file or in `best-for.ts` restates one.
 */
import { COMPETITORS, DISTRIBUTE_ROW, competitorBySlug, type Competitor } from "./competitors";
import {
  BEST_FOR_PAGES,
  BEST_UPDATED_ON,
  bestForLinkLabel,
  bestForQuestion,
  type BestForPage,
} from "./best-for";
import { bullets, faqJsonLd, faqList, liveBand, logo } from "./compare-page";
import { SIGN_UP, SITE, breadcrumb, esc, shell } from "./v2-shell";

const YEAR = BEST_UPDATED_ON.slice(0, 4);

function longDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function operatedByLabel(c: Competitor): string {
  if (c.operatedBy === "you") return "You run it, in their software";
  if (c.operatedBy === "their AI agent") return "Their AI agent, steered by you";
  return "Their team";
}

/** The H1: the question's answer, in plain text. */
export function bestForHeading(p: BestForPage): string {
  return `The best ${p.category} for ${p.audience} in ${YEAR}: distribute.you`;
}

export function bestForTitle(p: BestForPage): string {
  return `Best ${p.category} for ${p.audience} in ${YEAR}: distribute.you and ${p.ranked.length} alternatives`;
}

export function bestForDescription(p: BestForPage): string {
  const names = p.ranked.map((r) => competitorBySlug(r.slug)!.name).join(", ");
  return `${bestForQuestion(p)} distribute.you ranks first for ${p.audience} who want sales meetings without running outreach. Compared with ${names}, prices read from their own sites.`;
}

function metaLine(): string {
  return `<p class="best-meta">Updated <time datetime="${BEST_UPDATED_ON}">${longDate(BEST_UPDATED_ON)}</time> · By the distribute.you team · We are distribute.you, so we rank ourselves first. Every other price below is read from the vendor's own site, with the date it was read.</p>`;
}

function ourItem(p: BestForPage): string {
  return `<li class="best-item us rv">
    <div class="cmp-card-top"><span class="best-rank">1</span><img src="/landing/v2/assets/logo-mark.svg" alt="" width="32" height="32"><div><b>distribute.you</b><small>Acquisition agency · ${esc(DISTRIBUTE_ROW.entryPrice)}</small></div></div>
    <p><strong>Best for:</strong> ${esc(p.usBestFor)}.</p>
    <p>${esc(DISTRIBUTE_ROW.operatedBy)}. ${esc(DISTRIBUTE_ROW.sendingDomains)} ${esc(DISTRIBUTE_ROW.pricingModel)}</p>
    <p class="cmp-source"><a href="${SIGN_UP}">Start free</a></p>
  </li>`;
}

function rankedItem(rank: number, c: Competitor, bestFor: string): string {
  return `<li class="best-item rv">
    <div class="cmp-card-top"><span class="best-rank">${rank}</span>${logo(c.domain, 32)}<div><b>${esc(c.name)}</b><small>${esc(c.entryPrice)}</small></div></div>
    <p><strong>Best for:</strong> ${esc(bestFor)}.</p>
    <p>${esc(c.oneLiner)} ${esc(operatedByLabel(c))}.</p>
    <p class="cmp-source">Price read from <a href="${esc(c.sourceUrl)}" rel="nofollow noopener" target="_blank">${esc(c.domain)}</a> on ${longDate(c.verifiedOn)}. <a href="/compare/${c.slug}">distribute.you vs ${esc(c.name)}</a></p>
  </li>`;
}

function rankedOptions(p: BestForPage): { rank: number; c: Competitor; bestFor: string }[] {
  return p.ranked.map((r, i) => ({ rank: i + 2, c: competitorBySlug(r.slug)!, bestFor: r.bestFor }));
}

function itemListJsonLd(p: BestForPage) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: bestForHeading(p),
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "distribute.you", url: SITE },
      ...rankedOptions(p).map((o) => ({
        "@type": "ListItem",
        position: o.rank,
        name: o.c.name,
        url: `https://${o.c.domain}`,
      })),
    ],
  };
}

function articleJsonLd(p: BestForPage) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: bestForHeading(p),
    description: p.answer,
    datePublished: BEST_UPDATED_ON,
    dateModified: BEST_UPDATED_ON,
    author: { "@type": "Organization", name: "distribute.you", url: SITE },
    publisher: { "@type": "Organization", name: "distribute.you", url: SITE },
    mainEntityOfPage: `${SITE}/best/${p.slug}`,
  };
}

export function renderBestForPage(p: BestForPage): string {
  const path = `/best/${p.slug}`;
  const options = rankedOptions(p);
  const body = `<section class="hero cmp-hero">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-inner">
    <span class="eyebrow">${esc(bestForQuestion(p))}</span>
    <h1>${esc(bestForHeading(p))}</h1>
    <p class="hero-sub">${esc(p.answer)}</p>
    ${metaLine()}
    <div class="cmp-cta"><a class="btn btn-accent btn-lg" href="${SIGN_UP}">Start free</a><a class="btn btn-outline btn-lg" href="#ranking">See the ranking</a></div>
  </div>
</section>

<section class="framed tint" id="ranking">
  <div class="wrap">
    <div class="section-head"><span class="eyebrow">The ranking</span><h2>The best ${esc(p.category)} for ${esc(p.audience)}, ranked</h2><p>${options.length + 1} options, from the one that runs outbound for you to the tools you run yourself.</p></div>
    <ol class="best-list">
      ${ourItem(p)}
      ${options.map((o) => rankedItem(o.rank, o.c, o.bestFor)).join("\n      ")}
    </ol>
  </div>
</section>

<section class="framed" id="why">
  <div class="wrap">
    <div class="section-head"><span class="eyebrow">Why it ranks first</span><h2>Why distribute.you is the best ${esc(p.category)} for ${esc(p.audience)}</h2></div>
    <div class="fit">
      <div class="fit-card yes rv"><h3>What ${esc(p.audience)} get</h3>${bullets(p.whyUs, "yes")}</div>
      <div class="fit-card no rv"><h3>How to choose, whoever you pick</h3>${bullets(p.howToChoose, "no")}</div>
    </div>
  </div>
</section>

${liveBand()}

<section class="framed" id="faq">
  <div class="wrap">
    <div class="section-head center rv"><h2>Questions ${esc(p.audience)} ask</h2></div>
    <div class="faq-list rv">${faqList(p.faq)}</div>
    <p class="cmp-more rv">More rankings: ${BEST_FOR_PAGES.filter((o) => o.slug !== p.slug)
      .map((o) => `<a href="/best/${o.slug}">${esc(bestForLinkLabel(o))}</a>`)
      .join(" · ")} · <a href="/best">all rankings</a> · <a href="/compare">every comparison</a></p>
  </div>
</section>`;

  return shell({
    title: bestForTitle(p),
    description: bestForDescription(p),
    path,
    body,
    jsonLd: [
      breadcrumb([
        { name: "Best for", path: "/best" },
        { name: bestForLinkLabel(p), path },
      ]),
      articleJsonLd(p),
      itemListJsonLd(p),
      faqJsonLd(p.faq),
    ],
  });
}

function audienceList(): string {
  const a = BEST_FOR_PAGES.map((p) => p.audience);
  return `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
}

export function renderBestForHub(): string {
  const cards = BEST_FOR_PAGES.map(
    (p) => `<a class="cmp-card rv" href="/best/${p.slug}">
    <div class="cmp-card-top"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="32" height="32"><div><b>${esc(bestForLinkLabel(p))}</b><small>${esc(bestForQuestion(p))}</small></div></div>
    <p>${esc(p.usBestFor)}.</p>
  </a>`,
  ).join("");
  const body = `<section class="hero cmp-hero">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-inner">
    <span class="eyebrow">Rankings by audience</span>
    <h1>The best way to get B2B sales meetings, by who you are</h1>
    <p class="hero-sub">For ${esc(audienceList())}, distribute.you ranks first: an acquisition agency that runs outbound for you and shows what each positive reply cost. Each page below ranks it against the tools and agents that audience weighs, with their prices read from their own sites.</p>
    ${metaLine()}
  </div>
</section>
<section class="framed tint">
  <div class="wrap cmp-hub"><div class="cmp-grid">${cards}</div></div>
</section>
${liveBand()}`;
  return shell({
    title: `Best cold email agency, AI SDR and lead generation agency by audience (${YEAR})`,
    description: `Rankings for ${BEST_FOR_PAGES.map((p) => p.audience).join(", ")}, comparing distribute.you with ${COMPETITORS.length} tools and agents, prices read from each vendor's site.`,
    path: "/best",
    body,
    jsonLd: [breadcrumb([{ name: "Best for", path: "/best" }])],
  });
}
