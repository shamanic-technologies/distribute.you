import type { Metadata } from "next";
import Image from "next/image";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { PROD_URLS } from "@/lib/env-urls";

export const revalidate = 86400;

const MARKETPLACE_URL = `${PROD_URLS.landing}/marketplace`;
const PAGE_DESCRIPTION =
  "The Sales Exchange. An affiliate network with done-for-you distribution. Private preview, invite only.";

// Non-indexed by design: this is a private concept preview, kept out of Google,
// the sitemap, and llms.txt. Do not flip robots to index without sign-off.
export const metadata: Metadata = {
  title: "The Sales Exchange",
  description: PAGE_DESCRIPTION,
  alternates: { canonical: MARKETPLACE_URL },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

const STEPS = [
  {
    n: "1",
    label: "A brand posts an outcome price",
    body: "A brand lists what it pays per outcome it wants, like a website visit or a positive reply that turns into a sales meeting. In this preview we only list outcomes we measure ourselves, so no tracking setup is needed on the brand side.",
  },
  {
    n: "2",
    label: "You take your own referral link",
    body: "You grab your referral link for that brand and keep it. The affiliate relationship is yours. When it converts, the brand pays you directly.",
  },
  {
    n: "3",
    label: "We distribute it for you",
    body: "You set a daily distribution budget and we send cold email promoting your link on your behalf. You pay for the distribution work. We measure the outcomes and tell the brand what it owes each person.",
  },
];

const BRAND_POINTS = [
  "Set a price for the outcome you actually want (a visit, a positive reply).",
  "Pay only for measured outcomes, tracked by us in this preview.",
  "You pay the referrer directly. We never hold your money.",
  "Full visibility on who we contacted and what converted.",
];

const DISTRIBUTOR_POINTS = [
  "Keep your own referral link. The brand pays you, not us.",
  "Set a daily budget. We handle the cold email distribution.",
  "See the expected cost per outcome next to the brand's payout before you start.",
  "Pick where to put your budget across every listed brand.",
];

const EXAMPLE_ROWS = [
  { label: "Cost per paid client (via distribute)", value: "$150" },
  { label: "Measured lifetime revenue per paid client", value: "$1,500" },
  { label: "Referral share paid by the brand (30%)", value: "$450" },
  { label: "Example ratio", value: "3x" },
];

export default function MarketplacePage() {
  return (
    <>
      <Navbar />
      <main className="dy-page">
        {/* Hero */}
        <section className="pt-24 pb-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <Image
                src="/landing/logo/logo-distribute.svg"
                alt="distribute"
                width={40}
                height={40}
                className="rounded-lg"
              />
              <h1 className="font-display text-4xl font-bold text-gray-900">
                The Sales Exchange
              </h1>
            </div>
            <p className="inline-block text-[11px] uppercase tracking-wider font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded-full px-3 py-1 mb-6">
              Private preview · invite only
            </p>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              An affiliate network with distribution built in. Brands pay for the
              outcomes they want. You promote a referral link and we send it for you.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="pb-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-bold mb-6 text-gray-900">
              How it works
            </h2>
            <div className="grid sm:grid-cols-3 gap-3">
              {STEPS.map((step) => (
                <div
                  key={step.n}
                  className="bg-gray-50 border border-gray-200 rounded-xl p-5"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-500 text-white text-sm font-semibold mb-3">
                    {step.n}
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-2">
                    {step.label}
                  </h3>
                  <p className="text-xs text-gray-600 leading-relaxed">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Two sides */}
        <section className="pb-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-bold mb-6 text-gray-900">
              Two sides
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                <h3 className="text-gray-900 font-semibold text-base mb-4">
                  For brands
                </h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  {BRAND_POINTS.map((p) => (
                    <li key={p} className="flex gap-2">
                      <span className="text-brand-500 mt-0.5">+</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                <h3 className="text-gray-900 font-semibold text-base mb-4">
                  For distributors
                </h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  {DISTRIBUTOR_POINTS.map((p) => (
                    <li key={p} className="flex gap-2">
                      <span className="text-brand-500 mt-0.5">+</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* The economics */}
        <section className="pb-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-bold mb-2 text-gray-900">
              The economics
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              We measure the cost per outcome and the lifetime revenue each brand reports.
              The numbers below are an illustrative example built from historical averages.
              They are not a promise of results.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {EXAMPLE_ROWS.map((row, i) => (
                    <tr
                      key={row.label}
                      className={i > 0 ? "border-t border-gray-200" : ""}
                    >
                      <td className="px-5 py-3 text-gray-600">{row.label}</td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900 tabular-nums">
                        {row.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Illustrative example. Historical averages vary by brand and are shown before
              you start. Results are not guaranteed.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="pb-24">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="font-display text-2xl font-bold mb-4 text-gray-900">
              Request access
            </h2>
            <p className="text-gray-600 text-sm mb-6 max-w-xl mx-auto">
              The Sales Exchange is in private preview. Tell us whether you want to list a
              brand or distribute links and we will send you an invite.
            </p>
            <a
              href="mailto:hello@distribute.you?subject=Sales%20Exchange%20access"
              className="inline-block bg-brand-500 hover:bg-brand-600 text-white font-medium px-6 py-3 rounded-lg transition"
            >
              Request an invite
            </a>
          </div>
        </section>
      </main>

      <Footer disclaimer="The Sales Exchange is a private preview. distribute operates the affiliate tracking and the distribution service; brands pay referrers directly. Figures shown are illustrative historical averages, not a guarantee of results." />
    </>
  );
}
