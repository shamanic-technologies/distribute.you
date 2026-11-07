"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { OUTCOME_PINS_EVENT, outcomePinsStorageKey, parseOutcomePins, togglePin } from "@/lib/v2/outcome-pins";

/**
 * Outcome pins (owner 2026-11-07, `lib/v2/outcome-pins.ts`): the user's own pins per brand in localStorage, and the
 * list the sidebar SHOWS (own pins, else the default) published here so a Pin button anywhere toggles from what the
 * user sees. The sidebar is mounted on every brand page, so the shown list is always there once it rendered.
 */

const shownByBrand = new Map<string, string[]>();

function subscribe(onChange: () => void) {
  window.addEventListener(OUTCOME_PINS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(OUTCOME_PINS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readOwnRaw(brandId: string): string | null {
  try {
    return window.localStorage.getItem(outcomePinsStorageKey(brandId));
  } catch (err) {
    console.error("[v2] outcome pins: localStorage unreadable", err);
    return null;
  }
}

/** The user's own pins on this brand (null = never chosen, the sidebar shows its default). */
export function useOwnOutcomePins(brandId: string): string[] | null {
  const raw = useSyncExternalStore(
    subscribe,
    () => (brandId ? readOwnRaw(brandId) : null),
    () => null,
  );
  return parseOutcomePins(raw);
}

/** The sidebar publishes the keys it shows, so a Pin button reads and toggles the same list. */
export function usePublishShownPins(brandId: string, shown: string[]) {
  const sig = shown.join("|");
  useEffect(() => {
    if (!brandId) return;
    if ((shownByBrand.get(brandId) ?? []).join("|") === sig) return;
    shownByBrand.set(brandId, sig ? sig.split("|") : []);
    window.dispatchEvent(new Event(OUTCOME_PINS_EVENT));
  }, [brandId, sig]);
}

function useShownPins(brandId: string): string[] | null {
  const sig = useSyncExternalStore(
    subscribe,
    () => shownByBrand.get(brandId)?.join("|") ?? null,
    () => null,
  );
  return sig == null ? null : sig ? sig.split("|") : [];
}

/** Pin / Unpin one outcome of a brand. */
export function useOutcomePin(brandId: string, outcomeKey: string): { pinned: boolean; ready: boolean; toggle: () => void } {
  const own = useOwnOutcomePins(brandId);
  const shown = useShownPins(brandId);
  const current = shown ?? own;
  const toggle = useCallback(() => {
    if (!brandId || !current) return;
    const next = togglePin(current, outcomeKey);
    try {
      window.localStorage.setItem(outcomePinsStorageKey(brandId), JSON.stringify(next));
    } catch (err) {
      console.error("[v2] outcome pins: localStorage refused the write", err);
    }
    shownByBrand.set(brandId, next);
    window.dispatchEvent(new Event(OUTCOME_PINS_EVENT));
  }, [brandId, current, outcomeKey]);
  return { pinned: Boolean(current?.includes(outcomeKey)), ready: current != null, toggle };
}

const PIN_D = "M9.5 2.5l4 4-2 1-2.5 2.5-.5 3-2-2-3 3m2-5l-2-2 3-.5L9 4.5z";

/** The Pin / Unpin control (GTM Factory's): a `k-btn` with the pin glyph, its word saying what a click does. */
export function OutcomePinButton({ brandId, outcomeKey, compact = false }: { brandId: string; outcomeKey: string; compact?: boolean }) {
  const { pinned, ready, toggle } = useOutcomePin(brandId, outcomeKey);
  if (!ready) return null;
  const word = pinned ? "Unpin" : "Pin";
  return (
    <button
      type="button"
      className={compact ? "k-btn-ghost relative z-10 h-6 w-6 justify-center px-0" : "k-btn"}
      aria-pressed={pinned}
      aria-label={pinned ? "Remove from the sidebar" : "Add to the sidebar"}
      title={pinned ? "Remove from the sidebar" : "Add to the sidebar"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
    >
      <svg width="14" height="14" style={{ width: 14, height: 14, flexShrink: 0 }} viewBox="0 0 16 16" fill={pinned ? "currentColor" : "none"} aria-hidden="true" className={pinned ? "text-[var(--accent)]" : undefined}>
        <path d={PIN_D} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {!compact && word}
    </button>
  );
}
