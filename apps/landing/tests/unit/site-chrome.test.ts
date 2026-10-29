import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { SITE_PAGES, livePages, sitePagePaths, type SitePage } from "../../src/lib/site-pages";
import {
  BOOK_A_CALL,
  SIGN_UP,
  footerHtml,
  footerModel,
  navHtml,
  navModel,
  withSiteChrome,
} from "../../src/lib/site-chrome";

/**
 * SITE-FOUNDATION-1029: one page catalogue feeds the nav, the three footer variants and
 * the sitemap. The fixture flips two pages live (an Agent page and its Agency twin) and
 * asserts each surface picks them up with no other edit.
 */
const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

const FIXTURE: SitePage[] = SITE_PAGES.map((p) =>
  p.outcome === "cold-email" ? { ...p, live: true } : p,
);
const AGENT = "/cold-email-automation";
const AGENCY = "/cold-email-agency";

vi.mock("@/lib/blog/db", () => ({ listArticles: vi.fn(async () => []) }));
vi.mock("@/lib/fleet-indexes", async (orig) => ({
  ...(await orig<typeof import("../../src/lib/fleet-indexes")>()),
  fetchIndexList: vi.fn(async () => null),
}));
const pagesRef: { pages: SitePage[] } = { pages: SITE_PAGES };
vi.mock("@/lib/site-pages", async (orig) => {
  const real = await orig<typeof import("../../src/lib/site-pages")>();
  return { ...real, sitePagePaths: (pages?: SitePage[]) => real.sitePagePaths(pages ?? pagesRef.pages) };
});

describe("the catalogue starts with the pages served today", () => {
  it("`/`, `/gtm-agency` and `/ai-sdr` are live; 19 entries, one per outcome and buyer (Revenue has no Agency page)", () => {
    expect(SITE_PAGES).toHaveLength(19);
    expect(livePages().map((p) => p.path)).toEqual(["/", "/gtm-agency", "/ai-sdr"]);
    expect(new Set(SITE_PAGES.map((p) => p.path)).size).toBe(19);
  });

  it("a page that is not live is linked from nowhere", () => {
    const html = navHtml("/") + footerHtml("/");
    for (const p of SITE_PAGES.filter((x) => !x.live)) expect(html).not.toContain(`href="${p.path}"`);
    // The GTM Agency page is served (PAGE-REVENUE-AGENCY-1029): the Agency menu and
    // the Book a call button appear, Start free stays first on `/`.
    expect(navModel("/").groups.map((g) => g.label)).toContain("Agency");
    expect(navModel("/").ctas).toEqual([
      { label: "Start free", href: SIGN_UP },
      { label: "Book a call", href: BOOK_A_CALL },
    ]);
    expect(navModel("/gtm-agency").ctas[0]).toEqual({ label: "Book a call", href: BOOK_A_CALL });
  });
});

describe("adding a catalogue entry adds it everywhere", () => {
  it("the nav lists it under its buyer, with its one line", () => {
    const html = navHtml("/", FIXTURE);
    expect(html).toContain(`href="${AGENT}"><b>Sales Cold Email Automation</b>`);
    expect(html).toContain(`href="${AGENCY}"><b>Sales Cold Email Agency</b>`);
    expect(navModel("/", FIXTURE).groups.map((g) => g.label)).toEqual(["AI Agent", "Agency", "Data", "Compare"]);
  });

  it("the primary button follows the page's buyer", () => {
    expect(navModel(AGENT, FIXTURE).ctas.map((c) => c.label)).toEqual(["Start free", "Book a call"]);
    expect(navModel(AGENCY, FIXTURE).ctas.map((c) => c.label)).toEqual(["Book a call", "Start free"]);
  });

  it("each page gets its footer variant, with the bridge to its twin", () => {
    expect(footerModel("/", FIXTURE).variant).toBe("home");
    const agent = footerModel(AGENT, FIXTURE);
    expect(agent.variant).toBe("agent");
    expect(agent.bridge).toEqual({ label: "Scaling? See our Sales Cold Email agency", href: AGENCY });
    expect(agent.columns.find((c) => c.title === "AI Agent")?.links.map((l) => l.href)).toContain(AGENT);
    const agency = footerModel(AGENCY, FIXTURE);
    expect(agency.variant).toBe("agency");
    expect(agency.bridge).toEqual({ label: "Just testing? Start free", href: AGENT });
    expect(agency.columns[0].links.map((l) => l.href)).toContain(AGENCY);
    // The home footer carries both columns.
    const home = footerModel("/", FIXTURE).columns.map((c) => c.title);
    expect(home).toContain("AI Agent");
    expect(home).toContain("Agency");
  });

  it("the sitemap lists it", async () => {
    expect(sitePagePaths(FIXTURE)).toEqual(["/", "/gtm-agency", AGENT, AGENCY, "/ai-sdr"]);
    pagesRef.pages = FIXTURE;
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((e) => e.url);
    pagesRef.pages = SITE_PAGES;
    expect(urls).toContain(`https://distribute.you${AGENT}`);
    expect(urls).toContain(`https://distribute.you${AGENCY}`);
    expect(urls).toContain("https://distribute.you");
  });
});

