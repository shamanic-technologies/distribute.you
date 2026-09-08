import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/blog/db", () => ({ listArticles: vi.fn(async () => []) }));

import { decorateHtml, renderedResponse, staticHtml } from "@/lib/static-html";
import { organizationJsonLd } from "@/lib/seo";
import { renderAboutPage } from "@/lib/pages/about";
import { renderContactPage } from "@/lib/pages/contact";
import { renderDevelopersPage } from "@/lib/pages/developers";
import { renderNotFoundPage } from "@/lib/pages/not-found";

function read(relative: string): string {
  return readFileSync(join(process.cwd(), relative), "utf8");
}

function accepting(accept?: string): Request {
  return new Request("https://distribute.you/about", {
    headers: accept ? { accept } : {},
  });
}

// The About page carries none of the live-figure tokens, so rendering it makes no
// network call and the negotiation is the only thing under test here.
const PAGE = renderAboutPage();

/** Every document page the apex renders from TypeScript, by file-name-like key. */
const RENDERED: Record<string, string> = {
  "about": renderAboutPage(),
  "contact": renderContactPage(),
  "developers": renderDevelopersPage(),
  "404": renderNotFoundPage(),
};

describe("Accept negotiation on a statically-served page", () => {
  it("serves the HTML document to a browser, and varies on Accept", async () => {
    const res = await renderedResponse(
      PAGE,
      accepting("text/html,application/xhtml+xml;q=0.9,*/*;q=0.8"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("vary")).toContain("Accept");
    expect(await res.text()).toContain("<!doctype html>");
  });

  it("is byte-unchanged when no Accept header is sent", async () => {
    const withHeader = await renderedResponse(PAGE, accepting("text/html"));
    const without = await renderedResponse(PAGE, accepting());
    const bare = await renderedResponse(PAGE);
    const baseline = await withHeader.text();
    expect(await without.text()).toBe(baseline);
    expect(await bare.text()).toBe(baseline);
    expect(bare.headers.get("content-type")).toBe("text/html; charset=utf-8");
  });

  it("serves markdown of that page's own content when asked", async () => {
    const res = await renderedResponse(PAGE, accepting("text/markdown"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("vary")).toContain("Accept");

    const body = await res.text();
    expect(body).not.toContain("<!doctype html>");
    expect(body).not.toMatch(/<[a-z/][^>]*>/i);
    expect(body).toContain("# About distribute.you");
    expect(body).toContain("> Source: https://distribute.you/about");
    // Real content of THIS page, not a generic stub.
    expect(body).toContain("## What we sell");
    expect(body).toContain("## How you pay");
    expect(body.length).toBeGreaterThan(1500);
  });

  it("keeps the markdown variant out of a shared cache", async () => {
    // Cloudflare honours Vary only for Accept-Encoding, so a cacheable markdown
    // body could be handed to a browser asking the same URL for HTML.
    const res = await renderedResponse(PAGE, accepting("text/markdown"));
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 406 for a type it cannot produce", async () => {
    const res = await renderedResponse(PAGE, accepting("application/json"));
    expect(res.status).toBe(406);
    expect(res.headers.get("vary")).toContain("Accept");
    expect(await res.text()).toContain("text/markdown");
  });

  it("honours a status override for the 404 handler, in both variants", async () => {
    const html = await renderedResponse(RENDERED["404"], accepting("text/html"), { status: 404 });
    expect(html.status).toBe(404);
    const md = await renderedResponse(RENDERED["404"], accepting("text/markdown"), {
      status: 404,
      canonicalPath: "/404",
    });
    expect(md.status).toBe(404);
    const body = await md.text();
    expect(body).toContain("/sitemap.xml");
    expect(body).toContain("/llms.txt");
    expect(body).toContain("https://distribute.you/compare");
  });
});

describe("every static route passes the request through", () => {
  it("has no response call that drops the Accept header", () => {
    expect(read("src/app/route.ts")).toMatch(/staticResponse\("[^"]+", request/);
    for (const file of [
      "src/app/about/route.ts",
      "src/app/contact/route.ts",
      "src/app/developers/route.ts",
      "src/app/[...notFound]/route.ts",
    ]) {
      expect(read(file), file).toMatch(/renderedResponse\(render\w+Page\(\), request/);
    }
  });
});

describe("Organization structured data", () => {
  const org = organizationJsonLd();

  it("states a contact point and a postal address", () => {
    expect(org.contactPoint.email).toBe("support@distribute.you");
    expect(org.address["@type"]).toBe("PostalAddress");
    expect(org.address.addressLocality).toBe("Douelle");
    expect(org.address.postalCode).toBe("46140");
    expect(org.address.addressCountry).toBe("FR");
    expect(org.address.streetAddress).toContain("285 rue de l");
  });

  // The registered entity, verified against the company register rather than
  // against what the site used to say. "Shamanic Technologies" is the GitHub
  // organisation handle and was never a legal name; a commercial site here is
  // required to publish the real one, and an agent checking legitimacy reads
  // exactly this field.
  it("states the registered entity and its SIREN", () => {
    expect(org.legalName).toBe("BLOOMING GENERATION");
    expect(org.identifier).toBe("882102775");
  });

  const DECORATED: Record<string, string> = {
    "index-v2.html": staticHtml("index-v2.html"),
    about: decorateHtml(RENDERED.about),
    contact: decorateHtml(RENDERED.contact),
    developers: decorateHtml(RENDERED.developers),
  };
  for (const page of Object.keys(DECORATED)) {
    it(`injects exactly one Organization into ${page}`, () => {
      const html = DECORATED[page];
      const blocks =
        html.match(
          /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
        ) ?? [];
      const organizations = blocks.flatMap((block) => {
        const json = block.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "");
        const parsed = JSON.parse(json) as Record<string, unknown>;
        const graph = Array.isArray(parsed["@graph"]) ? parsed["@graph"] : [parsed];
        return graph.filter(
          (node) => (node as Record<string, unknown>)?.["@type"] === "Organization",
        );
      });
      expect(organizations).toHaveLength(1);
      expect(organizations[0]).toMatchObject({
        "@type": "Organization",
        legalName: "BLOOMING GENERATION",
        identifier: "882102775",
        address: { "@type": "PostalAddress", addressLocality: "Douelle" },
        contactPoint: { email: "support@distribute.you" },
      });
    });
  }

  it("leaves an unparseable ld+json block alone rather than deleting it", () => {
    // Guards the fail-soft branch: broken structured data is a bug to fix at its
    // source, and dropping it because we could not read it is strictly worse.
    const html = decorateHtml(RENDERED.about);
    expect(html).toContain("AboutPage");
  });
});

describe("trust anchor pages", () => {
  for (const page of ["about", "contact"]) {
    it(`${page} carries real content and is indexable`, () => {
      const html = RENDERED[page];
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<head[\s\S]*?<\/head>/i, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      expect(text.length).toBeGreaterThan(500);
      expect(html).not.toContain("noindex");
      expect(html).toContain("<link rel=\"canonical\"");
    });

    it(`${page} ships no em-dash`, () => {
      expect(RENDERED[page]).not.toContain(String.fromCharCode(0x2014));
    });
  }

  it("states the company address on both pages", () => {
    for (const page of ["about", "contact"]) {
      const html = RENDERED[page];
      expect(html).toContain("285 rue de l");
      expect(html).toContain("46140 Douelle");
    }
  });

  it("never calls the product a cold email tool", () => {
    for (const page of ["about", "contact", "404"]) {
      const html = RENDERED[page].toLowerCase();
      expect(html).not.toContain("cold email tool");
      expect(html).not.toContain("at cost");
      expect(html).not.toContain("pass-through");
      expect(html).not.toContain("no markup");
      expect(html).not.toContain("costs us");
    }
  });

  it("is reachable from the site", () => {
    // Raw HTML on the homepage, because a JS-injected link is invisible to a
    // crawler that does not run scripts.
    const home = read("public/landing/index-v2.html");
    expect(home).toContain('href="https://distribute.you/about"');
    expect(home).toContain('href="https://distribute.you/contact"');
    // Plus the footer every rendered page carries.
    for (const page of ["about", "contact", "developers"]) {
      expect(RENDERED[page]).toContain('href="/about"');
      expect(RENDERED[page]).toContain('href="/contact"');
    }
  });

  it("is in the sitemap", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toContain("https://distribute.you/about");
    expect(urls).toContain("https://distribute.you/contact");
    // The 404 is not a destination.
    expect(urls).not.toContain("https://distribute.you/404");
  });
});

describe("llms.txt", () => {
  const llms = read("public/llms.txt");

  it("says when to use distribute.you, and when not to", () => {
    expect(llms).toContain("## When to use distribute.you");
    expect(llms).toContain("Do NOT reach for distribute.you when");
    expect(llms).toContain("Book sales meetings");
  });

  it("names the developer surfaces at their real URLs", () => {
    expect(llms).toContain("https://docs.distribute.you/");
    expect(llms).toContain("https://api.distribute.you/openapi.json");
    expect(llms).toContain("https://mcp.distribute.you/mcp");
    expect(llms).toContain("https://distribute.you/.well-known/mcp.json");
  });

  it("tells an agent how to ask for markdown", () => {
    expect(llms).toContain("Accept: text/markdown");
  });

  it("keeps the positioning honest", () => {
    const lower = llms.toLowerCase();
    expect(lower).toContain("acquisition agency");
    // "cold email tool" appears once, in the Do-NOT list, naming what we are not.
    expect(lower).not.toMatch(/distribute\.you is a[^.]*cold email tool/);
    expect(lower.split("cold email tool").length - 1).toBe(1);
    expect(lower).not.toContain("at cost");
    expect(lower).not.toContain("costs us");
    expect(llms).not.toContain(String.fromCharCode(0x2014));
  });
});

describe("MCP descriptor", () => {
  it("names the live server and how to reach it", async () => {
    const { GET } = await import("@/app/.well-known/mcp.json/route");
    const res = GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      name: string;
      servers: { url: string; transport: string }[];
      openapi: string;
      documentation: string;
    };
    expect(body.name).toBe("distribute.you");
    expect(body.servers[0].url).toBe("https://mcp.distribute.you/mcp");
    expect(body.servers[0].transport).toBe("streamable-http");
    expect(body.openapi).toBe("https://api.distribute.you/openapi.json");
    expect(body.documentation).toContain("docs.distribute.you");
  });
});
