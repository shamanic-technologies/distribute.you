"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RocketIcon } from "@phosphor-icons/react/dist/csr/Rocket";
import { WalletIcon } from "@phosphor-icons/react/dist/csr/Wallet";
import { ChartLineUpIcon } from "@phosphor-icons/react/dist/csr/ChartLineUp";
import {
  StartShell,
  StartButton,
  StartOption,
  StartPathOption,
  StartGrid,
  StartReturnRow,
  StartProofCard,
  fromPerDay,
  useLandingBrand,
} from "./start-shell";
import { SalesFunnelMark } from "@/components/marks/sales-funnel-mark";
import { FunnelStepMark } from "@/components/marks/funnel-step-mark";
import { salesFunnelDefForWireKeyOrNull } from "@/lib/sales-funnels";
import {
  startOutcomes,
  channelsForOutcomes,
  funnelsForChannels,
  funnelRungs,
  DEFAULT_CHANNEL_SLUG,
  type StartCatalogue,
} from "@/lib/start-catalogue";
import {
  returnRowsForFunnel,
  returnReasonLabel,
  type PairReturn,
  type ChannelReturn,
} from "@/lib/start-returns";
import {
  startSelectionCookieAssignment,
  type StartSelection,
} from "@/lib/start-selection-cookie";
import {
  NO_COMMITMENT_TAG,
  proofCardsFor,
  shuffleWithSeed,
  reassuranceFor,
  type FleetProof,
  type ShowcaseBrand,
} from "@/lib/start-proof";

/**
 * THE FIRST SCREENS OF ONBOARDING: sell first, build second, sign up last.
 *
 * A welcome, TWO narrowing questions and a proof screen, rendered by the wizard
 * (`components/onboarding/onboarding.tsx`) as its own first steps — one flow,
 * one shell, one stepper, no reload between the pitch and the setup. They used
 * to be a separate route (`/start`) that handed off to the wizard through a
 * cookie and a full navigation, and the seam read as two products.
 *
 * CONTROLLED. The picks live in the wizard's state (so they persist with the rest
 * of the snapshot and pre-select the funnel step); this component only draws the
 * screens and reports each toggle. It still writes the `distribute-start` cookie
 * on every pick, because the proxy and the payment screens read it back on the
 * far side of the Clerk redirect.
 *
 * THE CHANNEL IS NOT A QUESTION. We run cold email, so the screen that asked
 * which channels to run offered one real answer and cost a step of the funnel to
 * collect it. The selection still CARRIES the channel (`DEFAULT_CHANNEL_SLUG`),
 * because what is bought is a (funnel x channel) pair and that is what billing
 * keys its ceiling on; what went is the asking.
 *
 * Every option on every screen is READ off the channel catalogue
 * features-service publishes. What this file decides is wording and the mark
 * beside each option.
 */

export type StartScreen = "welcome" | "outcome" | "path" | "returns";

export const START_SCREEN_ORDER: StartScreen[] = ["welcome", "outcome", "path", "returns"];

/**
 * THE WHOLE FLOW's stepper, stated once. The three pick screens are steps 1-3;
 * the build half of the wizard (website, services, funnels, audiences, the
 * summary) is one step, and the account + money is the last. A visitor reads
 * one bar from the landing to the dashboard.
 */
export const START_STEP_LABELS = ["Goal", "Path", "Results", "Your setup", "Review"] as const;
export const START_STEP_COUNT = START_STEP_LABELS.length;

export interface StartCatalogueState {
  /** The producer's catalogue whole: its channels, its funnels, its legs and its root
   *  step vocabulary. All three screens are DERIVED from it — which outcomes exist,
   *  which channels lead to them, and which (funnel x channel) pairs they buy. */
  wire: StartCatalogue;
  pairs: PairReturn[];
  founders: number | null;
  /** The fleet's proof, each half nullable on its own. */
  proof: FleetProof & {
    showcase: ShowcaseBrand[];
  };
}

/** One decimal under 10x, a whole number above it — the product's one spelling
 *  of a return. Above ten the decimal changes no decision and reads as false
 *  precision on a figure that moves. */
export const formatReturn = (x: number): string => (x < 10 ? `${x.toFixed(1)}x` : `${Math.round(x)}x`);

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

/**
 * The catalogue the four screens draw from, read once by the wizard that hosts
 * them and handed down — the wizard also reads `founders` off it for the trust
 * strip under every later step.
 */
export function useStartCatalogue(): { catalogue: StartCatalogueState | null; catalogueError: boolean } {
  const [catalogue, setCatalogue] = useState<StartCatalogueState | null>(null);
  const [catalogueError, setCatalogueError] = useState(false);

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
        const p = body?.proof ?? {};
        setCatalogue({
          wire,
          pairs,
          founders,
          proof: {
            hotLeads: p.hotLeads ?? null,
            medianReturnPerDollar: p.medianReturnPerDollar ?? null,
            showcase: Array.isArray(p.showcase) ? p.showcase : [],
          },
        });
      })
      .catch((err) => {
        console.error("[start] catalogue read failed:", err);
        if (live) setCatalogueError(true);
      });
    return () => {
      live = false;
    };
  }, []);
  return { catalogue, catalogueError };
}

