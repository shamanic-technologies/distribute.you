/**
 * The site's chrome as DATA: the top nav and the footer every page wears, built from
 * the page catalogue (`site-pages.ts`), the competitor catalogue and the best-for list.
 *
 * Two thin renderers draw it: `navHtml` / `footerHtml` below (static and request-rendered
 * pages, the homepage included through its `<!--site-nav-->` / `<!--site-footer-->`
 * tokens) and `components/navbar.tsx` / `components/footer.tsx` (React pages). Neither
 * holds a link of its own, so a page added to the catalogue reaches every nav and footer
 * at once.
 *
 * Footer variants (owner 2026-10-29): `agent` on an AI Agent page, `agency` on an Agency
 * page, `home` on `/` and on every page that is not an outcome page (both columns).
 *
 * Alias-free: the unit tests render it directly.
 */
import { COMPARE_CLUSTERS, COMPETITORS, clusterAlternativesPath, competitorPath } from "./competitors";
import { BEST_FOR_PAGES, bestForLinkLabel, bestForPath } from "./best-for";
import { INDEX_LINKS_TOKEN } from "./fleet-indexes";
import { OUTCOMES, SITE_PAGES, livePages, ownerPage, pageAt, type SitePage } from "./site-pages";

export const SIGN_UP = "https://dashboard.distribute.you/get-started";
export const SIGN_IN = "https://dashboard.distribute.you/sign-in";
/**
 * Where every "Book a call" goes: the booking link of the distribute.you brand's
 * "Sales-led" offer in brand-service (`brand_offers.booking_url`, offer 5a2868bb, read
 * 2026-10-29). The landing holds no brand-service key, so the served value is copied
 * here; change it in brand-service AND here together.
 */
export const BOOK_A_CALL = "https://calendar.app.google/BkmyoA7ujMFFDg1s9";
/** The developer docs, served by the landing since SITE-FOUNDATION-1029. */
export const DOCS_HREF = "/docs";
export const WHY = "Revenue made easy.";

/** The tokens the hand-written homepage carries in place of its chrome. */
export const SITE_NAV_TOKEN = "<!--site-nav-->";
export const SITE_FOOTER_TOKEN = "<!--site-footer-->";

export type ChromeLink = { label: string; href: string; description?: string };
export type NavGroup = {
  label: string;
  href: string;
  items: ChromeLink[];
  /** A row of small links under the items. */
  extra?: ChromeLink[];
  /** The promo card inside a dropdown (Apollo / lemlist pattern). */
  featured?: { title: string; line: string; cta: ChromeLink };
};
export type NavModel = {
  groups: NavGroup[];
  links: ChromeLink[];
  signIn: ChromeLink;
  /** First = the primary button. The page's buyer decides the order. */
  ctas: ChromeLink[];
};
export type FooterVariant = "home" | "agent" | "agency";
export type FooterColumn = { title: string; links: ChromeLink[]; indexLinks?: boolean };
export type FooterModel = { variant: FooterVariant; columns: FooterColumn[]; bridge?: ChromeLink };

const START_FREE: ChromeLink = { label: "Start free", href: SIGN_UP };
const BOOK: ChromeLink = { label: "Book a call", href: BOOK_A_CALL };
const DOCS: ChromeLink = { label: "Docs", href: DOCS_HREF };
const CATALOG: ChromeLink = { label: "Price catalog", href: "/catalog" };

export function footerVariantFor(path: string, pages: SitePage[] = SITE_PAGES): FooterVariant {
  if (path === "/") return "home";
  return ownerPage(path, pages)?.buyer ?? "home";
}

const toLink = (p: SitePage): ChromeLink => ({ label: p.navLabel, href: p.path, description: p.description });

export function navModel(path: string, pages: SitePage[] = SITE_PAGES): NavModel {
  const agents = livePages("agent", pages);
  const agencies = livePages("agency", pages);
  const groups: NavGroup[] = [];
  if (agents.length) {
    groups.push({
      label: "AI Agent",
      href: agents[0].path,
      items: agents.map(toLink),
      // No Mac app link: `/desktop` stays unlinked and noindex (owner 2026-10-04).
      extra: [DOCS, CATALOG, { label: "Use from Claude Code or Grok", href: "/docs/integrations/claude" }],
    });
  }
  if (agencies.length) {
    groups.push({
      label: "Agency",
      href: agencies[0].path,
      items: agencies.map(toLink),
      featured: { title: "From $1K/month + 10% of budget", line: "Your GTM department, run for you.", cta: BOOK },
    });
  }
  groups.push(
    {
      label: "Data",
      href: "/indexes",
      items: [
        { label: "Indexes", href: "/indexes", description: "Live cold email benchmarks, updated daily" },
        { label: "Blog", href: "/blog", description: "Studies and guides from our own campaigns" },
      ],
    },
    {
      label: "Compare",
      href: "/compare",
      items: [
        { label: "All comparisons", href: "/compare", description: "distribute.you beside each tool, side by side" },
        { label: "Alternatives", href: "/alternatives", description: "Every alternative, grouped by what it does" },
        { label: "Best for", href: "/best", description: "Who fits which kind of company" },
      ],
    },
  );
  const agencyPage = footerVariantFor(path, pages) === "agency";
  // A "Book a call" button only once an Agency page is live: nothing points at a page we do not serve.
  const ctas = agencyPage ? [BOOK, START_FREE] : agencies.length ? [START_FREE, BOOK] : [START_FREE];
  return {
    groups,
    links: [{ label: "Catalog", href: "/catalog" }, DOCS],
    signIn: { label: "Log in", href: SIGN_IN },
    ctas,
  };
}

