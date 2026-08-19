import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { URLS } from "@distribute/content";
import { PROD_URLS } from "@/lib/env-urls";
import {
  DepthPage,
  Seed,
  Stat,
  Stratum,
} from "@/components/channels/depth-page";
import {
  allPairs,
  channelPath,
  fetchChannelCatalogue,
  fetchPairEconomics,
  formatCentsUsd,
  formatCommitment,
  formatReturn,
  formatStartsWithin,
  formatUsd,
  funnelPath,
  NOT_MEASURED_COPY,
  UNPRICED_COPY,
  type Channel,
  type Pair,
  type PairStep,
} from "@/lib/channel-catalogue";

export const revalidate = 86400;

/**
 * One page per PAIR, and the pair list comes from the producer's own derivation
 * rather than a cartesian product: a funnel a channel cannot start has no
 * product behind it, so it gets no page.
 */
export async function generateStaticParams() {
  const { channels } = await fetchChannelCatalogue();
  return allPairs(channels).map(({ channel, funnel }) => ({
    channel: channel.slug,
    funnel: funnel.key,
  }));
}

async function load(channelSlug: string, funnelKey: string) {
  const { channels } = await fetchChannelCatalogue();
  const channel = channels.find((c) => c.slug === channelSlug);
  if (!channel) return null;
  const funnel = channel.salesFunnels.find((f) => f.key === funnelKey);
  if (!funnel) return null;
  const { pairs } = await fetchPairEconomics({ channelSlug });
  const pair = pairs.find((p) => p.funnelKey === funnelKey);
  if (!pair) return null;
  return { channel, pair };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ channel: string; funnel: string }>;
}): Promise<Metadata> {
  const { channel: channelSlug, funnel: funnelKey } = await params;
  const loaded = await load(channelSlug, funnelKey);
  if (!loaded) return {};
  const { pair } = loaded;
  const url = `${PROD_URLS.landing}/channels/${channelSlug}/${funnelKey}`;
  const title = `${pair.channelName} → ${pair.funnelName}`;
  const description = pair.result.measured
    ? `What ${pair.funnelName.toLowerCase()} costs through ${pair.channelName.toLowerCase()}, measured across every client campaign we have run: ${pair.funnelSteps.join(", ")}.`
    : `${pair.channelName} worked through ${pair.funnelName}: ${pair.funnelSteps.join(" → ")}. What it costs to book and how long before it starts.`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "en_US",
      url,
      siteName: "distribute",
      title,
      description,
    },
  };
}

export default async function PairPage({
  params,
}: {
  params: Promise<{ channel: string; funnel: string }>;
}) {
  const { channel: channelSlug, funnel: funnelKey } = await params;
  const loaded = await load(channelSlug, funnelKey);
  if (!loaded) notFound();
  const { channel, pair } = loaded;

  return (
    <DepthPage>
      <Stratum strata="sky">
        <a
          href={channelPath(channel.slug)}
          className="text-sm"
          style={{ color: "var(--muted)" }}
        >
          ← {channel.name}
        </a>
        <h1
          className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl"
          style={{ color: "var(--text)" }}
        >
          {pair.funnelName}, through {pair.channelName.toLowerCase()}
        </h1>
        <p
          className="mt-5 max-w-2xl text-lg leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          {pair.funnelSteps.join(" → ")}
        </p>
        <Headline pair={pair} />
      </Stratum>

      <Stratum strata="canopy">
        <h2
          className="text-3xl font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          What each step costs
        </h2>
        <StepTable pair={pair} />
      </Stratum>

      <Stratum strata="branch">
        <h2
          className="text-3xl font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          What you commit to
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Stat
            value={formatCentsUsd(channel.terms.dailyOperatingCostCents) ?? "—"}
            label="A day to run"
          />
          <Stat
            value={`${channel.terms.minimumCommitmentDays} days`}
            label="Shortest booking"
            hint={formatCommitment(channel.terms.minimumCommitmentDays)}
          />
          <Stat
            value={`${channel.terms.maxDaysToFirstProduction} days`}
            label="Before it starts"
            hint={formatStartsWithin(channel.terms.maxDaysToFirstProduction)}
          />
        </div>
        <p className="mt-6" style={{ color: "var(--muted)" }}>
          This chain is also sold through{" "}
          <a
            href={funnelPath(pair.funnelKey)}
            className="underline underline-offset-4"
            style={{ color: "var(--text)" }}
          >
            other channels
          </a>
          , each priced on its own.
        </p>
      </Stratum>

      <Stratum strata="trunk" horizon>
        <h2
          className="max-w-3xl text-3xl font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          No markup on what we route.
        </h2>
        <p
          className="mt-4 max-w-2xl text-lg leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          You pay the platform what the platform charges. No agency fee, no
          percentage of your spend, no seat, no retainer. You can start at $1 a
          day and stop whenever you like.
        </p>
      </Stratum>

      <Stratum strata="root">
        <Evidence pair={pair} />
      </Stratum>

      <Stratum strata="soil">
        <h2
          className="max-w-2xl text-3xl font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          Book this pairing.
        </h2>
        <div className="mt-8">
          <Seed href={URLS.signUp}>Plant your seed</Seed>
        </div>
      </Stratum>
    </DepthPage>
  );
}

