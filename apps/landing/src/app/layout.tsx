import type { Metadata } from "next";
import "./globals.css";
import { PROD_URLS } from "@/lib/env-urls";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, organizationJsonLd as sharedOrganizationJsonLd } from "@/lib/seo";
import { INVITE_FORWARD_SCRIPT } from "@/lib/static-html";
import { SupportWhatsAppButton } from "@/components/support-whatsapp-button";

const SITE_URL = PROD_URLS.landing;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | distribute.you",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "acquisition agency",
    "AI acquisition agency",
    "sales meetings done for you",
    "outbound done for you",
    "cost per sales meeting",
    "B2B lead generation agency",
    "pay as you go outbound",
    "distribute.you",
  ],
  authors: [{ name: "distribute.you" }],
  creator: "distribute.you",
  publisher: "distribute.you",
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
        url: "/opengraph-image",
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
    images: ["/opengraph-image"],
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
    icon: "/icon.svg",
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "distribute.you",
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
      description: "$30 of free credits at signup, then a daily budget from $1 a day",
    },
  ],
  provider: {
    "@type": "Organization",
    name: "distribute.you",
    url: SITE_URL,
    sameAs: [
      PROD_URLS.github,
      PROD_URLS.twitter,
    ],
  },
};

// The company is stated in ONE place (`lib/seo.ts`), which the statically-served
// pages also inject. A second literal here is how the two surfaces came to
// describe the company differently: this copy carried no logo, no legalName and
// no address, so a crawler read a different Organization depending on which
// half of the site it landed on.
const organizationJsonLd = sharedOrganizationJsonLd();

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "distribute.you",
  url: SITE_URL,
  description: SITE_DESCRIPTION,
};

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to get sales meetings with distribute.you",
  description: "Paste your website, confirm what we found, and set a daily budget. distribute.you finds the buyers, runs the outreach from its own domains, answers interested leads until the meeting is booked, and shows what each one cost.",
  step: [
    {
      "@type": "HowToStep",
      position: 1,
      name: "Paste your website",
      text: "Create an account and paste your website. We read your offer and draft the ideal customer profile and the audiences to reach.",
    },
    {
      "@type": "HowToStep",
      position: 2,
      name: "Confirm what we found",
      text: "Check the offer, the audiences and the sales funnel, then set a daily budget. The first $30 is free.",
    },
    {
      "@type": "HowToStep",
      position: 3,
      name: "Revenue lands, with its cost",
      text: "We send from domains we own, answer interested replies until the meeting is booked, and report what every outcome cost you.",
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
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        {/* React landing pages have a hardcoded-white body and no theme
            toggle, so dark is always broken here. Force light regardless of
            any `dt` pref set by the static landing's toggle (was washing out
            the navbar/logo for users who toggled dark on the static site). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.setAttribute('data-theme','light')`,
          }}
        />
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-YJHNGLEJPP" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-YJHNGLEJPP');gtag('config','AW-18233267088');`,
          }}
        />
        {/* Ahrefs Web Analytics — first-party page-view + traffic tracking
            (data-key = the distribute.you Ahrefs project). Mirrors
            static-html.ts analyticsHead(). */}
        <script
          src="https://analytics.ahrefs.com/analytics.js"
          data-key="6jqRRazbkHBZRDiWAmampA"
          async
        />
        {/* Partnero affiliate program KHV3KEHI — loader (records the referral
            click + keeps the partner key in the partnero_partner cookie) +
            via-forward (carries the key to dashboard.distribute.you, a different
            subdomain Partnero's cookie can't reach, by appending ?via= to every
            dashboard-bound link on click). Mirrors static-html.ts partneroHead(). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(p,t,n,e,r,o){p['__partnerObject']=r;function f(){var c={a:arguments,q:[]};var r=this.push(c);return "number"!=typeof r?r:f.bind(c.q);}f.q=f.q||[];p[r]=p[r]||f.bind(f.q);p[r].q=p[r].q||f.q;o=t.createElement(n);var _=t.getElementsByTagName(n)[0];o.async=1;o.src=e+'?v'+(~~(new Date().getTime()/1e6));_.parentNode.insertBefore(o,_);})(window,document,'script','https://app.partnero.com/js/universal.js','po');po('settings','assets_host','https://assets.partnero.com');po('program','KHV3KEHI','load');`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){function k(){var m=location.search.match(/[?&]via=([^&]+)/);if(m)return decodeURIComponent(m[1]);var c=document.cookie.match(/(?:^|; )partnero_partner=([^;]+)/);return c?decodeURIComponent(c[1]):null;}document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a[href*="dashboard.distribute.you"]'):null;if(!a)return;var v=k();if(!v)return;try{var u=new URL(a.href);if(!u.searchParams.get('via')){u.searchParams.set('via',v);a.href=u.href;}}catch(err){}},true);})();`,
          }}
        />
        {/* Customer referral code (?invite=CODE) on the same cross-subdomain
            journey as the Partnero key above. Source lives once in
            static-html.ts so the served HTML and these React pages cannot drift. */}
        <script dangerouslySetInnerHTML={{ __html: INVITE_FORWARD_SCRIPT }} />
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
      <body className="antialiased">
        {children}
        <SupportWhatsAppButton />
      </body>
    </html>
  );
}
