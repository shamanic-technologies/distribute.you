import type { Metadata } from "next";
import { PROD_URLS } from "@/lib/env-urls";
import { DEFAULT_OG_IMAGE_PATH, TWITTER_HANDLE } from "@/lib/seo";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Section } from "@/components/section";

export const revalidate = 86400;

const PRIVACY_URL = `${PROD_URLS.landing}/privacy`;
const LAST_UPDATED = "June 9, 2026";
const SUPPORT_EMAIL = "support@distribute.you";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for distribute, covering account data, outreach data, campaign analytics, and third-party providers.",
  alternates: { canonical: PRIVACY_URL },
  openGraph: {
    title: "Privacy Policy - distribute",
    description:
      "How distribute handles account data, outreach data, campaign analytics, and third-party providers.",
    url: PRIVACY_URL,
    type: "article",
    images: [
      {
        url: DEFAULT_OG_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: "distribute - Privacy Policy",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy - distribute",
    description:
      "How distribute handles account data, outreach data, campaign analytics, and third-party providers.",
    images: [DEFAULT_OG_IMAGE_PATH],
    creator: TWITTER_HANDLE,
  },
  robots: { index: true, follow: true },
};

const SECTIONS = [
  {
    title: "Information we collect",
    body: [
      "We collect account details you provide, such as name, email, company, billing settings, and product URLs.",
      "We process outreach inputs and campaign data needed to run the service, including prompts, lead lists, message drafts, delivery events, replies, and performance metrics.",
    ],
  },
  {
    title: "How we use information",
    body: [
      "We use this information to operate distribute, generate and send outreach on your behalf, measure campaign performance, prevent abuse, provide support, and improve the product.",
      "We may publish aggregated or public performance data as described in our Terms, but we do not sell personal information.",
    ],
  },
  {
    title: "Third-party providers",
    body: [
      "distribute relies on infrastructure and API providers for AI inference, lead enrichment, email delivery, analytics, payments, hosting, and observability.",
      "Provider access is limited to the information needed to deliver the service and is governed by their own terms and policies.",
    ],
  },
  {
    title: "Retention and security",
    body: [
      "We keep information for as long as needed to operate the service, comply with legal obligations, resolve disputes, and maintain accurate campaign records.",
      "We use technical and organizational safeguards appropriate to the type of data we process, but no internet service can guarantee perfect security.",
    ],
  },
  {
    title: "Your choices",
    body: [
      "You can request access, correction, export, or deletion of your personal information by contacting support.",
      "Some records may be retained when required for security, billing, compliance, dispute resolution, or legitimate business records.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="v2-page">
        <Section variant="prose" outerClassName="v2-section">
          <p className="v2-mono text-xs font-semibold uppercase tracking-[0.18em] text-[var(--v2-accent-hi)]">
            Legal
          </p>
          <h1 className="v2-title mt-4 text-4xl">
            Privacy Policy
          </h1>
          <p className="v2-mono mt-4 text-sm text-[var(--v2-muted)]">Last updated {LAST_UPDATED}</p>
          <p className="v2-body mt-6 text-lg">
            This Privacy Policy explains how distribute collects, uses, and
            protects information when you use our websites, dashboard, APIs,
            and related services.
          </p>
        </Section>

        <Section variant="prose" outerClassName="v2-section-tight">
          <div className="space-y-10">
            {SECTIONS.map((section) => (
              <section key={section.title}>
                <h2 className="v2-h2 text-2xl">
                  {section.title}
                </h2>
                <div className="v2-body mt-4 space-y-4 text-base">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}

            <section>
              <h2 className="v2-h2 text-2xl">
                Contact
              </h2>
              <p className="v2-body mt-4 text-base">
                For privacy questions or requests, contact{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[var(--v2-accent-hi)] underline">
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
