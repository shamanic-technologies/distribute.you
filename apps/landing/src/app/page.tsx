import { HeroForm } from "@/components/hero-form";
import { LinkButton } from "@/components/link-button";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { GmailInbox } from "@/components/gmail-inbox";
import { FreeVsCloud } from "@/components/free-vs-cloud";
import { PROD_URLS } from "@/lib/env-urls";

export const revalidate = 300;

// Cold-email-only "How it works" steps. Local to the home — the shared
// DISTRIBUTION_STEPS catalog still describes the full multi-channel product
// (consumed by README / investors / docs), but the public home sells one thing.
const COLD_EMAIL_STEPS = [
  {
    number: "#1 / Drop",
    title: "Paste your website URL",
    description:
      "We read your product. Figure out who your buyers are, and write your campaign. You write nothing. You log in, paste a link, set a budget. Done.",
  },
  {
    number: "#2 / Send",
    title: "We email your buyers",
    description:
      "Pre-warmed inboxes start sending the same day. Every email is personalized to the person and the company. No spam folder. No domain setup. Just buyers in their inbox.",
  },
  {
    number: "#3 / Read",
    title: "Buyer replies land in Gmail",
    description:
      "AI reads every reply. Only real buyers reach your inbox, ready to answer. You read 5 emails a day instead of 200. The other 195 never bother you.",
  },
];

const HERO_STATS = [
  { value: "$1.42", label: "per buyer reply on average" },
  { value: "10x", label: "more outbound than 1 SDR" },
  { value: "5 min", label: "to launch your first campaign" },
  { value: "$25", label: "free to start, no card" },
];

const SKIPPED_WORK = [
  "Hire an SDR for $5,000 a month plus commission",
  "Buy a list tool, an email tool, a warming tool, a CRM",
  "Set up a new sending domain and warm it for 3 weeks",
  "Write the cold emails yourself, hope they convert",
  "Read 200 replies a week to find the 5 real buyers",
  "Lose 3 months before your first booked meeting",
];

const SIMPLE_WORK = [
  "Paste your website URL",
  "Set a budget you control",
  "Reply from your Gmail",
];

const PRICING_LINES = [
  ["Apollo lead enrichment", "$0.012"],
  ["Email generation (Claude Sonnet 4.6)", "$0.018"],
  ["Send via agency address (Resend)", "$0.004"],
  ["Reply classifier (Claude Haiku 4.5)", "$0.002"],
];

