"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StartShell, StartButton, StartOption } from "./start-shell";
import {
  startOutcomes,
  channelsForOutcomes,
  funnelsForChannels,
  type CatalogueChannel,
} from "@/lib/start-catalogue";
import {
  returnRowsForFunnel,
  funnelHasMeasuredReturn,
  returnReasonLabel,
  type PairReturn,
  type ChannelReturn,
} from "@/lib/start-returns";
import {
  startSelectionCookieAssignment,
  type StartSelection,
} from "@/lib/start-selection-cookie";

/**
 * THE SIGNED-OUT HALF OF ONBOARDING: sell first, sign up after.
 *
 * Four narrowing questions and a proof screen, all before anyone has an account.
 * Nothing here writes to any service — the visitor has no org, no brand and no
 * session — so the whole answer rides a cookie to the far side of the Clerk
 * redirect, where the payment screens read it back.
 *
 * Every option on every screen is READ off the channel catalogue
 * features-service publishes. The one thing this file decides is wording.
 */

type Screen = "welcome" | "outcome" | "channels" | "funnels" | "returns";

const ORDER: Screen[] = ["welcome", "outcome", "channels", "funnels", "returns"];

interface Catalogue {
  channels: CatalogueChannel[];
  pairs: PairReturn[];
}

/** Whole dollars. A day rate is a commercial term we set, so cents read as noise
 *  the same way they do on a daily budget anywhere else in the product. */
const dailyUsd = (cents: number): string => `$${Math.round(cents / 100).toLocaleString("en-US")}`;

/** One decimal under 10x, a whole number above it — the product's one spelling
 *  of a return. Above ten the decimal changes no decision and reads as false
 *  precision on a figure that moves. */
const formatReturn = (x: number): string => (x < 10 ? `${x.toFixed(1)}x` : `${Math.round(x)}x`);

