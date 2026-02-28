import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
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
    <ClerkProvider>
      <html lang="en">
        <head>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        </head>
        <body className="antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
