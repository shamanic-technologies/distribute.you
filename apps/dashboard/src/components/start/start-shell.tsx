"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { GiftIcon } from "@phosphor-icons/react/dist/csr/Gift";
import { BrandLogo } from "@/components/brand-logo";
import { landingBrandFromCookie, type LandingBrand } from "@/lib/start-landing-brand";
import { foundersFloor, foundersLine } from "@/lib/founders-floor";
import { SHORT_VIEWPORT } from "@/lib/short-viewport";

/**
 * The frame every signed-out onboarding screen sits in (/start, /onboarding/pay,
 * /onboarding/build).
 *
 * It wears the SERVED landing's charter, not the dashboard's: Fustat display
 * headings, the hero glow, the pill top bar with the mark, the trust strip of
 * real founders under the card. A visitor lands here one click after the
 * landing and should read it as the same product, not a form somebody bolted on.
 *
 * Deliberately NOT `StepShell` from the authed flow: that one mounts the account
 * widget and reads the escape chrome, and a visitor with no session has neither.
 *
 * GEOMETRY. The card is capped so its body scrolls and the CTA stays on screen.
 * On a tall window that cap is a viewport calc, because the percentage form
 * applies to nothing when the parent's own height is indefinite. The constant in
 * it is a hand-counted guess at the chrome, and a guess is all it can be: the
 * top bar is 20px signed-out and ~66px signed-in. It is 48px short in the
 * measured case, which does not scroll — it CLIPS, because the card then
 * overflows the column and the `overflow-hidden` above eats both ends with no
 * scrollbar to say so. Harmless while the card sits under the cap, which on a
 * tall window it does.
 *
 * SHORT WINDOWS are where it bites, and there the cap becomes structural: the
 * layout stretches this shell (`SHORT_VIEWPORT.stretchRow`), so the parent
 * height is definite and `sm:max-h-full` is exact — it follows the top bar, the
 * gutter, the gaps and the trust strip with no constant to keep in step, and
 * `sm:my-auto` keeps a short card centered. Everything else compacts one notch.
 * Measured on the welcome step: the card wants 482px against 224px of chrome, so
 * it needs a 706px window, and a 1333x587 one overflowed by 71px with the pillar
 * cards sliced in half. After: zero overflow at 587 and pixel-identical at
 * 1440x900.
 *
 * Colour rides the `brand-*` ramp, never a literal hex: a customer's dashboard
 * re-declares that ramp at their own hue, so an arbitrary-value charter blue
 * would be the one control that never rotates. Every class here carries an
 * `html.dark` remap in globals.css, checked rather than assumed.
 */

/** The landing's shipped literal, kept until a real count lands. Never `0+`. */
const FOUNDERS_SEED = "Loved by 70+ founders";

const FACES = [
  "roberto-wrege",
  "ivan-menez",
  "ajay-kumaran",
  "coenraad-loubser",
  "ugnius-motiejunas",
  "tanyo-goshev",
];

/**
 * The brand the landing named, read once per mount off the cookie the root
 * layout wrote. Null is the ordinary case (a plain CTA click) and renders the
 * offer pill in its place.
 */
export function useLandingBrand(): LandingBrand | null {
  const [brand, setBrand] = useState<LandingBrand | null>(null);
  useEffect(() => {
    setBrand(landingBrandFromCookie(document.cookie));
  }, []);
  return brand;
}

