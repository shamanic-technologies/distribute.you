import type { LeadTab, OutcomeTab } from "@/lib/goal-steps";
import type { SalesFunnelKey } from "@/lib/sales-funnels";

/**
 * Which lead tabs a SALES FUNNEL implies, and in what order they read.
 *
 * A brand runs several funnels at once, so its Leads page shows the UNION of the tabs
 * of the funnels its ACTIVE campaigns sell — not the tabs of a single goal. That
 * matters twice over: the retired brand goal is a server-defaulted column that says
 * "website purchases" for a brand that chose nothing, and it could not tell the two
 * meeting funnels apart anyway (both echo `meetingBooked`), so a brand booking
 * meetings off replies was shown a Website-visits tab it never buys.
 *
 * The tabs are stated per funnel rather than matched out of the catalogue's chain
 * strings: those are display copy, and keying behaviour on them means a comma in a
 * label silently changes which tabs a customer sees.
 */

/** The engagement tabs a funnel's chain passes through, before its outcome. */
interface FunnelTabs {
  /** Delivery/engagement steps that carry a per-lead flag. `outreach` is universal and
   *  therefore not listed here — every contacted lead is in it whatever the funnel. */
  engagement: LeadTab[];
  /** Tracked outcome steps of this funnel's own chain. Each still has to be SERVED by
   *  the `/revenue` join before it renders; this says which ones belong. */
  outcomes: OutcomeTab[];
}

const FUNNEL_TABS: Record<SalesFunnelKey, FunnelTabs> = {
  // Positive reply → Meeting booked → Meeting attended → Paid client.
  reply_meeting: { engagement: ["positive-replies"], outcomes: ["meetings"] },
  // Website visit → Meeting booked → Meeting attended → Paid client.
  visit_meeting: { engagement: ["clicks"], outcomes: ["meetings"] },
  // Website visit → Signup → Paid client. BOTH middle and terminal steps are tracked
  // outcomes with tabs of their own, so both belong to this funnel.
  visit_signup: { engagement: ["clicks"], outcomes: ["signups", "sales"] },
  // Website visit → Form filled → Paid client.
  visit_form: { engagement: ["clicks"], outcomes: ["form-submissions"] },
};

/**
 * Canonical left-to-right order: the most advanced outcome first, `outreach` last.
 *
 * ONE list, so a union assembled from any set of funnels always reads the same way —
 * a page whose tab order depended on which campaign happened to be created first
 * would look different to two brands running the same funnels.
 */
const TAB_ORDER: readonly (LeadTab | OutcomeTab)[] = [
  "sales",
  "meetings",
  "signups",
  "form-submissions",
  "positive-replies",
  "clicks",
  "outreach",
];

function orderOf(tab: LeadTab | OutcomeTab): number {
  const at = TAB_ORDER.indexOf(tab);
  // An unknown tab sorts last rather than first: a tab we have no opinion about must
  // not displace the outcome the page exists to show.
  return at === -1 ? TAB_ORDER.length : at;
}

/**
 * The union of the tabs implied by `funnelKeys` — the funnels a brand's ACTIVE
 * campaigns sell.
 *
 * `outreach` is always present and always last. It is the honest floor: every lead we
 * contacted is in it whatever the funnel, so a brand with no active campaign still has
 * one truthful tab rather than an empty page.
 */
export function funnelLeadTabs(funnelKeys: readonly SalesFunnelKey[]): {
  engagement: LeadTab[];
  outcomes: OutcomeTab[];
} {
  const engagement = new Set<LeadTab>(["outreach"]);
  const outcomes = new Set<OutcomeTab>();
  for (const key of funnelKeys) {
    const tabs = FUNNEL_TABS[key];
    if (!tabs) continue;
    for (const tab of tabs.engagement) engagement.add(tab);
    for (const tab of tabs.outcomes) outcomes.add(tab);
  }
  return {
    engagement: [...engagement].sort((a, b) => orderOf(a) - orderOf(b)),
    outcomes: [...outcomes].sort((a, b) => orderOf(a) - orderOf(b)),
  };
}