function compareColumn(): FooterColumn {
  return {
    title: "Compare",
    links: [
      ...COMPETITORS.map((c) => ({ label: `distribute.you vs ${c.name}`, href: competitorPath(c) })),
      ...COMPARE_CLUSTERS.map((k) => ({ label: `${k.name} alternatives`, href: clusterAlternativesPath(k) })),
      { label: "All comparisons", href: "/compare" },
      { label: "Alternatives", href: "/alternatives" },
    ],
  };
}

function bestForColumn(): FooterColumn {
  return {
    title: "Best for",
    links: [
      ...BEST_FOR_PAGES.map((p) => ({ label: bestForLinkLabel(p), href: bestForPath(p) })),
      { label: "All rankings", href: "/best" },
    ],
  };
}

const INDEXES_COLUMN: FooterColumn = {
  title: "Indexes",
  indexLinks: true,
  links: [{ label: "All indexes", href: "/indexes" }],
};
const FOR_AGENTS_COLUMN: FooterColumn = {
  title: "For agents",
  links: [
    { label: "llms.txt", href: "/llms.txt" },
    { label: "MCP server", href: "/docs/mcp" },
    DOCS,
  ],
};
const COMPANY_COLUMN: FooterColumn = {
  title: "Company",
  links: [
    { label: "About", href: "/about" },
    { label: "Investors", href: "/investors" },
    { label: "Contact", href: "/contact" },
    { label: "Blog", href: "/blog" },
  ],
};
const LEGAL_COLUMN: FooterColumn = {
  title: "Legal",
  links: [
    { label: "Terms", href: "/terms" },
    { label: "Privacy", href: "/privacy" },
  ],
};

function outcomeName(p: SitePage): string {
  return OUTCOMES.find((o) => o.slug === p.outcome)?.name ?? p.navLabel;
}

export function footerModel(path: string, pages: SitePage[] = SITE_PAGES): FooterModel {
  const variant = footerVariantFor(path, pages);
  const agents = livePages("agent", pages).map((p) => ({ label: p.navLabel, href: p.path }));
  const agencies = livePages("agency", pages).map((p) => ({ label: p.navLabel, href: p.path }));
  const home = pageAt("/", pages);
  const page = variant === "home" ? home : ownerPage(path, pages);
  const sections = page?.sections ?? [];
  const tail = [compareColumn(), bestForColumn(), INDEXES_COLUMN];

  if (variant === "agency" && page) {
    const twin = pages.find((p) => p.live && p.buyer === "agent" && p.outcome === page.outcome);
    return {
      variant,
      columns: [
        { title: "Agency", links: [BOOK, ...sections, ...agencies] },
        ...(page.compare?.length ? [{ title: "Compare agencies", links: page.compare }] : []),
        ...tail,
        COMPANY_COLUMN,
        LEGAL_COLUMN,
      ],
      bridge: { label: "Just testing? Start free", href: twin?.path ?? SIGN_UP },
    };
  }

  const product: FooterColumn = { title: "Product", links: [...sections, CATALOG, DOCS] };
  const columns: FooterColumn[] = [product, { title: "AI Agent", links: agents }];
  // An AI Agent page with its own vs/alternatives cluster lists it next (the AI SDR page).
  if (variant === "agent" && page?.compare?.length) columns.push({ title: page.compareTitle ?? "Compare", links: page.compare });
  if (variant === "home" && agencies.length) columns.push({ title: "Agency", links: [BOOK, ...agencies] });
  columns.push(...tail, FOR_AGENTS_COLUMN, COMPANY_COLUMN, LEGAL_COLUMN);

  let bridge: ChromeLink | undefined;
  if (variant === "agent" && page) {
    const twin = pages.find((p) => p.live && p.buyer === "agency" && p.outcome === page.outcome);
    // The bridge names the twin Agency page only once it is served.
    if (twin) bridge = { label: `Scaling? See our ${outcomeName(page)} agency`, href: twin.path };
  }
  return { variant, columns, bridge };
}

/** The folded menu under 960px: every nav link once, grouped as in the bar. */
export function mobileMenu(m: NavModel): { label?: string; links: ChromeLink[] }[] {
  const seen = new Set<string>();
  const once = (links: ChromeLink[]) => links.filter((l) => !seen.has(l.href) && seen.add(l.href));
  const groups: { label?: string; links: ChromeLink[] }[] = m.groups.map((g) => ({
    label: g.label,
    links: once([...g.items, ...(g.extra ?? [])]),
  }));
  groups.push({ links: once([...m.links, ...m.ctas.slice(1)]) });
  return groups.filter((g) => g.links.length);
}

