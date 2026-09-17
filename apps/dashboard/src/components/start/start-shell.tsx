"use client";

import type { ReactNode } from "react";

/**
 * The card every signed-out onboarding screen sits in.
 *
 * Deliberately NOT `StepShell` from the authed flow: that one mounts the account
 * widget and reads the escape chrome, and a visitor with no session has neither.
 * What is copied verbatim is the geometry, because the lesson it carries is not
 * optional — the desktop cap is stated in VIEWPORT units. A percentage
 * max-height resolves against a parent whose own height is indefinite, so it
 * applies to nothing: the card runs to its natural height, the page scrolls
 * instead of the card, and the CTA lands below the fold at every width at once.
 */
export function StartShell({
  step,
  stepCount,
  title,
  subtitle,
  footer,
  children,
}: {
  /** 1-based. Rendered only when there is more than one, because "1 of 1" states
   *  a position in a sequence the visitor cannot be anywhere else in. */
  step: number;
  stepCount: number;
  title: string;
  subtitle?: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col sm:mx-auto sm:min-h-0 sm:flex-none sm:gap-3 sm:max-w-2xl">
      <div className="flex min-h-0 flex-1 flex-col bg-white p-5 sm:max-h-[calc(100svh-8rem)] sm:flex-none sm:rounded-2xl sm:border sm:border-gray-200 sm:p-8 sm:shadow-sm md:p-12">
        <div className="shrink-0">
          {stepCount > 1 && (
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Step {step} of {stepCount}
            </p>
          )}
          <h1 className="mt-1 text-2xl font-semibold text-gray-900 sm:text-3xl">{title}</h1>
          {subtitle && <div className="mt-2 text-sm text-gray-600">{subtitle}</div>}
        </div>

        {/* Scrolls at EVERY width. The option lists here are the tallest screens
            in the flow (production publishes 31 channels behind one outcome), so
            without this the card runs past the viewport and the footer goes with
            it. */}
        <div className="mt-6 min-h-0 flex-1 overflow-y-auto">{children}</div>

        <div className="mt-6 shrink-0">{footer}</div>
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
      className={`inline-flex w-full items-center justify-center rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 sm:w-auto ${
        busy ? "cursor-wait" : "disabled:cursor-not-allowed disabled:opacity-40"
      }`}
    >
      {children}
    </button>
  );
}

/** A pickable option. Multi-select everywhere in this flow, so it is a checkbox
 *  in behaviour and a card in appearance. */
export function StartOption({
  selected,
  onToggle,
  title,
  meta,
  description,
  children,
}: {
  selected: boolean;
  onToggle: () => void;
  title: ReactNode;
  meta?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      // Full-perimeter 1px border plus a background tint, never a side accent.
      className={`w-full rounded-xl border p-4 text-left transition-colors ${
        selected
          ? "border-brand-200 bg-brand-50"
          : "border-gray-200 bg-white hover:bg-gray-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-900">{title}</div>
          {description && <div className="mt-1 text-sm text-gray-600">{description}</div>}
          {children}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {meta && <span className="text-xs text-gray-500">{meta}</span>}
          <span
            aria-hidden="true"
            className={`flex h-5 w-5 items-center justify-center rounded border ${
              selected ? "border-brand-600 bg-brand-600 text-white" : "border-gray-300 bg-white"
            }`}
          >
            {selected && (
              <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 6.5 4.5 9 10 3.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
        </div>
      </div>
    </button>
  );
}
