import type { Metadata } from "next";
import "./globals.css";
import { PROD_URLS } from "@/lib/env-urls";

const SITE_URL = PROD_URLS.landing;
const SITE_NAME = "distribute";
const SITE_DESCRIPTION = "The Stripe for Distribution. Create an account, give us your URL — we automate welcome emails, outreach, webinar flows, and every touchpoint. AI workflows ranked by real performance data.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "distribute — Your distribution, automated",
    template: "%s | distribute",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "distribution automation",
    "marketing automation",
    "welcome emails",
    "email automation",
    "AI workflows",
    "cold outreach",
    "webinar automation",
    "lifecycle marketing",
    "growth automation",
    "distribution platform",
    "Stripe for distribution",
    "automated marketing",
    "solopreneur tools",
  ],
  authors: [{ name: "distribute" }],
  creator: "distribute",
  publisher: "distribute",
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
    title: "distribute — Your distribution, automated",
    description: "The Stripe for Distribution. AI workflows handle your welcome emails, outreach, and lifecycle campaigns. You just build your product.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "distribute — Your distribution, automated",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "distribute — Your distribution, automated",
    description: "The Stripe for Distribution. AI-powered welcome emails, outreach, webinar flows. Zero configuration.",
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

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "distribute",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  offers: [
    {
      "@type": "Offer",
      name: "Free",
      price: "0",
      priceCurrency: "USD",
      description: "Free to start — you only pay AI costs",
    },
  ],
  provider: {
    "@type": "Organization",
    name: "distribute",
    url: SITE_URL,
    sameAs: [
      PROD_URLS.github,
      PROD_URLS.twitter,
    ],
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "distribute",
  url: SITE_URL,
  description: "The Stripe for Distribution",
  sameAs: [
    PROD_URLS.github,
    PROD_URLS.twitter,
  ],
  contactPoint: {
    "@type": "ContactPoint",
    email: "support@distribute.you",
    contactType: "customer service",
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "distribute",
  url: SITE_URL,
  description: SITE_DESCRIPTION,
};

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Automate Your Distribution with distribute",
  description: "Set up automated welcome emails, outreach, and lifecycle campaigns in three steps",
  step: [
    {
      "@type": "HowToStep",
      position: 1,
      name: "Add your URL",
      text: "Create an account and provide your website URL. We analyze your brand, tone, and visual identity.",
    },
    {
      "@type": "HowToStep",
      position: 2,
      name: "Enable features",
      text: "Toggle the distribution features you need: welcome emails, cold outreach, webinar lifecycle, and more.",
    },
    {
      "@type": "HowToStep",
      position: 3,
      name: "We handle the rest",
      text: "The best-performing AI workflow runs automatically. You just watch the metrics in your dashboard.",
    },
  ],
  totalTime: "PT2M",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
