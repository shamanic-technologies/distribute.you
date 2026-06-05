import type { Metadata } from "next";
import "./globals.css";
import { PROD_URLS } from "@/lib/env-urls";

const SITE_URL = PROD_URLS.landing;
const SITE_NAME = "distribute";
const SITE_DESCRIPTION = "Lead Generation, on Autopilot. Sales, PR, VCs, hiring, accelerators — one dashboard. Drop a URL, set a budget, we send. AI qualifies replies and forwards positives to your Gmail. $2 welcome credits, no subscription.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "distribute — Lead Generation, on Autopilot",
    template: "%s | distribute",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "lead generation on autopilot",
    "multi-product distribution",
    "solo founder distribution",
    "indie hacker outreach",
    "cold email dashboard",
    "PR outreach automation",
    "VC outreach automation",
    "hiring cold email",
    "AI reply qualification",
    "pay-as-you-go cold email",
    "no subscription cold email",
    "Stripe of Lead Generation",
    "distribute.you",
    "portfolio distribution dashboard",
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
    title: "distribute — Lead Generation, on Autopilot",
    description: "One dashboard for every distribution channel. Drop a URL, set a budget — we send, qualify, forward. $2 welcome credits, no subscription.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "distribute — Lead Generation, on Autopilot",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "distribute — Lead Generation, on Autopilot",
    description: "One dashboard. Sales, PR, VCs, hiring, accelerators. Drop a URL, set a budget — we send, qualify, forward.",
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
  description: "The Stripe of Lead Generation",
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
  name: "How to put your lead generation on autopilot with distribute",
  description: "Drop a URL, set a daily budget, and let distribute send cold email, PR, hiring, and VC outreach on your behalf — AI qualifies replies, you watch cost per reply in the dashboard.",
  step: [
    {
      "@type": "HowToStep",
      position: 1,
      name: "Drop a URL",
      text: "Create an account and add your product URL. We analyze your brand, tone, and ICP.",
    },
    {
      "@type": "HowToStep",
      position: 2,
      name: "Set a daily budget per channel",
      text: "Pick channels — sales cold email, PR, VC outreach, hiring, accelerators, journalist pitch, and more. Set a daily spend cap per product × per channel.",
    },
    {
      "@type": "HowToStep",
      position: 3,
      name: "We send, qualify, forward",
      text: "We send from agency-warmed inboxes, AI qualifies every reply, and only positives land in your Gmail. Cost per reply tracked live per product × per channel.",
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
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-YJHNGLEJPP" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-YJHNGLEJPP');`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){if(!location.hostname.includes("-staging"))return;var img=new Image();img.crossOrigin="anonymous";img.onload=function(){var c=document.createElement("canvas");c.width=img.width;c.height=img.height;var x=c.getContext("2d");x.drawImage(img,0,0);x.globalCompositeOperation="multiply";x.fillStyle="rgba(138,43,226,0.45)";x.fillRect(0,0,c.width,c.height);x.globalCompositeOperation="destination-in";x.drawImage(img,0,0);var d=c.toDataURL("image/png");document.querySelectorAll('link[rel*="icon"]').forEach(function(l){l.href=d})};img.src="/favicon.jpg"})()`,
          }}
        />
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
