import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { URLS } from "@distribute/content";
import { PROD_URLS } from "@/lib/env-urls";
import {
  DepthPage,
  Seed,
  Stratum,
} from "@/components/channels/depth-page";
import {
  allFunnels,
  channelsForFunnel,
  fetchChannelCatalogue,
  fetchPairEconomics,
  formatCentsUsd,
  formatReturn,
  formatStartsWithin,
  formatUsd,
  pairPath,
  sortPairsByReturn,
  type Channel,
  type Pair,
} from "@/lib/channel-catalogue";

export const revalidate = 86400;

export async function generateStaticParams() {
  const { channels } = await fetchChannelCatalogue();
  return allFunnels(channels).map((f) => ({ funnel: f.key }));
}

async function load(funnelKey: string) {
  const { channels } = await fetchChannelCatalogue();
  const funnel = allFunnels(channels).find((f) => f.key === funnelKey);
  if (!funnel) return null;
  const sellers = channelsForFunnel(channels, funnelKey);
  const { pairs } = await fetchPairEconomics();
  return {
    funnel,
    sellers,
    pairs: pairs.filter((p) => p.funnelKey === funnelKey),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ funnel: string }>;
}): Promise<Metadata> {
  const { funnel: key } = await params;
  const loaded = await load(key);
  if (!loaded) return {};
  const { funnel, sellers } = loaded;
  const url = `${PROD_URLS.landing}/funnels/${key}`;
  const description = `${funnel.steps.join(" → ")}. The ${sellers.length} acquisition channels that can start this chain, and what each one has actually returned.`;
  return {
    title: funnel.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "en_US",
      url,
      siteName: "distribute",
      title: funnel.name,
      description,
    },
  };
}

export default async function FunnelPage({
  params,
}: {
  params: Promise<{ funnel: string }>;
}) {
  const { funnel: key } = await params;
  const loaded = await load(key);
  if (!loaded) notFound();
  const { funnel, sellers, pairs } = loaded;
  const ranked = sortPairsByReturn(pairs);
  const bySlug = new Map(sellers.map((c) => [c.slug, c]));

  return (
    <DepthPage>
      <Stratum strata="sky">
        <a href="/channels" className="text-sm" style={{ color: "var(--muted)" }}>
          ← Every channel
        </a>
        <p
          className="mt-4 text-xs font-medium uppercase tracking-[0.14em]"
          style={{ color: "var(--muted)" }}
        >
          A sales funnel
        </p>
        <h1
          className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl"
          style={{ color: "var(--text)" }}
        >
          {funnel.name}
        </h1>
        <p
          className="mt-5 max-w-2xl text-lg leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          {funnel.steps.join(" → ")}
        </p>
        <p
          className="mt-4 max-w-2xl leading-relaxed"
          style={{ color: "var(--faint)" }}
        >
          This is how the sale happens once someone lands. Which channel brought
          them is a separate choice, and it changes what the whole chain costs.
        </p>
      </Stratum>

      <Stratum strata="canopy">
        <h2
          className="text-3xl font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          {sellers.length} channels can start it
        </h2>
        <p
          className="mt-3 max-w-2xl leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          Best-returning first. A channel we have not run enough of through this
          chain says so rather than showing a figure we do not have.
        </p>
        <ul className="mt-8 space-y-3">
          {ranked.map((pair) => (
            <li key={pair.channelSlug}>
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
                    {pair.channelName}
                  </span>
                  <Numbers pair={pair} />
                </div>
                <Terms channel={bySlug.get(pair.channelSlug)} />
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
          percentage of your spend. You can start at $1 a day.
        </p>
      </Stratum>

      <Stratum strata="soil">
        <h2
          className="max-w-2xl text-3xl font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          Sell through {funnel.name.toLowerCase()}.
        </h2>
        <div className="mt-8">
          <Seed href={URLS.signUp}>Plant your seed</Seed>
        </div>
      </Stratum>
    </DepthPage>
  );
}

function Numbers({ pair }: { pair: Pair }) {
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

function Terms({ channel }: { channel: Channel | undefined }) {
  if (!channel) return null;
  return (
    <div className="mt-2 text-sm" style={{ color: "var(--faint)" }}>
      {formatCentsUsd(channel.terms.dailyOperatingCostCents)} a day ·{" "}
      {formatStartsWithin(channel.terms.maxDaysToFirstProduction)}
    </div>
  );
}
