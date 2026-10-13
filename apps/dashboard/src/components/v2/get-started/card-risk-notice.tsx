"use client";

import type { CardRiskCopy } from "@/lib/v2/card-risk";

/**
 * A saved card automatic charges may not reach (owner 2026-10-13): billing's reason, what
 * a failed charge costs in words, then another card first. `copy` is null only if billing's
 * verdict changed under us; the walk then goes on as "continue".
 */
export function CardRiskNotice({
  copy,
  busy,
  onAnotherCard,
  onSecondary,
}: {
  copy: CardRiskCopy | null;
  busy: boolean;
  onAnotherCard: () => void;
  onSecondary: (action: CardRiskCopy["secondaryAction"]) => void;
}) {
  if (!copy) {
    console.error("[get-started] card warning opened with no warning to show");
    return (
      <button type="button" className="k-cta k-btn-accent gs-glow mt-4 w-full justify-center" onClick={() => onSecondary("continue")} disabled={busy}>
        Continue
      </button>
    );
  }
  return (
    <div className="gs-in mt-4 grid gap-3" role="alert">
      <div className="rounded-[10px] bg-[color-mix(in_oklab,var(--data-amber)_14%,transparent)] px-3.5 py-3">
        <p className="k-fg text-[14px] font-medium leading-5">{copy.title}</p>
        <p className="k-fg2 mt-1 text-[13px] leading-5">{copy.body}</p>
      </div>
      <button type="button" className="k-cta k-btn-accent gs-glow w-full justify-center" onClick={onAnotherCard} disabled={busy}>
        {busy ? "Opening the card form..." : copy.primary}
      </button>
      <button type="button" className="k-btn w-full justify-center" onClick={() => onSecondary(copy.secondaryAction)} disabled={busy}>
        {copy.secondary}
      </button>
    </div>
  );
}