describe("an AI Agent page served at its search path (PAGE-AI-SDR-1029)", () => {
  it("Meetings Booked is `/ai-sdr`, never `/meetings-automation`, and wears the agent footer", () => {
    const page = SITE_PAGES.find((p) => p.outcome === "meetings" && p.buyer === "agent")!;
    expect(page.path).toBe("/ai-sdr");
    expect(page.live).toBe(true);
    expect(SITE_PAGES.some((p) => p.path === "/meetings-automation")).toBe(false);
    const model = footerModel("/ai-sdr/vs/11x");
    expect(model.variant).toBe("agent");
    const compare = model.columns.find((c) => c.title === "Compare AI SDRs")!;
    expect(compare.links.map((l) => l.href)).toEqual([
      "/ai-sdr/vs/11x",
      "/ai-sdr/vs/artisan",
      "/ai-sdr/vs/aisdr",
      "/ai-sdr/vs/qualified",
      "/ai-sdr/alternatives",
    ]);
    expect(navHtml("/")).toContain('href="/ai-sdr"><b>Meetings Booked Automation</b>');
  });
});

describe("one chrome on every surface", () => {
  it("the homepage files carry the tokens, never a hand-written nav or footer", () => {
    for (const f of ["public/landing/index-v2.html", "public/landing/index-v2-subscription.html"]) {
      const raw = read(f);
      expect(raw).toContain("<!--site-nav-->");
      expect(raw).toContain("<!--site-footer-->");
      expect(raw).not.toContain('<div class="nav-pill">');
      expect(raw).not.toContain('<div class="foot">');
      const served = withSiteChrome(raw, "/");
      expect(served).toContain('<div class="nav-pill">');
      expect(served).toContain('<div class="foot" data-footer="home">');
      // The trust row stays above the link grid.
      expect(served.indexOf("faces-row", served.indexOf("<footer>"))).toBeLessThan(served.indexOf('class="foot"'));
    }
    expect(read("src/app/route.ts")).toContain('withSiteChrome(page, "/")');
  });

  it("the shell, the React components and the desktop page draw the same model", () => {
    expect(read("src/lib/v2-shell.ts")).toContain("navHtml(path)");
    expect(read("src/lib/v2-shell.ts")).toContain("footerHtml(path)");
    expect(read("src/components/navbar.tsx")).toContain("navModel(path)");
    expect(read("src/components/footer.tsx")).toContain("footerModel(path)");
    expect(read("src/lib/pages/desktop.ts")).toContain("footerHtml(DESKTOP_PATH)");
  });

  it("the React footer names the same pages as the rendered one", () => {
    const fromHtml = [...footerHtml("/").matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    // The brand mark links `/` once more than the columns do.
    fromHtml.splice(fromHtml.indexOf("/"), 1);
    const fromModel = footerModel("/").columns.flatMap((c) => c.links.map((l) => l.href));
    expect(fromHtml.sort()).toEqual(fromModel.sort());
  });

  it("Log in is in the nav on every variant", () => {
    for (const p of ["/", AGENT, AGENCY]) expect(navHtml(p, FIXTURE)).toContain(">Log in</a>");
  });

  it("the mobile menu holds every nav link", () => {
    const html = navHtml("/", FIXTURE);
    const menu = html.slice(html.indexOf('<nav class="nav-menu-panel">'));
    for (const g of navModel("/", FIXTURE).groups) for (const i of g.items) expect(menu).toContain(`href="${i.href}"`);
  });
});

describe("the retired homepage candidates stay a noindex archive", () => {
  it("/lp/* are noindex, out of the A/B draw, out of the sitemap and the catalogue", () => {
    const ab = read("src/lib/landing-ab.ts");
    for (const v of ["instinct", "assistant", "concierge"]) expect(ab).toMatch(new RegExp(`\\b${v}: 0,`));
    expect(read("src/app/sitemap.ts")).not.toContain("/lp/");
    expect(SITE_PAGES.some((p) => p.path.startsWith("/lp/"))).toBe(false);
    expect(read("src/lib/pages/instinct.ts")).toContain('<meta name="robots" content="noindex">');
    expect(read("src/lib/pages/assistant.ts")).toContain('noindex: serving.at === "candidate"');
    expect(read("src/lib/pages/concierge.ts")).toContain('noindex: serving.at === "candidate"');
  });
});
