"use client";

import { useMemo } from "react";
import { StepMark } from "@/components/marks/step-mark";
import { SectionTitle } from "@/components/v2/ui";
import type { LegCatalogue } from "@/lib/legs";
import { offeredFromCatalogue, toggleLeg, toggleStep, type SalesPathSelection } from "@/lib/offer-sales-path";

/**
 * How an offer sells (beta): the steps it goes through, the legs between them, and
 * the channels we run on each leg. Presentational: the page owns the read and the
 * write, this only draws the three blocks and applies the tick rules.
 */
export function OfferSalesPath({
  catalogue,
  channelNames,
  selection,
  onChange,
  part = "both",
  bare = false,
  stepsIntro = "Every step a sale of this offer goes through. A paying client is always the last one.",
  legsIntro = "How a lead moves from one step to the next, and who moves it.",
}: {
  catalogue: LegCatalogue;
  /** The channels this surface offers, slug -> name. Any other channel is not shown. */
  channelNames: ReadonlyMap<string, string>;
  selection: SalesPathSelection;
  onChange: (next: SalesPathSelection) => void;
  /** Draw the steps, the legs, or both (the onboarding asks them on two screens). */
  part?: "steps" | "legs" | "both";
  /** No section titles and no intro lines (the onboarding states its own question). */
  bare?: boolean;
  stepsIntro?: string;
  legsIntro?: string;
}) {
  const { legs, steps, channelsByLeg } = useMemo(() => offeredFromCatalogue(catalogue, channelNames.keys()), [catalogue, channelNames]);

  const label = (step: string | null) => (step ? catalogue.steps.get(step)?.label ?? step : "Start");

  // On its own screen the legs list only those between ticked steps: a leg into a step
  // nobody ticked is not a way their sales move.
  const shownLegs =
    part === "legs"
      ? legs.filter((l) => (l.fromKey === null || selection.steps.has(l.fromKey)) && (l.toKey === "paid_client" || selection.steps.has(l.toKey)))
      : legs;

  return (
    <div className="space-y-8">
      {part !== "legs" && (
      <section>
        {!bare && <SectionTitle count={selection.steps.size}>Steps</SectionTitle>}
        {!bare && <p className="k-fg2 -mt-1 mb-3 text-[13px]">{stepsIntro}</p>}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {steps.map((s) => {
            const on = selection.steps.has(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(toggleStep(selection, s, !on, legs))}
                className={`k-card flex items-center gap-2.5 p-3 text-left transition-[box-shadow,background-color] duration-150 active:scale-[0.99] ${on ? "bg-[var(--accent-soft)] ring-2 ring-[var(--accent)]" : "k-hover"}`}
              >
                <StepMark stepKey={s} size="xs" dimmed={!on} />
                <span className={`min-w-0 flex-1 truncate text-[13px] ${on ? "k-fg font-semibold" : "k-fg3"}`}>{label(s)}</span>
                {on ? (
                  <span aria-hidden className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] text-white">✓</span>
                ) : (
                  <span aria-hidden className="h-5 w-5 shrink-0 rounded-full border border-[var(--line-strong)]" />
                )}
              </button>
            );
          })}
        </div>
      </section>
      )}

      {part !== "steps" && (
      <section>
        {!bare && <SectionTitle count={selection.legs.size}>Legs</SectionTitle>}
        {!bare && <p className="k-fg2 -mt-1 mb-3 text-[13px]">{legsIntro}</p>}
        <ul className="k-card divide-y divide-[var(--line-subtle)] overflow-hidden">
          {shownLegs.map((l) => {
            const on = selection.legs.has(l.legKey);
            const channels = channelsByLeg.get(l.legKey) ?? [];
            return (
              <li key={l.legKey}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange(toggleLeg(selection, l, !on, legs))}
                  className={`k-row flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-left ${on ? "bg-[var(--accent-soft)]" : ""}`}
                >
                  <span
                    aria-hidden
                    className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border text-[10px] text-white ${on ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--line-strong)]"}`}
                  >
                    {on ? "✓" : ""}
                  </span>
                  <span className={`min-w-0 flex-1 text-[13px] ${on ? "k-fg font-semibold" : "k-fg3"}`}>
                    {label(l.fromKey)} <span className="k-fg3">→</span> {label(l.toKey)}
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {channels.length === 0 ? (
                      <span className="k-fg3 text-[12px]">Your team</span>
                    ) : (
                      channels.map((slug) => (
                        <span key={slug} className="k-chip">
                          {channelNames.get(slug)}
                        </span>
                      ))
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      )}
    </div>
  );
}