// ---------- HTML renderer (static and request-rendered pages) ----------

export function esc(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const CHEVRON =
  '<svg class="nav-chev" width="10" height="10" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function dropHtml(g: NavGroup): string {
  const items = g.items
    .map(
      (i) =>
        `<a class="nav-item" href="${esc(i.href)}"><b>${esc(i.label)}</b>${i.description ? `<span>${esc(i.description)}</span>` : ""}</a>`,
    )
    .join("");
  const extra = g.extra?.length
    ? `<div class="nav-drop-extra">${g.extra.map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join("")}</div>`
    : "";
  const featured = g.featured
    ? `<a class="nav-featured" href="${esc(g.featured.cta.href)}"><b>${esc(g.featured.title)}</b><span>${esc(g.featured.line)}</span><em>${esc(g.featured.cta.label)}</em></a>`
    : "";
  return `<div class="nav-drop"><div class="nav-drop-in${g.featured ? " has-featured" : ""}"><div class="nav-drop-items">${items}</div>${featured}${extra}</div></div>`;
}

export function navHtml(path: string, pages: SitePage[] = SITE_PAGES): string {
  const m = navModel(path, pages);
  const groups = m.groups
    .map(
      (g) =>
        `<div class="nav-group"><a class="nav-top" href="${esc(g.href)}" aria-haspopup="true">${esc(g.label)}${CHEVRON}</a>${dropHtml(g)}</div>`,
    )
    .join("");
  const links = m.links.map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join("");
  const [primary, ...rest] = m.ctas;
  const secondary = rest
    .map((c) => `<a class="btn btn-outline nav-cta-2" href="${esc(c.href)}">${esc(c.label)}</a>`)
    .join("");
  const menu = mobileMenu(m)
    .map(
      (g) =>
        `<div class="nav-menu-group">${g.label ? `<p>${esc(g.label)}</p>` : ""}${g.links
          .map((i) => `<a href="${esc(i.href)}">${esc(i.label)}</a>`)
          .join("")}</div>`,
    )
    .join("");
  return `<div class="nav" id="nav">
  <div class="nav-pill">
    <a class="brand" href="/"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="26" height="26">distribute.you</a>
    <nav class="nav-links">${groups}${links}</nav>
    <div class="nav-right">
      <a class="btn btn-ghost" href="${esc(m.signIn.href)}">${esc(m.signIn.label)}</a>
      ${secondary}<a class="btn btn-primary" href="${esc(primary.href)}">${esc(primary.label)}</a>
      <details class="nav-menu"><summary aria-label="Menu"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></summary><nav class="nav-menu-panel">${menu}</nav></details>
    </div>
  </div>
</div>`;
}

function columnHtml(c: FooterColumn): string {
  const links = c.links.map((l) => `<li><a href="${esc(l.href)}">${esc(l.label)}</a></li>`).join("");
  return `<div><h4>${esc(c.title)}</h4><ul>${c.indexLinks ? INDEX_LINKS_TOKEN : ""}${links}</ul></div>`;
}

/** The link grid and the bottom line; a page may put its own band (the trust row) above it. */
export function footerInnerHtml(path: string, pages: SitePage[] = SITE_PAGES): string {
  const m = footerModel(path, pages);
  const bridge = m.bridge ? `<a class="foot-bridge" href="${esc(m.bridge.href)}">${esc(m.bridge.label)}</a>` : "";
  return `<div class="foot" data-footer="${m.variant}">
      <div class="foot-brand">
        <a class="brand" href="/"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="26" height="26">distribute.you</a>
        <p class="tag">${WHY}</p>${bridge}
      </div>
      ${m.columns.map(columnHtml).join("\n      ")}
    </div>
    <div class="foot-bottom"><span>© 2026 distribute.you</span></div>
    <div class="foot-mark" aria-hidden="true">distribute.you</div>`;
}

export function footerHtml(path: string, pages: SitePage[] = SITE_PAGES): string {
  return `<footer>
  <div class="wrap">
    ${footerInnerHtml(path, pages)}
  </div>
</footer>`;
}

/**
 * The hand-written homepage carries `<!--site-nav-->` where its nav was and
 * `<!--site-footer-->` inside its `<footer>` (under the trust row). Resolved at serve time
 * like every other token, so the raw HTML a crawler reads holds every link.
 */
export function withSiteChrome(html: string, path: string, pages: SitePage[] = SITE_PAGES): string {
  if (!html.includes(SITE_NAV_TOKEN) && !html.includes(SITE_FOOTER_TOKEN)) return html;
  return html.replaceAll(SITE_NAV_TOKEN, navHtml(path, pages)).replaceAll(SITE_FOOTER_TOKEN, footerInnerHtml(path, pages));
}
