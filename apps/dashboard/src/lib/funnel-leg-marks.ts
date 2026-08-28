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
// The GLYPH is what makes a leg unique; the tone is shared. Twelve distinct glyphs, and
// none of them belongs to a CHANNEL (`acquisition-channels.ts` owns envelope /
// chat-circle / chat-teardrop) or to a FUNNEL (`sales-funnel-mark.tsx` owns chats-circle
// / calendar-check / shopping-cart / magnet). Both exclusions are load-bearing and were
// found the hard way: a row draws its leg tile beside the channel's, and the SAME leg
// tile stands in for the funnel wherever a leg cannot be placed — so a shared glyph reads
// as one thing said twice, or as the funnel where an arrow was meant. `Sales interest`
// wore the reply funnel's own chats-circle, and `Sales interest -> Meeting booked` wore
// the website-meeting funnel's calendar-check.
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
  | "receipt";

/**
 * The ONE tone every leg wears: the charter's SECONDARY, which is where purple sits
 * (~44 degrees off the primary blue, a relationship `globals.css` preserves under the
 * `tone-tile` rotation, so on a customer's dashboard this is THEIR secondary).
 *
 * The legs used to draw from the same four categorical tints the funnels do, on the
 * reasoning that a categorical scale exists to be told apart. That is right for FUNNELS,
 * which a reader really does have to distinguish; it is wrong for legs, because a table
 * walking one funnel arrow by arrow is a SEQUENCE, and four colours down a sequence read
 * as four kinds of thing rather than as four steps of one. The GLYPH already tells the
 * legs apart — twelve distinct ones, which is the whole reason the catalogue is keyed on
 * a glyph token — so the tone is free to say "this is a step of your funnel" instead.
 *
 * Written as whole class strings because Tailwind cannot see a class assembled at
 * runtime, and both are tints the `html.dark` remap already covers.
 */
export const FUNNEL_LEG_TONE = { iconBg: "bg-purple-50", iconText: "text-purple-600" } as const;

/**
 * How a leg is marked: a duotone glyph in a tinted tile, the same treatment the sales
 * funnels and our own channels use.
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
    glyph: "hand-waving",
    tone: FUNNEL_LEG_TONE,
  },
  [funnelLegMarkKey(null, "website_visit")]: {
    glyph: "cursor-click",
    tone: FUNNEL_LEG_TONE,
  },
  [funnelLegMarkKey(null, "in_ad_form_submission")]: {
    glyph: "clipboard",
    tone: FUNNEL_LEG_TONE,
  },
  [funnelLegMarkKey(null, "in_ad_booked_meeting")]: {
    glyph: "calendar-plus",
    tone: FUNNEL_LEG_TONE,
  },
  // ── Internal legs: one of the funnel's own arrows. ───────────────────────────
  //
  // Two of these are arrows NO channel performs today — nobody sells us the step from
  // a website visit to a signup or to a filled form. They are still arrows of a funnel
  // a brand can buy, so they are still rows, and a row without a tile is the one thing
  // this catalogue exists to prevent.
  [funnelLegMarkKey("website_visit", "signup")]: {
    glyph: "user-plus",
    tone: FUNNEL_LEG_TONE,
  },
  [funnelLegMarkKey("website_visit", "form_filled")]: {
    glyph: "note-pencil",
    tone: FUNNEL_LEG_TONE,
  },
  [funnelLegMarkKey("conversation", "meeting_booked")]: {
    glyph: "calendar-star",
    tone: FUNNEL_LEG_TONE,
  },
  [funnelLegMarkKey("website_visit", "meeting_booked")]: {
    glyph: "calendar-dots",
    tone: FUNNEL_LEG_TONE,
  },
  [funnelLegMarkKey("meeting_booked", "meeting_attended")]: {
    glyph: "video-camera",
    tone: FUNNEL_LEG_TONE,
  },
  [funnelLegMarkKey("meeting_attended", "paid_client")]: {
    glyph: "handshake",
    tone: FUNNEL_LEG_TONE,
  },
  [funnelLegMarkKey("signup", "paid_client")]: {
    glyph: "credit-card",
    tone: FUNNEL_LEG_TONE,
  },
  [funnelLegMarkKey("form_filled", "paid_client")]: {
    glyph: "receipt",
    tone: FUNNEL_LEG_TONE,
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
