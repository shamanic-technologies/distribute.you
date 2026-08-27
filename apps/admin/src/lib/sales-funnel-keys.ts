// The sales funnels a campaign can sell, in the vocabulary every service now speaks.
//
// A campaign runs ONE sales funnel: it is paced on that funnel's own daily ceiling in
// billing and priced on that funnel's own economics, so campaign-service refuses to
// create a sales campaign that states none. Nothing derives it from the goal — that
// translation was deleted fleet-wide, because the goal is the poorer word (a meeting
// won from a reply and one won on the website read as the same goal).
//
// Staff STATE the funnel when they create a sales campaign here, the same way the
// customer states it by funding it. A feature that sells through no sales funnel
// (PR, hiring, VC, AI visibility) states none.
//
// Alias-free so it carries real unit tests.

export const SALES_FUNNEL_KEYS = [
  "sales_meetings_from_conversation",
  "sales_meetings_from_website",
  "website_purchases",
  "form_magnet",
] as const;

export type SalesFunnelKey = (typeof SALES_FUNNEL_KEYS)[number];

/** What each funnel is called, and the steps it runs. */
const SALES_FUNNEL_LABELS: Record<SalesFunnelKey, string> = {
  sales_meetings_from_conversation: "Sales Meeting from Conversation",
  sales_meetings_from_website: "Sales Meeting from Website",
  website_purchases: "Website Purchase",
  form_magnet: "Form Magnet",
};

/** The name a person reads for a funnel key, or the raw key when it names none of ours. */
export function salesFunnelLabel(key: string): string {
  return SALES_FUNNEL_LABELS[key as SalesFunnelKey] ?? key;
}

/** True when a value names one of the four funnels. */
export function isSalesFunnelKey(value: string | null | undefined): value is SalesFunnelKey {
  return !!value && (SALES_FUNNEL_KEYS as readonly string[]).includes(value);
}
