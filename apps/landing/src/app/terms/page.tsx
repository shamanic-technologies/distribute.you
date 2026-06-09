import type { Metadata } from "next";
import Link from "next/link";
import { PROD_URLS } from "@/lib/env-urls";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Section } from "@/components/section";

export const revalidate = 86400;

const TERMS_URL = `${PROD_URLS.landing}/terms`;
const LAST_UPDATED = "May 28, 2026";
const COMPANY = "Shamanic Technologies";
const SERVICE = "distribute";
const SUPPORT_EMAIL = "support@distribute.you";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for the distribute platform — pricing, credits, outreach on your behalf, public performance data, and acceptable use.",
  alternates: { canonical: TERMS_URL },
  openGraph: {
    title: "Terms of Service — distribute",
    description:
      "How distribute works: pricing, credits, outreach infrastructure, public performance data, and your responsibilities.",
    url: TERMS_URL,
    type: "article",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "distribute — Terms of Service",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Service — distribute",
    description:
      "How distribute works: pricing, credits, outreach infrastructure, public performance data, and your responsibilities.",
    images: ["/og-image.jpg"],
    creator: "@distribute_you",
  },
  robots: { index: true, follow: true },
};

interface SectionDef {
  id: string;
  title: string;
  body: React.ReactNode;
}

