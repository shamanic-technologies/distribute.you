import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join } from "path";
import {
  DOCS_ROUTES,
  MCP_ENDPOINT_URL,
  OPENAPI_DOCUMENT_URL,
  PRODUCT_NAME,
  docsHeading,
  docsUrl,
} from "../../src/lib/docs-routes";
import {
  API_KEY_PREFIX,
  AUTH_HEADER_LINE,
  AUTH_HEADER_NAME,
  CLAUDE_CODE_MCP_COMMAND,
  CLI_NPM_URL,
  CLI_PACKAGE,
  DEVELOPER_HUB_URL,
  MCP_HTTP_CONFIG,
  MCP_REMOTE_BRIDGE_PACKAGE,
  MCP_STDIO_BRIDGE_CONFIG,
  MCP_TOOLS,
  MCP_TOOL_COUNT,
  MCP_URL,
  mcpToolsByCategory,
} from "../../src/lib/developer-surfaces";

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

describe("headings name the product, and match the title list", () => {
  const files = pageFiles(APP_DIR);

  it.each(files)("%s renders its h1 from docsHeading", (file) => {
    const src = readFileSync(file, "utf8");
    // A hand-written h1 is how the tab and the first heading on the page came
    // to say two different things, and how a heading ends up naming a word
    // (`Brands`) rather than the product a search would be typed against.
    expect(src).toContain(`docsHeading("${routeOf(file)}")`);
    expect(src).not.toMatch(/<h1[^>]*>\s*[A-Za-z]/);
  });

  it.each(DOCS_ROUTES)("$path builds a heading that names the product", (route) => {
    expect(docsHeading(route.path)).toContain(PRODUCT_NAME);
  });

  it("never says the product name twice in one heading", () => {
    for (const route of DOCS_ROUTES) {
      const heading = docsHeading(route.path);
      expect(heading.split(PRODUCT_NAME).length - 1).toBe(1);
    }
  });
});

/**
 * The bare word is an ordinary English verb and an npm package somebody else
 * owns, so it cannot rank and it cannot disambiguate. Anything a reader or a
 * crawler is shown says `distribute.you`.
 *
 * What stays bare is an IDENTIFIER: renaming it breaks something. The MCP
 * server name becomes part of a client's tool names, the npm scope is a
 * published package, the rest are a file name, a URL path and a social handle.
 */
describe("the product is never named by the bare word", () => {
  const IDENTIFIERS = [
    "distribute.you",
    "@distribute/",
    "@distribute_you",
    "logo-distribute",
    "distribute-openapi",
    "mcp add --transport http distribute ",
    'MCP_SERVER_NAME = "distribute"',
    "distribute ops",
    '"distribute": {',
    "&quot;distribute&quot;",
    "<code>distribute</code>",
    "webhooks/distribute",
    "shamanic-technologies/distribute",
  ];

  function sourceFiles(dir: string): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        found.push(...sourceFiles(full));
      } else if (/\.(tsx?|txt)$/.test(entry)) {
        found.push(full);
      }
    }
    return found;
  }

  const files = [
    ...sourceFiles(join(__dirname, "../../src")),
    ...sourceFiles(join(__dirname, "../../public")),
  ];

  it.each(files)("%s spells the product name in full", (file) => {
    let src = readFileSync(file, "utf8");
    for (const id of IDENTIFIERS) src = src.replaceAll(id, "");
    expect(src).not.toMatch(/\bdistribute\b/);
  });

  it.each(files)("%s carries no em-dash", (file) => {
    expect(readFileSync(file, "utf8")).not.toContain("\u2014");
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

/**
 * Everything below is about a developer resource being USABLE once a name
 * search has surfaced it.
 *
 * The audit item this file already guards is "developer resources nobody can
 * find by name". Finding them is necessary and not sufficient: for months the
 * pages that did surface printed an npx command for an MCP package that has
 * never existed on npm, an auth header the API answers 401 to, and a catalogue
 * of thirty-five MCP tools the server does not expose. A developer who found
 * the docs pasted a command that failed, then a header that was rejected.
 *
 * Each literal below was checked against the thing that answers for it: the
 * npm registry for a package, the deployed openapi.json for the auth scheme,
 * and a connected client for the tool list. None of them can be checked by
 * rendering a page, which is why they are pinned here.
 */
describe("nothing on this site prints a command that cannot run", () => {
  function textFiles(dir: string): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        found.push(...textFiles(full));
      } else if (/\.(tsx?|txt)$/.test(entry)) {
        found.push(full);
      }
    }
    return found;
  }

  const files = [
    ...textFiles(join(__dirname, "../../src")),
    ...textFiles(join(__dirname, "../../public")),
  ];

  // Every one of these 404s or is refused. A comment naming one would pass a
  // reader and fail this guard, so the module that explains them describes
  // them instead of spelling them.
  const RETIRED = [
    "@distribute/mcp", // npm 404: this package has never been published
    "@distribute/api-client", // npm 404
    "DistributeClient", // the client class of that package
    "X-API-Key", // api-service's admin path, not the org-key scheme
    "dist_", // no key has ever carried this prefix
    "DISTRIBUTE_API_KEY", // a flag on the package that does not exist
    "35 tools",
  ];

  it.each(files)("%s prints no retired command, package or header", (file) => {
    const src = readFileSync(file, "utf8");
    for (const retired of RETIRED) {
      expect(src).not.toContain(retired);
    }
  });
});

