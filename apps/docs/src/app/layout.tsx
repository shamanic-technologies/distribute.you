import type { Metadata } from "next";
import "./globals.css";
import { DocsLayout } from "@/components/docs-layout";
import { ThemeProvider } from "@/components/theme-provider";

const SITE_URL = "https://docs.distribute.you";
const SITE_NAME = "distribute Documentation";
const SITE_DESCRIPTION = "Complete documentation for distribute - AI-powered distribution automation via MCP. Integration guides for ChatGPT, Claude, Cursor, n8n, Zapier, and Make.com.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "distribute Documentation",
    template: "%s | distribute Docs",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "distribute",
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
    "lead generation",
    "AI distribution",
  ],
  authors: [{ name: "distribute" }],
  creator: "distribute",
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
    title: "distribute Documentation",
    description: "Learn how to use distribute - installation, API reference, and integrations.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "distribute Documentation",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "distribute Documentation",
    description: "Complete guides and API reference for distribute.",
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
  alternates: {
    canonical: SITE_URL,
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "distribute",
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
  name: "distribute",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: "AI-powered distribution automation platform. Automate sales outreach, journalist pitches, and hiring campaigns. Provide your URL and budget — distribute handles the rest.",
  url: "https://distribute.you",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "At cost — no subscriptions, no markups. Pay only for what you use.",
  },
  featureList: [
    "Sales cold email automation",
    "Journalist outreach and PR",
    "Hiring outreach",
    "Press kit generation",
    "AI-powered email generation",
    "Workflow ranking system",
    "MCP server with 35 tools",
    "REST API and TypeScript client",
    "Real-time performance dashboards",
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
    name: "distribute",
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
      name: "distribute",
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
      name: "What is distribute?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "distribute is an AI-powered distribution automation platform that uses the Model Context Protocol (MCP) to enable AI assistants like ChatGPT, Claude, and Cursor to launch and manage cold email campaigns, find leads, and automate outreach.",
      },
    },
    {
      "@type": "Question",
      name: "How do I install the distribute MCP server?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "For Claude Code: run 'claude mcp add distribute -- npx @distribute/mcp --api-key=YOUR_KEY'. For Claude Desktop or Cursor, add the MCP server config to your configuration file. See docs.distribute.you/mcp/installation for details.",
      },
    },
    {
      "@type": "Question",
      name: "What tools are available?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The distribute MCP server provides 35 tools for managing brands, campaigns, workflows, leads, emails, outlets, journalists, articles, press kits, billing, and costs. See docs.distribute.you/mcp/tools for the full reference.",
      },
    },
    {
      "@type": "Question",
      name: "How much does distribute cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "distribute charges at cost — no subscriptions, no markups. You buy credits and only pay for what you use (AI calls, lead enrichment, email sends). See your cost breakdown in real-time in the dashboard.",
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
