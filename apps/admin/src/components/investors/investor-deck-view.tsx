"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useAuthQuery } from "@/lib/use-auth-query";
import { Skeleton } from "@/components/skeleton";
import { getFleetRevenue, getActiveUsersHistory, getCustomerSuccess } from "@/lib/api";
import { compoundGrowthSeries, compoundGrowthSummary } from "@/lib/compound-growth";
import { weeklySignups } from "@/lib/signup-buckets";
import type { DailyFunnelPoint } from "@/lib/public-stats";
import { formatCount } from "@/lib/format-number";
import {
  DECK_SLIDES,
  RAISE_AMOUNT_USD,
  RAISE_INSTRUMENT,
  deckVersion,
  deckFileName,
  deckVersionLine,
  formatGrowthRate,
  growthConclusion,
  type DeckGrowthFigure,
  type DeckSlideId,
} from "@/lib/investor-deck";

/** Whole dollars. A deck that prints cents reads as a bookkeeping report. */
function usd(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

/** One compound weekly rate out of a value series, the same way the metrics page derives its own. */
function weeklyFigure(label: string, values: number[], current: string | null): DeckGrowthFigure {
  const summary = compoundGrowthSummary(compoundGrowthSeries(values));
  return { label, pct: summary.latestPct, current, weeksUsed: summary.barsUsed };
}

/* ── Slide chrome ─────────────────────────────────────────────────────────── */

/**
 * One slide, one printed page. The fixed 16:9 aspect on screen is what makes the
 * preview the artifact: what does not fit here does not fit in the PDF either.
 */
function Slide({
  id,
  eyebrow,
  title,
  children,
}: {
  id: DeckSlideId;
  eyebrow?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`slide-${id}`}
      data-deck-slide={id}
      className="deck-slide bg-white border border-gray-200 rounded-xl px-10 py-9 flex flex-col"
    >
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-600">{eyebrow}</p>
      ) : null}
      {title ? <h2 className="mt-2 text-3xl font-semibold text-gray-950 leading-tight">{title}</h2> : null}
      <div className="mt-6 flex-1 min-h-0">{children}</div>
    </section>
  );
}

/** A number and what it is. Big enough to read from across a room, per Kevin Hale. */
function Figure({ value, label, note }: { value: string; label: string; note?: string | null }) {
  return (
    <div>
      <p className="text-4xl font-semibold text-gray-950 tabular-nums">{value}</p>
      <p className="mt-1 text-sm font-medium text-gray-700">{label}</p>
      {note ? <p className="mt-0.5 text-xs text-gray-500">{note}</p> : null}
    </div>
  );
}

/** A claim and the evidence under it. Used wherever a slide makes an argument. */
function Point({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-base font-semibold text-gray-950">{heading}</p>
      <p className="mt-1 text-sm leading-relaxed text-gray-600">{children}</p>
    </div>
  );
}

/* ── The deck ─────────────────────────────────────────────────────────────── */

