// The tile that stands for ONE LEG of a sales funnel.
//
// A campaign is named for the leg it performs (`campaign-leg.ts`), not for the whole
// funnel — so the icon beside that name has to be the leg's, or the row shows a mark
// for one thing above words about another. Two campaigns on the same funnel doing
// different arrows wore the same funnel tile; two campaigns on different funnels doing
// the same arrow wore different ones. Both are backwards.
//
// A leg is (from step, to step), and there are TWELVE of them: the ten every published
// channel states between them (`from: null` onto a conversation, a website visit, an
// in-ad form or an in-ad meeting, plus six internal conversions), and two more that are
// arrows of a funnel we SELL but that no channel performs today — a website visit into a
// signup, and one into a filled form. So this is a small closed catalogue rather than a
// per-channel one, and it covers every arrow a brand can be shown, funded or not.
//
// The GLYPH is what makes a leg unique; the tone is shared. Twelve distinct glyphs, none
// of them a channel's (`acquisition-channels.ts` owns envelope / chat-circle /
// chat-teardrop), so a leg tile and a channel tile can never be mistaken for each other
// on a row that draws both.
//
// Only value imports that carry no "@" alias live here, so this module stays directly
// unit-testable (vitest does not resolve the alias).

/**
 * Which glyph stands for a leg.
 *
 * A token rather than a component, so this module keeps no React or icon import and
 * stays a plain unit-testable catalogue. The mark component maps it.
 */
export type FunnelLegGlyph =
  | "chats"
  | "user-plus"
  | "note-pencil"
  | "cursor-click"
  | "clipboard"
  | "calendar-plus"
  | "calendar-check"
  | "calendar-dots"
  | "video-camera"
  | "handshake"
  | "credit-card"
  | "receipt";

/**
 * How a leg is marked: a duotone glyph in a tinted tile, the same treatment the sales
 * funnels and our own channels use.
 *
 * Tones are whole class strings because Tailwind cannot see a class assembled at
 * runtime, and every tint used here is one the `html.dark` remap already covers —
 * deliberately the same four pairs the funnel and channel catalogues draw from, so a
 * leg tile sits beside them without introducing a fifth palette.
 */
export interface FunnelLegMark {
  glyph: FunnelLegGlyph;
  tone: { iconBg: string; iconText: string };
}

/**
 * The catalogue key for a leg: the step it moves a lead OUT of and the step it moves it
 * TO, in the producer's own tokens. `null` from is "onto the funnel from nothing",
 * which is what every entry leg does and is NOT the same as the first step.
 */
export function funnelLegMarkKey(from: string | null | undefined, to: string): string {
  return `${from ?? ""}->${to}`;
}

/**
 * Every leg the fleet can show, one mark each.
 *
 * The published set, read off features-service's own `stepTransitions` across all 41
 * channels (four entry legs and six internal conversions), plus the two arrows of a
 * funnel we sell that no channel performs. A leg absent from here draws no tile rather
 * than borrowing another leg's — the same rule the channel catalogue holds, and for the
 * same reason: a mark we would have to invent is worse than none.
 */
export const FUNNEL_LEG_MARKS: Record<string, FunnelLegMark> = {
  // ── Entry legs: a lead was not on the funnel at all, and now it is. ──────────
  [funnelLegMarkKey(null, "conversation")]: {
    glyph: "chats",
    tone: { iconBg: "bg-blue-50", iconText: "text-blue-600" },
  },
  [funnelLegMarkKey(null, "website_visit")]: {
    glyph: "cursor-click",
    tone: { iconBg: "bg-indigo-50", iconText: "text-indigo-600" },
  },
  [funnelLegMarkKey(null, "in_ad_form_submission")]: {
    glyph: "clipboard",
    tone: { iconBg: "bg-orange-50", iconText: "text-orange-600" },
  },
  [funnelLegMarkKey(null, "in_ad_booked_meeting")]: {
    glyph: "calendar-plus",
    tone: { iconBg: "bg-orange-50", iconText: "text-orange-600" },
  },
  // ── Internal legs: one of the funnel's own arrows. ───────────────────────────
  //
  // Two of these are arrows NO channel performs today — nobody sells us the step from
  // a website visit to a signup or to a filled form. They are still arrows of a funnel
  // a brand can buy, so they are still rows, and a row without a tile is the one thing
  // this catalogue exists to prevent.
  [funnelLegMarkKey("website_visit", "signup")]: {
    glyph: "user-plus",
    tone: { iconBg: "bg-blue-50", iconText: "text-blue-600" },
  },
  [funnelLegMarkKey("website_visit", "form_filled")]: {
    glyph: "note-pencil",
    tone: { iconBg: "bg-orange-50", iconText: "text-orange-600" },
  },
  [funnelLegMarkKey("conversation", "meeting_booked")]: {
    glyph: "calendar-check",
    tone: { iconBg: "bg-purple-50", iconText: "text-purple-600" },
  },
  [funnelLegMarkKey("website_visit", "meeting_booked")]: {
    glyph: "calendar-dots",
    tone: { iconBg: "bg-purple-50", iconText: "text-purple-600" },
  },
  [funnelLegMarkKey("meeting_booked", "meeting_attended")]: {
    glyph: "video-camera",
    tone: { iconBg: "bg-indigo-50", iconText: "text-indigo-600" },
  },
  [funnelLegMarkKey("meeting_attended", "paid_client")]: {
    glyph: "handshake",
    tone: { iconBg: "bg-blue-50", iconText: "text-blue-600" },
  },
  [funnelLegMarkKey("signup", "paid_client")]: {
    glyph: "credit-card",
    tone: { iconBg: "bg-blue-50", iconText: "text-blue-600" },
  },
  [funnelLegMarkKey("form_filled", "paid_client")]: {
    glyph: "receipt",
    tone: { iconBg: "bg-orange-50", iconText: "text-orange-600" },
  },
};

/** The tile for one leg, or null for a leg this app has not drawn. */
export function funnelLegMarkFor(
  from: string | null | undefined,
  to: string | null | undefined,
): FunnelLegMark | null {
  if (!to) return null;
  return FUNNEL_LEG_MARKS[funnelLegMarkKey(from, to)] ?? null;
}
