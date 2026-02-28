import type { Metadata } from "next";
import { URLS } from "@distribute/content";

const SALES_PRICING_TIERS = [
  { name: "Free", price: 0, period: "one-time", emails: "500" },
  { name: "Hobby", price: 16, period: "/month", emails: "3,000" },
  { name: "Standard", price: 83, period: "/month", emails: "100,000" },
  { name: "Growth", price: 333, period: "/month", emails: "500,000" },
];
import "./globals.css";

const SITE_URL = URLS.salesLanding;
const SITE_NAME = "Sales Cold Emails | distribute";
const SITE_DESCRIPTION = "Cold email automation with your own API keys. You give us your URL + target audience. We handle lead finding, email generation, sending, and optimization. 100% open-source.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Sales Cold Emails - Open Source Cold Email Automation | distribute",
    template: "%s | Sales Cold Emails",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "cold email",
    "cold email automation",
    "sales cold emails",
    "cold email software",
    "cold email tool",
    "open source cold email",
    "email outreach",
    "B2B cold email",
    "cold email campaigns",
    "automated cold email",
    "personalized cold email",
    "cold email at scale",
    "lead generation",
    "sales prospecting",
    "outbound sales",
    "MCP",
    "Model Context Protocol",
    "open source",
    "bring your own API keys",
    "your own API keys",
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
    title: "Sales Cold Emails - The Stripe for Distribution",
    description: "Cold email automation with your own API keys. You give us your URL, we handle everything. 100% open-source.",
    images: [
      {
        url: `${URLS.landing}/og-image.jpg`,
        width: 1200,
        height: 630,
        alt: "Sales Cold Emails",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sales Cold Emails - The Stripe for Distribution",
    description: "Cold email automation with your own API keys. You give us your URL, we handle everything. 100% open-source.",
    images: [`${URLS.landing}/og-image.jpg`],
    creator: "@distribute_eu",
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
    icon: `${URLS.landing}/favicon.jpg`,
    shortcut: `${URLS.landing}/favicon.jpg`,
    apple: `${URLS.landing}/favicon.jpg`,
  },
  alternates: {
    canonical: SITE_URL,
  },
};

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Sales Cold Emails by distribute",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Email Marketing Software",
  operatingSystem: "Web",
  description: "Open-source cold email automation platform. Launch personalized cold email campaigns from ChatGPT, Claude, or Cursor.",
  url: SITE_URL,
  offers: SALES_PRICING_TIERS.map((tier) => ({
    "@type": "Offer",
    name: tier.name,
    price: String(tier.price),
    priceCurrency: "USD",
    ...(tier.price > 0 ? { priceValidUntil: "2027-12-31" } : {}),
    description: `${tier.emails} emails${tier.period === "/month" ? "/month" : " (one-time)"}`,
  })),
  featureList: [
    "100% open-source",
    "Lead search via Apollo",
    "AI-powered email personalization",
    "Automatic A/B testing",
    "Reply detection and qualification",
    "ChatGPT integration",
    "Claude integration",
    "Cursor IDE integration",
  ],
  provider: {
    "@type": "Organization",
    name: "distribute",
    url: URLS.landing,
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is AI cold email automation?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "AI cold email automation uses artificial intelligence to find leads, generate personalized emails, and send them at scale. distribute connects to ChatGPT, Claude, or Cursor so you can launch campaigns with simple prompts like 'Send cold emails to CTOs at SaaS companies'.",
      },
    },
    {
      "@type": "Question",
      name: "How does distribute cold email work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You connect distribute to your AI assistant (ChatGPT, Claude, or Cursor), provide your website URL and target audience, and the AI handles everything: finding leads via Apollo, generating personalized emails, sending them, and optimizing based on results.",
      },
    },
    {
      "@type": "Question",
      name: "How much does cold email automation cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: `distribute offers ${SALES_PRICING_TIERS[0].emails} free emails to start. Plans: ${SALES_PRICING_TIERS.filter((t) => t.price > 0).map((t) => `${t.name} $${t.price}/mo (${t.emails} emails)`).join(", ")}. Plus your own API key costs: Apollo ~$0.01/lead, Anthropic ~$0.01/email.`,
      },
    },
    {
      "@type": "Question",
      name: "Can I use my own email domain?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes! distribute sends emails from your own domain for maximum deliverability. You connect your email provider and we handle the sending, tracking, and optimization.",
      },
    },
    {
      "@type": "Question",
      name: "Is AI cold email effective?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "AI-generated cold emails typically see 2-3x higher response rates than templates because each email is personalized to the recipient's company, role, and recent activities. distribute automatically A/B tests subject lines and content to continuously improve.",
      },
    },
  ],
};

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Send AI Cold Emails",
  description: "Launch an AI-powered cold email campaign in 5 minutes",
  totalTime: "PT5M",
  estimatedCost: {
    "@type": "MonetaryAmount",
    currency: "USD",
    value: "0",
  },
  step: [
    {
      "@type": "HowToStep",
      position: 1,
      name: "Create Account",
      text: `Sign up at ${URLS.dashboard} - it's free`,
    },
    {
      "@type": "HowToStep",
      position: 2,
      name: "Connect Your AI",
      text: "Add distribute to ChatGPT, Claude, or Cursor using our MCP URL",
    },
    {
      "@type": "HowToStep",
      position: 3,
      name: "Add Your Keys",
      text: "Connect your Apollo account for leads and Anthropic for AI",
    },
    {
      "@type": "HowToStep",
      position: 4,
      name: "Launch Campaign",
      text: "Tell your AI: 'Send cold emails to [target] about [your product]'",
    },
    {
      "@type": "HowToStep",
      position: 5,
      name: "Watch Results",
      text: "Monitor opens, clicks, and replies in your dashboard",
    },
  ],
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
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
