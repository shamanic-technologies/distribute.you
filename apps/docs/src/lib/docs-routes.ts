/**
 * Every route this site publishes, with the title and description that route
 * carries in its `<title>`, its `<meta name="description">`, its canonical URL
 * and the sitemap.
 *
 * One list, because those four surfaces have to agree. A page that names itself
 * one way in the tab and another way in the sitemap is a page a name search has
 * to guess at, and guessing is how a documented API ends up unfindable by the
 * name of the product it documents.
 *
 * The product name is spelled `distribute.you` here, never the bare word on its
 * own: someone searching for the product types the domain, and the bare word is
 * an ordinary English verb that matches nothing.
 */
export interface DocsRoute {
  /** Path with a leading slash, no trailing slash. `/` is the home page. */
  path: string;
  /** Feeds `<title>`, which the layout suffixes with the product name. */
  title: string;
  /** Feeds `<meta name="description">`, the sitemap entry and llms.txt. */
  description: string;
}

export const PRODUCT_NAME = "distribute.you";
export const DOCS_SITE_URL = "https://docs.distribute.you";

/** The OpenAPI document every REST route in these docs is generated against. */
export const OPENAPI_DOCUMENT_URL = "https://api.distribute.you/openapi.json";
/** The interactive browser over that same document. */
export const OPENAPI_EXPLORER_URL = "https://api.distribute.you/docs";
/** The hosted MCP server, spoken over Streamable HTTP. */
export const MCP_ENDPOINT_URL = "https://mcp.distribute.you/mcp";

