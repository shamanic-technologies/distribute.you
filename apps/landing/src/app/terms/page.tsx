import type { Metadata } from "next";
import Link from "next/link";
import { PROD_URLS } from "@/lib/env-urls";
import { DEFAULT_OG_IMAGE_PATH, TWITTER_HANDLE } from "@/lib/seo";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Section } from "@/components/section";

export const revalidate = 86400;

const TERMS_URL = `${PROD_URLS.landing}/terms`;
const LAST_UPDATED = "October 29, 2026";
const COMPANY = "BLOOMING GENERATION";
const COMPANY_SIREN = "882102775";
const SERVICE = "distribute.you";
const SUPPORT_EMAIL = "support@distribute.you";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for distribute.you: the AI agent and the GTM agency, catalogue pricing, prepaid credit, outreach on your behalf, public performance data, and acceptable use.",
  alternates: { canonical: TERMS_URL },
  openGraph: {
    title: "Terms of Service | distribute.you",
    description:
      "How distribute.you works: pricing, credits, outreach infrastructure, public performance data, and your responsibilities.",
    url: TERMS_URL,
    type: "article",
    images: [
      {
        url: DEFAULT_OG_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: "distribute.you Terms of Service",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Service | distribute.you",
    description:
      "How distribute.you works: pricing, credits, outreach infrastructure, public performance data, and your responsibilities.",
    images: [DEFAULT_OG_IMAGE_PATH],
    creator: TWITTER_HANDLE,
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
          {COMPANY} is a SASU registered in France under SIREN {COMPANY_SIREN},
          with its registered office at 285 rue de l&rsquo;&Eacute;glise, 46140
          Douelle, France. Support reaches a person at{" "}
          <a href="mailto:support@distribute.you">support@distribute.you</a>.
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
          {SERVICE} is an acquisition agency delivered as a service, offered
          two ways: our AI agent, which runs your campaigns for you, and our
          GTM agency, where our team runs your go-to-market. You provide a
          website and set caps for each campaign; we find the buyers, write
          and send the outreach from domains we own, qualify and answer the
          replies, and report what each outcome cost you. Cold email is the channel we run. When a prospect asks to
          talk, our AI Instant Call can ring your sales rep and connect the
          call to the prospect. Any channel we add later is governed by
          these same Terms.
        </p>
        <p>
          The Service depends on AI providers, data providers, email
          infrastructure, and other third parties. See Section 8
          (Third-Party Services).
        </p>
        <p>
          <strong>Open source code.</strong> The code of our AI agent is
          published at{" "}
          <a href="https://github.com/distribute-you/gtm-factory" className="text-brand-400 underline">
            github.com/distribute-you/gtm-factory
          </a>{" "}
          under the MIT license. If you run it yourself, that license governs
          your use of the code, which is provided as is, without warranty, and
          your vendors bill you directly. These Terms govern the Service we
          host and run.
        </p>
      </>
    ),
  },
  {
    id: "pricing",
    title: "4. Pricing, Credit, and Payment",
    body: (
      <>
        <p>
          <strong>Which offer applies to you.</strong> The offer that applies
          to your account is the one in effect when the account was created.
          Accounts created on or after October 29, 2026 are on the current
          offer below. Accounts created before that date keep the offer they
          signed up under, described under &ldquo;Earlier offers&rdquo;, and
          are not re-priced in either direction.
        </p>
        <p>
          <strong>Current offer: the AI agent.</strong> The AI agent is free
          for one user. A team is billed per user each month (currently $9 per
          user). You pay for the work done on your campaigns: each tool behind
          them (lead data, research, AI writing, email checks, sending, calls)
          is billed by the unit at our public catalogue price, published at{" "}
          <a href="/catalog" className="text-brand-400 underline">
            distribute.you/catalog
          </a>
          . For these accounts we set each catalogue price at the
          vendor&apos;s list price for that tool, with no markup added. The
          catalogue price is the one that governs, even where a vendor&apos;s
          own price differs at a given moment (for example a vendor discount, a
          currency change, or a vendor change we have not yet published).
          Costs that come with running your account, such as onboarding, chat
          with our AI agent, and payment processing fees, are billed to your
          account the same way. There is no setup fee.
        </p>
        <p>
          <strong>Current offer: prepaid, with automatic reload.</strong> On
          the current offer, the Service is prepaid. Before your campaigns
          start, you pay a first top-up on the checkout page (currently at least
          $10) and set an automatic reload: a reload threshold (currently at
          least $5) and a reload amount (currently at least $10 above that
          threshold). Automatic reload is required for as long as you use the
          Service. An onboarding advance (currently $5) may be added to your
          account when it is created: it is an advance on your first payment,
          and that payment is credited net of it.
        </p>
        <p>
          <strong>Current offer: the GTM agency.</strong> When our team runs
          your go-to-market, the price is the one we agree with you (currently
          from $1,000 a month plus 10% of the campaign budget, the service
          fees), and the campaign budget is billed at the catalogue prices
          above.
        </p>
        <p>
          <strong>Earlier offers.</strong> For accounts created before October
          29, 2026, the platform is free and each tool is billed by the unit at
          our public catalogue price, our margin included. Depending on the
          offer such an account signed up under, it pays with prepaid credit,
          through a monthly plan, or after use (post-paid), and it may hold a
          welcome or referral offer, all described below. None of these earlier
          offers is open to accounts created on or after October 29, 2026.
        </p>
        <p>
          <strong>Prices are dynamic.</strong> Catalogue prices are in USD
          and move with our providers&apos; rates and our own pricing. We may
          change any catalogue price at any time, without notice, and by
          using the Service you agree to this. A new price applies to units
          used after the change, never to units already used. The price that governs a unit is the catalogue price at the
          moment that unit is used, as shown in your dashboard.
        </p>
        <p>
          <strong>Prepaid credit.</strong> You add credit before outreach
          starts, through our payment processors (Stripe or Revolut). The
          work on your campaigns draws on that credit. When it runs out, the
          automatic reload below adds credit; when it cannot (no payment
          method on file, or a declined charge), sending stops.
        </p>
        <p>
          <strong>Post-paid billing (earlier offers).</strong> Where an account signed up under it, you pay after
          use instead of adding credit first. You save a payment method when
          you sign up and nothing is charged that day. We charge it for what
          your campaigns spent when your unpaid usage reaches a threshold
          (currently $50, then $200, then $500), or at the end of the month,
          whichever comes first. If a charge is declined, sending stops until
          it is paid. Post-paid is not available on every payment method (for
          example some prepaid cards, or cards issued in some countries): we
          may then ask you to use another card or to switch to prepaid credit.
          By saving a payment method you authorize these charges without
          further confirmation.
        </p>
        <p>
          <strong>Card check.</strong> When you save a card, we may place a
          temporary authorization hold on it (for example $50) to check the
          card. A hold is not a charge. Your bank releases it after a few days,
          unless your campaigns reach that amount while the hold is active: we
          then use it toward your payment, only for what you owe, instead of a
          new charge. We may refuse a card that cannot take the hold.
        </p>
        <p>
          <strong>Reserved follow-ups.</strong> When the first email of a
          sequence goes out, we reserve the cost of its follow-ups on your
          credit. Each follow-up is billed at its real cost when it is sent,
          and the reserve is released when it is not. Your dashboard shows
          billed spend and reserved amounts apart.
        </p>
        <p>
          <strong>Automatic reload.</strong> Your campaigns spend money every
          day they run, so a prepaid account opened on or after October 11,
          2026 keeps automatic reload on to use the Service: when your credit
          falls under the reload threshold, we charge your saved payment
          method the reload amount and add it to your credit, as many times as
          your campaigns need. On the current offer you choose the threshold
          and the amount within the minimums above; on an earlier offer the
          threshold is $10 and the amount is that of your first payment. Once it is on,
          there is no switch to turn it off. To stop these charges, turn your
          campaigns off or remove your payment method; sending then stops when
          your credit runs out. Accounts opened before that date keep the
          reload setting they chose. By adding credit you authorize these
          charges without further confirmation.
        </p>
        <p>
          <strong>Monthly plan (earlier offers).</strong> Where an account signed up under it, it can subscribe to
          a monthly plan instead of prepaid credit. Each monthly payment is
          added to your account as credit for that month. A plan can start
          with a free trial of the length shown when you sign up (currently 3
          days): we add the plan&apos;s first month of credit at our expense,
          and we charge your saved payment method for the plan when the trial
          ends, unless you cancel before.
        </p>
        <p>
          <strong>Automatic plan upgrade.</strong> When your plan&apos;s credit
          runs out, including during a free trial, we move your plan up to the
          next plan amount (currently $100 more a month), charge your saved
          payment method that $100 right away, and add it to your credit. Each
          monthly payment after that is at the new amount. This repeats each
          time your credit runs out. For example, on a $99 plan whose trial
          credit runs out on day 2, we charge $100 that day, and $199 when the
          trial ends on day 3. By subscribing you authorize these charges
          without further confirmation. There is no switch to turn upgrades
          off: to stop them, cancel your plan, which stops all sending at
          once. Plans started before October 11, 2026 are not upgraded
          automatically.
        </p>
        <p>
          <strong>What you agree to spend.</strong> Before your card is first
          charged you confirm how it will be charged. You pay what your
          campaigns spend, at the catalogue prices above, within the budgets
          you set for them. Campaigns you add later spend within their own
          budgets.
        </p>
        <p>
          <strong>Campaign budgets.</strong> You set caps for each campaign
          (a max budget and/or a max volume, each with a period). A channel
          may have a minimum budget, and there is no maximum. Turning a campaign off stops its spend; amounts already
          used or reserved stay due.
        </p>
        <p>
          <strong>Credit validity.</strong> Prepaid credit is valid for twelve
          (12) months after the purchase that added it. Credit bought through
          a subscription expires at the end of each monthly period. Free
          credit (welcome, referral, promotional, goodwill) is valid for
          twelve (12) months after it is granted. Credit left unused after
          that date expires and is lost.
        </p>
        <p>
          <strong>No refunds.</strong> Payments are final and are not
          refunded, whatever the payment method or plan: prepaid credit,
          automatic reload, post-paid charges, monthly plan payments (including
          the first payment after a free trial), automatic plan upgrades, or service fees. Unused or expired
          credit is not refunded. The only exception is the managed plan
          guarantee below, for managed plans started before October 29, 2026.
        </p>
        <p>
          <strong>Managed plan (earlier offers).</strong> On a managed plan
          started before October 29, 2026, we run your outreach for you. It is
          priced from $1,000 a month plus 10% of the campaign budget (the
          service fees), with no time commitment. If you
          are not satisfied with the outcome after 60 days, tell us at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-400 underline">
            {SUPPORT_EMAIL}
          </a>{" "}
          and we refund 100% of the campaign budget you paid. Service fees
          are not refunded.
        </p>
        <p>
          <strong>Welcome credits and promotions (earlier offers).</strong> Welcome credits,
          referral credits, and promotional credits are granted at our sole
          discretion, offset charges rather than paying out in cash, have no
          cash value, expire as set out above, and may be revoked for abuse.
        </p>
        <p>
          <strong>The welcome offer is a total, not a top-up.</strong> The
          advertised welcome amount (currently $100, credited once the account
          has paid its first $100 of credit) is the most free credit an account can ever
          receive under that offer, counting every free credit that account has
          already been given under it. Promotional or discount codes, support
          and goodwill grants, and any other credit granted under the welcome
          offer count against that same total and reduce what is left of it. No
          combination of them entitles an account to more than the advertised
          welcome amount. The onboarding credit added when an account is
          created is not a welcome credit: it is an advance on the
          account&apos;s first payment, and that payment is credited net of it.
        </p>
        <p>
          <strong>Referral credits are separate and additional.</strong> The
          referral offer (currently $500, credited to the account that refers)
          is its own offer with its own total, and it does not count against
          the welcome amount. Referral credits are earned: the referring account
          receives its amount once the referred account&apos;s cumulative
          successful payments reach the referral amount. The referred account
          receives no referral credit. An account may earn the referral amount
          any number of times, once for each separate account it refers that
          reaches that threshold.
        </p>
        <p>
          <strong>Offer amounts.</strong> Payments means money
          actually received and not refunded or charged back, not usage accrued
          on credit. The welcome amount, the referral amount and any threshold
          that apply to an account are the ones in effect when that account was
          created; if we change an offer afterwards, existing accounts keep the
          terms they signed up under and are not re-priced in either direction.
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
          {" "}{SERVICE} and its affiliates to send cold email, replies,
          follow-ups, and other outreach on your behalf, referencing
          your brand, product, founders, and content. You also authorize us
          to call the phone number you give us for your sales rep when a
          prospect asks to talk, and to connect that call to the
          prospect.
        </p>
        <p>
          <strong>Our infrastructure.</strong> Outreach is sent from sending
          infrastructure owned, operated, or contracted by us, including
          inboxes on domains we own, hosted by mailbox providers such as
          Google Workspace, Gandi, and Mailforge, and sending platforms such
          as Instantly. Messages are sent from email addresses and domains
          that we own, not from your own brand domain. Replies land in our
          inboxes first: we read them, answer them on your behalf (including
          with AI), and forward the interested ones to you.
        </p>
        <p>
          <strong>Shared deliverability risk.</strong> Because some
          infrastructure is shared across customers, the conduct of other
          customers and the conduct of recipients can affect deliverability,
          inbox placement, blacklisting, and account suspension on third-party
          platforms. We do not guarantee delivery, reply rates,
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
          terms of service of Google, Microsoft, and every other email
          platform involved. You represent and warrant that (a)
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
          pages, public leaderboards, blog posts, social media, investor
          decks, partner materials, and machine-readable feeds (sitemap,
          JSON-LD, public API endpoints). Published data may include, without
          limitation: your brand name, brand domain, brand logo; campaign
          counts; emails sent, clicked, and replied; positive-reply
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
          limitation Anthropic, Google, OpenAI, DeepSeek, Z.ai, TypeSafe,
          Apollo, Instantly, Twilio, Postmark, Stripe, Revolut, Clerk,
          Cloudflare, Hetzner, and others. Our Privacy Policy lists them with
          what each one does. We are not
          responsible for the availability,
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
          deliverability of email, achievement of any
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
          You may stop using the Service at any time by turning off your
          campaigns; you remain responsible for amounts already used or
          reserved. Unused credit is not refunded and expires as set out in
          Section 4. Sections that by their nature should
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
          These Terms are governed by French law. Any dispute that cannot be
          settled amicably is subject to the exclusive jurisdiction of the
          competent courts of the place of our registered office in France.
          Where required by law, your local consumer-protection rights are
          unaffected.
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
      <main className="dy-page">
        <Section variant="prose" outerClassName="dy-section">
          <header className="mb-12">
            <p className="dy-mono mb-3 text-xs uppercase tracking-wider text-(--dy-muted)">
              Legal
            </p>
            <h1 className="dy-title mb-3 text-4xl md:text-5xl">
              Terms of Service
            </h1>
            <p className="dy-mono text-sm text-(--dy-muted)">
              Last updated: {LAST_UPDATED}
            </p>
            <p className="dy-body mt-6 text-base">
              These Terms govern your use of {SERVICE}. Please read them
              carefully. Sections 4 (Pricing &amp; Credit), 5 (Outreach
              on Your Behalf), and 6 (Public Performance Data) describe how
              the platform actually works and what you are agreeing to.
            </p>
          </header>

          <nav
            aria-label="Table of contents"
            className="dy-card mb-12 p-5"
          >
            <p className="dy-mono mb-3 text-xs font-semibold uppercase tracking-wider text-(--dy-muted)">
              Contents
            </p>
            <ol className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`#${s.id}`}
                    className="text-(--dy-sub) transition hover:text-(--dy-accent-hi)"
                  >
                    {s.title}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>

          <div className="dy-body space-y-10 text-base">
            {SECTIONS.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <h2 className="dy-h2 mb-4 text-2xl">
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