function HeroDashboardMock() {
  const rows = [
    { initials: "EV", company: "Eventilla", person: "Pekka Huttunen", status: "Replied", date: "Jun 7", cost: "$0.036" },
    { initials: "CI", company: "ColorID", person: "Gary Smith", status: "Opened", date: "Jun 7", cost: "$0.036" },
    { initials: "MC", company: "McCorkell", person: "Scott McCorkell", status: "Replied", date: "Jun 6", cost: "$0.036" },
    { initials: "BA", company: "Builders of Auth.", person: "Adam McChesney", status: "Opened", date: "Jun 6", cost: "$0.036" },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden text-left">
      <div className="flex min-h-[520px] min-w-0">
        <aside className="hidden md:flex w-56 flex-col border-r border-gray-200 bg-gray-50 p-5">
          <div className="font-display font-bold text-gray-900 mb-6">distribute</div>
          <div className="text-xs text-gray-400 mb-3">Campaign</div>
          <div className="rounded-lg bg-white border border-gray-200 p-3 mb-5">
            <p className="text-sm font-medium text-gray-900">prompthub.ai</p>
            <p className="text-xs text-gray-500">prompthub.ai</p>
          </div>
          {["Overview", "Leads", "Emails", "Campaign", "Settings", "Help"].map((item, index) => (
            <div
              key={item}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                index === 0 ? "bg-brand-50 text-brand-700" : "text-gray-600"
              }`}
            >
              <span>{item}</span>
              {item === "Leads" || item === "Emails" ? (
                <span className="text-xs text-gray-400">247</span>
              ) : null}
            </div>
          ))}
        </aside>
        <div className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-400 font-medium">
                Overview
              </p>
              <h2 className="font-display text-2xl font-bold text-gray-900">
                Jun 1 – Jun 7, 2026
              </h2>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              live
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {[
              ["Emails sent", "247", "+18% vs last week"],
              ["Opened", "94", "38% open rate"],
              ["Replied", "5", "2.1% reply rate"],
              ["Budget used today", "72%", "on track"],
            ].map(([label, value, sub]) => (
              <div key={label} className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="font-display text-2xl font-bold text-gray-900 mt-1">
                  {value}
                </p>
                <p className="text-xs text-emerald-600 mt-1">{sub}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-[1.25fr_0.75fr] gap-4 mb-5">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-gray-900">Emails per day</p>
                <p className="hidden sm:block text-xs text-gray-500">Jun 1–7, 2026</p>
              </div>
              <div className="mb-3 flex items-center gap-4 text-[11px] text-gray-500">
                <span>Sent</span>
                <span>Opened</span>
                <span>Replied</span>
              </div>
              <div className="flex items-end gap-2 h-36">
                {[36, 52, 44, 68, 58, 82, 92].map((height, index) => (
                  <div
                    key={height}
                    className={`h-full flex-1 flex-col justify-end items-center gap-2 ${
                      index > 4 ? "hidden sm:flex" : "flex"
                    }`}
                  >
                    <div className="w-full rounded-t bg-gray-900" style={{ height: `${height}%` }} />
                    <span className="text-[10px] text-gray-400">{index + 1}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-950 p-4 text-white">
              <p className="text-xs uppercase tracking-wider text-gray-500">Expected ROI</p>
              <p className="font-display text-4xl font-bold mt-2">8x</p>
              <p className="text-sm text-gray-400">pipeline / spend</p>
              <div className="mt-5 border-t border-gray-800 pt-4">
                <p className="text-xs text-gray-500">Exp. revenue</p>
                <p className="text-2xl font-semibold">$7,100</p>
                <p className="text-xs text-gray-500">5 replies × $1,420</p>
              </div>
              <div className="mt-5 border-t border-gray-800 pt-4">
                <p className="text-xs text-gray-500">Cost / reply</p>
                <p className="text-2xl font-semibold">$1.78</p>
                <p className="text-xs text-gray-500">per qualified reply</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_auto] gap-3 border-b border-gray-100 px-4 py-3 text-[11px] uppercase tracking-wider text-gray-400">
              <span>Company</span>
              <span>Status</span>
              <span className="hidden sm:block">Date</span>
              <span className="hidden sm:block">Cost</span>
            </div>
            {rows.map((row) => (
              <div
                key={`${row.company}-${row.person}`}
                className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-3 text-sm items-center border-b border-gray-50 last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                    {row.initials}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{row.company}</p>
                    <p className="text-xs text-gray-500 truncate">{row.person}</p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs ${
                    row.status === "Replied"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-blue-50 text-blue-700"
                  }`}
                >
                  {row.status}
                </span>
                <span className="hidden sm:block text-xs text-gray-500">{row.date}</span>
                <span className="hidden sm:block text-xs text-gray-500">{row.cost}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is distribute?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "distribute is a pay-as-you-go platform that runs cold email outreach on your behalf. You give us a URL and a daily budget; we find your buyers, write personalized cold emails, send from agency-warmed inboxes, qualify replies with AI, and forward only the positive ones to your Gmail.",
      },
    },
    {
      "@type": "Question",
      name: "How much does distribute cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "$25 free credits. No subscription. No credit card. Launch in 5 minutes.",
      },
    },
    {
      "@type": "Question",
      name: "Can I run distribute myself?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. The cold email workflow is open source under MIT on GitHub. You can self-host with your own API keys, your own mailbox warmup, and your own infrastructure.",
      },
    },
    {
      "@type": "Question",
      name: "What is the average cold email reply rate?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Industry studies put the average B2B cold email reply rate at 3.43% in 2025 (TheDigitalBloom). Top-quartile campaigns reach 15–25% through tight ICP targeting and follow-up sequencing.",
      },
    },
    {
      "@type": "Question",
      name: "How long does it take to warm up a cold mailbox?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "3 to 5 weeks of progressive sending before a cold inbox can safely run real outreach at 40 emails per day (Lemlist Warmup Guide, 2025). distribute uses pre-warmed agency inboxes so you skip this entirely.",
      },
    },
  ],
};

