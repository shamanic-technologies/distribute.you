import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join } from "path";
import {
  DOCS_ROUTES,
  MCP_ENDPOINT_URL,
  OPENAPI_DOCUMENT_URL,
  docsUrl,
} from "../../src/lib/docs-routes";

/**
 * The Is Agentic audit scored this domain PARTIAL on two counts: developer
 * resources that a name search could not surface, and a 404 with nothing in
 * its body. Both failures are silent, so they are pinned here.
 */

const APP_DIR = join(__dirname, "../../src/app");

function pageFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...pageFiles(full));
    } else if (entry === "page.tsx") {
      found.push(full);
    }
  }
  return found;
}

function routeOf(file: string): string {
  const rel = file.slice(APP_DIR.length).replace(/\/page\.tsx$/, "");
  return rel === "" ? "/" : rel;
}

describe("every page is in the route list", () => {
  const files = pageFiles(APP_DIR);

  it("finds every page on disk in DOCS_ROUTES", () => {
    const onDisk = files.map(routeOf).sort();
    const declared = DOCS_ROUTES.map((r) => r.path).sort();
    expect(onDisk).toEqual(declared);
  });

  it.each(files)("%s reads its metadata from docsMetadata", (file) => {
    const src = readFileSync(file, "utf8");
    expect(src).toContain(`docsMetadata("${routeOf(file)}")`);
    // A hand-written metadata literal would carry its own title, description
    // and canonical, which is how the four surfaces drifted apart before.
    expect(src).not.toMatch(/export const metadata: Metadata = \{/);
  });
});

describe("titles and descriptions name the product", () => {
  it.each(DOCS_ROUTES)("$path names distribute.you in its description", (route) => {
    expect(route.description).toContain("distribute.you");
  });

  it("never spells the product as the bare word", () => {
    for (const route of DOCS_ROUTES) {
      const stripped = `${route.title} ${route.description}`.replaceAll(
        "distribute.you",
        "",
      );
      // `@distribute/mcp` is a package name and stays as it is.
      expect(stripped.replaceAll("@distribute/", "")).not.toMatch(/\bdistribute\b/i);
    }
  });

  it("carries no em-dash in any user-facing string", () => {
    for (const route of DOCS_ROUTES) {
      expect(`${route.title} ${route.description}`).not.toContain("—");
    }
  });
});

describe("the product name appears once per title", () => {
  it("a title that already names the product opts out of the layout template", () => {
    const helper = readFileSync(
      join(__dirname, "../../src/lib/docs-metadata.ts"),
      "utf8",
    );
    expect(helper).toContain("namesProduct ? { absolute: route.title }");
  });
});

describe("each page owns its canonical", () => {
  it("the layout declares none, so pages do not inherit the home page's", () => {
    const layout = readFileSync(join(APP_DIR, "layout.tsx"), "utf8");
    expect(layout).not.toMatch(/canonical:/);
  });

  it("builds a canonical that matches the served URL, trailing slash included", () => {
    expect(docsUrl("/")).toBe("https://docs.distribute.you/");
    expect(docsUrl("/api/brands")).toBe("https://docs.distribute.you/api/brands/");
  });
});

describe("the sitemap is derived, not a second hand-written list", () => {
  it("maps over DOCS_ROUTES", () => {
    const sitemap = readFileSync(join(APP_DIR, "sitemap.ts"), "utf8");
    expect(sitemap).toContain("DOCS_ROUTES.map");
    expect(sitemap).toContain('export const dynamic = "force-static"');
  });
});

describe("llms.txt", () => {
  const llms = readFileSync(join(__dirname, "../../public/llms.txt"), "utf8");

  it.each(DOCS_ROUTES)("lists $path", (route) => {
    expect(llms).toContain(docsUrl(route.path));
    expect(llms).toContain(route.title);
  });

  it("names the machine-readable entry points", () => {
    expect(llms).toContain(OPENAPI_DOCUMENT_URL);
    expect(llms).toContain(MCP_ENDPOINT_URL);
    expect(llms).toContain("https://docs.distribute.you/sitemap.xml");
  });

  it("is announced in robots.txt", () => {
    const robots = readFileSync(join(__dirname, "../../public/robots.txt"), "utf8");
    expect(robots).toContain("llms.txt");
  });
});

describe("the 404 page says where to go next", () => {
  const notFound = join(APP_DIR, "not-found.tsx");

  it("exists", () => {
    expect(existsSync(notFound)).toBe(true);
  });

  it("points at the index, the sitemap, the OpenAPI document and the MCP server", () => {
    const src = readFileSync(notFound, "utf8");
    expect(src).toContain("/llms.txt");
    expect(src).toContain("/sitemap.xml");
    expect(src).toContain("OPENAPI_DOCUMENT_URL");
    expect(src).toContain("MCP_ENDPOINT_URL");
    expect(src).toContain("distribute.you");
  });
});

describe("the OpenAPI document and the MCP server have a predictable page", () => {
  it("/openapi is a route", () => {
    expect(DOCS_ROUTES.map((r) => r.path)).toContain("/openapi");
  });

  it("states both URLs and is reachable from the sidebar", () => {
    const page = readFileSync(join(APP_DIR, "openapi/page.tsx"), "utf8");
    expect(page).toContain("OPENAPI_DOCUMENT_URL");
    expect(page).toContain("MCP_ENDPOINT_URL");
    const sidebar = readFileSync(
      join(__dirname, "../../src/components/sidebar.tsx"),
      "utf8",
    );
    expect(sidebar).toContain('href: "/openapi"');
  });
});
