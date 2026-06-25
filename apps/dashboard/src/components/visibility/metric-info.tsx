"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
 * Info-icon with a styled tooltip bubble. Single primitive for every (i) in
 * the dashboard.
 *
 * - Opens on TAP/click (mobile) AND hover + keyboard focus (desktop).
 * - Always rendered in a body portal at `fixed z-50` viewport coords, so it
 *   ESCAPES any ancestor `overflow` clip (table `overflow-x-auto`, card
 *   `overflow-hidden`) and never stacks under a neighboring element.
 * - Bubble x is clamped to the viewport so it never runs off a narrow phone
 *   edge. `placement` is the preferred side (above/below the icon); it flips
 *   automatically when there isn't room.
 * - Closes on outside tap, Escape, scroll, or resize.
 */
const BUBBLE_CLASS =
  "w-52 max-w-[calc(100vw-16px)] rounded-lg bg-gray-900 text-white text-[11px] font-normal normal-case leading-snug px-2 py-1.5 shadow-lg whitespace-normal tracking-normal";

const BUBBLE_MARGIN = 6; // gap between icon and bubble
const EDGE_PAD = 8; // min distance from viewport edge

export function InfoTooltip({
  tip,
  placement = "top",
}: {
  tip: string;
  placement?: "top" | "bottom";
}) {
  const iconRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    above: boolean;
  } | null>(null);

  const reposition = () => {
    const icon = iconRef.current?.getBoundingClientRect();
    if (!icon) return;
    const bubble = bubbleRef.current?.getBoundingClientRect();
    const bw = bubble?.width ?? 208; // w-52 = 13rem = 208px
    const bh = bubble?.height ?? 0;
    const vw = window.innerWidth;
    const cx = icon.left + icon.width / 2;
    // Clamp horizontal center so the (centered) bubble stays on-screen.
    const half = bw / 2;
    const left = Math.min(Math.max(cx, half + EDGE_PAD), vw - half - EDGE_PAD);
    // Prefer requested side; flip only if it would clip and the other fits.
    const vh = window.innerHeight;
    const fitsAbove = icon.top - BUBBLE_MARGIN - bh >= EDGE_PAD;
    const fitsBelow = icon.bottom + BUBBLE_MARGIN + bh <= vh - EDGE_PAD;
    let above = placement === "top";
    if (above && !fitsAbove && fitsBelow) above = false;
    if (!above && !fitsBelow && fitsAbove) above = true;
    const top = above ? icon.top - BUBBLE_MARGIN : icon.bottom + BUBBLE_MARGIN;
    setPos({ left, top, above });
  };

  // Measure after the bubble mounts (so width/height are real), then on every
  // scroll/resize while open. Close on scroll to avoid a detached bubble.
  useLayoutEffect(() => {
    if (open) reposition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (iconRef.current?.contains(t) || bubbleRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open]);

  return (
    <span
      ref={iconRef}
      className="inline-flex align-middle"
      // Hover (desktop) — pointer events keep mouse behavior while not
      // interfering with the tap toggle below (touchscreens fire no hover).
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="More info"
        className="inline-flex"
        // Tap/click toggle (mobile + desktop click).
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <InformationCircleIcon className="w-3.5 h-3.5 text-gray-400 cursor-help" />
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            ref={bubbleRef}
            role="tooltip"
            className={`fixed z-50 -translate-x-1/2 ${pos?.above ? "-translate-y-full" : ""} ${BUBBLE_CLASS}`}
            style={{
              left: pos?.left ?? -9999,
              top: pos?.top ?? -9999,
              visibility: pos ? "visible" : "hidden",
            }}
          >
            {tip}
          </span>,
          document.body,
        )}
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
