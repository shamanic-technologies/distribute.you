/**
 * Sidebar outcome pins (owner 2026-11-07: « la possibilité de pin des pages outcomes dans la sidebar, au lieu de voir
 * 100% des outcomes affichées »; the GTM Factory preview's Pin / Unpin). The sidebar's Outcomes group lists its Overview
 * and the PINNED outcomes only. A pin is a UI preference, kept per brand in this browser. Until the user pins or unpins
 * anything on a brand, the sidebar shows the DEFAULT_PIN_COUNT outcomes with the biggest served counts; their first
 * pin or unpin replaces that default with their own list. Alias-free so it carries real unit tests.
 */

export const DEFAULT_PIN_COUNT = 3;
export const OUTCOME_PINS_EVENT = "distribute:outcome-pins";

export const outcomePinsStorageKey = (brandId: string): string => `distribute-outcome-pins-${brandId}`;

/** The user's own pins on a brand, or null when they never pinned or unpinned there. */
export function parseOutcomePins(raw: string | null): string[] | null {
  if (raw == null) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (Array.isArray(v) && v.every((k) => typeof k === "string")) return v as string[];
    console.error("[v2] outcome pins: stored value is not a list of keys", { raw });
  } catch (err) {
    console.error("[v2] outcome pins: stored value is not JSON", { raw, err });
  }
  return null;
}

/**
 * The pinned keys the sidebar shows. Own pins win (kept in the user's order, only those still listed). With none,
 * the DEFAULT_PIN_COUNT listed outcomes with the biggest served counts (a count still loading ranks last, ties keep the
 * listed order).
 */
export function shownPins(own: string[] | null, listed: Array<{ key: string; count: number | null | undefined }>): string[] {
  if (own) {
    const here = new Set(listed.map((o) => o.key));
    return own.filter((k) => here.has(k));
  }
  return listed
    .map((o, i) => ({ key: o.key, count: o.count ?? -1, i }))
    .sort((a, b) => b.count - a.count || a.i - b.i)
    .slice(0, DEFAULT_PIN_COUNT)
    .map((o) => o.key);
}

/** The next own list after a click on Pin / Unpin: starts from what the sidebar showed, so the default is kept. */
export function togglePin(shown: string[], key: string): string[] {
  return shown.includes(key) ? shown.filter((k) => k !== key) : [...shown, key];
}