export function InvestorDeckView({ timeline }: { timeline: DailyFunnelPoint[] }) {
  const [now] = useState(() => new Date());

  const revenueQuery = useAuthQuery(["fleetRevenue"], () => getFleetRevenue());
  const usersQuery = useAuthQuery(["activeUsersHistory"], () => getActiveUsersHistory());
  const customersQuery = useAuthQuery(["customerSuccess"], () => getCustomerSuccess());

  const figures = useMemo(() => {
    const rev = revenueQuery.data;
    const users = usersQuery.data;

    const revenue = weeklyFigure(
      "Revenue",
      (rev?.weekly ?? []).map((b) => b.revenueUsd),
      rev ? usd(rev.totalRevenueUsd) : null
    );
    const activeUsers = weeklyFigure(
      "Active users",
      (users?.weekly ?? []).map((b) => b.activeUsers),
      users ? formatCount(users.currentTotal) : null
    );
    const signupBuckets = weeklySignups(timeline);
    const signups = weeklyFigure(
      "Signups",
      signupBuckets.map((b) => b.signups),
      formatCount(signupBuckets.reduce((sum, b) => sum + b.signups, 0))
    );

    return { revenue, activeUsers, signups };
  }, [revenueQuery.data, usersQuery.data, timeline]);

  // The edition is the week the figures report on — the same span the revenue
  // CWGR states, so the stamp on the cover can never disagree with the chart.
  const version = deckVersion(figures.revenue.weeksUsed, now);

  const revenueBars = useMemo(
    () =>
      (revenueQuery.data?.weekly ?? []).map((b) => ({
        period: b.period,
        revenue: Math.round(b.revenueUsd),
      })),
    [revenueQuery.data]
  );

  const customers = customersQuery.data;
  const payingCustomers = customers?.stats.activeCount ?? null;
  const mrr = revenueQuery.data?.committedMrr.currentMrrUsd ?? null;
  const arr = revenueQuery.data?.committedMrr.currentArrUsd ?? null;

  // A median beats a mean on a handful of customers, where one outlier moves
  // the average to somewhere no real customer sits.
  const medianRoi = useMemo(() => {
    const values = (customers?.customers ?? [])
      .map((c) => c.currentEconomics.roiMultiple)
      .filter((v): v is number => v !== null && Number.isFinite(v))
      .sort((a, b) => a - b);
    if (values.length === 0) return null;
    const mid = Math.floor(values.length / 2);
    return values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
  }, [customers]);

  const loading = revenueQuery.isPending || usersQuery.isPending;
  const download = () => {
    // The suggested filename in the print dialog comes from document.title, so
    // it carries the week and the date. Restored afterwards so the tab does not
    // keep the deck's name.
    const previous = document.title;
    document.title = deckFileName(version).replace(/\.pdf$/, "");
    window.print();
    window.setTimeout(() => {
      document.title = previous;
    }, 0);
  };

  return (
    <div className="deck-root p-4 md:p-8 max-w-5xl mx-auto">
      <header className="deck-chrome mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-950">Investor deck</h1>
          <p className="mt-1 text-sm text-gray-500">
            {DECK_SLIDES.length} slides, every figure read live. What you see is what downloads.
            Deal terms stay out of it on purpose: they belong in the conversation, not in a deck
            that gets forwarded.
          </p>
        </div>
        <button
          type="button"
          onClick={download}
          disabled={loading}
          className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
        >
          Download PDF
        </button>
      </header>

      {loading ? (
        <div className="deck-chrome space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : null}

      <div className={`deck-pages space-y-6 ${loading ? "hidden" : ""}`}>
        {/* 1 — Title. One declarative sentence, per Sequoia. */}
        <Slide id="title">
          <div className="flex h-full flex-col justify-center">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-600">
              distribute.you
            </p>
            <h2 className="mt-4 text-5xl font-semibold leading-[1.05] text-gray-950">
              Autonomous Sales Meeting Acquisition
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-gray-600">
              We are an acquisition agency that runs the whole campaign, and reports what each
              interested reply actually cost.
            </p>
            <p className="mt-8 text-sm text-gray-500">{deckVersionLine(version)}</p>
          </div>
        </Slide>

        {/* 2 — What. */}
        <Slide id="what" eyebrow="What" title="We sell sales meetings, not software">
          <div className="grid grid-cols-2 gap-x-10 gap-y-6">
            <Point heading="You give us a website and a daily budget">
              Nothing to install, no seat to buy, no sending domain to warm. We set the whole
              thing up and run it on your behalf.
            </Point>
            <Point heading="We find the buyers and write to them">
              Outreach goes out from domains we own and operate, so your domain never touches
              cold email and carries none of the reputation risk.
            </Point>
            <Point heading="Interested replies reach your inbox">
              We screen everything first. You see the whole picture, including the replies that
              went nowhere.
            </Point>
            <Point heading="You pay the budget you authorised">
              One number. No retainer, no seats, no minimum term. Pause any day.
            </Point>
          </div>
        </Slide>

        {/* 3 — Why. The founder's own line, unedited in substance. */}
        <Slide id="why" eyebrow="Why" title="Every alternative is unreliable, unpredictable, or slow">
          <div className="space-y-5">
            <Point heading="An agency costs $1,500 to $5,000 a month before it sends anything">
              Plus $80 to $200 per qualified reply. You are buying effort and hoping for outcomes.
            </Point>
            <Point heading="An SDR costs $4,000 to $7,000 a month and takes 3 to 6 months to ramp">
              You carry the ramp, the tooling and the turnover.
            </Point>
            <Point heading="Doing it yourself is 2 to 4 weeks of setup before the first email">
              Domains, warmup, data, sequences, deliverability. Then you own it forever.
            </Point>
            <p className="pt-1 text-base font-medium text-gray-900">
              None of them can tell you what a meeting cost. We can, because measuring it is the
              product.
            </p>
          </div>
        </Slide>

        {/* 4 — How it works. Described, not screenshotted: YC is explicit that
            product screenshots are illegible and break all three design rules. */}
        <Slide id="how" eyebrow="How it works" title="Split, test, and keep what pays">
          <div className="space-y-5">
            <Point heading="1. Split the market into segments that can be measured separately">
              By geography, company size and role, so each one gets its own cost per reply
              instead of hiding inside an average.
            </Point>
            <Point heading="2. Test angles inside each segment">
              Several offers run against the same segment. The cheap ones get more budget, the
              expensive ones stop.
            </Point>
            <Point heading="3. Report the real cost per interested reply">
              Per segment, per week, against the budget that was actually spent. That number is
              the deliverable.
            </Point>
          </div>
        </Slide>

        {/* 5 — Traction. Revenue first: YC calls it the best thing to put here. */}
        <Slide id="traction" eyebrow="Traction" title="Compounding weekly since inception">
          <div className="flex h-full flex-col">
            <div className="grid grid-cols-3 gap-8">
              <Figure
                value={formatGrowthRate(figures.revenue.pct)}
                label="Revenue"
                note={figures.revenue.current ? `${figures.revenue.current} realized to date` : null}
              />
              <Figure
                value={formatGrowthRate(figures.activeUsers.pct)}
                label="Active users"
                note={figures.activeUsers.current ? `${figures.activeUsers.current} today` : null}
              />
              <Figure
                value={formatGrowthRate(figures.signups.pct)}
                label="Signups"
                note={figures.signups.current ? `${figures.signups.current} to date` : null}
              />
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Compounded weekly growth rate since inception, excluding the week in progress.
            </p>

            {revenueBars.length > 0 ? (
              <div className="mt-6 flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueBars} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} width={44} />
                    <Tooltip formatter={(v) => usd(typeof v === "number" ? v : null)} />
                    <Bar dataKey="revenue" fill="#2563eb" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : null}

            {/* Every chart states its conclusion in words rather than making the
                reader derive it. */}
            <p className="mt-3 text-sm font-medium text-gray-900">
              {growthConclusion(figures.revenue) ?? "Not enough history to state a rate yet."}
            </p>
          </div>
        </Slide>

        {/* 6 — Unit economics. Normally a Series A slide; it is here because
            cost per outcome IS the product. */}
        <Slide id="economics" eyebrow="Unit economics" title="The number nobody else reports">
          <div className="space-y-7">
            <div className="grid grid-cols-3 gap-8">
              <Figure value={usd(mrr)} label="Committed MRR" note="Active daily budget, annualised monthly" />
              <Figure value={usd(arr)} label="Committed ARR" />
              <Figure
                value={payingCustomers === null ? "—" : formatCount(payingCustomers)}
                label="Paying customers"
                note="Currently active"
              />
            </div>
            {medianRoi !== null ? (
              <p className="text-base font-medium text-gray-900">
                Median customer return: {medianRoi.toFixed(1)}x on spend. A meeting on the open
                market costs about $700; our customers pay a fraction of that and can see the
                figure every day.
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                Customer return is not measurable yet across the fleet.
              </p>
            )}
          </div>
        </Slide>

        {/* 7 — Market. */}
        <Slide id="market" eyebrow="Market" title="Everyone who has to book meetings to grow">
          <div className="space-y-5">
            <Point heading="The buyer is any B2B company that sells through conversations">
              Agencies, software companies, professional services, recruiters. They are already
              paying for this outcome, badly.
            </Point>
            <Point heading="They spend $1,500 to $7,000 a month today">
              An agency retainer or an SDR salary, both before a single meeting is booked. That
              spend is the market we take.
            </Point>
            <Point heading="We win the account by being measurable, then by being cheaper">
              Nobody switches from an agency because of a feature. They switch when they can see
              what a meeting costs.
            </Point>
          </div>
        </Slide>

        {/* 8 — Competition. Largest jump in investor attention DocSend measured;
            omitting it is the single most expensive cut in a pre-seed deck. */}
        <Slide id="competition" eyebrow="Competition" title="Who we take the budget from">
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
                  <th className="px-4 py-2.5">Alternative</th>
                  <th className="px-4 py-2.5">What it costs</th>
                  <th className="px-4 py-2.5">Why we win</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-4 py-2.5 font-medium text-gray-900">Outbound agency</td>
                  <td className="px-4 py-2.5 text-gray-600">$1.5k-5k/mo + $80-200 per reply</td>
                  <td className="px-4 py-2.5 text-gray-600">No retainer, and the cost is measured</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-gray-900">In-house SDR</td>
                  <td className="px-4 py-2.5 text-gray-600">$4k-7k/mo, 3-6 months to ramp</td>
                  <td className="px-4 py-2.5 text-gray-600">Runs the day you sign up</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-gray-900">Cold-email tooling</td>
                  <td className="px-4 py-2.5 text-gray-600">Seats, plus 2-4 weeks of setup</td>
                  <td className="px-4 py-2.5 text-gray-600">We do the work; tools hand you a login</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-gray-900">Paid ads</td>
                  <td className="px-4 py-2.5 text-gray-600">$4-7 per click</td>
                  <td className="px-4 py-2.5 text-gray-600">We reach named buyers, not audiences</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm font-medium text-gray-900">
            All four sell effort. We are the only one that reports the cost of the outcome.
          </p>
        </Slide>

        {/* 9 — Team. The most-read slide in the deck. Founders only: YC is blunt
            that nobody cares about advisors. */}
        <Slide id="team" eyebrow="Team" title="One founder, shipping the whole thing">
          <div className="space-y-5">
            <Point heading="Kevin Lourd, founder">
              Solo. Building and operating all of it: the acquisition engine, the measurement
              layer, and the agency that runs on top of them.
            </Point>
            {/* Solo is the first question a pre-seed investor asks, so the slide
                answers it rather than leaving a gap they will notice anyway.
                What is on screen is verifiable: the product exists, it has
                paying customers, and the numbers three slides back are its
                output. */}
            <Point heading="Why that is not the risk it looks like">
              Everything in this deck is running in production and every figure in it is read
              live from that system. A team of one built the platform, the customers and the
              measurement, which is the same evidence a larger team would be asked for.
            </Point>
            <p className="deck-todo rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-500">
              Add one line on what you did before this and why it makes you the person for this
              problem. LinkedIn is not machine-readable, so this is the one claim on the slide
              that has to come from you. It is the most-read slide in the deck.
            </p>
          </div>
        </Slide>

        {/* 10 — The ask. Amount and instrument only. The cap is deliberately
            absent: DocSend, from 200 decks, "don't list your deal terms". */}
        <Slide id="ask" eyebrow="The ask" title={`${usd(RAISE_AMOUNT_USD)} on ${RAISE_INSTRUMENT}`}>
          <div className="space-y-6">
            <p className="text-lg leading-relaxed text-gray-700">
              Enough to buy the one thing the numbers say we are missing: a repeatable way to
              acquire signups. Everything downstream of a signup already compounds.
            </p>
            <div className="grid grid-cols-3 gap-8">
              <Figure value={formatGrowthRate(figures.revenue.pct)} label="Revenue growth, weekly" />
              <Figure value={formatGrowthRate(figures.activeUsers.pct)} label="Active users growth, weekly" />
              <Figure value={formatGrowthRate(figures.signups.pct)} label="Signups growth, weekly" />
            </div>
            <p className="text-base font-medium text-gray-900">
              Two of these compound on their own. The third is what the money is for.
            </p>
          </div>
        </Slide>

        {/* 11 — Use of funds. YC frames this as "what it gets you", not a pie chart. */}
        <Slide id="use-of-funds" eyebrow="Use of funds" title="$100K MRR within 6 months">
          <div className="space-y-6">
            <Point heading="The milestone">
              Reach $100K MRR in six months. That is the bar that makes the next round a
              conversation about scale rather than about whether this works.
            </Point>
            <Point heading="Where it goes">
              Signup acquisition, which is the only part of the funnel that is not currently
              compounding. Everything after a signup already does.
            </Point>
            <div className="grid grid-cols-2 gap-8 pt-1">
              <Figure value={usd(mrr)} label="Committed MRR today" />
              <Figure value="$100,000" label="Committed MRR in 6 months" />
            </div>
          </div>
        </Slide>

        {/* 12 — Thanks and needs. Kept from the founder's own update: naming a
            specific need is what turns a deck into a request someone can act on. */}
        <Slide id="thanks-and-needs" eyebrow="Thanks and needs" title="What would help most">
          <div className="space-y-7">
            <Point heading="We need signup acquisition">
              Introductions to anyone who has taken a B2B product from a trickle of signups to a
              repeatable channel. That is the constraint, and it is the only one.
            </Point>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-4">
              <p className="text-sm font-semibold text-gray-900">Thanks</p>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">
                James of Arc, for his relentless support towards ascension.
              </p>
            </div>
            <p className="text-sm text-gray-500">{deckVersionLine(version)}</p>
          </div>
        </Slide>
      </div>
    </div>
  );
}
