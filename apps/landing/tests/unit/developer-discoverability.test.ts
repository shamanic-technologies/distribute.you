import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/blog/db", () => ({ listArticles: vi.fn(async () => []) }));
vi.mock("@/lib/fleet-indexes", async (orig) => ({
  ...(await orig<typeof import("../../src/lib/fleet-indexes")>()),
  fetchIndexList: vi.fn(async () => null),
}));

import { renderAboutPage } from "@/lib/pages/about";
import { renderContactPage } from "@/lib/pages/contact";
import { renderNotFoundPage } from "@/lib/pages/not-found";
import { DOCS_ROUTES, docsUrl } from "@/lib/docs/docs-routes";
import { withSiteChrome } from "../../src/lib/site-chrome";

function read(relative: string): string {
  return readFileSync(join(process.cwd(), relative), "utf8");
}

/**
 * The is-agentic audit's "Developer resource discoverability" finding: a name search
 * surfaced no page on distribute.you, because every developer surface lived on a
 * subdomain. `/developers` answered it on the apex; since SITE-FOUNDATION-1029 the docs
 * themselves live on the apex at `/docs` (docs.distribute.you 301s there) and
 * `/developers` redirects to the docs home. These guards keep the docs findable.
 */
describe("the docs live on the apex", () => {
  it("/developers (and anything under it) redirects permanently to /docs", () => {
    const cfg = read("next.config.ts");
    expect(cfg).toContain('{ source: "/developers", destination: "/docs", permanent: true, missing: offLab }');
    expect(cfg).toContain('{ source: "/developers/:path+", destination: "/docs", permanent: true, missing: offLab }');
  });

  it("every docs route is in the sitemap, at its apex URL", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((entry) => entry.url);
    for (const r of DOCS_ROUTES) expect(urls).toContain(docsUrl(r.path));
    expect(urls).toContain("https://distribute.you/docs");
    expect(urls).not.toContain("https://distribute.you/developers");
  });

  it("every docs route has a page under src/app/docs", () => {
    for (const r of DOCS_ROUTES) {
      const file = r.path === "/" ? "src/app/docs/page.tsx" : `src/app/docs${r.path}/page.tsx`;
      expect(read(file), file).toContain(`docsMetadata("${r.path}")`);
    }
  });

  it("declares the API and its reference as machine-readable types", () => {
    const layout = read("src/app/docs/layout.tsx");
    expect(layout).toContain('"@type": "WebAPI"');
    expect(layout).toContain('"@type": "APIReference"');
    expect(layout).toContain("documentation: `${DOCS_SITE_URL}/api`");
  });
});

describe("a crawler that runs no JavaScript can find it", () => {
  it("is linked from the raw HTML of the served homepage", () => {
    const home = withSiteChrome(read("public/landing/index-v2.html"), "/");
    expect(home).toContain('href="/docs"');
  });

  it("is linked from the raw HTML of the trust pages and the 404", () => {
    for (const [name, html] of [
      ["about", renderAboutPage()],
      ["contact", renderContactPage()],
      ["404", renderNotFoundPage()],
    ] as const) {
      expect(html, name).toContain('href="/docs"');
    }
  });

  it("no page on the apex still points at the old docs host", () => {
    for (const f of ["src/lib/pages/not-found.ts", "src/lib/pages/contact.ts", "src/lib/site-chrome.ts", "public/llms.txt"]) {
      expect(read(f), f).not.toContain("docs.distribute.you");
    }
  });
});

describe("llms.txt points an agent at the docs", () => {
  const llms = read("public/llms.txt");

  it("lists the docs under Developer resources and under Key pages", () => {
    expect(llms).toContain("https://distribute.you/docs");
    expect(llms).toContain("[Docs](https://distribute.you/docs)");
    expect(llms).not.toContain("https://distribute.you/developers");
  });

  it("carries no em-dash, like the rest of the file", () => {
    expect(llms).not.toContain(String.fromCharCode(0x2014));
  });
});
