import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/blog/db", () => ({ listArticles: vi.fn(async () => []) }));

import { staticHtml, staticResponse } from "@/lib/static-html";
import { organizationJsonLd } from "@/lib/seo";

function read(relative: string): string {
  return readFileSync(join(process.cwd(), relative), "utf8");
}

function accepting(accept?: string): Request {
  return new Request("https://distribute.you/about", {
    headers: accept ? { accept } : {},
  });
}

// about.html carries none of the live-metric tokens, so rendering it makes no
// network call and the negotiation is the only thing under test here.
const PAGE = "about.html";

describe("Accept negotiation on a statically-served page", () => {
  it("serves the HTML document to a browser, and varies on Accept", async () => {
    const res = await staticResponse(
      PAGE,
      accepting("text/html,application/xhtml+xml;q=0.9,*/*;q=0.8"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("vary")).toContain("Accept");
    expect(await res.text()).toContain("<!DOCTYPE html>");
  });

  it("is byte-unchanged when no Accept header is sent", async () => {
    const withHeader = await staticResponse(PAGE, accepting("text/html"));
    const without = await staticResponse(PAGE, accepting());
    const bare = await staticResponse(PAGE);
    const baseline = await withHeader.text();
    expect(await without.text()).toBe(baseline);
    expect(await bare.text()).toBe(baseline);
    expect(bare.headers.get("content-type")).toBe("text/html; charset=utf-8");
  });

  it("serves markdown of that page's own content when asked", async () => {
    const res = await staticResponse(PAGE, accepting("text/markdown"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("vary")).toContain("Accept");

    const body = await res.text();
    expect(body).not.toContain("<!DOCTYPE html>");
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
    const res = await staticResponse(PAGE, accepting("text/markdown"));
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 406 for a type it cannot produce", async () => {
    const res = await staticResponse(PAGE, accepting("application/json"));
    expect(res.status).toBe(406);
    expect(res.headers.get("vary")).toContain("Accept");
    expect(await res.text()).toContain("text/markdown");
  });

  it("honours a status override for the 404 handler, in both variants", async () => {
    const html = await staticResponse("404.html", accepting("text/html"), { status: 404 });
    expect(html.status).toBe(404);
    const md = await staticResponse("404.html", accepting("text/markdown"), {
      status: 404,
      canonicalPath: "/404",
    });
    expect(md.status).toBe(404);
    const body = await md.text();
    expect(body).toContain("/sitemap.xml");
    expect(body).toContain("/llms.txt");
    expect(body).toContain("https://distribute.you/pricing");
  });
});

describe("every static route passes the request through", () => {
  it("has no staticResponse call that drops the Accept header", () => {
    const files = [
      "src/app/route.ts",
      "src/app/pricing/route.ts",
      "src/app/performance/route.ts",
      "src/app/use-cases/route.ts",
      "src/app/about/route.ts",
      "src/app/contact/route.ts",
      "src/app/cold-email-cost-guide/route.ts",
      "src/app/cold-email-vs-linkedin/route.ts",
      "src/app/cold-email-for-saas-founders/route.ts",
      "src/app/[...notFound]/route.ts",
    ];
    for (const file of files) {
      const src = read(file);
      expect(src, file).toMatch(/staticResponse\("[^"]+", request/);
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

  it("keeps the legal name untouched", () => {
    expect(org.legalName).toBe("Shamanic Technologies");
  });

  for (const page of ["index-v1.html", "use-cases.html", "pricing.html", "about.html"]) {
    it(`injects exactly one Organization into ${page}`, () => {
      const html = staticHtml(page);
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
        legalName: "Shamanic Technologies",
        address: { "@type": "PostalAddress", addressLocality: "Douelle" },
        contactPoint: { email: "support@distribute.you" },
      });
    });
  }

  it("leaves an unparseable ld+json block alone rather than deleting it", () => {
    // Guards the fail-soft branch: broken structured data is a bug to fix at its
    // source, and dropping it because we could not read it is strictly worse.
    const html = staticHtml("about.html");
    expect(html).toContain("AboutPage");
  });
});

describe("trust anchor pages", () => {
  for (const page of ["about.html", "contact.html"]) {
    it(`${page} carries real content and is indexable`, () => {
      const html = read(`public/landing/${page}`);
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
      expect(read(`public/landing/${page}`)).not.toContain(String.fromCharCode(0x2014));
    });
  }

  it("states the company address on both pages", () => {
    for (const page of ["about.html", "contact.html"]) {
      const html = read(`public/landing/${page}`);
      expect(html).toContain("285 rue de l");
      expect(html).toContain("46140 Douelle");
    }
  });

  it("never calls the product a cold email tool", () => {
    for (const page of ["about.html", "contact.html", "404.html"]) {
      const html = read(`public/landing/${page}`).toLowerCase();
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
    const home = read("public/landing/index-v1.html");
    expect(home).toContain('href="https://distribute.you/about"');
    expect(home).toContain('href="https://distribute.you/contact"');
    // Plus the shared footer every other static page injects.
    const components = read("public/landing/js/components.js");
    expect(components).toContain('href="/about"');
    expect(components).toContain('href="/contact"');
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
    expect(body.name).toBe("distribute");
    expect(body.servers[0].url).toBe("https://mcp.distribute.you/mcp");
    expect(body.servers[0].transport).toBe("streamable-http");
    expect(body.openapi).toBe("https://api.distribute.you/openapi.json");
    expect(body.documentation).toContain("docs.distribute.you");
  });
});
