"use client";

import { useEffect, useMemo, useState } from "react";
import { RocketIcon } from "@phosphor-icons/react/dist/csr/Rocket";
import { WalletIcon } from "@phosphor-icons/react/dist/csr/Wallet";
import { ChartLineUpIcon } from "@phosphor-icons/react/dist/csr/ChartLineUp";
import {
  StartShell,
  StartButton,
  StartOption,
  StartGrid,
  StartProofCard,
  fromPerDay,
  useLandingBrand,
} from "./start-shell";
import { StepMark } from "@/components/marks/step-mark";
import { LegMark } from "@/components/marks/leg-mark";
import {
  startOutcomes,
  pairsForOutcomes,
  legsTo,
  type StartCatalogue,
} from "@/lib/start-catalogue";
import {
  proofCardsFor,
  shuffleWithSeed,
  reassuranceFor,
  type FleetProof,
  type ShowcaseBrand,
} from "@/lib/start-proof";
import { SHORT_VIEWPORT } from "@/lib/short-viewport";

/**
 * THE FIRST SCREENS OF ONBOARDING: sell first, build second, sign up last.
 *
 * A welcome, ONE question and a proof screen, rendered by the wizard
 * (`components/onboarding/onboarding.tsx`) as its own first steps — one flow, one
 * shell, one stepper, no reload between the pitch and the setup.
 *
 * THE QUESTION IS THE OUTCOME. An outcome is a step one of our channels lands a leg
 * on; picking one names the campaigns that reach it (one per leg x channel, walked back
 * to a leg that starts from nothing), so there is no second question.
 *
 * CONTROLLED. The picks live in the wizard's state (so they persist with the rest of
 * the snapshot); this component only draws the screens and reports each toggle.
 * Every option is READ off the catalogue features-service publishes.
 */

export type StartScreen = "welcome" | "outcome" | "returns";

export const START_SCREEN_ORDER: StartScreen[] = ["welcome", "outcome", "returns"];

/**
 * THE WHOLE FLOW's stepper, stated once. The pick screens are steps 1-2; the build
 * half of the wizard (website, services, audiences, the summary) is one step, and the
 * account + money is the last.
 */
export const START_STEP_LABELS = ["Goal", "Results", "Your setup", "Review"] as const;
export const START_STEP_COUNT = START_STEP_LABELS.length;

export interface StartCatalogueState {
  /** The producer's catalogue: its channels (with the legs they perform) and its steps. */
  wire: StartCatalogue;
  founders: number | null;
  /** The fleet's proof, each half nullable on its own. */
  proof: FleetProof & {
    showcase: ShowcaseBrand[];
  };
}

/** One decimal under 10x, a whole number above it — the product's one spelling of a
 *  return. */
export const formatReturn = (x: number): string => (x < 10 ? `${x.toFixed(1)}x` : `${Math.round(x)}x`);

/**
 * The catalogue the screens draw from, read once by the wizard that hosts them and
 * handed down — the wizard also reads `founders` off it for the trust strip.
 */