export const DOCS_ROUTES: DocsRoute[] = [
  {
    path: "/",
    title: "distribute.you Documentation",
    description:
      "Documentation for distribute.you: AI cold email outreach done for you, reachable from an MCP server, a REST API and a TypeScript client.",
  },
  {
    path: "/quickstart",
    title: "Quick Start",
    description:
      "Get started with distribute.you in 5 minutes. Install the MCP server and launch your first campaign from Claude Code or Cursor.",
  },
  {
    path: "/authentication",
    title: "Authentication",
    description:
      "Set up your distribute.you API key and authenticate every request across both the MCP server and the REST API.",
  },
  {
    path: "/openapi",
    title: "distribute.you OpenAPI Specification",
    description:
      "The distribute.you OpenAPI document, the interactive API explorer and the hosted MCP endpoint, each at a fixed URL an agent can fetch.",
  },
  {
    path: "/mcp",
    title: "distribute.you MCP Server",
    description:
      "Use distribute.you from Claude Code, Claude Desktop, Cursor, or any MCP-compatible client. 35 tools for brands, campaigns, workflows and more.",
  },
  {
    path: "/mcp/installation",
    title: "MCP Installation",
    description:
      "Install the distribute.you MCP server for Claude Code, Claude Desktop, Cursor, and any other MCP-compatible client.",
  },
  {
    path: "/mcp/tools",
    title: "MCP Tools Reference",
    description:
      "Reference for all 35 distribute.you MCP tools: brands, campaigns, workflows, leads, press kits, billing and more.",
  },
  {
    path: "/api",
    title: "distribute.you API Reference",
    description:
      "REST API reference for distribute.you. Manage brands, campaigns, workflows, leads, press kits, billing and more.",
  },
  {
    path: "/api/brands",
    title: "Brands API",
    description:
      "Create brands from a URL, fetch full brand details, and extract structured company data with AI through the distribute.you REST API.",
  },
  {
    path: "/api/features",
    title: "Features API",
    description:
      "List automation features, pull live performance stats, and prefill campaign inputs through the distribute.you REST API.",
  },
  {
    path: "/api/campaigns",
    title: "Campaigns API",
    description:
      "Create, launch, stop and monitor outreach campaigns, and track their status and results in real time, via the distribute.you REST API.",
  },
  {
    path: "/api/workflows",
    title: "Workflows API",
    description:
      "List workflows, inspect their DAGs, fetch run summaries, and check API-key status through the distribute.you REST API.",
  },
  {
    path: "/api/leads",
    title: "Leads API",
    description:
      "List qualified leads discovered for your campaigns and brands, with enrichment and source context, via the distribute.you REST API.",
  },
  {
    path: "/api/emails",
    title: "Emails API",
    description:
      "View AI-generated emails and full outreach sequences for any campaign, with content and send status, via the distribute.you REST API.",
  },
  {
    path: "/api/outlets",
    title: "Outlets API",
    description:
      "List media outlets and publications discovered for your brand, with domain authority and topic fit, via the distribute.you REST API.",
  },
  {
    path: "/api/journalists",
    title: "Journalists API",
    description:
      "List journalists and reporters discovered for your PR outreach, with their beats, outlets and context, via the distribute.you REST API.",
  },
  {
    path: "/api/articles",
    title: "Articles API",
    description:
      "List and retrieve articles that mention your brand, discovered across your distribute.you PR and outreach campaigns, via the REST API.",
  },
  {
    path: "/api/press-kits",
    title: "Press Kits API",
    description:
      "Generate, list and manage AI-powered press kits, ready-to-send media assets for your brand, via the distribute.you REST API.",
  },
  {
    path: "/api/billing",
    title: "Billing API",
    description:
      "Check your account balance, credit usage and billing settings programmatically through the distribute.you REST API and MCP server.",
  },
  {
    path: "/api/costs",
    title: "Costs API",
    description:
      "Retrieve per-campaign cost breakdowns and email delivery statistics to track spend and performance through the distribute.you REST API.",
  },
  {
    path: "/api/webhooks",
    title: "Webhooks",
    description:
      "Receive real-time notifications for distribute.you campaign events: webhook events, payload structure and signature verification.",
  },
  {
    path: "/integrations",
    title: "distribute.you Integrations",
    description:
      "Connect distribute.you to Claude Code, Claude Desktop, Cursor, ChatGPT, n8n, Zapier, Make.com, and any other MCP-compatible client.",
  },
  {
    path: "/integrations/claude",
    title: "Claude Code Integration",
    description:
      "Use distribute.you from Claude Code. One command installs the MCP server and 35 tools for brands, campaigns, leads and more.",
  },
  {
    path: "/integrations/claude-desktop",
    title: "Claude Desktop Integration",
    description:
      "Add the 35 distribute.you tools to Claude Desktop. Configure the MCP server once and automate brand distribution from chat.",
  },
  {
    path: "/integrations/cursor",
    title: "Cursor Integration",
    description:
      "Connect distribute.you to the Cursor IDE. Configure the MCP server and automate brand distribution without leaving your editor.",
  },
  {
    path: "/integrations/chatgpt",
    title: "ChatGPT Integration",
    description:
      "Use distribute.you inside ChatGPT. Connect through the MCP connector or call the REST API directly to automate your distribution.",
  },
  {
    path: "/integrations/n8n",
    title: "n8n Integration",
    description:
      "Build automated, self-hosted workflows with distribute.you and n8n, wiring campaigns and outreach together using the REST API.",
  },
  {
    path: "/integrations/zapier",
    title: "Zapier Integration",
    description:
      "Connect distribute.you to 5,000+ apps with Zapier. Trigger campaigns and react to outreach events using the REST API and webhooks.",
  },
  {
    path: "/integrations/make",
    title: "Make.com Integration",
    description:
      "Build visual automation scenarios with distribute.you and Make.com, orchestrating campaigns, leads and outreach through the REST API.",
  },
];

/**
 * The `<h1>` a page renders.
 *
 * Derived from the same route list as the `<title>`, so the tab and the first
 * heading on the page can never say two different things. Every heading names
 * the product, because the audit's own remedy for developer resources nobody
 * can find by name is to put the product name in the titles AND the headings:
 * a page headed `Brands` answers a search for `brands`, which is a word, not a
 * product. A title that already opens with the name is left alone rather than
 * repeating it.
 */
export function docsHeading(path: string): string {
  const { title } = docsRoute(path);
  return title.startsWith(PRODUCT_NAME) ? title : `${PRODUCT_NAME} ${title}`;
}

export function docsRoute(path: string): DocsRoute {
  const found = DOCS_ROUTES.find((route) => route.path === path);
  if (!found) {
    // Fail loud: a page whose path is absent here would ship with the layout's
    // default title and no canonical of its own, which is exactly the state
    // this list exists to prevent.
    throw new Error(`Unknown docs route: ${path}. Add it to DOCS_ROUTES.`);
  }
  return found;
}

/**
 * The URL this site actually serves for a route. `trailingSlash: true` is set
 * in next.config.ts, so `/api/brands` is served at `/api/brands/`, and a
 * canonical or sitemap entry that omits the slash points at a redirect rather
 * than at the document.
 */
export function docsUrl(path: string): string {
  return path === "/" ? `${DOCS_SITE_URL}/` : `${DOCS_SITE_URL}${path}/`;
}
