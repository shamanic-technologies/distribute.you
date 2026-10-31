import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { DocsLayout } from "@/components/docs/docs-layout";
import { DOCS_SITE_URL, OPENAPI_DOCUMENT_URL } from "@/lib/docs/docs-routes";
import {
  AUTH_HEADER_LINE,
  CATALOG_URL,
  CLAUDE_CODE_MCP_COMMAND,
  DEVELOPER_HUB_URL,
  MCP_TOOLS,
  MCP_TOOL_COUNT,
  MCP_URL,
  SKILLS_LIST_ROUTE,
} from "@/lib/docs/developer-surfaces";
import "./docs.css";

/**
 * The developer docs, under the landing since SITE-FOUNDATION-1029 (they lived on
 * docs.distribute.you as a static export; every URL there 301s here). They wear the
 * site's nav and footer (one chrome, `lib/site-chrome.ts`) around their own section
 * sidebar, in dashboard v2's type (Geist) and blue ramp (`docs.css`).
 *
 * Every page owns its canonical (`lib/docs/docs-metadata.ts`): a canonical declared here
 * would be inherited by all of them and mark each one a duplicate of the docs home.
 */
const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

const SITE_NAME = "distribute.you Documentation";
const SITE_DESCRIPTION =
  "Complete documentation for distribute.you: the hosted MCP server, the REST API and its OpenAPI document, authentication, and the command line client. Integration guides for Claude Code, Claude Desktop, Cursor, ChatGPT, n8n, Zapier and Make.com.";

export const metadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: "%s | distribute.you Docs",
  },
  description: SITE_DESCRIPTION,
};

/**
 * The developer surfaces, declared as the things they are: a page that only mentions an
 * API in prose is a page a search engine has to infer an API from.
 */
const developerSurfacesJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebAPI",
      name: "distribute.you API",
      url: "https://api.distribute.you",
      description:
        "REST API for brands, campaigns, audiences, leads, workflows, runs and billing on distribute.you.",
      documentation: `${DOCS_SITE_URL}/api`,
      termsOfService: "https://distribute.you/terms",
      provider: { "@type": "Organization", name: "distribute.you", url: "https://distribute.you" },
    },
    {
      "@type": "APIReference",
      name: "distribute.you OpenAPI document",
      url: OPENAPI_DOCUMENT_URL,
      description: "OpenAPI description of every distribute.you API operation, served by the API itself.",
      programmingModel: "REST",
      inLanguage: "en",
    },
    {
      "@type": "SoftwareApplication",
      name: "distribute.you MCP server",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Any",
      url: MCP_URL,
      description: `Hosted Model Context Protocol server for distribute.you, spoken over Streamable HTTP, exposing ${MCP_TOOL_COUNT} tools. Authenticated with the same API key as the REST API.`,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@type": "WebPage",
      name: "distribute.you developer resources",
      url: DEVELOPER_HUB_URL,
      description:
        "Every machine-readable surface distribute.you publishes, at a fixed address: the REST API and its OpenAPI document, the MCP server, the CLI, and the docs.",
    },
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "distribute.you", item: "https://distribute.you" },
    { "@type": "ListItem", position: 2, name: "Documentation", item: DOCS_SITE_URL },
  ],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is distribute.you?",
      acceptedAnswer: {
        "@type": "Answer",
        text: `distribute.you runs cold email outreach for you: you tell it what you sell and set each campaign's caps (a max budget and/or a max volume), and it picks the buyers, writes and sends the email from domains it owns and warms, and passes the interested replies to you. It publishes a REST API with an OpenAPI document at ${OPENAPI_DOCUMENT_URL}, a hosted Model Context Protocol server at ${MCP_URL}, a command line client on npm, and these docs at ${DEVELOPER_HUB_URL}, so an AI assistant such as Claude, Cursor or ChatGPT can read and steer it. The method skills our own Copilot follows are served at ${SKILLS_LIST_ROUTE}, so an agent can follow the same steps.`,
      },
    },
    {
      "@type": "Question",
      name: "How do I install the distribute.you MCP server?",
      acceptedAnswer: {
        "@type": "Answer",
        text: `The server is hosted, so there is nothing to install. For Claude Code, run: ${CLAUDE_CODE_MCP_COMMAND}. For Claude Desktop or Cursor, register the endpoint ${MCP_URL} with the header ${AUTH_HEADER_LINE}. See distribute.you/docs/mcp/installation for details.`,
      },
    },
    {
      "@type": "Question",
      name: "What tools are available?",
      acceptedAnswer: {
        "@type": "Answer",
        text: `The hosted distribute.you MCP server exposes ${MCP_TOOL_COUNT} tools: ${MCP_TOOLS.map((t) => t.name).join(", ")}. Anything beyond those is reachable over the REST API, whose OpenAPI document is published at ${OPENAPI_DOCUMENT_URL}. See distribute.you/docs/mcp/tools for the full reference.`,
      },
    },
    {
      "@type": "Question",
      name: "How much does distribute.you cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: `The AI agent is free. You pay as you go from a prepaid balance, starting with $10: each action is billed at the vendor's API price with 0% markup, listed on ${CATALOG_URL}, and each campaign spends only up to the caps you set (a max budget and/or a max volume, each with a period). See what each result cost you in the dashboard.`,
      },
    },
  ],
};

export default function DocsRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`docs-root ${sans.variable} ${mono.variable} antialiased`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(developerSurfacesJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <Navbar path="/docs" />
      <DocsLayout>{children}</DocsLayout>
      <Footer path="/docs" />
    </div>
  );
}