export function useStartCatalogue(): { catalogue: StartCatalogueState | null; catalogueError: boolean } {
  const [catalogue, setCatalogue] = useState<StartCatalogueState | null>(null);
  const [catalogueError, setCatalogueError] = useState(false);

  // The catalogue is the whole screen's content, so a failed read is STATED rather
  // than rendered as an empty list.
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
          steps: cat?.steps ?? [],
        };
        const founders = typeof body?.founders === "number" ? body.founders : null;
        const p = body?.proof ?? {};
        setCatalogue({
          wire,
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
  onOutcomesChange,
  onScreenChange,
  onContinue,
  brandHost,
  notice = null,
}: {
  screen: StartScreen;
  catalogue: StartCatalogueState | null;
  catalogueError: boolean;
  outcomes: string[];
  onOutcomesChange: (next: string[]) => void;
  /** Moves between the screens, both ways. */
  onScreenChange: (next: StartScreen) => void;
  /** The last screen's CTA: the wizard takes over (website, then the build). */
  onContinue: () => void;
  /** The website the wizard already holds, so the bar keeps naming it after the
   *  landing cookie has been consumed. */
  brandHost: string | null;
  /** Why the wizard sent the visitor back to the pick, when it did. */
  notice?: string | null;
}) {
  const landingBrand = useLandingBrand();
  const brand = brandHost ? { url: `https://${brandHost}`, host: brandHost } : landingBrand;
  // Picked once per mount: a shuffle re-drawn on every poll makes the cards jump.
  const [proofSeed] = useState(() => Math.random());

  const allOutcomes = useMemo(
    () => (catalogue ? startOutcomes(catalogue.wire) : []),
    [catalogue],
  );

  // An outcome the catalogue no longer offers (an older snapshot, a retired step) is
  // dropped from the picks rather than carried into the build.
  useEffect(() => {
    if (allOutcomes.length === 0) return;
    const offered = new Set(allOutcomes.map((o) => o.key));
    const next = outcomes.filter((k) => offered.has(k));
    if (next.length !== outcomes.length) onOutcomesChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allOutcomes]);

  const campaigns = useMemo(
    () => (catalogue ? pairsForOutcomes(outcomes, catalogue.wire) : []),
    [catalogue, outcomes],
  );

  const toggle = (list: string[], value: string): string[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const go = (next: StartScreen) => onScreenChange(next);
  const back = () => {
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
            ? `One question and you see what our clients got back. Then we set it up for ${brand.host}.`
            : "One question and you see what our clients got back. You only make an account once you have seen the price."
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
              className={`start-enter rounded-2xl border border-gray-200 bg-gray-50 p-5 ${SHORT_VIEWPORT.innerCardPadding}`}
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
        subtitle="Pick everything worth paying for. We run the campaigns that reach each one."
        footer={footer(
          <StartButton onClick={() => go("returns")} disabled={outcomes.length === 0}>
            Continue
          </StartButton>,
          picked(outcomes.length, "outcome"),
        )}
      >
        {notice && (
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p>
        )}
        <StartGrid>
          {allOutcomes.length === 0 && <Loading />}
          {allOutcomes.map((o, i) => {
            const legs = catalogue ? legsTo(o.key, catalogue.wire) : [];
            const channelNames = [...new Set(legs.map((c) => c.channelName))].join(" and ");
            return (
              <StartOption
                key={o.key}
                index={i}
                selected={outcomes.includes(o.key)}
                onToggle={() => onOutcomesChange(toggle(outcomes, o.key))}
                title={o.label}
                description={
                  channelNames ? `${o.description} Through ${channelNames}.` : o.description
                }
                mark={<StepMark stepKey={o.key} size="sm" />}
              />
            );
          })}
        </StartGrid>
      </StartShell>
    );
  }

  // returns
  // The top three named clients by return, drawn in a random order fixed for this
  // visit so they read as three clients rather than a ranking. They sit OUTSIDE the
  // white card.
  const proofCards = shuffleWithSeed(proofCardsFor(proof?.showcase ?? []), proofSeed);

  return (
    <StartShell
      step={2}
      stepCount={START_STEP_COUNT}
      stepLabels={START_STEP_LABELS}
      brand={brand}
      founders={founders}
      reassurance={reassuranceFor("returns", proof, formatReturn)}
      scrollKey={screen}
      title="What we would run for you"
      subtitle="One campaign per step, each with its own daily budget. You set the amounts before anything starts."
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
                key={c.id}
                index={i}
                portrait={c.person.portrait}
                name={c.person.name}
                role={c.person.role}
                outcomeLabel={c.outcomeLabel}
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
      <div className="flex flex-col gap-2" data-start-campaigns>
        {campaigns.length === 0 && (
          <p className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
            None of our channels reaches what you picked yet. Go back and pick something else.
          </p>
        )}
        {campaigns.map((c, i) => (
          <div
            key={c.key}
            className="start-enter flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-gray-200 bg-white px-4 py-3"
            style={{ "--enter-delay": `${i * 60}ms` } as React.CSSProperties}
          >
            <LegMark fromKey={c.fromKey} toKey={c.toKey} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">
                {c.fromLabel ? `${c.fromLabel} → ${c.toLabel}` : c.toLabel}
              </p>
              <p className="text-xs text-gray-500">Via {c.channelName}</p>
            </div>
            <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
              {fromPerDay(c.dailyOperatingCostCents)}
            </span>
          </div>
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