export default function Home() {
  const urls = PROD_URLS;

  return (
    <main className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <Navbar />

      {/* Hero */}
      <section className="pt-16 pb-10 bg-gradient-to-b from-brand-50/50 via-white to-white">
        <div className="max-w-[17.5rem] sm:max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex max-w-full items-center gap-2 bg-gray-50 border border-gray-200 text-gray-600 px-4 py-1.5 rounded-full text-xs sm:text-sm mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
            <span className="truncate">AI cold email, done for you</span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl md:text-7xl font-bold mb-6 text-gray-900 tracking-tight text-balance">
            <span className="gradient-text-subtle block">100 sales calls</span>
            <span className="block">in 30 days.</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            Drop your website URL. We email your ideal customers. AI reads every
            reply. Only real buyers land in your Gmail. You read 5 emails, not 200.
            No SDR. No setup. No subscription.
          </p>

          <HeroForm signUpUrl={urls.signUp} />
          <div className="mt-4">
            <a
              href={urls.pricing}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition"
            >
              See pricing
            </a>
          </div>

          <p className="text-sm text-gray-400 mt-6">
            No subscription. No credit card. Launch in 5 minutes.
          </p>
        </div>

        <div className="max-w-[17.5rem] sm:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-14">
          <HeroDashboardMock />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {HERO_STATS.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-gray-200 bg-white p-5 text-center shadow-sm">
                <p className="font-display text-3xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-xs uppercase tracking-wider text-gray-400 font-medium mb-2">
              How it works
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900">
              From your URL to 100 buyer conversations
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto mt-3">
              Three steps. No setup. No software to learn. No SDR to hire.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {COLD_EMAIL_STEPS.map((step) => (
              <div key={step.number} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <p className="text-xs uppercase tracking-wider text-brand-500 font-semibold mb-3">
                  {step.number}
                </p>
                <h3 className="font-display font-bold text-xl text-gray-900 mb-3">
                  {step.title}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gmail inbox — the email you want to read (money shot) */}
      <section className="py-20 bg-gray-50 border-y border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-10">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-medium mb-2">
            What lands in your inbox
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4 text-gray-900">
            The only emails worth your time
          </h2>
          <p className="text-gray-500 text-lg">
            The buyers. AI qualifies every reply before it reaches you. The buyers
            come through with their full message, ready to answer. The noise stays out.
          </p>
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-3 gap-5 mb-12">
          {[
            [
              "Only buyers, never noise",
              "AI reads every reply and keeps only the ones from real buyers. Out-of-office, unsubscribes, vague brush-offs never reach you.",
            ],
            [
              "Sent straight to Gmail",
              "Buyer replies forward to your existing Gmail. Same threading, same Send button. You reply from your normal inbox.",
            ],
            [
              "Daily wins, no surprises",
              "Every morning: how many emails went out, how many buyers replied, and what each buyer cost. You see results, not dashboards.",
            ],
          ].map(([title, body]) => (
            <div key={title} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-display text-lg font-bold text-gray-900 mb-2">
                {title}
              </h3>
              <p className="text-sm leading-relaxed text-gray-500">{body}</p>
            </div>
          ))}
        </div>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-12">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-medium">
            Gmail replies
          </p>
        </div>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <GmailInbox />
        </div>
      </section>

      {/* The 3 months you skip */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              The 3 months you skip
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Cold email used to mean buying tools, hiring an SDR, warming inboxes
              for 3 weeks, and reading hundreds of replies a week. Not anymore.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
              <h3 className="font-display text-xl font-bold text-gray-900 mb-5">
                Without Distribute
              </h3>
              <div className="space-y-3">
                {SKIPPED_WORK.map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-50 text-xs text-red-500">
                      x
                    </span>
                    <span className="text-sm text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border-2 border-brand-200 bg-brand-50/60 p-6">
              <h3 className="font-display text-xl font-bold text-gray-900 mb-5">
                With Distribute
              </h3>
              <div className="space-y-3">
                {SIMPLE_WORK.map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-xs text-white">
                      ✓
                    </span>
                    <span className="text-sm font-medium text-gray-900">{item}</span>
                  </div>
                ))}
              </div>
              <p className="mt-8 text-lg font-display font-bold text-gray-900">
                Everything else, us, not for you.
              </p>
            </div>
          </div>

          <div className="mt-8 text-center">
            <LinkButton
              href={urls.signUp}
              className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
            >
              Start free, $25 credits
            </LinkButton>
          </div>

        </div>
      </section>

      {/* Pricing — single cloud plan */}
      <section className="py-20 bg-gray-50 border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Pay per email. Stop anytime.
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              No subscription. No seats. You pay $0.036 per email sent and $1.42
              on average for every buyer reply. Cheaper than 1 hour of an SDR.
            </p>
          </div>
          <div className="grid lg:grid-cols-[1fr_0.8fr] gap-5 items-start">
            <FreeVsCloud signUpUrl={urls.signUp} />
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-wider text-gray-400 font-medium mb-4">
                sales-outreach · apex-v4
              </p>
              <div className="space-y-3">
                {PRICING_LINES.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-mono text-gray-900">{value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 border-t border-gray-100 pt-5 flex items-end justify-between">
                <div>
                  <p className="text-xs text-gray-500">Per email sent</p>
                  <p className="text-xs text-brand-600 mt-1">avg $1.42 per qualified reply</p>
                </div>
                <p className="font-display text-3xl font-bold text-gray-900">$0.036</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-3xl font-bold mb-3 text-white">
            100 sales calls.
            <br />
            30 days. Go.
          </h2>
          <p className="text-gray-400 mb-8">
            $25 free credits. No subscription. No credit card. Launch in 5 minutes.
          </p>
          <LinkButton
            href={urls.signUp}
            className="inline-block bg-white text-gray-900 px-8 py-3 rounded-lg font-medium hover:bg-gray-100 transition text-sm"
          >
            Start free, $25 credits
          </LinkButton>
        </div>
      </section>

      <Footer />
    </main>
  );
}
