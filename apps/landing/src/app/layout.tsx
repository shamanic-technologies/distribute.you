import type { Metadata } from "next";
import "./globals.css";
import { PROD_URLS } from "@/lib/env-urls";
import {
  BRAND_LOGO_URL,
  DEFAULT_OG_IMAGE_PATH,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
  TWITTER_HANDLE,
  organizationJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | distribute",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "AI cold email done for you",
    "cold email outreach",
    "solo founder outreach",
    "micro-SaaS outreach",
    "cold email dashboard",
    "AI reply qualification",
    "pay-as-you-go cold email",
    "pay-as-you-go cold email",
    "distribute.you",
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
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: DEFAULT_OG_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: SITE_TITLE,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE_PATH],
    creator: TWITTER_HANDLE,
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
  logo: BRAND_LOGO_URL,
  image: BRAND_LOGO_URL,
  offers: [
    {
      "@type": "Offer",
      name: "$25 free credits",
      price: "0",
      priceCurrency: "USD",
      description: "$25 free credits. Cancel anytime. Launch in 5 minutes.",
    },
  ],
  provider: {
    "@type": "Organization",
    name: "distribute",
    url: SITE_URL,
    logo: BRAND_LOGO_URL,
    image: BRAND_LOGO_URL,
    sameAs: [
      PROD_URLS.github,
      PROD_URLS.twitter,
    ],
  },
};

const orgJsonLd = organizationJsonLd(
  "AI outreach automation for solo founders and micro-SaaS builders. Drop a URL, set a budget, get qualified replies.",
);

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "distribute",
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  publisher: {
    "@type": "Organization",
    name: "distribute",
    logo: BRAND_LOGO_URL,
  },
};

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "From your URL to 100 sales meetings",
  description: "Three steps. No setup. No software to learn. No SDR to hire.",
  step: [
    {
      "@type": "HowToStep",
      position: 1,
      name: "Paste your website URL",
      text: "We read your product. Figure out who your buyers are, and write your campaign. You write nothing. You log in, paste a link, set a budget. Done.",
    },
    {
      "@type": "HowToStep",
      position: 2,
      name: "We email your buyers",
      text: "Pre-warmed inboxes start sending the same day. Every email is personalized to the person and the company. No spam folder. No domain setup. Just buyers in their inbox.",
    },
    {
      "@type": "HowToStep",
      position: 3,
      name: "Buyer replies land in Gmail",
      text: "AI reads every reply. Only real buyers reach your inbox, ready to answer. You read 5 emails a day instead of 200. The other 195 never bother you.",
    },
  ],
  totalTime: "PT5M",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Google Analytics + Google Ads (conversion linker auto-on; conversions fire in the dashboard) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-YJHNGLEJPP" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-YJHNGLEJPP');gtag('config','AW-18233267088');`,
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
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
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
