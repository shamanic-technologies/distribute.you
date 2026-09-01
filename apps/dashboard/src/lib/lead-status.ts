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
 * The pill a status wears, everywhere one is drawn — the leads table's Status badge,
 * the lead panel, and the board card's tag.
 *
 * ONE PALETTE, and the hue is not decorative: it tracks HOW FAR ALONG the lead is, so
 * a column of badges reads as a progression rather than as eleven unrelated chips.
 *
 *   stone   nothing has happened to them yet — buffered, claimed, or never served
 *   slate   ours to send, not sent — picked up, and waiting for the sending window
 *   blue    it left
 *   sky     it arrived
 *   cyan    they came to the site
 *   teal    they answered
 *
 * Cool the whole way, deliberately: this family is what WE did and what the delivery
 * layer MEASURED. The reply kinds a person states are warm and green (`REPLY_KIND_PILL`
 * in `lib/reply-kind.ts`), so a stated kind can never be mistaken for an observed
 * status even though one replaces the other on the same card.
 *
 * Two colours sit outside the sweep because they are not points along it:
 *
 *   orange  BOUNCED — a failure of delivery. A problem to fix, not a verdict on the
 *           person, so it is warned rather than condemned. It is deliberately not red:
 *           the lead stays in play (lead-service v0.65.0) and a red chip would say the
 *           opposite of the column it sits in.
 *   red     UNSUBSCRIBED — the prospect's own binding act, and the one terminal state
 *           the delivery layer can observe.
 *
 * `teal` for a reply rather than a green: "replied" means they answered, not that they
 * answered WELL. The moment somebody states which kind of reply it was, that kind's own
 * pill takes over and says so.
 *
 * Every tint here is answered by the `html.dark` layer — `tests/dark-accent-coverage.test.ts`
 * fails on one that is not.
 */
export function leadStatusPill(status: LeadConsolidatedStatus): string {
  switch (status) {
    case "replied": return "bg-teal-100 text-teal-700 border-teal-200";
    case "clicked": return "bg-cyan-100 text-cyan-700 border-cyan-200";
    case "delivered": return "bg-sky-100 text-sky-700 border-sky-200";
    case "sent": return "bg-blue-100 text-blue-700 border-blue-200";
    case "bounced": return "bg-orange-100 text-orange-700 border-orange-200";
    case "unsubscribed": return "bg-red-100 text-red-700 border-red-200";
    case "contacted": return "bg-slate-100 text-slate-700 border-slate-200";
    case "served": return "bg-slate-100 text-slate-700 border-slate-200";
    case "claimed": return "bg-stone-100 text-stone-700 border-stone-200";
    case "buffered": return "bg-stone-100 text-stone-700 border-stone-200";
    // Never served at all: the dimmest thing on the page, and the only one with no
    // border tint, because there is nothing to look at.
    case "skipped": return "bg-gray-100 text-gray-600 border-gray-200";
  }
}
