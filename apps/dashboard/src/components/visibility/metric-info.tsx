"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { InformationCircleIcon } from "@heroicons/react/20/solid";

/**
 * Single source of truth for AI-visibility metric explanations.
 * Consumed by the score cards + every metric table header across the
 * visibility-runs / prompts / competitors / run-detail pages so the copy
 * never drifts between surfaces. Definitions mirror the ai-visibility-score
 * service formulas (GET /orgs/visibility-score-runs/{id} openapi descriptions).
 */
export const METRIC_INFO = {
  // Aggregate run metrics (score cards + runs table)
  visibility:
    "Overall score (0–100%) blending mention rate, citation rate, share of voice, position & sentiment. Your headline AI-visibility number.",
  shareOfVoice:
    "Of every brand named across the tested prompts, the share that's yours: brand mentions ÷ (brand + competitor mentions). Dominance vs rivals.",
  brandMentionRate:
    "% of tested prompts where the AI named your brand — whether or not it linked you.",
  citationRate:
    "% of tested prompts where the AI cited your domain as a source. Stricter than a mention: it pointed to your site, not just said your name.",
  netSentiment:
    "Average tone of your mentions, from −1 (negative) to +1 (positive). 0 = neutral.",
  avgPosition:
    "Average rank of your brand when it appears in an answer (1 = named first). Lower is better.",

  // Per-prompt metrics (prompts table)
  promptBrandMention: "Did the AI name your brand anywhere in this answer?",
  promptUrlMention: "Did the AI include your brand's URL / link in this answer?",
  promptPosition:
    "Rank of your brand among the brands named in this answer (1 = first). — if not ranked.",
  promptSentiment:
    "Tone toward your brand in this single answer: positive, neutral, or negative.",

  // Competitor row metrics (competitors table)
  competitorMentions: "Number of tested prompts where this brand was named.",
  competitorShareOfVoice:
    "This brand's share of all brand mentions in the run (your row is highlighted for comparison).",
  competitorAvgPosition:
    "Average rank of this brand when named (1 = first). Lower is better.",
  competitorNetSentiment:
    "Average tone toward this brand across its mentions, from −1 to +1.",
} as const;

export type MetricKey = keyof typeof METRIC_INFO;

/**
 * Hover info-icon with a styled tooltip bubble. Lifted from the
 * `InfoLabel` pattern in campaigns/new and made reusable.
 *
 * placement="top" (default) opens the bubble above the icon — for score
 * cards, which have room above. placement="bottom" opens it downward into
 * the table body so it stays inside the table card's `overflow-hidden` box.
 *
 * `float` renders the bubble in a body portal at fixed viewport coords, so it
 * ESCAPES any ancestor `overflow` clip — required inside the single-line stat
 * row (`overflow-x-auto`, which also clips vertically per CSS), where the
 * default absolute bubble would be cut off. (#stat-cards tooltip clip)
 */
const BUBBLE_CLASS =
  "w-52 rounded-lg bg-gray-900 text-white text-[11px] font-normal normal-case leading-snug px-2 py-1.5 shadow-lg whitespace-normal tracking-normal";

export function InfoTooltip({
  tip,
  placement = "top",
  float = false,
}: {
  tip: string;
  placement?: "top" | "bottom";
  float?: boolean;
}) {
  const iconRef = useRef<HTMLSpanElement>(null);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);

  if (float) {
    const open = () => {
      const r = iconRef.current?.getBoundingClientRect();
      if (r) setCoords({ x: r.left + r.width / 2, y: r.top });
    };
    const close = () => setCoords(null);
    return (
      <span
        ref={iconRef}
        className="inline-flex align-middle"
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
      >
        <InformationCircleIcon className="w-3.5 h-3.5 text-gray-400 cursor-help" />
        {coords !== null &&
          typeof document !== "undefined" &&
          createPortal(
            <span
              className={`pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full ${BUBBLE_CLASS}`}
              style={{ left: coords.x, top: coords.y - 6 }}
            >
              {tip}
            </span>,
            document.body,
          )}
      </span>
    );
  }

  const pos = placement === "top" ? "bottom-full mb-1" : "top-full mt-1";
  return (
    <span className="group relative inline-flex align-middle">
      <InformationCircleIcon className="w-3.5 h-3.5 text-gray-400 cursor-help" />
      <span
        className={`pointer-events-none absolute ${pos} left-1/2 -translate-x-1/2 hidden group-hover:block z-20 ${BUBBLE_CLASS}`}
      >
        {tip}
      </span>
    </span>
  );
}

/**
 * Inline metric label + info-icon, for table `<th>` content. The `<th>`
 * keeps its own padding/alignment classes; this only fills its children.
 */
export function MetricLabel({
  text,
  tip,
  placement = "bottom",
}: {
  text: string;
  tip: string;
  placement?: "top" | "bottom";
}) {
  return (
    <span className="inline-flex items-center gap-1">
      {text}
      <InfoTooltip tip={tip} placement={placement} />
    </span>
  );
}
