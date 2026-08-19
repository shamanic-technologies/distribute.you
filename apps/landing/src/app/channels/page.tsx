import type { Metadata } from "next";
import { PROD_URLS } from "@/lib/env-urls";
import { URLS } from "@distribute/content";
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
  groupChannelsByFamily,
  pairPath,
  sortPairsByReturn,
  type Pair,
} from "@/lib/channel-catalogue";

export const revalidate = 86400;

const PAGE_URL = `${PROD_URLS.landing}/channels`;
const PAGE_DESCRIPTION =
  "Every acquisition channel you can book through distribute, what it costs to run, how long before it starts, and what it has actually returned. Read live from what we charge and what we measured.";

export const metadata: Metadata = {
  title: "Every acquisition channel, priced",
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: PAGE_URL,
    siteName: "distribute",
    title: "Every acquisition channel, priced",
    description: PAGE_DESCRIPTION,
  },
};

export default async function ChannelsPage() {
  const [catalogue, economics] = await Promise.all([
    fetchChannelCatalogue(),
    fetchPairEconomics(),
  ]);
  const { channels } = catalogue;
  const groups = groupChannelsByFamily(channels);
  const pairCount = allPairs(channels).length;

  const measured = economics.pairs.filter((p) => p.result.measured);
  const ranked = sortPairsByReturn(measured).slice(0, 6);

  return (
    <DepthPage>
      <Stratum strata="sky">
        <p
          className="text-xs font-medium uppercase tracking-[0.14em]"
          style={{ color: "var(--muted)" }}
        >
          The catalogue
        </p>
        <h1
          className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl"
          style={{ color: "var(--text)" }}
        >
          {channels.length} ways to reach your buyers. One API. No markup on what
          we route.
        </h1>
        <p
          className="mt-5 max-w-2xl text-lg leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          You book a channel and a sales funnel. We run it. Every figure below
          is what we charge and what we measured, read live, so this page cannot
          drift from the product.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <Stat value={String(channels.length)} label="Channels you can book" />
          <Stat value={String(pairCount)} label="Channel and funnel pairings" />
          <Stat
            value={String(measured.length)}
            label="Pairings we have measured"
            hint="The rest say so rather than showing a number we do not have."
          />
        </div>
      </Stratum>

      <Stratum strata="canopy" id="ranked">
        <h2
          className="text-3xl font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          What is returning the most right now
        </h2>
        <p
          className="mt-3 max-w-2xl leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          A customer buys a pairing, not a channel. The same channel returns
          very differently depending on the funnel it is worked through, which is
          why we rank on return rather than on what is cheapest.
        </p>
        {ranked.length > 0 ? (
          <ul className="mt-8 space-y-3">
            {ranked.map((pair) => (
              <RankedRow key={`${pair.channelSlug}-${pair.funnelKey}`} pair={pair} />
            ))}
          </ul>
        ) : (
          <p className="mt-8" style={{ color: "var(--faint)" }}>
            Nothing has produced enough evidence to rank yet.
          </p>
        )}
      </Stratum>

      <Stratum strata="branch" id="catalogue">
        <h2
          className="text-3xl font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          The whole catalogue
        </h2>
        <div className="mt-10 space-y-14">
          {groups.map((group) => (
            <div key={group.family}>
              <h3
                className="text-xl font-semibold tracking-tight"
                style={{ color: "var(--text)" }}
              >
                {group.label}
              </h3>
              <p
                className="mt-2 max-w-2xl text-sm leading-relaxed"
                style={{ color: "var(--muted)" }}
              >
                {group.blurb}
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.channels.map((channel) => (
                  <a
                    key={channel.slug}
                    href={channelPath(channel.slug)}
                    className="block rounded-xl p-5 transition-transform hover:-translate-y-0.5"
                    style={{
                      background: "var(--panel)",
                      border: "1px solid var(--line)",
                      boxShadow: "var(--shadow)",
                    }}
                  >
                    <div
                      className="font-medium"
                      style={{ color: "var(--text)" }}
                    >
                      {channel.name}
                    </div>
                    <p
                      className="mt-2 text-sm leading-relaxed"
                      style={{ color: "var(--muted)" }}
                    >
                      {channel.description}
                    </p>
                    <div
                      className="mt-4 text-xs"
                      style={{ color: "var(--faint)" }}
                    >
                      {formatCentsUsd(channel.terms.dailyOperatingCostCents)} a
                      day · {formatCommitment(channel.terms.minimumCommitmentDays)}{" "}
                      · {formatStartsWithin(channel.terms.maxDaysToFirstProduction)}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Stratum>

      <Stratum strata="trunk" horizon id="price">
        <h2
          className="max-w-3xl text-3xl font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          We take no markup on what we route.
        </h2>
        <p
          className="mt-4 max-w-2xl text-lg leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          You pay Google what Google charges, and Meta what Meta charges. No
          agency fee, no percentage of your ad spend, no seat, no retainer. Bring
          your own creative and there is nothing on top at all.
        </p>
        <p className="mt-4 max-w-2xl" style={{ color: "var(--faint)" }}>
          You can start at $1 a day. What you fund is a sales funnel, worked
          through the channel you picked, and you can stop it whenever you like.
        </p>
      </Stratum>

      <Stratum strata="root" id="evidence">
        <h2
          className="text-3xl font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          These are our own numbers
        </h2>
        <p
          className="mt-3 max-w-2xl leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          Measured across every client campaign we have run, not a case study we
          picked. Where we have not run something enough to know, the page says
          so instead of showing you a figure.
        </p>
      </Stratum>

      <Stratum strata="soil">
        <h2
          className="max-w-2xl text-3xl font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          Give us the URL. We will run the rest.
        </h2>
        <div className="mt-8">
          <Seed href={URLS.signUp}>Plant your seed</Seed>
        </div>
      </Stratum>
    </DepthPage>
  );
}

function RankedRow({ pair }: { pair: Pair }) {
  if (!pair.result.measured) return null;
  const { returnPerDollar, costPerSaleUsd } = pair.result.economics;
  return (
    <li>
      <a
        href={pairPath(pair.channelSlug, pair.funnelKey)}
        className="flex flex-wrap items-center justify-between gap-4 rounded-xl px-5 py-4"
        style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
        }}
      >
        <span style={{ color: "var(--text)" }}>
          <span className="font-medium">{pair.channelName}</span>
          <span style={{ color: "var(--faint)" }}> → </span>
          <span>{pair.funnelName}</span>
        </span>
        <span className="flex items-center gap-6">
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
      </a>
    </li>
  );
}
