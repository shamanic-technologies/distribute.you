import { HeroForm } from "@/components/hero-form";
import { LinkButton } from "@/components/link-button";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { GmailInbox } from "@/components/gmail-inbox";
import { ProviderAvatar } from "@/components/provider-avatar";
import { PROD_URLS } from "@/lib/env-urls";

export const revalidate = 300;

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What does distribute do?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "distribute runs sales cold email outreach for you. Add your URL and budget; we find prospects, write emails, send sequences, qualify replies with AI, and forward qualified buyers to Gmail.",
      },
    },
    {
      "@type": "Question",
      name: "Do I need a sending domain or warmed mailbox?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. distribute handles sending infrastructure, prospect sourcing, copy generation, deliverability monitoring, reply triage, and campaign reporting.",
      },
    },
    {
      "@type": "Question",
      name: "How much does it cost to start?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "$25 welcome credits. No subscription. You set the campaign budget before launch and see the exact unit-cost breakdown in the dashboard.",
      },
    },
  ],
};

const proofStats = [
  { value: "100", label: "buyer conversations in the first push", suffix: "qualified replies target" },
  { value: "10x", label: "more outbound without hiring SDRs", suffix: "list, copy, send, qualify" },
  { value: "$1.42", label: "target cost per qualified reply", suffix: "ranked by workflow cost" },
  { value: "24h", label: "from URL to live campaign", suffix: "no warmup project" },
];

const campaignRows = [
  { segment: "Founder-led SaaS", prospects: "2,900", sent: "1,240", replies: "86", cost: "$1.38", status: "Scale" },
  { segment: "Agencies buying ops tools", prospects: "1,840", sent: "920", replies: "61", cost: "$1.51", status: "Scale" },
  { segment: "VC-backed revops teams", prospects: "740", sent: "360", replies: "12", cost: "$5.90", status: "Cut" },
];

const steps = [
  {
    title: "Drop your URL",
    body: "We extract the offer, ICP, proof, pain, objections, and buying trigger from the site.",
  },
  {
    title: "We build the machine",
    body: "Prospect list, enrichment, cold email copy, inbox routing, follow-ups, reply qualification, cost tracking.",
  },
  {
    title: "You get buyers",
    body: "Qualified replies land in Gmail with context, company, cost, and the thread ready for your reply.",
  },
];

const handleItems = [
  "Prospect sourcing and enrichment",
  "Cold email positioning and sequence writing",
  "Agency-warmed sending infrastructure",
  "Bounce, blacklist, and reputation monitoring",
  "AI reply qualification and Gmail forwarding",
  "Live cost per reply and ROI reporting",
];

