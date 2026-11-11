"use client";

import { StepMark } from "@/components/marks/step-mark";
import type { heldStepCopy } from "@/lib/held-step";

/** The note itself, amber like every held state in v2 (`CampaignHoldNote`'s anatomy). Hook-free for render probes. */
export function HeldStepCard({
  outcome,
  copy,
  onFix,
}: {
  outcome: string;
  copy: ReturnType<typeof heldStepCopy>;
  onFix: () => void;
}) {
  return (
    // keel.css is unlayered, so a bg-* utility on a k-card loses: the amber tint rides an inline style.
    <div
      className="k-card flex flex-wrap items-center gap-3 px-4 py-3"
      style={{ background: "color-mix(in oklab, var(--data-amber) 10%, var(--bg-raised))" }}
      data-held-step={outcome}
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[14px] font-medium">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--data-amber)]" aria-hidden />
          <StepMark stepKey={outcome} size="xs" />
          {copy.headline}
        </p>
        <p className="k-fg2 mt-0.5 text-[13px]">{copy.body}</p>
      </div>
      {copy.fix === "brief" && copy.actionLabel && (
        <button type="button" className="k-btn-accent" onClick={onFix}>
          {copy.actionLabel}
        </button>
      )}
    </div>
  );
}