/**
 * The headline figures. An unmeasured pair says which ingredient is missing
 * rather than rendering an empty stat row: "we could not measure this" and "it
 * costs nothing" are different statements and a blank cannot tell them apart.
 */
function Headline({ pair }: { pair: Pair }) {
  if (!pair.result.measured) {
    return (
      <p
        className="mt-10 max-w-2xl rounded-xl p-5 leading-relaxed"
        style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          color: "var(--muted)",
        }}
      >
        {NOT_MEASURED_COPY[pair.result.reason]}
      </p>
    );
  }
  const { returnPerDollar, costPerSaleUsd, lifetimeRevenueUsd } =
    pair.result.economics;
  return (
    <div className="mt-10 grid gap-4 sm:grid-cols-3">
      <Stat
        value={formatReturn(returnPerDollar) ?? "—"}
        label="Back for every dollar"
      />
      <Stat value={formatUsd(costPerSaleUsd) ?? "—"} label="Per sale" />
      <Stat
        value={formatUsd(lifetimeRevenueUsd) ?? "—"}
        label="What a customer is worth"
        hint="Stated by the brands running this chain."
      />
    </div>
  );
}

function StepTable({ pair }: { pair: Pair }) {
  if (!pair.result.measured) {
    return (
      <p className="mt-6 max-w-2xl leading-relaxed" style={{ color: "var(--muted)" }}>
        {NOT_MEASURED_COPY[pair.result.reason]} The chain is{" "}
        {pair.funnelSteps.join(" → ")}.
      </p>
    );
  }
  return (
    <ul className="mt-8 space-y-3">
      {pair.result.economics.steps.map((step) => (
        <StepRow key={step.step} step={step} />
      ))}
    </ul>
  );
}

function StepRow({ step }: { step: PairStep }) {
  return (
    <li
      className="flex flex-wrap items-center justify-between gap-4 rounded-xl px-5 py-4"
      style={{ background: "var(--panel)", border: "1px solid var(--line)" }}
    >
      <span style={{ color: "var(--text)" }}>
        {step.step}
        {step.milestone ? (
          <span
            className="ml-3 rounded-full px-2 py-0.5 text-xs"
            style={{ background: "var(--sap-glow)", color: "var(--text)" }}
          >
            the moment it is working
          </span>
        ) : null}
      </span>
      {step.costPerStepUsd !== null ? (
        <span
          className="text-lg font-semibold tabular-nums"
          style={{ color: "var(--text)" }}
        >
          {formatUsd(step.costPerStepUsd)}
        </span>
      ) : (
        <span className="max-w-sm text-sm" style={{ color: "var(--faint)" }}>
          {step.unpricedReason ? UNPRICED_COPY[step.unpricedReason] : "No figure."}
        </span>
      )}
    </li>
  );
}

/** What the numbers above are actually made of. */
function Evidence({ pair }: { pair: Pair }) {
  if (!pair.result.measured) {
    return (
      <>
        <h2
          className="text-3xl font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          We would rather say nothing than guess
        </h2>
        <p
          className="mt-3 max-w-2xl leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          {NOT_MEASURED_COPY[pair.result.reason]} When it has run enough to be
          worth reporting, this page will say what it cost.
        </p>
      </>
    );
  }
  const { evidence } = pair.result.economics;
  return (
    <>
      <h2
        className="text-3xl font-semibold tracking-tight"
        style={{ color: "var(--text)" }}
      >
        What this is measured on
      </h2>
      <p
        className="mt-3 max-w-2xl leading-relaxed"
        style={{ color: "var(--muted)" }}
      >
        Every client campaign we have run on this channel, not a case study we
        picked.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          value={formatUsd(evidence.totalSpentUsd) ?? "—"}
          label="Spent through it"
        />
        <Stat value={String(evidence.brandCount)} label="Brands" />
        <Stat
          value={evidence.conversationsProduced.toLocaleString("en-US")}
          label="Conversations opened"
        />
        <Stat
          value={evidence.websiteVisitsProduced.toLocaleString("en-US")}
          label="Website visits"
        />
      </div>
    </>
  );
}
