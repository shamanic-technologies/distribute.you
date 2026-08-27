import type { Metadata } from "next";
import "./globals.css";
import { DocsLayout } from "@/components/docs-layout";
import { ThemeProvider } from "@/components/theme-provider";
import { OPENAPI_DOCUMENT_URL } from "@/lib/docs-routes";
import {
  AUTH_HEADER_LINE,
  CLAUDE_CODE_MCP_COMMAND,
  DEVELOPER_HUB_URL,
  MCP_TOOLS,
  MCP_TOOL_COUNT,
  MCP_URL,
} from "@/lib/developer-surfaces";

const SITE_URL = "https://docs.distribute.you";
const SITE_NAME = "distribute.you Documentation";
const SITE_DESCRIPTION = "Complete documentation for distribute.you: the hosted MCP server, the REST API and its OpenAPI document, authentication, and the command line client. Integration guides for Claude Code, Claude Desktop, Cursor, ChatGPT, n8n, Zapier and Make.com.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Every page owns its own canonical (see src/lib/docs-metadata.ts). Declaring
  // one here would be inherited by all 28 pages, telling search engines that
  // the home page is the real document and every other page a duplicate of it.
  title: {
    default: "distribute.you Documentation",
    template: "%s | distribute.you Docs",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "distribute.you",
    "documentation",
    "API",
    "MCP",
    "Model Context Protocol",
    "ChatGPT integration",
    "Claude integration",
    "Cursor integration",
    "n8n",
    "Zapier",
    "Make.com",
    "distribution automation",
    "cold email",
    "client acquisition",
    "AI distribution",
  ],
  authors: [{ name: "distribute.you" }],
  creator: "distribute.you",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "distribute.you Documentation",
    description: "Learn how to use distribute.you - installation, API reference, and integrations.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "distribute.you Documentation",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "distribute.you Documentation",
    description: "Complete guides and API reference for distribute.you.",
    images: ["/og-image.jpg"],
    creator: "@distribute_you",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.jpg",
    shortcut: "/favicon.jpg",
    apple: "/favicon.jpg",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "distribute.you",
  url: "https://distribute.you",
  logo: "https://distribute.you/logo-head.jpg",
  sameAs: [
    "https://twitter.com/distribute_you",
    "https://github.com/shamanic-technologies/distribute.you",
  ],
};

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "distribute.you",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: "Autonomous sales meetings acquisition, run for you. Give distribute.you a website and a daily budget; it picks the buyers, writes and sends the outreach from domains we own and warm, reads every reply, and passes the interested ones to you. Cold email is the channel it runs, and every outcome is priced against real spend.",
  url: "https://distribute.you",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Transparent variable costs: pay only for what you use, no half-used subscriptions. Live unit prices at distribute.you/pricing.",
  },
  featureList: [
    "Sales cold email outreach run for you",
    "Buyers picked from a website and a budget",
    "Sending domains we own and warm, so yours is never used",
    "Replies read and qualified, interested ones forwarded",
    "AI-powered email generation",
    "Workflow ranking system",
    "Hosted MCP server over Streamable HTTP",
    "REST API with a published OpenAPI document",
    "Command line client on npm",
    "Real-time performance dashboards",
  ],
};

/**
 * The developer surfaces, declared as the things they are.
 *
 * The audit that prompted this scored developer-resource discoverability as
 * partial: the resources existed and a name search did not surface them. A
 * page that only mentions an API in prose is a page a search engine has to
 * infer an API from. `WebAPI`, `APIReference` and a `SoftwareApplication` for
 * the MCP server say it outright, and they name the product in every `name`,
 * so a search for the product by name has something to match. The same three
 * nodes are published on the apex hub, so the two domains agree.
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
      documentation: `${SITE_URL}/api/`,
      termsOfService: "https://distribute.you/terms",
      provider: {
        "@type": "Organization",
        name: "distribute.you",
        url: "https://distribute.you",
      },
    },
    {
      "@type": "APIReference",
      name: "distribute.you OpenAPI document",
      url: OPENAPI_DOCUMENT_URL,
      description:
        "OpenAPI description of every distribute.you API operation, served by the API itself.",
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

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  publisher: {
    "@type": "Organization",
    name: "distribute.you",
    url: "https://distribute.you",
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "distribute.you",
      item: "https://distribute.you",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Documentation",
      item: SITE_URL,
    },
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
        text: `distribute.you runs cold email outreach for you: you give it a website and a daily budget, and it picks the buyers, writes and sends the email from domains it owns and warms, and passes the interested replies to you. It publishes a REST API with an OpenAPI document at ${OPENAPI_DOCUMENT_URL}, a hosted Model Context Protocol server at ${MCP_URL}, a command line client on npm, and a page naming all of them at ${DEVELOPER_HUB_URL}, so an AI assistant such as Claude, Cursor or ChatGPT can read and steer it.`,
      },
    },
    {
      "@type": "Question",
      name: "How do I install the distribute.you MCP server?",
      acceptedAnswer: {
        "@type": "Answer",
        text: `The server is hosted, so there is nothing to install. For Claude Code, run: ${CLAUDE_CODE_MCP_COMMAND}. For Claude Desktop or Cursor, register the endpoint ${MCP_URL} with the header ${AUTH_HEADER_LINE}. See docs.distribute.you/mcp/installation for details.`,
      },
    },
    {
      "@type": "Question",
      name: "What tools are available?",
      acceptedAnswer: {
        "@type": "Answer",
        text: `The hosted distribute.you MCP server exposes ${MCP_TOOL_COUNT} tools: ${MCP_TOOLS.map((t) => t.name).join(", ")}. Anything beyond those is reachable over the REST API, whose OpenAPI document is published at ${OPENAPI_DOCUMENT_URL}. See docs.distribute.you/mcp/tools for the full reference.`,
      },
    },
    {
      "@type": "Question",
      name: "How much does distribute.you cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "distribute.you charges transparent variable costs: every unit price we re-bill is published live at distribute.you/pricing, grouped by provider and cost type. You buy credits and only pay for what you use (AI calls, lead enrichment, email sends). No fixed subscription you only half-use. See your cost breakdown in real-time in the dashboard.",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-YJHNGLEJPP" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-YJHNGLEJPP');`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme:dark)").matches))document.documentElement.classList.add("dark")}catch(e){}})()`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){if(!location.hostname.includes("-staging"))return;var img=new Image();img.crossOrigin="anonymous";img.onload=function(){var c=document.createElement("canvas");c.width=img.width;c.height=img.height;var x=c.getContext("2d");x.drawImage(img,0,0);x.globalCompositeOperation="multiply";x.fillStyle="rgba(138,43,226,0.45)";x.fillRect(0,0,c.width,c.height);x.globalCompositeOperation="destination-in";x.drawImage(img,0,0);var d=c.toDataURL("image/png");document.querySelectorAll('link[rel*="icon"]').forEach(function(l){l.href=d})};img.src="/favicon.jpg"})()`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(developerSurfacesJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      </head>
      <body className="antialiased h-screen flex flex-col overflow-hidden">
        <ThemeProvider>
          <DocsLayout>{children}</DocsLayout>
        </ThemeProvider>
      </body>
    </html>
  );
}
