import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/blog/db", () => ({ listArticles: vi.fn(async () => []) }));

import { staticHtml, staticResponse } from "@/lib/static-html";

function read(relative: string): string {
  return readFileSync(join(process.cwd(), relative), "utf8");
}

const PAGE = "developers.html";
const source = read(`public/landing/${PAGE}`);
const rendered = staticHtml(PAGE);

/**
 * The is-agentic audit's "Developer resource discoverability" finding is not
 * that these surfaces are missing — the API, the OpenAPI document, the MCP
 * server and the CLI have all been live for a while. It is that a name search
 * "surfaced no pages on distribute.you", because every one of them lives on a
 * SUBDOMAIN and the apex carried no page naming them. `/developers` is the
 * page, so what these guards protect is: it exists, it says the product's name
 * where a search engine reads one, it names each resource at its real URL, and
 * a crawler that runs no JavaScript can find it.
 */
describe("/developers exists at a predictable URL", () => {
  it("is wired to a route that serves the static page", () => {
    const route = read("src/app/developers/route.ts");
    expect(route).toContain('staticResponse("developers.html"');
  });

  it("canonicalises to the apex, not to a docs subdomain", () => {
    expect(source).toContain(
      '<link rel="canonical" href="https://distribute.you/developers">',
    );
  });

  it("is in the sitemap", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toContain("https://distribute.you/developers");
  });
});

describe("the product name is where a name search reads one", () => {
  it("names the product in the title, the OG title and the Twitter title", () => {
    const title = source.match(/<title>([\s\S]*?)<\/title>/);
    expect(title?.[1]).toContain("distribute.you");
    for (const prop of ['property="og:title"', 'name="twitter:title"']) {
      const meta = source.match(new RegExp(`${prop} content="([^"]*)"`));
      expect(meta?.[1], prop).toContain("distribute.you");
    }
  });

  it("names the product in the h1 and in the headings that name a resource", () => {
    const h1 = source.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
    expect(h1?.[1]).toContain("distribute.you");
    // A heading per resource, each carrying the product name, because the
    // finding is specifically about name-based queries.
    for (const heading of [
      "The distribute.you API",
      "The distribute.you MCP server",
      "The distribute.you CLI",
    ]) {
      expect(source, heading).toContain(heading);
    }
  });
});

describe("every developer surface is named at its real URL", () => {
  // Each of these was requested live before being published here. A URL that
  // needs a query parameter to answer is deliberately absent: publishing one
  // that 400s bare is worse than not publishing it.
  const URLS = [
    "https://api.distribute.you",
    "https://api.distribute.you/openapi.json",
    "https://api.distribute.you/docs",
    "https://api.distribute.you/v1/costs/platform-prices",
    "https://api.distribute.you/v1/public/channels",
    "https://mcp.distribute.you/mcp",
    "https://docs.distribute.you/",
    "https://docs.distribute.you/mcp",
    "https://docs.distribute.you/openapi",
    "https://www.npmjs.com/package/@distribute.you/cli",
    "/.well-known/mcp.json",
    "/llms.txt",
    "/sitemap.xml",
    "/robots.txt",
  ];

  for (const url of URLS) {
    it(`links ${url}`, () => {
      expect(source).toContain(`href="${url}"`);
    });
  }

  it("states the authentication scheme the deployed OpenAPI document declares", () => {
    // bearerAuth with a `distrib.usr_*` key. `X-API-Key` is the platform/admin
    // scheme and must never be advertised to a customer building a client.
    expect(source).toContain("Bearer distrib.usr_");
    expect(source).not.toContain("X-API-Key");
  });
});

describe("a crawler that runs no JavaScript can find it", () => {
  it("is linked from the raw HTML of the served homepage", () => {
    // The homepage's nav is JS-injected; its footer is not. A JS-injected link
    // is invisible to the link graph, which is how a new page is born orphaned.
    const home = read("public/landing/index-v1.html");
    expect(home).toContain('href="https://distribute.you/developers"');
  });

  it("is linked from the raw HTML of the trust pages and the 404", () => {
    for (const page of ["about.html", "contact.html", "404.html"]) {
      expect(read(`public/landing/${page}`), page).toContain('href="/developers"');
    }
  });

  it("is in the shared footer every other static page injects", () => {
    const components = read("public/landing/js/components.js");
    expect(components).toContain('href="/developers"');
  });

  it("bumps the components.js cache-buster on every page that links it", () => {
    // Editing the injected nav/footer ships nothing to a returning visitor
    // unless the `?v=N` token moves: it is its own edge cache key.
    const pages = ["index-v1.html", "about.html", "contact.html", "pricing.html"];
    for (const page of pages) {
      const html = read(`public/landing/${page}`);
      if (!html.includes("js/components.js")) continue;
      expect(html, page).toContain("js/components.js?v=2");
      expect(html, page).not.toContain("js/components.js?v=1");
    }
  });
});

describe("llms.txt points an agent at the page", () => {
  const llms = read("public/llms.txt");

  it("lists it under Developer resources and under Key pages", () => {
    expect(llms).toContain("https://distribute.you/developers");
    expect(llms).toContain("[Developers](https://distribute.you/developers)");
  });

  it("carries no em-dash, like the rest of the file", () => {
    expect(llms).not.toContain(String.fromCharCode(0x2014));
  });
});

describe("the page itself holds the repo's conventions", () => {
  it("carries no em-dash, since every string on it is copy a person reads", () => {
    expect(source).not.toContain(String.fromCharCode(0x2014));
  });

  it("gets the canonical Organization injected, and declares none of its own", () => {
    // `withCanonicalOrganization` deletes a hand-written Organization node and
    // injects the one from lib/seo. A second one here would be a second answer.
    const blocks = [...rendered.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    const orgs = blocks
      .map((m) => JSON.parse(m[1]) as Record<string, unknown>)
      .flatMap((node) => {
        const graph = node["@graph"];
        return Array.isArray(graph) ? (graph as Record<string, unknown>[]) : [node];
      })
      .filter((node) => node["@type"] === "Organization");
    expect(orgs).toHaveLength(1);
    expect(orgs[0].name).toBe("distribute.you");
  });

  it("declares the API and its reference as machine-readable types", () => {
    const graph = JSON.parse(
      source.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1],
    )["@graph"] as Record<string, unknown>[];
    const types = graph.map((node) => node["@type"]);
    expect(types).toContain("WebAPI");
    expect(types).toContain("APIReference");
    expect(types).toContain("BreadcrumbList");
    const api = graph.find((node) => node["@type"] === "WebAPI")!;
    expect(api.url).toBe("https://api.distribute.you");
    expect(api.documentation).toBe("https://docs.distribute.you/");
  });

  it("answers markdown as well as HTML, like every other static page", async () => {
    const asMarkdown = await staticResponse(
      PAGE,
      new Request("https://distribute.you/developers", {
        headers: { accept: "text/markdown" },
      }),
    );
    expect(asMarkdown.status).toBe(200);
    expect(asMarkdown.headers.get("content-type")).toContain("text/markdown");
    const body = await asMarkdown.text();
    expect(body).toContain("distribute.you");
    expect(body).toContain("https://api.distribute.you/openapi.json");
  });

  it("refuses a client that accepts neither HTML nor markdown", async () => {
    const res = await staticResponse(
      PAGE,
      new Request("https://distribute.you/developers", {
        headers: { accept: "application/pdf" },
      }),
    );
    expect(res.status).toBe(406);
  });
});
