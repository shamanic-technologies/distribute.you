"use client";

/**
 * The credit step's first screen (owner 2026-11-25): the card is saved and NOTHING is
 * charged, then the next screen picks the credit and its reload, paid on that card.
 * Shared by the `/get-started` wall and the dashboard walk's launch.
 */
export function CardFirst({ busy, onAdd }: { busy: boolean; onAdd: () => void }) {
  return (
    <div className="grid gap-3">
      <div>
        <p className="k-fg text-[13px] font-medium">Add your card</p>
        <p className="k-fg2 text-[13px] leading-5">Nothing is charged now. You pick your credit next.</p>
      </div>
      <button type="button" className="k-cta k-btn-accent gs-glow w-full justify-center" onClick={onAdd} disabled={busy}>
        {busy ? "Opening the card form..." : "Add my card"}
      </button>
    </div>
  );
}
