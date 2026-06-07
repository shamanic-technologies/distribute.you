import type { Metadata } from "next";
import "./globals.css";
import { PROD_URLS } from "@/lib/env-urls";

const SITE_URL = PROD_URLS.landing;
const SITE_NAME = "distribute";
const SITE_DESCRIPTION = "Sales cold email outreach done for you. Drop a URL, set a budget, and distribute finds prospects, writes emails, sends sequences, qualifies replies with AI, and forwards buyers to Gmail. $25 welcome credits, no subscription.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "distribute - Sales cold email outreach done for you",
    template: "%s | distribute",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "client acquisition on autopilot",
    "sales cold email outreach",
    "cold email automation",
    "done for you cold email",
    "AI sales outreach",
    "qualified reply automation",
    "indie hacker outreach",
    "cold email dashboard",
    "AI reply qualification",
    "pay-as-you-go cold email",
    "no subscription cold email",
    "distribute.you",
    "sales automation",
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
    title: "distribute - Sales cold email outreach done for you",
    description: "Drop a URL, set a budget. We find prospects, write emails, send sequences, qualify replies, and forward buyers to Gmail.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "distribute - Sales cold email outreach done for you",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "distribute - Sales cold email outreach done for you",
    description: "Drop a URL, set a budget. We find prospects, write emails, send sequences, qualify replies, and forward buyers to Gmail.",
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
      name: "Free credits",
      price: "0",
      priceCurrency: "USD",
      description: "$25 welcome credits for sales cold email outreach",
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
  description: "Sales cold email outreach done for you",
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
  name: "How to launch sales cold email outreach with distribute",
  description: "Drop a URL, set a daily budget, and let distribute find prospects, write cold emails, send sequences, qualify replies, and forward buyers to Gmail.",
  step: [
    {
      "@type": "HowToStep",
      position: 1,
      name: "Drop a URL",
      text: "Create an account and add your product URL. We analyze your offer, tone, proof, and ideal customer profile.",
    },
    {
      "@type": "HowToStep",
      position: 2,
      name: "Set a daily budget",
      text: "Set a sales outreach budget before launch. distribute builds the list, writes the sequence, and sends from managed infrastructure.",
    },
    {
      "@type": "HowToStep",
      position: 3,
      name: "We send, qualify, forward",
      text: "AI qualifies every reply, and only buyer conversations land in your Gmail. Cost per qualified reply is tracked live.",
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