describe("the developer surfaces are spelled once", () => {
  const files = [
    join(APP_DIR, "authentication/page.tsx"),
    join(APP_DIR, "quickstart/page.tsx"),
    join(APP_DIR, "mcp/page.tsx"),
    join(APP_DIR, "mcp/installation/page.tsx"),
    join(APP_DIR, "mcp/tools/page.tsx"),
    join(APP_DIR, "api/page.tsx"),
    join(APP_DIR, "openapi/page.tsx"),
  ];

  it.each(files)("%s reads them from developer-surfaces, never its own copy", (file) => {
    const src = readFileSync(file, "utf8");
    expect(src).toContain('from "@/lib/developer-surfaces"');
    // A hand-written header line is how twenty-two files drifted together.
    expect(src).not.toMatch(/Authorization: Bearer distrib\.usr_/);
  });

  it("names the scheme the deployed OpenAPI document declares", () => {
    expect(AUTH_HEADER_NAME).toBe("Authorization");
    expect(API_KEY_PREFIX).toBe("distrib.usr_");
    expect(AUTH_HEADER_LINE).toBe("Authorization: Bearer distrib.usr_YOUR_KEY");
  });

  it("names the one npm package this product publishes", () => {
    expect(CLI_PACKAGE).toBe("@distribute.you/cli");
    expect(CLI_NPM_URL).toBe(`https://www.npmjs.com/package/${CLI_PACKAGE}`);
  });

  it("registers the MCP server as a remote endpoint, not a subprocess", () => {
    expect(MCP_URL).toBe("https://mcp.distribute.you/mcp");
    expect(CLAUDE_CODE_MCP_COMMAND).toContain("--transport http");
    expect(CLAUDE_CODE_MCP_COMMAND).toContain(MCP_URL);
    expect(CLAUDE_CODE_MCP_COMMAND).toContain(AUTH_HEADER_LINE);
    expect(MCP_HTTP_CONFIG).toContain(`"url": "${MCP_URL}"`);
    expect(MCP_HTTP_CONFIG).not.toContain('"command"');
    // The stdio path is a bridge to the same URL, never a package of ours.
    expect(MCP_STDIO_BRIDGE_CONFIG).toContain(MCP_REMOTE_BRIDGE_PACKAGE);
    expect(MCP_STDIO_BRIDGE_CONFIG).toContain(MCP_URL);
  });
});