export function StartShell({
  step,
  stepCount,
  title,
  subtitle,
  footer,
  founders,
  scrollKey,
  stepLabels,
  reassurance,
  aside,
  brand: brandOverride,
  cardMaxWidth,
  showEyebrow = true,
  children,
}: {
  /** 1-based. The dots render only when there is more than one, because "1 of 1"
   *  states a position in a sequence the visitor cannot be anywhere else in. */
  step: number;
  stepCount: number;
  /** The screen's headline. Absent on a wizard step that draws its own heading
   *  inside the body; the card then opens straight on the body. */
  title?: ReactNode;
  subtitle?: ReactNode;
  /** The CTA row. A step with nothing to press (a loader) passes none, and the
   *  card then ends on its body rather than on an empty bordered row. */
  footer?: ReactNode;
  /** The platform's raw user count, floored here. Absent keeps the seed line. */
  founders?: number | null;
  /** Names the screen when several share one step number, so a change of screen
   *  resets the scroll even when the step does not move. */
  scrollKey?: string;
  /** One word per step, shown beside its number. Without them the bar draws
   *  numbers alone. */
  stepLabels?: readonly string[];
  /** A fleet figure for the strip under the card, in place of the founders line.
   *  The welcome keeps the founders; each question after it gets one figure. */
  reassurance?: { figure: string; label: string } | null;
  /** A column OUTSIDE the white card, to its right on a wide screen and under it
   *  on a narrow one. The returns screen puts the named clients here: inside
   *  the card they read as part of the question; beside it they read as the
   *  world vouching for the answer. */
  aside?: ReactNode;
  /** The website this flow is setting up, once the wizard holds it in state
   *  (the landing cookie is consumed the moment it lands in the field, so the
   *  cookie read alone would blank the bar after the first screen). */
  brand?: LandingBrand | null;
  /** Narrows the CARD, never the bar: a form step reads better at `sm:max-w-xl`
   *  while the pill bar and the stepper keep the flow's one width. */
  cardMaxWidth?: string;
  /** The in-card "Setting this up for <host>" line. Off on a step whose own
   *  header already names the brand, so the card does not say it twice. */
  showEyebrow?: boolean;
  children: ReactNode;
}) {
  const landingBrand = useLandingBrand();
  const brand = brandOverride === undefined ? landingBrand : brandOverride;

  // The scroll box is ONE element across screens (the shell sits at the same
  // position in the tree whichever screen renders it), so its scrollTop
  // survives a screen change: a visitor who scrolled a long list to its end
  // arrived on the next screen already at the bottom, headline off-screen.
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [step, scrollKey]);
  const floored = foundersFloor(founders);
  const foundersText = floored === null ? FOUNDERS_SEED : foundersLine(floored);

  return (
    <div className={`relative flex min-h-0 w-full min-w-0 flex-1 flex-col sm:mx-auto sm:min-h-0 sm:flex-none sm:gap-4 sm:max-w-6xl sm:px-4 ${SHORT_VIEWPORT.stretchShell} ${SHORT_VIEWPORT.shellGap}`}>
      {/* The landing's hero glow: a soft blob behind the card, from a remapped
          ramp step so it tints with the brand and survives the dark surface.
          `opacity-40` is the standalone utility, never a `/40` colour modifier
          (that compiles to a class the dark remap cannot reach). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 hidden h-[28rem] w-[44rem] -translate-x-1/2 rounded-full bg-brand-100 opacity-40 blur-3xl sm:block"
      />

      {/* Pill top bar: the mark on the left, the step dots in the middle, and on
          the right either the brand we are setting this up for or the offer. */}
      <div className={`relative z-10 flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:rounded-full sm:border sm:px-5 sm:py-2 sm:shadow-sm ${SHORT_VIEWPORT.pillPadding}`}>
        <a href="https://distribute.you" className="flex items-center gap-2.5">
          <Image src="/logo-distribute.svg" alt="distribute.you" width={26} height={26} />
          <span className="font-display text-base font-medium tracking-tight text-gray-900">
            distribute.you
          </span>
        </a>

        {stepCount > 1 && (
          /* NUMBERED steps, one word each, the current one filled: a row of dots of
             two widths was reported as a shape nobody could read as a position. */
          <ol className="hidden items-center gap-1 sm:flex" aria-label={`Step ${step} of ${stepCount}`}>
            {Array.from({ length: stepCount }, (_, i) => {
              const n = i + 1;
              const state = n < step ? "done" : n === step ? "current" : "todo";
              return (
                <li key={n} className="flex items-center gap-1">
                  {i > 0 && <span aria-hidden="true" className="mx-1 h-px w-4 bg-gray-200" />}
                  <span
                    aria-current={state === "current" ? "step" : undefined}
                    className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                      state === "current"
                        ? "bg-brand-600 text-white"
                        : state === "done"
                          ? "text-brand-700"
                          : "text-gray-400"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                        state === "current"
                          ? "bg-white/20"
                          : state === "done"
                            ? "bg-brand-600 text-white"
                            : "border border-gray-300"
                      }`}
                    >
                      {state === "done" ? <CheckIcon size={10} weight="bold" /> : n}
                    </span>
                    {stepLabels?.[i]}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {brand ? (
          <span
            className="flex min-w-0 items-center gap-2 rounded-full border border-brand-200 bg-brand-50 py-1 pl-1.5 pr-3 text-sm text-gray-900"
            data-landing-brand={brand.host}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white">
              <BrandLogo domain={brand.host} size={16} className="rounded-full" fallbackClassName="text-gray-300" />
            </span>
            <span className="truncate">
              Setting up <span className="font-medium">{brand.host}</span>
            </span>
          </span>
        ) : (
          <span className="hidden items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm text-gray-900 sm:flex">
            <GiftIcon size={16} weight="duotone" className="text-brand-600" />
            First $30 free
          </span>
        )}
      </div>

      {/* The card, and beside it whatever the screen puts OUTSIDE it. One grid
          column when there is nothing beside it, so every other screen is
          byte-identical to before. */}
      <div
        className={`relative z-10 flex min-h-0 flex-1 flex-col ${
          aside ? "gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start" : ""
        }`}
      >
      <div className={`relative z-10 flex min-h-0 min-w-0 flex-1 flex-col bg-white p-5 sm:max-h-[calc(100svh-11rem)] sm:flex-none sm:rounded-3xl sm:border sm:border-gray-200 sm:p-8 sm:shadow-sm md:p-10 ${SHORT_VIEWPORT.stretchCard} ${SHORT_VIEWPORT.cardPadding} ${cardMaxWidth ? `w-full sm:mx-auto ${cardMaxWidth}` : ""}`}>
        <div className="shrink-0 start-enter">
          {stepCount > 1 && (
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 sm:hidden">
              Step {step} of {stepCount}
              {stepLabels?.[step - 1] ? ` · ${stepLabels[step - 1]}` : ""}
            </p>
          )}
          {brand && showEyebrow && (
            /* The website the visitor typed on the landing, at the head of every
               screen: their own logo and host, so the form reads as theirs and
               not as a generic one. The host only: no brand NAME exists before
               brand-service resolves it at signup, and a guessed one is worse
               than none. */
            <p
              className={`mb-3 flex items-center gap-2.5 text-sm text-gray-500 ${SHORT_VIEWPORT.eyebrowGap}`}
              data-landing-brand-eyebrow={brand.host}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white shadow-sm">
                <BrandLogo domain={brand.host} size={24} className="rounded-md" fallbackClassName="text-gray-300" />
              </span>
              <span className="min-w-0 truncate">
                Setting this up for{" "}
                <span className="font-medium text-gray-900">{brand.host}</span>
              </span>
            </p>
          )}
          {title !== undefined && (
            <h1 className={`mt-1 font-display text-3xl leading-none tracking-[-0.03em] text-gray-900 sm:text-4xl ${SHORT_VIEWPORT.title}`}>
              {title}
            </h1>
          )}
          {subtitle && (
            <div className={`mt-3 max-w-2xl text-base text-gray-500 ${SHORT_VIEWPORT.subtitleGap}`}>{subtitle}</div>
          )}
        </div>

        {/* Scrolls only when it must. The desktop card is wide enough that both
            question screens fit without scrolling; anything longer scrolls inside
            the card so the footer stays on screen. */}
        {/* Bled 4px on every side (`-m-1 p-1`): a selected card wears a 2px ring OUTSIDE
            its border and a hovered one lifts 2px, and an overflow box clips both at its
            edge. Without the bleed the outline on every edge card was cut off. */}
        <div
          ref={bodyRef}
          className={`-m-1 min-h-0 flex-1 overflow-y-auto p-1 ${
            title !== undefined || (brand && showEyebrow) || stepCount > 1
              ? `mt-5 ${SHORT_VIEWPORT.bodyGap}`
              : ""
          }`}
        >
          {children}
        </div>

        {footer != null && footer !== false && (
          <div className={`mt-6 shrink-0 border-t border-gray-100 pt-5 ${SHORT_VIEWPORT.footerGap}`}>{footer}</div>
        )}
      </div>
      {aside && (
        <div className="relative z-10 min-w-0" data-start-aside>
          {aside}
        </div>
      )}
      </div>

      {/* The landing's trust strip, under the card rather than in the hero, so it
          reads as reassurance and not as a claim the screen is making. */}
      <div className={`relative z-10 hidden items-center justify-center gap-3 py-1 sm:flex ${SHORT_VIEWPORT.trustPadding}`}>
        {reassurance ? (
          <p className="flex items-baseline gap-2 text-sm text-gray-500" data-reassurance>
            <span className="font-display text-xl font-medium tracking-tight text-gray-900">
              {reassurance.figure}
            </span>
            {reassurance.label}
          </p>
        ) : (
          <>
        <div className="flex">
          {FACES.map((f, i) => (
            <img
              key={f}
              src={`/start/${f}.jpg`}
              alt=""
              width={32}
              height={32}
              className={`h-8 w-8 rounded-full border-2 border-white object-cover shadow-sm ${i > 0 ? "-ml-2" : ""}`}
            />
          ))}
        </div>
        <div className="flex flex-col text-sm leading-tight text-gray-500">
          <span className="text-[13px] tracking-wider text-amber-500" aria-hidden="true">
            ★★★★★
          </span>
          <span data-founder-count>{foundersText}</span>
        </div>
          </>
        )}
      </div>
    </div>
  );
}

/** The primary action. One per screen. */
export function StartButton({
  onClick,
  disabled,
  children,
  busy,
}: {
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      // The in-flight label stays FULL opacity: a disabled button carries the
      // fade, and fading the very word that signals work reads as a dead
      // control. Only the genuinely-unavailable state dims.
      className={`group inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-brand-700 hover:shadow-lg sm:w-auto ${
        busy ? "cursor-wait" : "disabled:cursor-not-allowed disabled:opacity-40"
      }`}
    >
      {children}
      {!busy && (
        <ArrowRightIcon
          size={16}
          weight="bold"
          className="transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

/** The grid every option list sits in: three across on desktop, two on a
 *  tablet, one on a phone. Every screen shares it so the rhythm never changes. */
export function StartGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {children}
    </div>
  );
}

/**
 * A pickable option. Multi-select everywhere in this flow, so it is a checkbox
 * in behaviour and a card in appearance. Every one carries a MARK on the left:
 * a logo for a channel bought on somebody's platform, a duotone glyph for
 * everything of ours, so a list of thirty reads by eye rather than by reading.
 *
 * `index` drives the reveal stagger; the card rises in `index * 40ms` after
 * the one before it, the landing's own card recipe.
 */
export function StartOption({
  selected,
  onToggle,
  title,
  meta,
  description,
  mark,
  index = 0,
  children,
}: {
  selected: boolean;
  onToggle: () => void;
  title: ReactNode;
  /** The price, or the operator, in a pill at the bottom. */
  meta?: ReactNode;
  description?: ReactNode;
  mark?: ReactNode;
  index?: number;
  children?: ReactNode;
}) {
  // A pop on SELECTION only: the first paint and a deselect stay still, so the
  // animation means "you just picked this" and nothing else.
  const [popKey, setPopKey] = useState(0);
  const wasSelected = useRef(selected);
  useEffect(() => {
    if (selected && !wasSelected.current) setPopKey((k) => k + 1);
    wasSelected.current = selected;
  }, [selected]);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      style={{ "--enter-delay": `${Math.min(index, 24) * 40}ms` } as CSSProperties}
      // Full-perimeter 1px border plus a background tint, never a side accent.
      className={`start-enter group relative flex w-full flex-col rounded-2xl border p-4 text-left transition-all ${
        selected
          ? "border-brand-600 bg-brand-50 shadow-md ring-2 ring-brand-200"
          : "border-gray-200 bg-white hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
      }`}
    >
      <span
        key={popKey}
        aria-hidden="true"
        className={`absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border transition-colors ${
          selected
            ? "start-pop border-brand-600 bg-brand-600 text-white"
            : "border-gray-300 bg-white text-transparent group-hover:border-brand-300"
        }`}
      >
        <CheckIcon size={14} weight="bold" />
      </span>

      <div className="flex items-start gap-3 pr-8">
        {mark && <span className="shrink-0">{mark}</span>}
        <div className="min-w-0">
          <div className="font-display text-base font-medium leading-tight text-gray-900">{title}</div>
          {description && (
            <div className="mt-1 text-sm leading-snug text-gray-500">{description}</div>
          )}
        </div>
      </div>

      {(meta || children) && (
        <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-3">
          <div className="min-w-0 text-xs text-gray-500">{children}</div>
          {meta && (
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                selected ? "bg-white text-brand-700" : "bg-gray-100 text-gray-700"
              }`}
            >
              {meta}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

/**
 * Whole dollars, spelled the way every price on this flow reads: a floor, not a
 * bill. A day rate is a commercial term we set, so cents read as noise the same
 * way they do on a daily budget anywhere else in the product.
 */
export function fromPerDay(cents: number): string {
  return `From $${Math.round(cents / 100).toLocaleString("en-US")} per day`;
}

/**
 * A number that counts up to its value on first paint, the landing's stat-band
 * recipe. Renders the FINAL value immediately under reduced motion, and the
 * final value is what a test reads: the animation is the illustration and the
 * number is the fact.
 */
export function CountUp({
  value,
  format,
  durationMs = 900,
}: {
  value: number;
  format: (n: number) => string;
  durationMs?: number;
}) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setShown(value);
    };
    setShown(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);
  return <span data-count-up={value}>{format(shown)}</span>;
}

/**
 * A named client's card: the person, what they got back on the budget they paid, the
 * first step's price, the counts, and the outcome they reached. The homepage's proof
 * card, in the same order, so a visitor who came from it reads the same people.
 */
export function StartProofCard({
  index = 0,
  portrait,
  name,
  role,
  outcomeLabel,
  returnPerDollar,
  firstStep,
  counts,
  formatReturn,
}: {
  index?: number;
  portrait: string;
  name: string;
  role: string;
  outcomeLabel: string | null;
  returnPerDollar: number;
  firstStep: { label: string; costPerReachUsd: number | null } | null;
  counts: { label: string; peopleReached: number }[];
  formatReturn: (x: number) => string;
}) {
  return (
    <article
      // Dense on purpose: three cards stack beside the rows and all three have
      // to sit above the fold at 1440x900 (the third clipped under the CTA at
      // p-4 / text-3xl, measured on the live page).
      className="start-enter rounded-2xl border border-gray-200 bg-gray-50 p-3"
      style={
        {
          "--enter-delay": `${200 + index * 90}ms`,
        } as CSSProperties
      }
      data-proof-card
    >
      <div className="flex items-center gap-3">
        <img src={portrait} alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900">{name}</p>
          <p className="truncate text-xs text-gray-500">{role}</p>
        </div>
      </div>
      <p className="mt-2 font-display text-2xl leading-none tracking-tight text-gray-900">
        {formatReturn(returnPerDollar)}
        <span className="ml-2 text-xs font-normal leading-tight text-gray-500">
          return on paid budget
        </span>
      </p>
      {firstStep && firstStep.costPerReachUsd != null && (
        <p className="mt-1 flex justify-between text-xs text-gray-500">
          <span>Cost per {firstStep.label.toLowerCase()}</span>
          <b className="font-medium text-gray-900">
            ${Math.round(firstStep.costPerReachUsd).toLocaleString("en-US")}
          </b>
        </p>
      )}
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
        {counts.map((c) => (
          <span key={c.label}>
            <b className="font-medium text-gray-900">{c.peopleReached.toLocaleString("en-US")}</b>{" "}
            {c.label.toLowerCase()}
          </span>
        ))}
      </div>
      {outcomeLabel && (
        <p className="mt-1 flex justify-between gap-2 text-xs text-gray-500">
          <span>Outcome</span>
          <b className="min-w-0 truncate text-right font-medium text-gray-900">{outcomeLabel}</b>
        </p>
      )}
      <p className="mt-1 flex justify-between text-xs text-gray-500">
        <span>Channel</span>
        <b className="font-medium text-gray-900">Cold email</b>
      </p>
    </article>
  );
}
