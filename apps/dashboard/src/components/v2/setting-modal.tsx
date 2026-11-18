"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * A money SETTING on a v2 page (auto top-up, monthly limit): its value reads in a `k-btn`
 * with a chevron, a click opens ONE modal with the field and one Save, and a refusal is
 * said IN the modal (owner 2026-11-18: an inline input with red text glued to a sentence
 * read « quelle horreur »). Same anatomy as the campaign modal (`FunnelCampaignModal`)
 * and the launch payment modal (`get-started/org-launch.tsx`): `k-popover` portalled to
 * `#v2-portal`, a `k-label` header with `×`, Esc closes, Cancel + Save at the bottom.
 */

export const SettingChevron = () => (
  <svg viewBox="0 0 12 12" className="k-fg3 h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
    <path d="M3 4.5 6 7.5 9 4.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** The value as a button: what is set now, a chevron, a click opens its modal. */
export function SettingButton({
  label,
  children,
  onClick,
  disabled = false,
}: {
  /** What the button changes, for screen readers ("Change auto top-up"). */
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="k-btn shrink-0 gap-1.5 tabular-nums"
    >
      {children}
      <SettingChevron />
    </button>
  );
}

export function SettingModal({
  title,
  onClose,
  onSave,
  saving,
  canSave,
  failure,
  children,
}: {
  title: string;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  canSave: boolean;
  /** The refusal, in plain words, shown beside Save. */
  failure: string | null;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  if (typeof document === "undefined") return null;
  const host = document.getElementById("v2-portal") ?? document.body;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-[#1010121f] px-3 pt-[12vh]" onMouseDown={() => !saving && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="k-popover flex w-full max-w-[480px] flex-col overflow-hidden text-left"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--line-subtle)] px-4">
          <span className="k-label">{title}</span>
          <button type="button" aria-label="Close" className="k-btn-ghost ml-auto h-7 w-7 justify-center p-0" onClick={onClose} disabled={saving}>
            ×
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave && !saving) onSave();
          }}
        >
          <div className="px-4 py-4">{children}</div>
          <div className="flex items-center gap-2 border-t border-[var(--line-subtle)] px-4 py-3">
            {failure && (
              <p role="alert" className="min-w-0 flex-1 text-[12.5px] leading-[18px] text-[var(--data-rose)]">
                {failure}
              </p>
            )}
            <button type="button" onClick={onClose} disabled={saving} className="k-btn-ghost ml-auto">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave || saving}
              className={`k-btn-accent ${saving ? "cursor-wait" : "disabled:cursor-not-allowed disabled:opacity-40"}`}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    host,
  );
}
