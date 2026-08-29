"use client";

import { createContext, useContext, type ReactNode } from "react";
import { LEARNING_NOTE, PAUSED_NOTE } from "@/lib/learning-threshold";
import { InfoTooltip } from "@/components/visibility/metric-info";

/**
 * Which of the brand's accents a Learning tag wears on a given surface.
 *
 * A tag says one thing wherever it appears, so the colour is a property of the SURFACE
 * it sits on rather than of the tag: a page reads in one accent, and a reader meets this
 * tag more often than anything else on it. Hence a context rather than a prop threaded
 * through `OutreachStatCards` / `RoiTrendCard` / `TopAudiencesCard` — three shared
 * components, none of which has any business knowing which page mounted it.
 *
 * `tertiary` is the default, so every surface that states nothing is unchanged.
 */
export type LearningTone = "primary" | "tertiary";

const LearningToneContext = createContext<LearningTone>("tertiary");

export function LearningToneProvider({
  tone,
  children,
}: {
  tone: LearningTone;
  children: ReactNode;
}) {
  return <LearningToneContext.Provider value={tone}>{children}</LearningToneContext.Provider>;
}

/**
 * Stands in for a cost per outcome that has too few outcomes behind it to state.
 *
 * It takes the VALUE's place rather than sitting beside one, because printing a
 * dollar figure and a caveat together is read as a price with a footnote — the whole
 * point is that there is no figure yet. The (i) carries the reason, through the shared
 * `InfoTooltip` (a native tooltip attribute shows nothing on a phone).
 *
 * The tone comes from `LearningToneProvider`, defaulting to the charter's TERTIARY —
 * every campaign surface reads in one accent, owner-decided. The funnel Overview states
 * `primary` instead, and the Campaigns / leg table pins itself back to `tertiary` so it
 * is orange on every page by construction rather than by whoever remembers.
 *
 * TERTIARY carries `tone-tile`, so on a customer's dashboard it is THEIR tertiary rather
 * than ours — the fill, the text and the border each have a rotation rule, or the pill
 * renders two hues at once. PRIMARY needs none: `:root[data-brand-tint]` re-declares the
 * whole `--color-brand-*` ramp at the brand hue, so `bg-brand-50` / `text-brand-600` /
 * `border-brand-200` rotate for free — which is also why a literal charter hex here would
 * be the one control that stays blue on a tinted dashboard. Every class in both tones is
 * in the `html.dark` remapped set (tinted AND untinted), so neither paints a light block
 * on the dark surface.
 * Full-perimeter 1px border, per the no-side-accent rule.
 *
 * `paused` says the campaign that would have produced those outcomes is STOPPED, and
 * the tag then reads **Paused** in the pause grey — the same word and the same tint the
 * status pill and the controls roll-up already use, so one campaign is never described
 * two ways on one screen. `Learning` there would state a process that is not running:
 * a reader waits for a figure that cannot arrive until they restart the campaign. Grey
 * ignores the tone entirely and carries no `tone-tile`: a verdict never rotates with the
 * brand hue, and both classes are in the `html.dark` remapped set.
 */
export function LearningTag({
  withInfo = true,
  paused = false,
}: {
  withInfo?: boolean;
  paused?: boolean;
}) {
  const surfaceTone = useContext(LearningToneContext);
  const tone = paused
    ? "border-gray-200 bg-gray-100 text-gray-500"
    : surfaceTone === "primary"
      ? "border-brand-200 bg-brand-50 text-brand-600"
      : "tone-tile border-orange-200 bg-orange-50 text-orange-600";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tone}`}
    >
      {paused ? "Paused" : "Learning"}
      {withInfo && <InfoTooltip tip={paused ? PAUSED_NOTE : LEARNING_NOTE} placement="top" />}
    </span>
  );
}
