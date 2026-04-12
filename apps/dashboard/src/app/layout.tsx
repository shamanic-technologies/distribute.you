import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const SITE_URL = "https://dashboard.distribute.you";
const SITE_NAME = "distribute Dashboard";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Dashboard | distribute",
    template: "%s | distribute Dashboard",
  },
  description: "Manage your API keys, campaigns, usage, and billing. Configure your distribute automations.",
  keywords: [
    "distribute",
    "dashboard",
    "campaigns",
    "automation",
    "API keys",
    "distribution",
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
    title: "distribute Dashboard",
    description: "Manage your API keys, campaigns, and usage.",
    images: [
      {
        url: "https://distribute.you/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "distribute Dashboard",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "distribute Dashboard",
    description: "Manage your distribute automations.",
  },
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: "/favicon.jpg",
    shortcut: "/favicon.jpg",
    apple: "/favicon.jpg",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "distribute Dashboard",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: "Dashboard to manage API keys, campaigns, and distribution automation settings.",
  url: SITE_URL,
  provider: {
    "@type": "Organization",
    name: "distribute",
    url: "https://distribute.you",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider dynamic>
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
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        </head>
        <body className="antialiased">
          <ThemeProvider>{children}</ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
