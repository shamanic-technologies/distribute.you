"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RocketIcon } from "@phosphor-icons/react/dist/csr/Rocket";
import { WalletIcon } from "@phosphor-icons/react/dist/csr/Wallet";
import { ChartLineUpIcon } from "@phosphor-icons/react/dist/csr/ChartLineUp";
import {
  StartShell,
  StartButton,
  StartOption,
  StartGrid,
  StartGroupLabel,
  CountUp,
  fromPerDay,
  useLandingBrand,
} from "./start-shell";
import { AcquisitionChannelMark } from "@/components/marks/acquisition-channel-mark";
import { SalesFunnelMark } from "@/components/marks/sales-funnel-mark";
import { FunnelLegMark } from "@/components/marks/funnel-leg-mark";
import { channelMarkForSlug } from "@/lib/acquisition-channels";
import { salesFunnelDefForWireKeyOrNull } from "@/lib/sales-funnels";
import {
  startOutcomes,
  channelsForOutcomes,
  channelGroups,
  funnelsForChannels,
  funnelGroups,
  missingRungsForNearestFunnel,
  type CatalogueChannel,
  type StartCatalogue,
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
 * Three narrowing questions and a proof screen, all before anyone has an account.
 * Nothing here writes to any service — the visitor has no org, no brand and no
 * session — so the whole answer rides a cookie to the far side of the Clerk
 * redirect, where the payment screens read it back.
 *
 * Every option on every screen is READ off the channel catalogue
 * features-service publishes. What this file decides is wording and the mark
 * beside each option.
 */

type Screen = "welcome" | "outcome" | "channels" | "funnels" | "returns";

const ORDER: Screen[] = ["welcome", "outcome", "channels", "funnels", "returns"];

interface Catalogue {
  /** The producer's catalogue whole: its channels, its funnels, its legs and its root
   *  step vocabulary. All three screens are DERIVED from it — which outcomes exist,
   *  which channels lead to them, and which (funnel x channel) pairs they buy. */
  wire: StartCatalogue;
  pairs: PairReturn[];
  founders: number | null;
}

/** One decimal under 10x, a whole number above it — the product's one spelling
 *  of a return. Above ten the decimal changes no decision and reads as false
 *  precision on a figure that moves. */
const formatReturn = (x: number): string => (x < 10 ? `${x.toFixed(1)}x` : `${Math.round(x)}x`);

/**
 * The funnel's own tile, or nothing for a funnel this app draws no mark for.
 *
 * TOLERANT BY DESIGN. The producer publishes more funnels than this app holds
 * marks for, and the name beside the tile comes off the wire, so an unmarked
 * funnel still reads correctly. Resolving through the THROWING normalizer here
 * is what made the screen die on its own decoration.
 */
function funnelMark(wireKey: string) {
  const def = salesFunnelDefForWireKeyOrNull(wireKey);
  return def ? <SalesFunnelMark def={def} size="sm" /> : null;
}

export function StartFlow() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [catalogueError, setCatalogueError] = useState(false);
  const brand = useLandingBrand();

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
        const cat = body?.channels;
        const wire: StartCatalogue = {
          channels: cat?.channels ?? cat ?? [],
          funnels: cat?.funnels ?? [],
          legs: cat?.legs ?? [],
          steps: cat?.steps ?? [],
        };
        const pairs = body?.returns?.pairs ?? [];
        const founders = typeof body?.founders === "number" ? body.founders : null;
        setCatalogue({ wire, pairs, founders });
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
    () => (catalogue ? startOutcomes(catalogue.wire) : []),
    [catalogue],
  );
  const offeredChannels = useMemo(
    () => (catalogue ? channelsForOutcomes(catalogue.wire, outcomes) : []),
    [catalogue, outcomes],
  );
  const groups = useMemo(() => channelGroups(offeredChannels), [offeredChannels]);
  const keptChannels = useMemo(
    () => offeredChannels.filter((c) => channels.includes(c.slug)),
    [offeredChannels, channels],
  );
  // Filtered by the OUTCOMES as well as the channels: a channel sells every
  // funnel that starts on any step it produces, and the visitor asked for one.
  // One row per (funnel x channel) — the thing a visitor actually buys, and the key
  // billing puts its ceiling on.
  const offeredFunnels = useMemo(
    () =>
      catalogue ? funnelsForChannels(keptChannels, outcomes, catalogue.wire) : [],
    [keptChannels, outcomes, catalogue],
  );
  // What an empty screen is SHORT OF. A path is bought only when every one of its rungs
  // is ticked, so the ordinary empty case is a path one tick away rather than no path
  // at all — and those are two different sentences.
  const missingRungs = useMemo(
    () =>
      catalogue && offeredFunnels.length === 0
        ? missingRungsForNearestFunnel(keptChannels, outcomes, catalogue.wire)
        : [],
    [catalogue, offeredFunnels, keptChannels, outcomes],
  );

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

  const founders = catalogue?.founders ?? null;

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

  const footer = (primary: React.ReactNode, note?: React.ReactNode) => (
    <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <BackLink />
        {note && <span className="hidden text-sm text-gray-500 sm:inline">{note}</span>}
      </div>
      <div className="sm:ml-auto">{primary}</div>
    </div>
  );

  const picked = (n: number, noun: string) =>
    n === 0 ? null : `${n} ${noun}${n === 1 ? "" : "s"} picked`;

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
    const pillars = [
      {
        icon: RocketIcon,
        title: "We run it for you",
        body: "Our own sending infrastructure, our own team, on your behalf. Nothing to set up on your side.",
      },
      {
        icon: WalletIcon,
        title: "You set the daily budget",
        body: "You are charged what the campaign spent and nothing else. Stop it whenever you want.",
      },
      {
        icon: ChartLineUpIcon,
        title: "You see the real cost",
        body: "Every meeting, signup or sale shows what it actually cost. Measured, never quoted.",
      },
    ];
    return (
      <StartShell
        step={1}
        stepCount={1}
        founders={founders}
        title={
          <>
            Get <span className="text-brand-600">revenue in 24h</span>.
            <br />
            From $1 per day.
          </>
        }
        subtitle={
          brand
            ? `Three quick questions and you see what our clients got back. Then we set it up for ${brand.host}.`
            : "Three quick questions and you see what our clients got back. You only make an account once you have seen the price."
        }
        footer={footer(<StartButton onClick={() => go("outcome")}>Start</StartButton>)}
      >
        <StartGrid>
          {pillars.map((p, i) => (
            <div
              key={p.title}
              className="start-enter rounded-2xl border border-gray-200 bg-gray-50 p-5"
              style={{ "--enter-delay": `${(i + 1) * 90}ms` } as React.CSSProperties}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50">
                <p.icon size={26} weight="duotone" className="text-brand-600" />
              </span>
              <h2 className="mt-4 font-display text-lg font-medium leading-tight text-gray-900">{p.title}</h2>
              <p className="mt-2 text-sm leading-snug text-gray-500">{p.body}</p>
            </div>
          ))}
        </StartGrid>
      </StartShell>
    );
  }

  if (screen === "outcome") {
    return (
      <StartShell
        step={1}
        stepCount={4}
        founders={founders}
        title="What should we get you?"
        subtitle="Pick everything worth paying for. Each one unlocks a different set of channels."
        footer={footer(
          <StartButton onClick={() => go("channels")} disabled={outcomes.length === 0}>
            Continue
          </StartButton>,
          picked(outcomes.length, "outcome"),
        )}
      >
        <StartGrid>
          {allOutcomes.length === 0 && <Loading />}
          {allOutcomes.map((o, i) => (
            <StartOption
              key={o.key}
              index={i}
              selected={outcomes.includes(o.key)}
              onToggle={() => setOutcomes((prev) => toggle(prev, o.key))}
              title={o.label}
              description={o.description}
              mark={<FunnelLegMark fromKey={null} toKey={o.key} size="sm" />}
              meta={`${o.channelSlugs.length} channels`}
            />
          ))}
        </StartGrid>
      </StartShell>
    );
  }

  if (screen === "channels") {
    let index = 0;
    return (
      <StartShell
        step={2}
        stepCount={4}
        founders={founders}
        title="Which channels should we run?"
        subtitle="Every one of these delivers what you picked. Keep the ones you want us to test. Prices are what a day costs to run, before results."
        footer={footer(
          <StartButton onClick={() => go("funnels")} disabled={channels.length === 0}>
            Continue
          </StartButton>,
          picked(channels.length, "channel"),
        )}
      >
        {groups.map((g) => (
          <section key={g.family}>
            <StartGroupLabel count={g.channels.length}>{g.label}</StartGroupLabel>
            <StartGrid>
              {g.channels.map((c) => (
                <StartOption
                  key={c.slug}
                  index={index++}
                  selected={channels.includes(c.slug)}
                  onToggle={() => setChannels((prev) => toggle(prev, c.slug))}
                  title={c.name}
                  description={c.description}
                  mark={<AcquisitionChannelMark def={{ mark: channelMarkForSlug(c.slug) }} size="sm" />}
                  meta={
                    // A customer-operated channel puts nobody of ours on it, which
                    // is what makes its zero day rate a statement rather than a
                    // blank. Read the operator, never infer it from the price.
                    c.operatedBy === "customer"
                      ? "You run it"
                      : fromPerDay(c.terms.dailyOperatingCostCents)
                  }
                />
              ))}
            </StartGrid>
          </section>
        ))}
      </StartShell>
    );
  }

  if (screen === "funnels") {
    return (
      <StartShell
        step={3}
        stepCount={4}
        founders={founders}
        title="How should it turn into revenue?"
        subtitle="Each path ends with a paying client. You pay per path, one day at a time, and you can stop any of them."
        footer={footer(
          <StartButton onClick={() => go("returns")} disabled={funnels.length === 0}>
            Continue
          </StartButton>,
          picked(funnels.length, "path"),
        )}
      >
        {offeredFunnels.length === 0 ? (
          <p className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
            {missingRungs.length > 0 ? (
              <>
                You are one step short of a path. Go back and add{" "}
                <span className="font-medium text-gray-900">
                  {missingRungs.map((s) => s.label).join(" and ")}
                </span>{" "}
                to what you want, and we can sell you the whole way to a paying client.
              </>
            ) : (
              <>
                None of our revenue paths starts where the channels you kept land. Go back and keep
                a channel that gets you a website visit or a conversation.
              </>
            )}
          </p>
        ) : (
          (() => {
            let index = 0;
            return funnelGroups(offeredFunnels).map((g) => (
              <div key={g.funnelKey} className="mb-8 last:mb-0">
                {/* The funnel's name and its rungs, stated ONCE above its channels.
                    A row is still one pair — that is the purchase — but repeating the
                    path on 31 cards is the same sentence 31 times. */}
                <StartGroupLabel count={g.pairs.length}>
                  <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    <span>{g.funnelName}</span>
                    {g.steps.map((step, j) => (
                      <span key={step} className="flex items-center gap-1.5">
                        <span className="text-gray-300">{j === 0 ? "·" : "→"}</span>
                        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-normal text-gray-700">
                          {step}
                        </span>
                      </span>
                    ))}
                  </span>
                </StartGroupLabel>
                <StartGrid>
                  {g.pairs.map((f) => (
                    <StartOption
                      key={f.key}
                      index={index++}
                      selected={funnels.includes(f.key)}
                      onToggle={() => setFunnels((prev) => toggle(prev, f.key))}
                      title={f.channelName}
                      mark={
                        <AcquisitionChannelMark
                          def={{ mark: channelMarkForSlug(f.channelSlug) }}
                          size="sm"
                        />
                      }
                      meta={
                        f.operatedBy === "customer"
                          ? "You run it"
                          : fromPerDay(f.dailyOperatingCostCents)
                      }
                    >
                      {f.operatedBy === "customer"
                        ? "Your own team works this one."
                        : `Judge it after ${f.effectiveMinimumCommitmentDays} days.`}
                    </StartOption>
                  ))}
                </StartGrid>
              </div>
            ));
          })()
        )}
      </StartShell>
    );
  }

  // returns
  const funnelRows = offeredFunnels
    .filter((f) => funnels.includes(f.key))
    .map((f) => ({
      funnel: f,
      rows: returnRowsForFunnel(
        f.funnelKey,
        [f.channelSlug],
        catalogue?.pairs ?? [],
        channelReturns,
      ),
    }));

  return (
    <StartShell
      step={4}
      stepCount={4}
      founders={founders}
      title="What our clients got back"
      subtitle="Measured on real clients, per dollar spent. Where we have not measured a pairing yet, we say so instead of quoting an average."
      footer={footer(
        <StartButton
          onClick={() => {
            // The picks are already in the cookie; signup carries nothing in its
            // query string, which is the whole reason the cookie exists.
            window.location.href = "/sign-up";
          }}
        >
          Create my account
        </StartButton>,
        "No charge until you confirm each path.",
      )}
    >
      <div className="space-y-6">
        {funnelRows.map(({ funnel, rows }, fi) => (
          <section
            key={funnel.key}
            className="start-enter"
            style={{ "--enter-delay": `${fi * 120}ms` } as React.CSSProperties}
          >
            <div className="flex items-center gap-3">
              {funnelMark(funnel.funnelKey)}
              <h2 className="font-display text-lg font-medium text-gray-900">{funnel.name}</h2>
            </div>
            {!funnelHasMeasuredReturn(rows) && (
              <p className="mt-2 text-sm text-gray-500">
                Not enough clients have run this one yet for us to state a figure.
              </p>
            )}
            <StartGrid>
              {rows.map((r, i) => (
                <div
                  key={r.channelSlug}
                  className="start-enter mt-3 flex flex-col rounded-2xl border border-gray-200 bg-white p-4"
                  style={{ "--enter-delay": `${fi * 120 + (i + 1) * 60}ms` } as React.CSSProperties}
                >
                  <div className="flex items-center gap-3">
                    <AcquisitionChannelMark def={{ mark: channelMarkForSlug(r.channelSlug) }} size="sm" />
                    <span className="min-w-0 truncate text-sm font-medium text-gray-900">{r.channelName}</span>
                  </div>
                  {r.median != null ? (
                    <>
                      <p className="mt-3 font-display text-3xl leading-none tracking-tight text-gray-900">
                        <CountUp value={r.median} format={formatReturn} />
                        <span className="ml-1.5 text-sm font-normal text-gray-500">back per dollar</span>
                      </p>
                      <p className="mt-2 text-xs leading-snug text-gray-500">
                        {r.p25 != null && r.p75 != null && (
                          <>
                            {formatReturn(r.p25)} to {formatReturn(r.p75)} for the middle half.{" "}
                          </>
                        )}
                        {/* The scope is never dropped: a channel-wide median must
                            not be read as describing the one funnel picked. */}
                        {r.scope === "pair"
                          ? `${r.brandCount} clients on this exact pairing.`
                          : `${r.brandCount} clients on this channel, every path included.`}
                        {r.costPerPaidClientUsd != null && (
                          <> A paying client cost them ${Math.round(r.costPerPaidClientUsd).toLocaleString("en-US")}.</>
                        )}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-3 font-display text-lg text-gray-400">Not measured yet</p>
                      <p className="mt-1 text-xs leading-snug text-gray-500">{returnReasonLabel(r.reason)}</p>
                    </>
                  )}
                </div>
              ))}
            </StartGrid>
          </section>
        ))}
      </div>
    </StartShell>
  );
}

function Loading() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-100" />
      ))}
    </>
  );
}