const SECTIONS: SectionDef[] = [
  {
    id: "acceptance",
    title: "1. Acceptance of Terms",
    body: (
      <>
        <p>
          These Terms of Service (the &ldquo;Terms&rdquo;) form a binding agreement
          between you (&ldquo;you&rdquo;, &ldquo;your&rdquo;, or &ldquo;Customer&rdquo;) and {COMPANY}
          (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;, or &ldquo;{SERVICE}&rdquo;)
          regarding your access to and use of the {SERVICE} platform, websites,
          APIs, dashboards, and related services (collectively, the
          &ldquo;Service&rdquo;).
        </p>
        <p>
          By creating an account, accessing, or using the Service, you confirm
          that you have read, understood, and agree to be bound by these Terms
          and our Privacy Policy. If you do not agree, do not use the Service.
        </p>
        <p>
          If you are using the Service on behalf of an organization, you
          represent that you have authority to bind that organization, and
          &ldquo;you&rdquo; refers to that organization.
        </p>
      </>
    ),
  },
  {
    id: "eligibility",
    title: "2. Eligibility and Account",
    body: (
      <>
        <p>
          You must be at least 18 years old and capable of entering into a
          binding contract. You agree to provide accurate, current account
          information and to keep it up to date.
        </p>
        <p>
          You are responsible for all activity that occurs under your account,
          including outreach we send on your behalf. Keep your credentials
          confidential and notify us immediately at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-400 underline">
            {SUPPORT_EMAIL}
          </a>{" "}
          if you suspect unauthorized use.
        </p>
      </>
    ),
  },
  {
    id: "service",
    title: "3. Description of the Service",
    body: (
      <>
        <p>
          {SERVICE} is a done-for-you (DFY), bring-your-own-keys (BYOK)
          automation platform built on the Model Context Protocol. You provide
          a URL and a budget; we orchestrate lead discovery, message
          generation, outreach delivery, reply qualification, and reporting
          across multiple channels (sales cold email, PR, VC outreach, hiring,
          accelerators, journalist pitching, and more).
        </p>
        <p>
          The Service depends on AI providers, data providers, email
          infrastructure, social account infrastructure, and other third
          parties. See Section 8 (Third-Party Services).
        </p>
      </>
    ),
  },
  {
    id: "pricing",
    title: "4. Pricing, Credits, and Auto-Reload",
    body: (
      <>
        <p>
          <strong>Variable, pay-as-you-go pricing.</strong> {SERVICE} charges
          you only for what you use, calculated from per-unit costs of the
          underlying providers (AI inference, lead data, email sending,
          warmed-inbox infrastructure, etc.) plus our platform fee. Unit
          prices change whenever an upstream provider rate changes, and we
          may adjust our platform fee at any time.
        </p>
        <p>
          <strong>The pricing page is informational.</strong> Pricing displayed
          on our marketing pages, blog, documentation, social posts, partner
          materials, or any other communication is provided for transparency
          and convenience only and may be inaccurate, outdated, or incomplete.
          It does not constitute a binding offer or a guarantee of price. The
          authoritative price for any unit of consumption is the price shown
          live in your dashboard at the moment that unit is consumed and the
          price actually charged against your credit balance. By using the
          Service you accept that the live dashboard price (and the
          corresponding debit) is the only price that governs.
        </p>
        <p>
          <strong>Credits.</strong> The Service operates on prepaid credits.
          You purchase credits in advance; we debit credits as you consume
          units. Credits are denominated in USD cents, are non-refundable
          except where required by law, are not transferable between accounts,
          and have no cash value outside the Service.
        </p>
        <p>
          <strong>Auto-reload.</strong> You may enable auto-reload, which
          authorizes us to charge your saved payment method (via our payment
          processor, Stripe) for a configured top-up amount whenever your
          balance falls below a configured threshold. By enabling auto-reload
          you authorize recurring charges of variable amounts without further
          confirmation, up to and including the limits you configure. You can
          disable auto-reload at any time in the dashboard; disabling stops
          future top-ups but does not refund previously-charged amounts.
        </p>
        <p>
          <strong>Welcome credits and promotions.</strong> Welcome credits,
          referral credits, and promotional credits are granted at our sole
          discretion, have no cash value, may expire, and may be revoked for
          abuse.
        </p>
        <p>
          <strong>Taxes.</strong> Prices exclude applicable taxes, duties, and
          levies, which you are responsible for paying.
        </p>
        <p>
          <strong>Disputes about charges.</strong> If you believe a charge is
          incorrect, contact us at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-400 underline">
            {SUPPORT_EMAIL}
          </a>{" "}
          within thirty (30) days of the charge. After thirty days, charges
          are deemed accepted.
        </p>
      </>
    ),
  },
  {
    id: "outreach-on-your-behalf",
    title: "5. Outreach on Your Behalf",
    body: (
      <>
        <p>
          <strong>Authorization.</strong> By using the Service you authorize
          {" "}{SERVICE} and its affiliates to send email, social messages,
          replies, follow-ups, and other outreach on your behalf, referencing
          your brand, product, founders, and content.
        </p>
        <p>
          <strong>Our infrastructure.</strong> Unless you explicitly configure
          and connect your own sending infrastructure, outreach is sent from
          sending infrastructure owned, operated, or contracted by us or our
          affiliated marketing agency, including but not limited to: email
          inboxes on domains we or our agency own; email accounts that we
          pre-warm and maintain; LinkedIn, X (Twitter), and other social
          accounts operated by our agency on behalf of multiple customers;
          shared and dedicated IP pools; and third-party sending platforms
          such as Postmark, Instantly, Apollo, and equivalents. Messages may
          be sent from email addresses, domains, and social handles that do
          not match your own brand, and replies may be routed through our
          infrastructure before being forwarded to you.
        </p>
        <p>
          <strong>Shared deliverability risk.</strong> Because some
          infrastructure is shared across customers, the conduct of other
          customers and the conduct of recipients can affect deliverability,
          inbox placement, blacklisting, and account suspension on third-party
          platforms. We do not guarantee delivery, open rates, reply rates,
          inbox placement, or any specific outcome. We may pause, throttle,
          re-route, or suspend any outreach (including yours) at any time if
          we determine, in our sole discretion, that doing so is necessary to
          protect the integrity of our infrastructure or the interests of
          other customers.
        </p>
        <p>
          <strong>Your compliance obligations.</strong> You are solely
          responsible for ensuring that any outreach you direct us to send
          complies with all applicable laws and platform terms, including
          without limitation the CAN-SPAM Act (U.S.), CASL (Canada), GDPR
          (EU/UK), PECR (UK), CCPA / CPRA (California), TCPA (U.S.), and the
          terms of service of LinkedIn, X (Twitter), Google, Microsoft, and
          every other platform involved. You represent and warrant that (a)
          you have a lawful basis to contact each recipient; (b) you have not
          targeted recipients on suppression lists or who have unsubscribed;
          (c) your content is truthful, not misleading, and does not infringe
          third-party rights; and (d) your product or service is real and
          legally operable in the recipient&rsquo;s jurisdiction.
        </p>
        <p>
          <strong>Recipient data.</strong> You instruct us to process
          recipient personal data on your behalf as part of the Service. You
          are the controller of recipient personal data; we are a processor.
          You will respond to recipient data-subject requests; we will
          reasonably assist.
        </p>
        <p>
          <strong>Reply attribution.</strong> Replies, opt-outs, and
          complaints received against shared infrastructure may be attributed
          to you, to other customers, or to us collectively, and may affect
          shared reputation metrics. We may reroute, suppress, or block
          recipients across the whole customer base when we receive abuse or
          spam complaints.
        </p>
      </>
    ),
  },
  {
    id: "public-performance-data",
    title: "6. Public Performance Data and Attribution",
    body: (
      <>
        <p>
          <strong>Public leaderboards.</strong> {SERVICE} publishes campaign
          performance data on public-facing surfaces, including our marketing
          pages, public leaderboards (e.g. /performance), blog
          posts, social media, investor decks, partner materials, and machine
          -readable feeds (sitemap, JSON-LD, API endpoints such as
          /v1/public/features/ranked). Published data may include, without
          limitation: your brand name, brand domain, brand logo; campaign
          counts; emails sent, opened, clicked, and replied; positive-reply
          counts and rates; cost-per-action metrics in aggregate or per
          campaign; ranked and unranked comparisons against other customers;
          and the categories, features, workflows, and AI models you use.
        </p>
        <p>
          <strong>You consent.</strong> By creating an account and running
          campaigns, you grant us a perpetual, irrevocable, worldwide,
          royalty-free license to publish, display, distribute, and
          incorporate your performance data and brand identifiers (name,
          domain, logo) for the purposes above, including in promotional and
          marketing materials and for benchmarking against other customers.
        </p>
        <p>
          <strong>No expectation of privacy on performance data.</strong> You
          acknowledge that aggregated and per-brand performance data is a core
          element of the Service&rsquo;s public benchmarking proposition and
          that you cannot reasonably expect this data to remain confidential.
        </p>
        <p>
          <strong>Opt-out.</strong> You may request that we redact your brand
          name and logo from public leaderboards by emailing{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-400 underline">
            {SUPPORT_EMAIL}
          </a>{" "}
          with the subject &ldquo;Leaderboard Opt-Out&rdquo;. We will redact
          identifiers within thirty (30) days of receipt. Aggregate,
          anonymized, and historical statistics may continue to include your
          data. Cached, third-party, and archived copies (search engines,
          AI scrapers, internet archives) are outside our control.
        </p>
      </>
    ),
  },
  {
    id: "ai-generated-content",
    title: "7. AI-Generated Content",
    body: (
      <>
        <p>
          The Service uses large language models (LLMs) and other AI systems
          to generate emails, replies, pitches, summaries, qualifications,
          and other content. AI output can be inaccurate, hallucinated,
          biased, offensive, defamatory, or otherwise unfit for purpose. You
          are responsible for reviewing AI-generated content before it is
          sent if you have configured the Service to require approval, and
          for accepting the consequences of AI-generated content sent under
          fully automated configurations.
        </p>
        <p>
          You will not use the Service to generate content that is illegal,
          defamatory, harassing, deceptive, fraudulent, infringing, or
          designed to evade spam filters or platform safeguards.
        </p>
      </>
    ),
  },
  {
    id: "third-party",
    title: "8. Third-Party Services and Dependencies",
    body: (
      <>
        <p>
          The Service relies on third-party providers, including without
          limitation Anthropic, OpenAI, Google, Apollo, Muck Rack, Featured,
          Postmark, Stripe, Clerk, Vercel, Neon, Railway, LinkedIn, X
          (Twitter), and others. We are not responsible for the availability,
          accuracy, or behavior of third-party services. Outages, rate limits,
          API changes, deprecations, and policy changes at any provider may
          degrade or interrupt the Service, change pricing, or require
          changes to your configuration without notice.
        </p>
        <p>
          Your use of third-party services through the Service is also
          governed by those providers&rsquo; terms.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "9. Acceptable Use",
    body: (
      <>
        <p>You will not, and will not attempt to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Use the Service to send unsolicited bulk email in violation of any anti-spam law.</li>
          <li>
            Contact recipients on suppression lists, who have unsubscribed, or
            who have not provided a lawful basis to be contacted.
          </li>
          <li>
            Send content that is defamatory, deceptive, harassing, infringing,
            obscene, fraudulent, or that promotes illegal goods or services.
          </li>
          <li>
            Use the Service to impersonate a third party or to misrepresent
            your affiliation, identity, or qualifications.
          </li>
          <li>
            Reverse-engineer, decompile, scrape, or extract data from the
            Service, except for your own data and except as permitted by
            the open-source license that covers our source code.
          </li>
          <li>
            Probe, attack, or interfere with the Service or any infrastructure
            we operate.
          </li>
          <li>
            Resell, sublicense, or white-label the Service without our prior
            written consent.
          </li>
          <li>
            Use the Service to compete by training a competing LLM, agent,
            or distribution automation product on output we generate.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "your-content",
    title: "10. Your Content and Data",
    body: (
      <>
        <p>
          You retain ownership of the content and data you submit to the
          Service (your &ldquo;Customer Data&rdquo;). You grant us a
          worldwide, non-exclusive, royalty-free license to host, copy,
          transmit, display, modify, and otherwise process your Customer Data
          solely as required to operate and improve the Service, including
          as described in Section 6 (Public Performance Data).
        </p>
      </>
    ),
  },
  {
    id: "ip",
    title: "11. Intellectual Property",
    body: (
      <>
        <p>
          The Service, including all software, designs, models, datasets,
          documentation, trademarks, and content (excluding Customer Data
          and content licensed under open-source licenses we publish), is
          owned by us or our licensors and is protected by intellectual
          property laws. Except for the rights expressly granted in these
          Terms, no rights are transferred to you.
        </p>
        <p>
          Portions of the Service are published under the MIT License at{" "}
          <a
            href="https://github.com/shamanic-technologies/distribute.you"
            className="text-brand-400 underline"
          >
            github.com/shamanic-technologies/distribute.you
          </a>
          ; use of the open-source code is governed by that license.
        </p>
      </>
    ),
  },
  {
    id: "privacy",
    title: "12. Privacy and Data Processing",
    body: (
      <>
        <p>
          Our processing of personal data is described in our Privacy Policy.
          Where you direct us to process recipient personal data, you are the
          controller and we are the processor, and the data processing
          provisions of Section 5 apply.
        </p>
      </>
    ),
  },
  {
    id: "confidentiality",
    title: "13. Confidentiality",
    body: (
      <>
        <p>
          Each party will protect the other&rsquo;s non-public information
          using at least the degree of care it uses for its own confidential
          information of similar importance, and at least reasonable care.
          Confidential information does not include information that is or
          becomes public through no fault of the receiving party, that the
          receiving party already knew, or that the receiving party
          independently develops.
        </p>
      </>
    ),
  },
  {
    id: "warranty-disclaimer",
    title: "14. Warranty Disclaimer",
    body: (
      <>
        <p className="uppercase tracking-wide">
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo;, without warranties of any kind, whether express,
          implied, statutory, or otherwise, including without limitation
          warranties of merchantability, fitness for a particular purpose,
          title, non-infringement, accuracy of AI-generated content,
          deliverability of email or social messages, achievement of any
          performance metric, uninterrupted or error-free operation, or that
          defects will be corrected.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    title: "15. Limitation of Liability",
    body: (
      <>
        <p className="uppercase tracking-wide">
          To the maximum extent permitted by law, in no event will we, our
          affiliates, or our agency partners be liable to you for any
          indirect, incidental, special, consequential, exemplary, or
          punitive damages, or for any loss of profits, revenue, goodwill,
          data, opportunity, or business, arising out of or related to the
          Service, even if we have been advised of the possibility of such
          damages.
        </p>
        <p className="uppercase tracking-wide">
          Our aggregate liability for all claims arising out of or related to
          the Service in any twelve-month period will not exceed the greater
          of (a) the amounts you actually paid to us for the Service in the
          three (3) months immediately preceding the event giving rise to
          liability, or (b) one hundred U.S. dollars ($100).
        </p>
      </>
    ),
  },
  {
    id: "indemnification",
    title: "16. Indemnification",
    body: (
      <>
        <p>
          You will defend, indemnify, and hold harmless {COMPANY}, its
          affiliates, agency partners, officers, employees, and contractors
          from and against any third-party claim, demand, loss, damage,
          liability, fine, settlement, cost, or expense (including reasonable
          attorneys&rsquo; fees) arising out of or related to: (a) your
          Customer Data; (b) outreach we sent on your behalf at your
          direction; (c) your violation of these Terms, applicable law, or
          third-party platform terms; (d) your product, service, website, or
          business; (e) your infringement of any third-party right; or (f)
          any spam, abuse, or unsubscribe complaint attributable to your
          campaigns.
        </p>
      </>
    ),
  },
  {
    id: "suspension-termination",
    title: "17. Suspension and Termination",
    body: (
      <>
        <p>
          We may suspend or terminate your account, at our sole discretion,
          with or without notice, for any reason, including without
          limitation: violation of these Terms; abusive behavior; spam or
          deliverability complaints; risk to our shared infrastructure or
          other customers; unpaid amounts; legal or regulatory requirement;
          or discontinuation of the Service. Upon termination, your right to
          use the Service ends immediately; we may delete your Customer Data
          after a reasonable retention period.
        </p>
        <p>
          You may stop using the Service at any time by ceasing usage and
          disabling auto-reload. Sections that by their nature should
          survive termination (Sections 4&ndash;6, 10&ndash;16, 19&ndash;20)
          will survive.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "18. Modifications to These Terms",
    body: (
      <>
        <p>
          We may modify these Terms at any time by posting an updated version
          at this URL and updating the &ldquo;Last updated&rdquo; date. If we
          make material changes we will use commercially reasonable efforts
          to notify you (e.g. in-app banner, email). Your continued use of
          the Service after changes take effect constitutes acceptance.
        </p>
      </>
    ),
  },
  {
    id: "governing-law",
    title: "19. Governing Law and Disputes",
    body: (
      <>
        <p>
          These Terms are governed by the laws of the State of Delaware,
          United States, excluding its conflict-of-laws rules. Each party
          submits to the exclusive jurisdiction of the state and federal
          courts located in Delaware for any dispute that is not subject to
          arbitration, and waives any objection to venue. Where required by
          law, your local consumer-protection rights are unaffected.
        </p>
      </>
    ),
  },
  {
    id: "miscellaneous",
    title: "20. Miscellaneous",
    body: (
      <>
        <p>
          These Terms (together with the Privacy Policy and any order forms)
          are the entire agreement between you and us regarding the Service
          and supersede all prior agreements on the subject. If any provision
          is unenforceable, the remaining provisions remain in effect. Our
          failure to enforce any right is not a waiver. You may not assign
          these Terms without our prior written consent; we may assign them
          freely. Neither party is liable for delays caused by events beyond
          its reasonable control (force majeure).
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "21. Contact",
    body: (
      <>
        <p>
          Questions about these Terms? Email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-400 underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="v2-page">
        <Section variant="prose" outerClassName="v2-section">
          <header className="mb-12">
            <p className="v2-mono mb-3 text-xs uppercase tracking-wider text-[var(--v2-muted)]">
              Legal
            </p>
            <h1 className="v2-title mb-3 text-4xl md:text-5xl">
              Terms of Service
            </h1>
            <p className="v2-mono text-sm text-[var(--v2-muted)]">
              Last updated: {LAST_UPDATED}
            </p>
            <p className="v2-body mt-6 text-base">
              These Terms govern your use of {SERVICE}. Please read them
              carefully — sections 4 (Pricing &amp; Auto-Reload), 5 (Outreach
              on Your Behalf), and 6 (Public Performance Data) describe how
              the platform actually works and what you are agreeing to.
            </p>
          </header>

          <nav
            aria-label="Table of contents"
            className="v2-card mb-12 p-5"
          >
            <p className="v2-mono mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--v2-muted)]">
              Contents
            </p>
            <ol className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`#${s.id}`}
                    className="text-[var(--v2-sub)] transition hover:text-[var(--v2-accent-hi)]"
                  >
                    {s.title}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>

          <div className="v2-body space-y-10 text-base">
            {SECTIONS.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <h2 className="v2-h2 mb-4 text-2xl">
                  {s.title}
                </h2>
                <div className="space-y-4">{s.body}</div>
              </section>
            ))}
          </div>
        </Section>
      </main>
      <Footer />
    </>
  );
}