export function StartPicks({
  screen,
  catalogue,
  catalogueError,
  outcomes,
  funnels,
  onOutcomesChange,
  onFunnelsChange,
  onScreenChange,
  onContinue,
  brandHost,
}: {
  screen: StartScreen;
  catalogue: StartCatalogueState | null;
  catalogueError: boolean;
  outcomes: string[];
  funnels: string[];
  onOutcomesChange: (next: string[]) => void;
  onFunnelsChange: (next: string[]) => void;
  /** Moves between the four screens, both ways. */
  onScreenChange: (next: StartScreen) => void;
  /** The last screen's CTA: the wizard takes over (website, then the build). */
  onContinue: () => void;
  /** The website the wizard already holds, so the bar keeps naming it after
   *  the landing cookie has been consumed. */
  brandHost: string | null;
}) {
  const landingBrand = useLandingBrand();
  const brand = brandHost ? { url: `https://${brandHost}`, host: brandHost } : landingBrand;
  const [channelReturns, setChannelReturns] = useState<ChannelReturn[]>([]);
  // Picked once per mount: a shuffle re-drawn on every poll makes the cards jump.
  const [proofSeed] = useState(() => Math.random());
  const setOutcomes = (update: (prev: string[]) => string[]) => onOutcomesChange(update(outcomes));
  const setFunnels = (update: (prev: string[]) => string[]) => onFunnelsChange(update(funnels));

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
    // The channel is not picked, so it is STATED: the payment and brand screens
    // resolve (funnel x channel) pairs out of this cookie, and a selection naming
    // no channel buys nothing.
    remember({ outcomes, channels: [DEFAULT_CHANNEL_SLUG], funnels, paid: [] });
  }, [outcomes, funnels, remember]);

  const allOutcomes = useMemo(
    () => (catalogue ? startOutcomes(catalogue.wire) : []),
    [catalogue],
  );
  // The one channel we run, read off the catalogue rather than assumed present:
  // a catalogue that does not publish it has nothing for this flow to sell, and
  // the funnel screen says so rather than rendering an empty list.
  const keptChannels = useMemo(
    () => (catalogue ? channelsForOutcomes(catalogue.wire, outcomes) : []),
    [catalogue, outcomes],
  );
  // Filtered by the OUTCOMES: the channel sells every funnel that starts on any
  // step it produces, and the visitor asked for one thing. One row per
  // (funnel x channel) — the thing a visitor actually buys, and the key billing
  // puts its ceiling on.
  const offeredFunnels = useMemo(
    () =>
      catalogue ? funnelsForChannels(keptChannels, outcomes, catalogue.wire) : [],
    [keptChannels, outcomes, catalogue],
  );

  // Changing the outcome can drop a path the visitor had already picked. Keeping
  // it would carry an unbuyable pick into the payment screens, so the selection
  // is narrowed to what is still offered.
  useEffect(() => {
    const offered = new Set(offeredFunnels.map((f) => f.key));
    const next = funnels.filter((k) => offered.has(k));
    if (next.length !== funnels.length) onFunnelsChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offeredFunnels]);

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

  const go = (next: StartScreen) => onScreenChange(next);
  // The path screen arrives with its FIRST offered path already picked
  // (owner-asked, 2026-09-18): a visitor who takes the default reaches the
  // last screen in one click, and one who wants another path is one toggle away.
  // Only on ARRIVAL with nothing picked, never on a deselect: a visitor who
  // empties the list on purpose must not see the first one snap back.
  // A path step with ONE option is not a question (owner 2026-09-19: "s'il n'y
  // a qu'une option sur cette step alors skip-la complètement"): the sole path
  // is picked and the visitor lands on the returns, and Back from there walks
  // over the skipped step. Every outcome but Meeting booked offers one path on
  // the prod catalogue, so this is the common case, not an edge.
  const solePath = offeredFunnels.length === 1;
  const goToFunnels = () => {
    if (funnels.length === 0 && offeredFunnels.length > 0) {
      onFunnelsChange([offeredFunnels[0].key]);
    }
    onScreenChange(solePath ? "returns" : "path");
  };
  const back = () => {
    if (screen === "returns" && solePath) {
      onScreenChange("outcome");
      return;
    }
    const at = START_SCREEN_ORDER.indexOf(screen);
    if (at > 0) onScreenChange(START_SCREEN_ORDER[at - 1]);
  };

  const founders = catalogue?.founders ?? null;
  const proof = catalogue?.proof ?? null;

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
        brand={brand}
        founders={founders}
        scrollKey={screen}
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
        {/* THREE pillars in THREE columns, not `StartGrid`: that grid goes to four
            columns at xl, so three cards took three quarters of the width and left
            an empty fourth (reported: "the 3 cards don't take all the width"). */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4" data-welcome-pillars>
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
        </div>
      </StartShell>
    );
  }

  if (screen === "outcome") {
    return (
      <StartShell
        step={1}
        stepCount={START_STEP_COUNT}
        stepLabels={START_STEP_LABELS}
        brand={brand}
        founders={founders}
        reassurance={reassuranceFor("outcome", proof, formatReturn)}
        scrollKey={screen}
        title="What should we get you?"
        subtitle="Pick everything worth paying for. Each one opens a different way of turning it into revenue."
        footer={footer(
          <StartButton onClick={goToFunnels} disabled={outcomes.length === 0}>
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
              mark={<FunnelStepMark stepKey={o.key} size="sm" />}
            />
          ))}
        </StartGrid>
      </StartShell>
    );
  }

  if (screen === "path") {
    return (
      <StartShell
        step={2}
        stepCount={START_STEP_COUNT}
        stepLabels={START_STEP_LABELS}
        brand={brand}
        founders={founders}
        reassurance={reassuranceFor("funnels", proof, formatReturn)}
        scrollKey={screen}
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
            {keptChannels.length === 0 ? (
              <>
                We could not load what we run this through. Reload the page and it should come
                back.
              </>
            ) : (
              <>
                None of our revenue paths turns what you picked into a paying client yet. Go back
                and pick something else.
              </>
            )}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {/* ONE ROW PER FUNNEL. The channel is the same on every row, so naming it
                on each one states the only answer there is over and over; the row is
                the path, and the path is what the visitor is choosing between. */}
            {offeredFunnels.map((f, i) => {
              const rungs = catalogue
                ? funnelRungs(f.funnelKey, catalogue.wire).map((step) => ({
                    key: step.key,
                    label: step.label,
                    mark: <FunnelStepMark stepKey={step.key} size="sm" />,
                  }))
                : [];
              return (
                <StartPathOption
                  key={f.key}
                  index={i}
                  selected={funnels.includes(f.key)}
                  onToggle={() => setFunnels((prev) => toggle(prev, f.key))}
                  title={f.funnelName}
                  mark={funnelMark(f.funnelKey)}
                  meta={
                    f.operatedBy === "customer"
                      ? "You run it"
                      : fromPerDay(f.dailyOperatingCostCents)
                  }
                  rungs={rungs}
                >
                  {/* No path carries a commitment; the tag says so and reads NO
                      producer field (the channel's "minimum days" is how long a
                      result takes to show, not a term). */}
                  {f.operatedBy === "customer" ? (
                    "Your own team works this one."
                  ) : (
                    <span className="inline-flex rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-600">
                      {NO_COMMITMENT_TAG}
                    </span>
                  )}
                </StartPathOption>
              );
            })}
          </div>
        )}
      </StartShell>
    );
  }

  // returns
  // One row per (funnel x channel) pair the visitor kept, in the order they were
  // offered, so the whole screen fits without scrolling: what they picked, what
  // our clients got back on it, what a paying client cost them.
  const returnRows = offeredFunnels
    .filter((f) => funnels.includes(f.key))
    .flatMap((f) =>
      returnRowsForFunnel(
        f.funnelKey,
        [f.channelSlug],
        catalogue?.pairs ?? [],
        channelReturns,
      ).map((r) => ({ funnel: f, row: r })),
    );

  // The top three named clients by return, whatever path they ran and whatever
  // the fleet median beside them says, drawn in a random order fixed for this
  // visit so they read as three clients rather than a ranking. They sit OUTSIDE
  // the white card.
  const proofCards = shuffleWithSeed(proofCardsFor(proof?.showcase ?? []), proofSeed);

  return (
    <StartShell
      step={3}
      stepCount={START_STEP_COUNT}
      stepLabels={START_STEP_LABELS}
      brand={brand}
      founders={founders}
      reassurance={reassuranceFor("returns", proof, formatReturn)}
      scrollKey={screen}
      title="What our clients got back"
      subtitle="Measured on real clients, per dollar spent. Where we have not measured a path yet, we say so."
      footer={footer(
        <StartButton onClick={onContinue}>
          See what we&apos;d build for you
        </StartButton>,
      )}
      aside={
        proofCards.length > 0 ? (
          <div className="flex flex-col gap-2" data-proof-cards>
            {proofCards.map((c, i) => (
              <StartProofCard
                key={`${c.domain}:${c.funnelKey}`}
                index={i}
                portrait={c.person.portrait}
                name={c.person.name}
                role={c.person.role}
                funnelName={c.funnelName}
                returnPerDollar={c.returnPerDollar}
                firstStep={c.firstStep}
                counts={c.counts}
                formatReturn={formatReturn}
              />
            ))}
          </div>
        ) : null
      }
    >
      <div className="flex flex-col gap-2">
        {returnRows.map(({ funnel, row }, i) => (
          <StartReturnRow
            key={funnel.key}
            index={i}
            funnelMark={funnelMark(funnel.funnelKey)}
            funnelName={funnel.funnelName}
            median={row.median}
            p25={row.p25}
            p75={row.p75}
            reasonLabel={returnReasonLabel(row.reason)}
            formatReturn={formatReturn}
          />
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
