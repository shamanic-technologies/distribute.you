import type { Metadata } from "next";
import { PROD_URLS } from "@/lib/env-urls";
import { DEFAULT_OG_IMAGE_PATH, TWITTER_HANDLE } from "@/lib/seo";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Section } from "@/components/section";

export const revalidate = 86400;

const PRIVACY_URL = `${PROD_URLS.landing}/privacy`;
const LAST_UPDATED = "October 6, 2026";
const SUPPORT_EMAIL = "support@distribute.you";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for distribute.you, covering account data, outreach data, campaign analytics, and third-party providers.",
  alternates: { canonical: PRIVACY_URL },
  openGraph: {
    title: "Privacy Policy - distribute.you",
    description:
      "How distribute.you handles account data, outreach data, campaign analytics, and third-party providers.",
    url: PRIVACY_URL,
    type: "article",
    images: [
      {
        url: DEFAULT_OG_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: "distribute.you - Privacy Policy",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy - distribute.you",
    description:
      "How distribute.you handles account data, outreach data, campaign analytics, and third-party providers.",
    images: [DEFAULT_OG_IMAGE_PATH],
    creator: TWITTER_HANDLE,
  },
  robots: { index: true, follow: true },
};

const SECTIONS = [
  {
    title: "Who we are",
    body: [
      "distribute.you is run by BLOOMING GENERATION, a SASU registered in France under SIREN 882102775, with its registered office at 285 rue de l\u2019\u00c9glise, 46140 Douelle, France. We decide how the data about our clients is used. For data about the prospects we contact for a client, the client decides and we act on its instructions, as set out in our Terms.",
    ],
  },
  {
    title: "Data about you",
    body: [
      "Account: your name and work email, or your Google sign-in. Sign-in is handled by Clerk.",
      "Phone number: asked at sign-up. We use it to reach you, and for AI Instant Call, to ring your sales rep when a prospect asks to talk.",
      "Your business: your website, what you sell, your sales path and its rates, the lifetime revenue of a client, your campaigns and their budgets.",
      "Payments: your credit, reload settings and payment history. Card details are handled by Stripe or Revolut; we never see your full card number.",
      "Messages: what you send us by email, WhatsApp or the request forms in the dashboard.",
      "Accounts you choose to connect, such as Google (read only), GoHighLevel, or a WhatsApp or Discord account linked in read-only mode to bring your leads' messages into your dashboard.",
      "Usage: pages you visit, clicks, device and browser details, and recordings of your sessions on our site and dashboard (see Cookies and tracking).",
    ],
  },
  {
    title: "Data about your prospects",
    body: [
      "To run your campaigns we process data about the people we contact for you: name, job title, company, LinkedIn profile, location, work email, and phone number when a prospect asks to be called. It comes from lead data providers such as Apollo, from public web pages, and from lists you upload.",
      "We check that email addresses are valid, record the emails we send, link clicks (not opens), unsubscribes and replies. AI reads each reply, answers it on your behalf, and we forward the interested ones to you.",
    ],
  },
  {
    title: "Why we use it",
    body: [
      "To provide the service you signed up for: find buyers, write and send outreach, answer replies, connect calls, bill you, and support you.",
      "For our legitimate interests: measure and improve the product, prevent abuse, keep our sending infrastructure healthy, and publish performance data as described in our Terms.",
      "To meet our legal obligations, such as keeping billing records.",
      "We do not sell personal information.",
    ],
  },
  {
    title: "Cookies and tracking",
    body: [
      "Our site and dashboard use Google Analytics and Google Ads (to measure visits and ad results), PostHog, hosted in the EU (product analytics and session recordings), Ahrefs Web Analytics (site visits), and Partnero (affiliate referrals). We also set a first-visit cookie to know where you came from, and Clerk sets the cookies that keep you signed in.",
      "Our team receives internal notifications about sign-up visits through Telegram, which can include your name and email.",
      "You can block or delete cookies in your browser settings. Blocking sign-in cookies stops the dashboard from working.",
    ],
  },
  {
    title: "Who we share it with",
    body: [
      "We share data only with the providers that run the service for us, each limited to what its job needs:",
      "AI: Anthropic, Google, OpenAI, DeepSeek, Z.ai, TypeSafe, Moonshot. Lead data and email checks: Apollo, Explee, Apify. Web research: Scrape.do, Firecrawl, Treg.",
      "Inboxes and sending: Google Workspace, Gandi, Mailforge, Instantly. Our own emails to you: Postmark. Calls: Twilio.",
      "Payments: Stripe, Revolut. Sign-in: Clerk. Hosting: Hetzner (Germany) and Cloudflare. Error tracking: Sentry. Analytics: Google, PostHog, Ahrefs, Partnero. Internal notifications: Telegram.",
      "Some of these providers are outside the European Union, mostly in the United States. For those transfers we rely on the safeguards each provider offers, such as standard contractual clauses.",
    ],
  },
  {
    title: "How long we keep it",
    body: [
      "We keep your data while your account is open, and after that until you ask us to delete it. Billing records are kept as long as accounting law requires.",
      "Database backups are kept for 7 days. Technical logs of each run are kept for 30 days.",
    ],
  },
  {
    title: "Your rights",
    body: [
      "You can ask to access, correct, export or delete your personal data, to restrict or object to its use, by emailing support. Our team handles each request by hand, within one month.",
      "Some records may be kept when the law requires it, or for security, billing or dispute resolution.",
      "If you think we got something wrong, you can complain to the CNIL, the French data protection authority (cnil.fr).",
    ],
  },
  {
    title: "Security",
    body: [
      "We use technical and organizational safeguards suited to the data we handle, but no internet service can guarantee perfect security.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="dy-page">
        <Section variant="prose" outerClassName="dy-section">
          <p className="dy-mono text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dy-accent-hi)]">
            Legal
          </p>
          <h1 className="dy-title mt-4 text-4xl">
            Privacy Policy
          </h1>
          <p className="dy-mono mt-4 text-sm text-[var(--dy-muted)]">Last updated {LAST_UPDATED}</p>
          <p className="dy-body mt-6 text-lg">
            This Privacy Policy explains how distribute.you collects, uses, and
            protects information when you use our websites, dashboard, APIs,
            and related services.
          </p>
        </Section>

        <Section variant="prose" outerClassName="dy-section-tight">
          <div className="space-y-10">
            {SECTIONS.map((section) => (
              <section key={section.title}>
                <h2 className="dy-h2 text-2xl">
                  {section.title}
                </h2>
                <div className="dy-body mt-4 space-y-4 text-base">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}

            <section>
              <h2 className="dy-h2 text-2xl">
                Contact
              </h2>
              <p className="dy-body mt-4 text-base">
                For privacy questions or requests, contact{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[var(--dy-accent-hi)] underline">
                  {SUPPORT_EMAIL}
                </a>
                .
              </p>
            </section>
          </div>
        </Section>
      </main>
      <Footer />
    </>
  );
}
