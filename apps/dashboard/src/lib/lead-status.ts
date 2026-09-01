/**
 * The WORD a lead's most-advanced delivery status wears, and the tone it wears it in.
 *
 * ONE map, read by three surfaces: the leads table's Status badge, the CSV that must
 * export what the screen shows, and the board card's tag. A second spelling is how a
 * lead comes to read "Delivered" in a table and "Sent" on a card one click away.
 *
 * The STATUS is `getLeadConsolidatedStatus` (lib/api.ts) and the instant that proves it
 * is `leadDateForStatus` beside it — so a label and the date under it are always about
 * the same event, which is the pairing that made the table's Date column wrong before
 * #3152.
 *
 * Alias-free: its only import is type-only and erased at build, so this carries real
 * unit tests. Keep it that way.
 */

import type { LeadConsolidatedStatus } from "./api";

/**
 * What a customer reads for each status.
 *
 * `contacted` reads **Queued**, not "Contacted": handing a lead to Instantly is not
 * reaching them. Instantly dispatches on weekdays inside the recipient's business
 * hours, so that state routinely outlives the push by three days, and the old wording
 * claimed an email had already gone out to somebody who had been told we respect
 * business hours.
 */
export function leadStatusLabel(status: LeadConsolidatedStatus): string {
  switch (status) {
    case "replied": return "Replied";
    case "clicked": return "Website visit";
    case "delivered": return "Delivered";
    case "sent": return "Sent";
    case "bounced": return "Bounced";
    case "unsubscribed": return "Unsubscribed";
    case "contacted": return "Queued";
    case "served": return "Processing";
    case "skipped": return "Skipped";
    case "claimed": return "Claimed";
    case "buffered": return "Buffered";
  }
}

/**
 * The tone a status wears on a BOARD card, in the reply-kind vocabulary the card's
 * other tag already uses.
 *
 * Deliberately NOT the table's own `leadStatusStyle` palette, which is eleven distinct
 * hues (emerald / violet / cyan / amber / slate …) and is remapped for dark mode
 * almost nowhere — bringing it onto the board would spread a light-mode-only palette
 * to a second surface. `REPLY_TONE_PILL`'s four tints are all in the `html.dark`
 * closed set, and on a card the WORD carries the information while the tone only has
 * to say good / bad / neither.
 *
 * A BOUNCE reads negative even though it leaves the lead in play: the address needs
 * repairing and that is the one thing on the card worth acting on.
 */
export type LeadStatusTone = "positive" | "negative" | "neutral";

export function leadStatusTone(status: LeadConsolidatedStatus): LeadStatusTone {
  switch (status) {
    case "replied":
    case "clicked":
      return "positive";
    case "bounced":
    case "unsubscribed":
      return "negative";
    case "delivered":
    case "sent":
    case "contacted":
    case "served":
    case "skipped":
    case "claimed":
    case "buffered":
      return "neutral";
  }
}
