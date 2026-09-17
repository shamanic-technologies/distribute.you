"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { GiftIcon } from "@phosphor-icons/react/dist/csr/Gift";
import { BrandLogo } from "@/components/brand-logo";
import { landingBrandFromCookie, type LandingBrand } from "@/lib/start-landing-brand";
import { foundersFloor, foundersLine } from "@/lib/founders-floor";

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
 * What is copied verbatim is the geometry lesson it carries: the desktop cap is
 * stated in VIEWPORT units. A percentage max-height resolves against a parent
 * whose own height is indefinite, so it applies to nothing: the card runs to its
 * natural height, the page scrolls instead of the card, and the CTA lands below
 * the fold at every width at once.
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
  children,
}: {
  /** 1-based. The dots render only when there is more than one, because "1 of 1"
   *  states a position in a sequence the visitor cannot be anywhere else in. */
  step: number;
  stepCount: number;
  title: ReactNode;
  subtitle?: ReactNode;
  footer: ReactNode;
  /** The platform's raw user count, floored here. Absent keeps the seed line. */
  founders?: number | null;
  children: ReactNode;
}) {
  const brand = useLandingBrand();
  const floored = foundersFloor(founders);
  const foundersText = floored === null ? FOUNDERS_SEED : foundersLine(floored);

  return (
    <div className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col sm:mx-auto sm:min-h-0 sm:flex-none sm:gap-4 sm:max-w-6xl sm:px-4">
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
      <div className="relative z-10 flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:rounded-full sm:border sm:px-5 sm:py-2 sm:shadow-sm">
        <a href="https://distribute.you" className="flex items-center gap-2.5">
          <Image src="/logo-distribute.svg" alt="distribute.you" width={26} height={26} />
          <span className="font-display text-base font-medium tracking-tight text-gray-900">
            distribute.you
          </span>
        </a>

        {stepCount > 1 && (
          <ol className="hidden items-center gap-1.5 sm:flex" aria-label={`Step ${step} of ${stepCount}`}>
            {Array.from({ length: stepCount }, (_, i) => (
              <li
                key={i}
                aria-current={i + 1 === step ? "step" : undefined}
                className={`h-1.5 rounded-full transition-all ${
                  i + 1 < step
                    ? "w-4 bg-brand-600"
                    : i + 1 === step
                      ? "w-8 bg-brand-600"
                      : "w-4 bg-gray-200"
                }`}
              />
            ))}
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

      <div className="relative z-10 flex min-h-0 flex-1 flex-col bg-white p-5 sm:max-h-[calc(100svh-11rem)] sm:flex-none sm:rounded-3xl sm:border sm:border-gray-200 sm:p-8 sm:shadow-sm md:p-10">
        <div className="shrink-0 start-enter">
          {stepCount > 1 && (
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 sm:hidden">
              Step {step} of {stepCount}
            </p>
          )}
          <h1 className="mt-1 font-display text-3xl leading-none tracking-[-0.03em] text-gray-900 sm:text-4xl">
            {title}
          </h1>
          {subtitle && <div className="mt-3 max-w-2xl text-base text-gray-500">{subtitle}</div>}
        </div>

        {/* Scrolls only when it must. The desktop card is wide enough that the
            outcome and funnel screens fit without scrolling; the channel screen
            (production publishes 31 behind one outcome) is the one that overflows,
            and it scrolls inside the card so the footer stays on screen. */}
        <div className="mt-6 min-h-0 flex-1 overflow-y-auto">{children}</div>

        <div className="mt-6 shrink-0 border-t border-gray-100 pt-5">{footer}</div>
      </div>

      {/* The landing's trust strip, under the card rather than in the hero, so it
          reads as reassurance and not as a claim the screen is making. */}
      <div className="relative z-10 hidden items-center justify-center gap-3 py-1 sm:flex">
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
            <div className="mt-1 line-clamp-3 text-sm leading-snug text-gray-500">{description}</div>
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

/** The heading above one family of channels. */
export function StartGroupLabel({ children, count }: { children: ReactNode; count: number }) {
  return (
    <h2 className="mb-3 mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400 first:mt-0">
      {children}
      <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">
        {count}
      </span>
    </h2>
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
