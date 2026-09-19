// DID THIS VISITOR ARRIVE FROM /start, AND WHAT DID THEY ALREADY ANSWER?
//
// The three signed-out screens ask what the visitor wants, through which path,
// and show what our clients got back. Then they continue into the wizard. That
// continuation is the whole point: a visitor who has just answered three
// questions must not be met by a marketing welcome screen and asked for the
// website they typed on the landing. Both of those read as being sent back to
// the beginning, which is exactly how it was reported.
//
// Everything needed is already in two cookies nobody joined up: the picks
// (`start-selection-cookie`) and the website (`landing-url-cookie`). This module
// is that join, and it decides ONE thing — is there something to continue.
//
// A SELECTION WITH NO FUNNEL IS NOT A CONTINUATION. The screens write the cookie
// on every keystroke of a pick, so a visitor who opened /start and left has one
// with empty lists; treating that as "they came from /start" would skip the
// welcome screen for somebody who answered nothing.
//
// THE WEBSITE IS READ, NEVER CONSUMED. Expiring it is the wizard's own job, and
// it does it once the value has landed in the field — see the seeding effect in
// `onboarding.tsx`. A second reader that cleared it would race that one and
// leave the field empty.
//
// Only value imports that carry no "@" alias live here, so this module stays
// directly unit-testable (vitest does not resolve the alias).

import { readLandingUrlCookie } from "./landing-url-cookie";
import { decodeStartSelection, START_SELECTION_COOKIE } from "./start-selection-cookie";

export interface StartContinuation {
  /**
   * The website the landing carried, normalised, or null.
   *
   * Null is an ordinary state: a visitor can reach /start with no `?url=` (from
   * a shared link, from the nav). They are still continuing — they answered the
   * three questions — they simply have to state the website, so the wizard opens
   * on the URL step rather than on the welcome pitch.
   */
  website: string | null;
  /**
   * The funnels they picked, in whatever spelling the selection carries.
   *
   * The selection names (funnel x channel) PAIRS (`<funnelKey>::<channelSlug>`)
   * because the pair is what is bought, and tolerates the older funnel-only
   * shape. The wizard asks about FUNNELS, so the funnel half is what crosses.
   * Nothing is mapped onto this app's own catalogue here: that is a question
   * about which funnels are offered, which this module has no business knowing.
   */
  funnelKeys: string[];
}

/** The funnel half of each entry a selection carries, deduped, order kept. */
export function funnelKeysFromSelection(stored: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of stored) {
    const sep = entry.indexOf("::");
    const key = sep === -1 ? entry : entry.slice(0, sep);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/**
 * What the wizard should continue from, or null when there is nothing to
 * continue — in which case it opens exactly as it does today.
 */
export function startContinuation(cookieHeader: string | null | undefined): StartContinuation | null {
  const selection = decodeStartSelection(readCookie(cookieHeader, START_SELECTION_COOKIE));
  const funnelKeys = funnelKeysFromSelection(selection.funnels);
  if (funnelKeys.length === 0) return null;
  return { website: readLandingUrlCookie(cookieHeader), funnelKeys };
}

/** One cookie out of a raw `document.cookie` string, raw value, no decoding —
 *  `decodeStartSelection` owns its own decoding and its own refusals. */
function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    return part.slice(eq + 1).trim();
  }
  return null;
}