function ColdEmailDashboardMockup() {
  return (
    <div className="relative mx-auto max-w-6xl" aria-label="Cold email outreach dashboard preview">
      <div className="absolute -inset-5 rounded-[2rem] bg-brand-500/20 blur-3xl" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d17] shadow-2xl shadow-brand-950/40">
        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-400/80" />
            <span className="h-3 w-3 rounded-full bg-amber-300/80" />
            <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
          </div>
          <div className="hidden rounded-md border border-white/10 bg-black/30 px-4 py-1 font-mono text-xs text-gray-400 sm:block">
            app.distribute.you/sales-cold-email-outreach
          </div>
          <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            live
          </div>
        </div>

        <div className="grid lg:grid-cols-[1.25fr_0.75fr]">
          <div className="min-w-0 border-white/10 p-5 lg:border-r lg:p-7">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-300">
                  Sales cold email engine
                </p>
                <h3 className="text-balance font-display text-2xl font-bold leading-tight text-white">
                  239 qualified replies queued
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-gray-400">
                  We rank every prospect, write the sequence, send from warmed inboxes,
                  and kill segments where the cost per buyer goes soft.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-right">
                <div className="text-3xl font-bold tabular-nums text-white">$1.42</div>
                <div className="text-xs text-gray-400">per qualified reply</div>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-black/20">
              {[
                ["12,400", "emails sent"],
                ["1,920", "buyers matched"],
                ["18.4x", "pipeline ROI"],
              ].map(([value, label]) => (
                <div key={label} className="border-r border-white/10 p-4 last:border-r-0">
                  <div className="text-xl font-bold tabular-nums text-white sm:text-2xl">{value}</div>
                  <div className="mt-1 text-xs text-gray-500">{label}</div>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="min-w-[640px] text-left text-xs sm:w-full sm:min-w-0">
                <thead className="bg-white/[0.04] text-[10px] uppercase tracking-[0.16em] text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Segment</th>
                    <th className="hidden px-4 py-3 text-right font-semibold sm:table-cell">Prospects</th>
                    <th className="px-4 py-3 text-right font-semibold">Sent</th>
                    <th className="px-4 py-3 text-right font-semibold">Replies</th>
                    <th className="px-4 py-3 text-right font-semibold">$/reply</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {campaignRows.map((row) => (
                    <tr key={row.segment} className="bg-white/[0.015]">
                      <td className="px-4 py-4 font-medium text-gray-100">{row.segment}</td>
                      <td className="hidden px-4 py-4 text-right tabular-nums text-gray-400 sm:table-cell">
                        {row.prospects}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums text-gray-400">{row.sent}</td>
                      <td className="px-4 py-4 text-right tabular-nums font-semibold text-white">{row.replies}</td>
                      <td className="px-4 py-4 text-right tabular-nums text-brand-200">{row.cost}</td>
                      <td className="px-4 py-4 text-right">
                        <span
                          className={
                            row.status === "Scale"
                              ? "rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300"
                              : "rounded-full border border-red-400/20 bg-red-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-300"
                          }
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="min-w-0 space-y-4 bg-white/[0.02] p-5 lg:p-7">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                Cost breakdown
              </p>
              <div className="space-y-3">
                {[
                  { name: "Apollo Credit", domain: "apollo.io", price: "$4.34" },
                  { name: "Google Pro 3.1", domain: "google.com", price: "$1.68" },
                  { name: "Instantly Sends", domain: "instantly.ai", price: "$1.29" },
                  { name: "Postmark Email", domain: "postmarkapp.com", price: "<$0.01" },
                ].map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <ProviderAvatar provider={item.name} providerDomain={item.domain} size={22} />
                      <span className="text-sm text-gray-300">{item.name}</span>
                    </div>
                    <span className="font-mono text-xs text-gray-400">{item.price}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-brand-400/20 bg-brand-400/10 p-4">
              <p className="text-sm font-semibold text-brand-100">AI reply triage</p>
              <p className="mt-2 text-sm leading-6 text-brand-100/70">
                Spam, out-of-office, objections, intros, and real buying signals are separated before anything hits your inbox.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Next move</p>
              <p className="mt-2 text-2xl font-bold text-white">Scale segment 1 and 2</p>
              <p className="mt-2 text-sm text-gray-400">
                Kill expensive lists. Double send volume where buyers reply.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const urls = PROD_URLS;

  return (
    <main className="min-h-screen bg-[#080811] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <Navbar />

      <section className="relative overflow-hidden px-4 pb-16 pt-20 sm:px-6 lg:px-8 lg:pb-24">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(236,72,153,0.22),transparent_36%),radial-gradient(circle_at_80%_30%,rgba(99,102,241,0.18),transparent_32%)]"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:44px_44px]"
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-6xl text-center">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-brand-300/20 bg-brand-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-100">
            <span className="h-2 w-2 rounded-full bg-brand-300 shadow-[0_0_18px_rgba(244,114,182,0.9)]" />
            sales cold email outreach
          </div>

          <h1 className="mx-auto max-w-5xl font-display text-5xl font-bold leading-[0.96] tracking-tight text-white sm:text-6xl lg:text-8xl">
            Turn one URL into 100 qualified sales conversations.
          </h1>

          <p className="mx-auto mt-7 max-w-3xl text-lg leading-8 text-gray-300 sm:text-xl">
            Stop building polite campaigns that die in spreadsheets. Give us your URL and a budget.
            We find buyers, write the emails, send the sequence, qualify replies, and push the good ones to Gmail.
          </p>

          <div className="mx-auto mt-10 max-w-xl">
            <HeroForm signUpUrl={urls.signUp} />
            <p className="mt-4 text-sm text-gray-500">
              $25 welcome credits. No subscription. No sending-domain setup.
            </p>
          </div>

          <div className="mt-14">
            <ColdEmailDashboardMockup />
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.03] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d17] sm:grid-cols-2 lg:grid-cols-4">
          {proofStats.map((stat) => (
            <div key={stat.label} className="border-b border-white/10 p-6 sm:border-r lg:border-b-0 last:border-r-0">
              <div className="font-display text-4xl font-bold tabular-nums text-white">{stat.value}</div>
              <p className="mt-2 text-sm font-semibold text-gray-200">{stat.label}</p>
              <p className="mt-1 text-xs text-gray-500">{stat.suffix}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-300">
              why this hits harder
            </p>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight text-white sm:text-5xl">
              10x your sales motion without hiring a sales team.
            </h2>
            <p className="mt-5 text-lg leading-8 text-gray-400">
              A founder should not spend three weeks buying domains, warming inboxes,
              scraping lists, writing follow-ups, and sorting garbage replies.
              That work is the product now.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {handleItems.map((item) => (
              <div key={item} className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-400/15 text-brand-200">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm font-semibold leading-6 text-gray-100">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f8f7fb] px-4 py-20 text-gray-950 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
              the machine
            </p>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight sm:text-5xl">
              From blank URL to qualified replies in three moves.
            </h2>
          </div>

          <div className="grid overflow-hidden rounded-2xl border border-gray-200 bg-white md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.title} className="border-b border-gray-200 p-7 md:border-b-0 md:border-r last:border-r-0">
                <div className="mb-8 font-mono text-sm font-semibold text-brand-600">
                  0{index + 1}
                </div>
                <h3 className="font-display text-2xl font-bold text-gray-950">{step.title}</h3>
                <p className="mt-4 text-sm leading-7 text-gray-600">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-300">
              your inbox, filtered
            </p>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight text-white sm:text-5xl">
              No dashboards to babysit. The buyers land in Gmail.
            </h2>
            <p className="mt-5 text-lg leading-8 text-gray-400">
              You do not need another tab full of vanity metrics. You need the few replies worth answering,
              with the context and cost attached.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {["qualified only", "full thread", "company context", "reply cost"].map((item) => (
                <span key={item} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-gray-300">
                  {item}
                </span>
              ))}
            </div>
          </div>
          <GmailInbox />
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.03] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_0.85fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-300">
              pricing
            </p>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight text-white sm:text-5xl">
              Buy pipeline, not software seats.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-gray-400">
              No subscription tax. No annual contract. Every campaign shows the expected spend before launch,
              then ranks workflows by cost per qualified reply.
            </p>
          </div>

          <div className="rounded-2xl border border-brand-300/20 bg-brand-300/10 p-7">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-100">starter push</p>
            <div className="mt-5 flex items-end gap-2">
              <span className="font-display text-6xl font-bold text-white">$25</span>
              <span className="pb-2 text-gray-400">welcome credits</span>
            </div>
            <ul className="mt-7 space-y-3 text-sm text-gray-200">
              <li>Campaign budget visible before launch</li>
              <li>Prospect sourcing, copy, sending, AI qualification included</li>
              <li>Cancel the losers, scale the lists that produce buyers</li>
            </ul>
            <LinkButton
              href={urls.signUp}
              className="mt-8 block rounded-xl bg-brand-500 px-6 py-4 text-center text-base font-bold text-white transition hover:bg-brand-400"
            >
              Start free, get $25 credits
            </LinkButton>
          </div>
        </div>
      </section>

      <section className="px-4 py-24 text-center sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-display text-5xl font-bold leading-tight text-white sm:text-6xl">
            Let your competitors keep warming inboxes. Start buying replies.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-400">
            If the offer is real, distribution should not be the bottleneck. Put the machine on it today.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <LinkButton
              href={urls.signUp}
              className="rounded-xl bg-white px-8 py-4 text-base font-bold text-gray-950 transition hover:bg-gray-200"
            >
              Launch sales outreach
            </LinkButton>
            <LinkButton
              href={urls.pricing}
              className="rounded-xl border border-white/15 px-8 py-4 text-base font-semibold text-white transition hover:bg-white/10"
            >
              See unit costs
            </LinkButton>
          </div>
        </div>
      </section>

      <Footer
        disclaimer={
          <>
            Current beta focus: sales cold email outreach. Other distribution channels are still experimental
            and are intentionally not promoted on this page.
          </>
        }
      />
    </main>
  );
}