export function StartFlow() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [catalogueError, setCatalogueError] = useState(false);

  const [outcomes, setOutcomes] = useState<string[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [funnels, setFunnels] = useState<string[]>([]);

  const [channelReturns, setChannelReturns] = useState<ChannelReturn[]>([]);

  // The catalogue is the whole screen's content, so a failed read is STATED
  // rather than rendered as an empty list: a visitor shown "no channels" reads
  // it as us selling nothing.
  useEffect(() => {
    let live = true;
    fetch("/api/public/catalogue")
      .then(async (res) => {
        if (!res.ok) throw new Error(`catalogue ${res.status}`);
        return res.json();
      })
      .then((body) => {
        if (!live) return;
        const chans = body?.channels?.channels ?? body?.channels ?? [];
        const pairs = body?.returns?.pairs ?? [];
        setCatalogue({ channels: chans, pairs });
      })
      .catch((err) => {
        console.error("[start] catalogue read failed:", err);
        if (live) setCatalogueError(true);
      });
    return () => {
      live = false;
    };
  }, []);

  // Every pick is written through immediately, so a visitor who signs up from a
  // second tab, or who is bounced through an OAuth round, arrives with what they
  // chose rather than with whatever the last full screen happened to be.
  const remember = useCallback((selection: StartSelection) => {
    document.cookie = startSelectionCookieAssignment(selection);
  }, []);

  useEffect(() => {
    // `paid: []` on purpose, never carried over. These screens are where a
    // selection is MADE, so anything bought under a previous one belongs to that
    // one; inheriting it would mark funnels paid that this selection never
    // charged for, and send somebody past the payment step for free. A completed
    // flow clears the cookie anyway, so there is normally nothing to inherit.
    remember({ outcomes, channels, funnels, paid: [] });
  }, [outcomes, channels, funnels, remember]);

  const allOutcomes = useMemo(
    () => (catalogue ? startOutcomes(catalogue.channels) : []),
    [catalogue],
  );
  const offeredChannels = useMemo(
    () => (catalogue ? channelsForOutcomes(catalogue.channels, outcomes) : []),
    [catalogue, outcomes],
  );
  const keptChannels = useMemo(
    () => offeredChannels.filter((c) => channels.includes(c.slug)),
    [offeredChannels, channels],
  );
  const offeredFunnels = useMemo(() => funnelsForChannels(keptChannels), [keptChannels]);

  // Dropping a channel can drop the only seller of a funnel the visitor had
  // already picked. Keeping that funnel would carry an unbuyable pick into the
  // payment screens, so the selection is narrowed to what is still offered.
  useEffect(() => {
    const offered = new Set(offeredFunnels.map((f) => f.key));
    setFunnels((prev) => {
      const next = prev.filter((k) => offered.has(k));
      return next.length === prev.length ? prev : next;
    });
  }, [offeredFunnels]);

  useEffect(() => {
    const offered = new Set(offeredChannels.map((c) => c.slug));
    setChannels((prev) => {
      const next = prev.filter((s) => offered.has(s));
      return next.length === prev.length ? prev : next;
    });
  }, [offeredChannels]);

  // The per-channel returns are only needed by the proof screen, and only for
  // the channels actually kept, so they are read on arrival rather than up
  // front. A failed read leaves the rows on whatever their pair says.
  useEffect(() => {
    if (screen !== "returns" || keptChannels.length === 0) return;
    let live = true;
    const slugs = keptChannels.map((c) => c.slug).join(",");
    fetch(`/api/public/channel-returns?slugs=${encodeURIComponent(slugs)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body) => {
        if (live) setChannelReturns(body?.returns ?? []);
      })
      .catch((err) => console.error("[start] channel returns read failed:", err));
    return () => {
      live = false;
    };
  }, [screen, keptChannels]);

  const toggle = (list: string[], value: string): string[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const go = (next: Screen) => setScreen(next);
  const back = () => {
    const at = ORDER.indexOf(screen);
    if (at > 0) setScreen(ORDER[at - 1]);
  };

  const BackLink = () =>
    screen === "welcome" ? null : (
      <button
        type="button"
        onClick={back}
        className="text-sm font-medium text-gray-500 hover:text-gray-700"
      >
        Back
      </button>
    );

  const footer = (primary: React.ReactNode) => (
    <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
      <BackLink />
      <div className="sm:ml-auto">{primary}</div>
    </div>
  );

  if (catalogueError) {
    return (
      <StartShell
        step={1}
        stepCount={1}
        title="We could not load what we sell"
        subtitle="This is on us, not on you. Reload the page and it should come back."
        footer={
          <StartButton onClick={() => window.location.reload()}>Try again</StartButton>
        }
      >
        <span />
      </StartShell>
    );
  }

  if (screen === "welcome") {
    return (
      <StartShell
        step={1}
        stepCount={1}
        title="Get revenue in 24h. From $1/day."
        subtitle="Pick what you want to buy, the channels you want us to try, and the revenue funnels you want us to run. You only make an account once you have seen what it costs."
        footer={footer(<StartButton onClick={() => go("outcome")}>Start</StartButton>)}
      >
        <ul className="space-y-3 text-sm text-gray-600">
          <li>We run the campaigns on our own sending infrastructure, on your behalf.</li>
          <li>You set a daily budget and are charged what the campaign spent, nothing else.</li>
          <li>You see what every outcome actually cost, measured, not quoted.</li>
        </ul>
      </StartShell>
    );
  }

  if (screen === "outcome") {
    return (
      <StartShell
        step={1}
        stepCount={4}
        title="What do you want us to buy you?"
        subtitle="Pick everything that is worth your money. Each one opens a different set of channels."
        footer={footer(
          <StartButton onClick={() => go("channels")} disabled={outcomes.length === 0}>
            Continue
          </StartButton>,
        )}
      >
        <div className="space-y-3">
          {allOutcomes.length === 0 && <Loading />}
          {allOutcomes.map((o) => (
            <StartOption
              key={o.key}
              selected={outcomes.includes(o.key)}
              onToggle={() => setOutcomes((prev) => toggle(prev, o.key))}
              title={o.label}
              description={o.description}
              meta={`${o.channelSlugs.length} channels`}
            />
          ))}
        </div>
      </StartShell>
    );
  }

  if (screen === "channels") {
    return (
      <StartShell
        step={2}
        stepCount={4}
        title="Which channels do you want to try with us?"
        subtitle="Every one of these can deliver what you picked. Keep as many as you want to test."
        footer={footer(
          <StartButton onClick={() => go("funnels")} disabled={channels.length === 0}>
            Continue
          </StartButton>,
        )}
      >
        <div className="space-y-3">
          {offeredChannels.map((c) => (
            <StartOption
              key={c.slug}
              selected={channels.includes(c.slug)}
              onToggle={() => setChannels((prev) => toggle(prev, c.slug))}
              title={c.name}
              description={c.description}
              meta={
                // A customer-operated channel puts nobody of ours on it, which
                // is what makes its zero day rate a statement rather than a
                // blank. Read the operator, never infer it from the price.
                c.operatedBy === "customer"
                  ? "You run it"
                  : `${dailyUsd(c.terms.dailyOperatingCostCents)}/day`
              }
            />
          ))}
        </div>
      </StartShell>
    );
  }

  if (screen === "funnels") {
    return (
      <StartShell
        step={3}
        stepCount={4}
        title="Which revenue funnels do you want us to run?"
        subtitle="Each one ends at a paying client. You pay for them one at a time, and you can drop any of them at the payment step."
        footer={footer(
          <StartButton onClick={() => go("returns")} disabled={funnels.length === 0}>
            Continue
          </StartButton>,
        )}
      >
        <div className="space-y-3">
          {offeredFunnels.map((f) => (
            <StartOption
              key={f.key}
              selected={funnels.includes(f.key)}
              onToggle={() => setFunnels((prev) => toggle(prev, f.key))}
              title={f.name}
              description={f.steps.join(" > ")}
              meta={`${dailyUsd(f.dailyOperatingCostCents)}/day`}
            >
              <p className="mt-2 text-xs text-gray-500">
                {f.channelSlugs.length} of your channels sell this. Give it{" "}
                {f.effectiveMinimumCommitmentDays} days before judging it.
              </p>
            </StartOption>
          ))}
        </div>
      </StartShell>
    );
  }

  // returns
  const funnelRows = offeredFunnels
    .filter((f) => funnels.includes(f.key))
    .map((f) => ({
      funnel: f,
      rows: returnRowsForFunnel(
        f.key,
        f.channelSlugs,
        catalogue?.pairs ?? [],
        channelReturns,
      ),
    }));

  return (
    <StartShell
      step={4}
      stepCount={4}
      title="What a dollar came back as"
      subtitle="Our own clients, measured. Where we have not measured a pairing yet, we say so rather than quote you an average."
      footer={footer(
        <StartButton
          onClick={() => {
            // The picks are already in the cookie; signup carries nothing in its
            // query string, which is the whole reason the cookie exists.
            window.location.href = "/sign-up";
          }}
        >
          Create an account to continue
        </StartButton>,
      )}
    >
      <div className="space-y-6">
        {funnelRows.map(({ funnel, rows }) => (
          <section key={funnel.key}>
            <h2 className="text-sm font-semibold text-gray-900">{funnel.name}</h2>
            {!funnelHasMeasuredReturn(rows) && (
              <p className="mt-1 text-sm text-gray-500">
                We have not measured this one across enough clients to state a figure yet.
              </p>
            )}
            <ul className="mt-3 space-y-2">
              {rows.map((r) => (
                <li
                  key={r.channelSlug}
                  className="rounded-xl border border-gray-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900">{r.channelName}</span>
                    {r.median != null ? (
                      <span className="text-sm font-semibold text-gray-900">
                        {formatReturn(r.median)} median
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500">Not measured yet</span>
                    )}
                  </div>
                  {r.median != null ? (
                    <p className="mt-1 text-xs text-gray-500">
                      {r.p25 != null && r.p75 != null && (
                        <>
                          {formatReturn(r.p25)} to {formatReturn(r.p75)} across the middle half.{" "}
                        </>
                      )}
                      {/* The scope is never dropped: a channel-wide median must
                          not be read as describing the one funnel picked. */}
                      {r.scope === "pair"
                        ? `Over ${r.brandCount} clients running this exact pairing.`
                        : `Over ${r.brandCount} clients running this channel, across every funnel they sell through it.`}
                      {r.costPerPaidClientUsd != null && (
                        <> Median cost per paying client ${Math.round(r.costPerPaidClientUsd).toLocaleString("en-US")}.</>
                      )}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-500">{returnReasonLabel(r.reason)}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </StartShell>
  );
}

function Loading() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />
      ))}
    </div>
  );
}
