// The tile that stands for ONE LEG.
//
// A campaign is named for the leg it performs, so the icon beside that name is the
// leg's. A leg is (from step, to step), and the set is small and closed, so this is one
// catalogue rather than a per-channel one, and it covers every leg a brand can be shown.
//
// The GLYPH is what makes a leg unique; the tone is shared. No leg glyph belongs to a
// CHANNEL (`acquisition-channels.ts` owns envelope / chat-circle / chat-teardrop): a row
// draws its leg tile beside the channel's, so a shared glyph would read as one thing
// said twice.
//
// Only value imports that carry no "@" alias live here, so this module stays directly
// unit-testable (vitest does not resolve the alias).

/**
 * Which glyph stands for a leg.
 *
 * A token rather than a component, so this module keeps no React or icon import and
 * stays a plain unit-testable catalogue. The mark component maps it.
 */
export type LegGlyph =
  | "hand-waving"
  | "user-plus"
  | "note-pencil"
  | "cursor-click"
  | "clipboard"
  | "calendar-plus"
  | "calendar-star"
  | "calendar-dots"
  | "video-camera"
  | "handshake"
  | "credit-card"
  | "receipt"
  | "chat-text"
  | "storefront"
  | "seal-check";

/**
 * The ONE tone every leg wears: the charter's SECONDARY, which is where purple sits
 * (~44 degrees off the primary blue, a relationship `globals.css` preserves under the
 * `tone-tile` rotation, so on a customer's dashboard this is THEIR secondary).
 *
 * The GLYPH already tells the legs apart, so the tone is free to say what LAYER the tile
 * belongs to: four colours down a sequence of legs would read as four kinds of thing.
 *
 * Written as whole class strings because Tailwind cannot see a class assembled at
 * runtime, and both are tints the `html.dark` remap already covers.
 */
export const LEG_TONE = { iconBg: "bg-purple-50", iconText: "text-purple-600" } as const;

/**
 * How a leg is marked: a duotone glyph in a tinted tile, the same treatment our own
 * channels use.
 */
export interface LegMark {
  glyph: LegGlyph;
  tone: { iconBg: string; iconText: string };
}

/**
 * The catalogue key for a leg: the step it moves a lead OUT of and the step it moves it
 * TO, in the producer's own tokens. `null` from is "onto a step from nothing",
 * which is what every entry leg does and is NOT the same as the first step.
 */
export function legMarkKey(from: string | null | undefined, to: string): string {
  return `${from ?? ""}->${to}`;
}

/**
 * Every leg the fleet can show, one mark each.
 *
 * The published set, read off features-service's own `legs` across all 42 channels
 * (four entry legs and nine internal conversions), plus the legs no channel performs
 * today. A leg absent from here draws no tile rather than borrowing another leg's — the same rule the channel catalogue holds, and for the
 * same reason: a mark we would have to invent is worse than none.
 */
export const LEG_MARKS: Record<string, LegMark> = {
  // ── Entry legs: a lead was on no step at all, and now it is. ─────────────────
  [legMarkKey(null, "conversation")]: {
    glyph: "hand-waving",
    tone: LEG_TONE,
  },
  [legMarkKey(null, "website_visit")]: {
    glyph: "cursor-click",
    tone: LEG_TONE,
  },
  // Both of these were `in_ad_form_submission` / `in_ad_booked_meeting` until
  // 2026-09-17, when features-service collapsed the two in-ad steps into the plain
  // steps they always were. What the ad delivers is a filled form and a booked
  // meeting; what differs is that nothing of ours happened first, which is the LEG
  // (`from: null`) and not a step of its own.
  [legMarkKey(null, "form_submitted")]: {
    glyph: "clipboard",
    tone: LEG_TONE,
  },
  [legMarkKey(null, "meeting_booked")]: {
    glyph: "calendar-plus",
    tone: LEG_TONE,
  },
  // ── Internal legs: from one step to the next. ────────────────────────────────
  [legMarkKey("website_visit", "signup")]: {
    glyph: "user-plus",
    tone: LEG_TONE,
  },
  [legMarkKey("website_visit", "form_submitted")]: {
    glyph: "note-pencil",
    tone: LEG_TONE,
  },
  [legMarkKey("conversation", "meeting_booked")]: {
    glyph: "calendar-star",
    tone: LEG_TONE,
  },
  [legMarkKey("website_visit", "meeting_booked")]: {
    glyph: "calendar-dots",
    tone: LEG_TONE,
  },
  [legMarkKey("meeting_booked", "meeting_attended")]: {
    glyph: "video-camera",
    tone: LEG_TONE,
  },
  [legMarkKey("meeting_attended", "paid_client")]: {
    glyph: "handshake",
    tone: LEG_TONE,
  },
  [legMarkKey("signup", "paid_client")]: {
    glyph: "credit-card",
    tone: LEG_TONE,
  },
  [legMarkKey("form_submitted", "paid_client")]: {
    glyph: "receipt",
    tone: LEG_TONE,
  },
  // Two legs that SKIP a step a longer path inserts: a sale closed inside the
  // conversation, and a sale on landing.
  [legMarkKey("conversation", "paid_client")]: {
    glyph: "chat-text",
    tone: LEG_TONE,
  },
  [legMarkKey("website_visit", "paid_client")]: {
    glyph: "storefront",
    tone: LEG_TONE,
  },
};

/** The tile for one leg, or null for a leg this app has not drawn. */
export function legMarkFor(
  from: string | null | undefined,
  to: string | null | undefined,
): LegMark | null {
  if (!to) return null;
  return LEG_MARKS[legMarkKey(from, to)] ?? null;
}
