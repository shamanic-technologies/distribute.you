// What a campaign is CALLED, on every surface that names one.
//
// campaign-service stores a `name` on the row, written when the campaign was
// provisioned. It is stale by construction: it predates the per-funnel model, so
// it says nothing about the funnel the campaign runs nor the channel it runs on
// — the two facts that actually distinguish one campaign from another under the
// same brand. A title is therefore COMPOSED from those two, in the words brand
// Settings already uses: the funnel it buys, then the channel it buys through.
//
// One helper, used by the Overview heading, the top-bar context and the table's
// two columns, so a campaign cannot read as one thing on the page you opened and
// another in the row you clicked.
//
// Only relative value imports live here, so this module stays directly
// unit-testable (vitest does not resolve the "@" alias). The `@/lib/api` import
// is type-only and erases at compile time.

import type { BrandOptimizationGoal } from "@/lib/api";
import {
  acquisitionChannelForWorkflowSlug,
  type AcquisitionChannelDef,
} from "./acquisition-channels";
import { campaignFunnel, type CampaignFunnelRow } from "./campaign-funnel";
import { primaryFunnelForGoal, type SalesFunnelDef } from "./sales-funnels";

/** The fields a title reads off a campaign row. */
export interface CampaignTitleRow extends CampaignFunnelRow {
  /** campaign-service's stored name. Read ONLY when neither half resolves. */
  name: string;
  /** A campaign has no channel field — its workflow IS the channel. */
  workflowSlug: string | null;
}

/**
 * A workflow slug we carry no channel for, prettified.
 *
 * Named as the slug spells itself rather than as a channel we do not carry: an
 * invented channel name is worse than the raw one, because the catalogue is what
 * every other surface reads.
 */
export function channelSlugLabel(workflowSlug: string | null): string {
  if (!workflowSlug) return "—";
  return workflowSlug
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Fallback outcome word for a pre-funnel campaign whose inherited brand goal no
 * funnel in the catalogue ends on. A campaign that names its own funnel never
 * reads this.
 */
export const GOAL_SHORT: Record<BrandOptimizationGoal, string> = {
  signups: "Signups",
  sales_meetings: "Positive Replies",
  positive_replies: "Positive Replies",
  website_visits: "Website Visits",
  form_submissions: "Form Submissions",
  website_purchase: "Purchases",
  sales: "Sales",
};

export interface CampaignTitleParts {
  /** The funnel's catalogue entry, or null when nothing in it ends on the goal. */
  funnel: SalesFunnelDef | null;
  /** The channel's catalogue entry, or null for a slug the catalogue misses. */
  channel: AcquisitionChannelDef | null;
  /** What the funnel half reads. Null when there is nothing honest to say. */
  funnelLabel: string | null;
  /** What the channel half reads. Null when the campaign carries no workflow. */
  channelLabel: string | null;
  /**
   * The whole title, one string.
   *
   * `<funnel> · <channel>` when both halves resolve, one half when only one
   * does, and campaign-service's stored name when NEITHER does — a campaign we
   * can say nothing composed about keeps whatever name it was given rather than
   * rendering an em-dash where its identity should be.
   */
  label: string;
}

/**
 * The funnel × channel a campaign runs, resolved for display.
 *
 * `fallbackGoal` is the effective goal (the campaign's own when set, else the
 * brand's) and is READ ONLY when the campaign carries no funnel key of its own —
 * a lossy fallback, since two funnels share `meetingBooked`. Pass null where no
 * goal is in hand (the top bar fetches one campaign and no brand), and the funnel
 * half simply goes unstated instead of guessed.
 */
export function campaignTitleParts(
  campaign: CampaignTitleRow,
  fallbackGoal: BrandOptimizationGoal | null,
): CampaignTitleParts {
  const funnel = campaignFunnel(campaign.funnelKey) ?? (fallbackGoal ? primaryFunnelForGoal(fallbackGoal) : null);
  const channel = acquisitionChannelForWorkflowSlug(campaign.workflowSlug);

  const funnelLabel = funnel ? funnel.name : fallbackGoal ? GOAL_SHORT[fallbackGoal] : null;
  const channelLabel = campaign.workflowSlug
    ? (channel?.name ?? channelSlugLabel(campaign.workflowSlug))
    : null;

  const halves = [funnelLabel, channelLabel].filter((h): h is string => h !== null);
  return {
    funnel,
    channel,
    funnelLabel,
    channelLabel,
    label: halves.length > 0 ? halves.join(" · ") : campaign.name,
  };
}
