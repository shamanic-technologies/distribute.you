/**
 * Can our AI book meetings for a brand's prospects through its GoHighLevel connection
 * (AUTO-BOOK-1103)? crm-service owns the verdict (`booking.canBook`) and the list of
 * token scopes to grant; this module only maps them to what the GoHighLevel card shows.
 * Alias-free on purpose: it carries real unit tests.
 */

export interface GhlBookingView {
  canBook: boolean | null;
  access: string;
  checkedAt: string | null;
  vendorError: string | null;
  requiredScopes: string[];
}

/** What the card shows: a positive line, the reconnect ask, or nothing (not known yet). */
export type GhlBookingState = "can_book" | "cannot_book" | "unknown";

export function ghlBookingState(booking: GhlBookingView | null | undefined): GhlBookingState {
  if (!booking || booking.canBook === null) return "unknown";
  return booking.canBook ? "can_book" : "cannot_book";
}

/** Every scope a connection needs, read then book, in the producer's order, once each. */
export function ghlScopesToGrant(scopes: { mirror: string[]; booking: string[] }): string[] {
  return [...new Set([...scopes.mirror, ...scopes.booking])];
}

export const GHL_BOOKING_COPY = {
  canBook: "Our AI books meetings for your prospects on your calendar, automatically.",
  cannotBook: "Our AI cannot book meetings for your prospects yet.",
  reconnect: "Reconnect with write access",
  stepOpen: "In GoHighLevel, open Settings, then Private Integrations.",
  stepScopes: "Edit your integration and tick these scopes:",
  stepToken: "Paste the new token here. Kept the same token? Leave it blank.",
  submit: "Check access",
  stillRefused: "GoHighLevel still keeps write access closed. Tick the scopes above, then check again.",
  connectScopes: "Give your Private Integration these scopes. Our AI then reads your CRM and books meetings for your prospects.",
} as const;
