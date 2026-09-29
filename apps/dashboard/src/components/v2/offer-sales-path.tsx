"use client";

import { useMemo } from "react";
import { StepMark } from "@/components/marks/step-mark";
import { SectionTitle } from "@/components/v2/ui";
import type { LegCatalogue } from "@/lib/legs";
import {
  offeredLegs,
  offeredSteps,
  toggleLeg,
  toggleStep,
  type PathLeg,
  type SalesPathSelection,
} from "@/lib/offer-sales-path";

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
}: {
  catalogue: LegCatalogue;
  /** The channels this surface offers, slug -> name. Any other channel is not shown. */
  channelNames: ReadonlyMap<string, string>;
  selection: SalesPathSelection;
  onChange: (next: SalesPathSelection) => void;
}) {
  const { legs, steps, channelsByLeg } = useMemo(() => {
    const byLeg = new Map<string, string[]>();
    for (const [slug, keys] of catalogue.legsByChannel) {
      if (!channelNames.has(slug)) continue;
      for (const k of keys) byLeg.set(k, [...(byLeg.get(k) ?? []), slug]);
    }
    const all: PathLeg[] = [...catalogue.legs.values()].map((l) => ({ legKey: l.legKey, fromKey: l.fromKey, toKey: l.toKey }));
    const offered = offeredLegs(all, byLeg);
    return { legs: offered, steps: offeredSteps(offered, [...catalogue.steps.keys()]), channelsByLeg: byLeg };
  }, [catalogue, channelNames]);

  const label = (step: string | null) => (step ? catalogue.steps.get(step)?.label ?? step : "Start");

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle count={selection.steps.size}>Steps</SectionTitle>
        <p className="k-fg2 -mt-1 mb-3 text-[13px]">
          Every step a sale of this offer goes through. A paying client is always the last one.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {steps.map((s) => {
            const on = selection.steps.has(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(toggleStep(selection, s, !on, legs))}
                className={`k-card flex items-center gap-2.5 p-3 text-left ${on ? "k-selected" : "k-hover"}`}
              >
                <StepMark stepKey={s} size="xs" dimmed={!on} />
                <span className={`truncate text-[13px] ${on ? "font-medium" : "k-fg2"}`}>{label(s)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <SectionTitle count={selection.legs.size}>Legs</SectionTitle>
        <p className="k-fg2 -mt-1 mb-3 text-[13px]">
          How a lead moves from one step to the next, and who moves it.
        </p>
        <ul className="k-card divide-y divide-[var(--line-subtle)] overflow-hidden">
          {legs.map((l) => {
            const on = selection.legs.has(l.legKey);
            const channels = channelsByLeg.get(l.legKey) ?? [];
            return (
              <li key={l.legKey}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange(toggleLeg(selection, l, !on, legs))}
                  className={`k-row flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-left ${on ? "k-selected" : ""}`}
                >
                  <span
                    aria-hidden
                    className={`h-3.5 w-3.5 shrink-0 rounded-[4px] border ${on ? "border-[var(--accent)] bg-[var(--accent)]" : "k-line"}`}
                  />
                  <span className={`min-w-0 flex-1 text-[13px] ${on ? "font-medium" : "k-fg2"}`}>
                    {label(l.fromKey)} <span className="k-fg3">→</span> {label(l.toKey)}
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {channels.length === 0 ? (
                      <span className="k-fg3 text-[12px]">No channel</span>
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
    </div>
  );
}