describe("the MCP tool catalogue is the one the server exposes", () => {
  it("names six prefixed tools, and the count is read rather than written", () => {
    expect(MCP_TOOL_COUNT).toBe(MCP_TOOLS.length);
    expect(MCP_TOOLS.map((t) => t.name).sort()).toEqual([
      "distribute_campaign_stats",
      "distribute_list_brands",
      "distribute_list_campaigns",
      "distribute_list_workflows",
      "distribute_status",
      "distribute_suggest_icp",
    ]);
  });

  it("groups every tool, losing none", () => {
    const grouped = mcpToolsByCategory().flatMap((g) => g.tools);
    expect(grouped).toHaveLength(MCP_TOOLS.length);
    expect(new Set(grouped.map((t) => t.name)).size).toBe(MCP_TOOLS.length);
  });

  it("is rendered from that list, not restated on the page", () => {
    const src = readFileSync(join(APP_DIR, "mcp/tools/page.tsx"), "utf8");
    expect(src).toContain("mcpToolsByCategory()");
    expect(src).not.toContain("const TOOL_CATEGORIES = [");
  });
});

/**
 * A REST route these docs print has to be a route the API serves. The four
 * pages that documented outlets, journalists, articles and press kits were
 * removed because none of those paths is in the deployed OpenAPI document:
 * that surface left the product, and the documentation was the straggler.
 */
describe("no page documents a REST surface the API does not serve", () => {
  const RETIRED_PATHS = [
    "/v1/outlets",
    "/v1/journalists",
    "/v1/discoveries",
    "/v1/press-kits",
    "/v1/billing/balance",
  ];

  const files = pageFiles(APP_DIR);

  it.each(files)("%s prints none of the retired paths", (file) => {
    const src = readFileSync(file, "utf8");
    for (const path of RETIRED_PATHS) {
      expect(src).not.toContain(path);
    }
  });

  it("keeps no route, sidebar entry or llms.txt line for the removed pages", () => {
    const sidebar = readFileSync(join(__dirname, "../../src/components/sidebar.tsx"), "utf8");
    const llms = readFileSync(join(__dirname, "../../public/llms.txt"), "utf8");
    for (const path of ["/api/outlets", "/api/journalists", "/api/articles", "/api/press-kits"]) {
      expect(DOCS_ROUTES.map((r) => r.path)).not.toContain(path);
      expect(sidebar).not.toContain(path);
      expect(llms).not.toContain(path);
    }
  });
});

describe("the two domains point at each other", () => {
  it("llms.txt names the apex hub, the CLI and the MCP tools", () => {
    const llms = readFileSync(join(__dirname, "../../public/llms.txt"), "utf8");
    expect(llms).toContain(DEVELOPER_HUB_URL);
    expect(llms).toContain(CLI_NPM_URL);
    for (const tool of MCP_TOOLS) expect(llms).toContain(tool.name);
  });

  it("every page carries a crawlable link to the hub, through the sidebar", () => {
    const sidebar = readFileSync(join(__dirname, "../../src/components/sidebar.tsx"), "utf8");
    expect(sidebar).toContain("DEVELOPER_HUB_URL");
    expect(sidebar).toContain("OPENAPI_DOCUMENT_URL");
    expect(sidebar).toContain("MCP_URL");
    expect(sidebar).toContain("CLI_NPM_URL");
  });

  it("declares the API, the OpenAPI document and the MCP server as structured data", () => {
    const layout = readFileSync(join(APP_DIR, "layout.tsx"), "utf8");
    expect(layout).toContain("developerSurfacesJsonLd");
    expect(layout).toContain('"@type": "WebAPI"');
    expect(layout).toContain('"@type": "APIReference"');
    // A name search matches on a name, so every node carries the product's.
    for (const marker of [
      'name: "distribute.you API"',
      'name: "distribute.you OpenAPI document"',
      'name: "distribute.you MCP server"',
    ]) {
      expect(layout).toContain(marker);
    }
  });
});
