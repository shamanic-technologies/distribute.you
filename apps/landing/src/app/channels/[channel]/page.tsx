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
  fetchChannelCatalogue,
  fetchPairEconomics,
  formatCentsUsd,
  formatCommitment,
  formatReturn,
  formatStartsWithin,
  formatUsd,
  pairPath,
  sortPairsByReturn,
  type Pair,
} from "@/lib/channel-catalogue";

export const revalidate = 86400;

/**
 * Prerender every channel. The catalogue is small and the pages are nothing but
 * served figures, so building them all costs one read and makes every one of
 * them instant and indexable — a scraper parses raw HTML only.
 */
export async function generateStaticParams() {
  const { channels } = await fetchChannelCatalogue();
  return channels.map((c) => ({ channel: c.slug }));
}

async function load(slug: string) {
  const { channels } = await fetchChannelCatalogue();
  const channel = channels.find((c) => c.slug === slug);
  if (!channel) return null;
  const { pairs } = await fetchPairEconomics({ channelSlug: slug });
  return { channel, pairs };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ channel: string }>;
}): Promise<Metadata> {
  const { channel: slug } = await params;
  const loaded = await load(slug);
  if (!loaded) return {};
  const { channel } = loaded;
  const url = `${PROD_URLS.landing}/channels/${slug}`;
  const description = `${channel.description} What it costs, how long before it starts, and what it has returned through each sales funnel.`;
  return {
    title: channel.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "en_US",
      url,
      siteName: "distribute",
      title: channel.name,
      description,
    },
  };
}

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ channel: string }>;
}) {
  const { channel: slug } = await params;
  const loaded = await load(slug);
  if (!loaded) notFound();
  const { channel, pairs } = loaded;
  const ranked = sortPairsByReturn(pairs);

  return (
    <DepthPage>
      <Stratum strata="sky">
        <a
          href="/channels"
          className="text-sm"
          style={{ color: "var(--muted)" }}
        >
          ← Every channel
        </a>
        <h1
          className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl"
          style={{ color: "var(--text)" }}
        >
          {channel.name}
        </h1>
        <p
          className="mt-5 max-w-2xl text-lg leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          {channel.description}
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <Stat
            value={formatCentsUsd(channel.terms.dailyOperatingCostCents) ?? "—"}
            label="A day to run"
            hint="What it costs to operate, whatever the volume."
          />
          <Stat
            value={`${channel.terms.minimumCommitmentDays} days`}
            label="Shortest booking"
            hint={formatCommitment(channel.terms.minimumCommitmentDays)}
          />
          <Stat
            value={`${channel.terms.maxDaysToFirstProduction} days`}
            label="Before it starts"
            hint={`${formatStartsWithin(channel.terms.maxDaysToFirstProduction)}. An upper bound, not an estimate.`}
          />
        </div>
      </Stratum>

      <Stratum strata="canopy">
        <h2
          className="text-3xl font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          What it produces
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {channel.producibleSteps.map((step) => (
            <div
              key={step.key}
              className="rounded-xl p-5"
              style={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
              }}
            >
              <div className="font-medium" style={{ color: "var(--text)" }}>
                {step.label}
              </div>
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: "var(--muted)" }}
              >
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </Stratum>

      <Stratum strata="branch">
        <h2
          className="text-3xl font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          What it sells through
        </h2>
        <p
          className="mt-3 max-w-2xl leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          These are the sales funnels this channel can start, best-returning
          first. You buy one pairing, and it is priced on its own.
        </p>
        <ul className="mt-8 space-y-3">
          {ranked.map((pair) => (
            <li key={pair.funnelKey}>
              <a
                href={pairPath(pair.channelSlug, pair.funnelKey)}
                className="block rounded-xl px-5 py-4"
                style={{
                  background: "var(--panel)",
                  border: "1px solid var(--line)",
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <span className="font-medium" style={{ color: "var(--text)" }}>
                    {pair.funnelName}
                  </span>
                  <PairHeadline pair={pair} />
                </div>
                <div
                  className="mt-2 text-sm"
                  style={{ color: "var(--faint)" }}
                >
                  {pair.funnelSteps.join(" → ")}
                </div>
              </a>
            </li>
          ))}
        </ul>
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
          percentage of your spend. You can start at $1 a day and stop whenever
          you like.
        </p>
      </Stratum>

      <Stratum strata="soil">
        <h2
          className="max-w-2xl text-3xl font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          Book {channel.name}.
        </h2>
        <div className="mt-8">
          <Seed href={URLS.signUp}>Plant your seed</Seed>
        </div>
      </Stratum>
    </DepthPage>
  );
}

function PairHeadline({ pair }: { pair: Pair }) {
  if (!pair.result.measured) {
    return (
      <span className="text-sm" style={{ color: "var(--faint)" }}>
        Not enough data yet
      </span>
    );
  }
  const { returnPerDollar, costPerSaleUsd } = pair.result.economics;
  return (
    <span className="flex items-center gap-5">
      {costPerSaleUsd !== null ? (
        <span className="text-sm" style={{ color: "var(--muted)" }}>
          {formatUsd(costPerSaleUsd)} a sale
        </span>
      ) : null}
      <span
        className="text-xl font-semibold tabular-nums"
        style={{ color: "var(--text)" }}
      >
        {formatReturn(returnPerDollar) ?? "—"}
      </span>
    </span>
  );
}
