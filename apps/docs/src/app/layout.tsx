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
  description: "AI-powered distribution automation platform using Model Context Protocol (MCP). Launch cold email campaigns, find leads, and automate outreach from ChatGPT, Claude, or Cursor.",
  url: "https://distribute.you",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free tier available — bring your own API keys",
  },
  featureList: [
    "Cold email campaign automation",
    "Lead search via Apollo",
    "AI-powered email generation",
    "ChatGPT integration",
    "Claude integration",
    "Cursor IDE integration",
    "Webhook notifications",
    "REST API access",
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
      name: "How do I connect distribute to ChatGPT?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Go to ChatGPT Settings → Connectors → Add Custom Connector. Enter the MCP URL: https://mcp.distribute.you/mcp and add your API key as a Bearer token in the Authorization header.",
      },
    },
    {
      "@type": "Question",
      name: "How do I connect distribute to Claude?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "For Claude.ai, go to Settings → Integrations → Add more. Enter 'distribute' as the name and https://mcp.distribute.you/mcp as the URL. For Claude Desktop, edit the claude_desktop_config.json file.",
      },
    },
    {
      "@type": "Question",
      name: "How do I connect distribute to Cursor?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Add the MCP configuration to your .cursor/mcp.json file with the URL https://mcp.distribute.you/mcp and your API key in the Authorization header. Restart Cursor after saving.",
      },
    },
    {
      "@type": "Question",
      name: "Can I use my own API keys?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. distribute lets you use your own API keys for underlying services like OpenAI, Anthropic, and Apollo. You pay those providers directly at their rates, giving you full control over costs and usage.",
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
