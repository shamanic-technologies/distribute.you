/**
 * What we assembled, stated back before anyone is asked to pay.
 *
 * This is the screen the whole reorder exists for: a visitor typed a website
 * ten minutes ago and has since watched us read their site, name their
 * services, pick the outcomes they want, say who they sell to and draft
 * their offer. Asking for a card before showing them any of it is what
 * this replaces.
 *
 * So the one rule here is that it states what is TRUE. A section with nothing
 * in it is DROPPED, never rendered empty and never filled with a placeholder:
 * an empty target-audience block or a services row showing a spinner
 * that never resolves is worse than a shorter summary, because the visitor is
 * about to decide whether we are worth paying on exactly this evidence.
 *
 * Alias-free so it carries real unit tests. The caller resolves every display
 * string (leg labels, channel names, lever titles) from the catalogues that own
 * them and hands them over already resolved — this module names nothing of its
 * own, so it cannot drift from the vocabulary the rest of the flow uses.
 */

/** One campaign we will run: a leg, through a channel. */
export interface BuiltCampaign {
  key: string;
  /** The leg in the customer's words ("Positive reply", "Positive reply → Meeting booked"). */
  label: string;
  /** The channel that performs it. */
  channelName: string;
}


export interface BuiltLever {
  key: string;
  /** What the lever is called on the screen that asked for it. */
  label: string;
  value: string;
}

export interface BuiltInput {
  services: string[];
  campaigns: BuiltCampaign[];
  /**
   * Who the customer sells to, in their own words. NOT a list of audiences:
   * those are built by hand after payment, from exactly this text.
   */
  targetAudience?: string | null;
  levers: BuiltLever[];
}

export type BuiltSection =
  | { kind: "services"; items: string[] }
  | { kind: "campaigns"; items: BuiltCampaign[] }
  | { kind: "targetAudience"; text: string }
  | { kind: "offer"; items: BuiltLever[] };

/**
 * The order the sections read in, and it is the order they were BUILT in — what
 * you sell, how you sell it, who we will say it to, and how we will say it. A
 * visitor recognises their own ten minutes in that sequence; any other order
 * reads as a report about them rather than a recap of what they just did.
 */
export interface BuiltSummary {
  sections: BuiltSection[];
  /** Nothing to show. The caller states that rather than rendering a blank card. */
  isEmpty: boolean;
}

/** A lever with no answer is not a lever we drafted, so it is not shown. */
const filled = (l: BuiltLever): boolean => typeof l.value === "string" && l.value.trim().length > 0;

const clean = (s: string): boolean => typeof s === "string" && s.trim().length > 0;

export function builtSummary(input: BuiltInput): BuiltSummary {
  const services = (input.services ?? []).filter(clean);
  const campaigns = (input.campaigns ?? []).filter((c) => c && clean(c.label));
  const targetAudience = typeof input.targetAudience === "string" ? input.targetAudience.trim() : "";
  const levers = (input.levers ?? []).filter((l) => l && filled(l));

  const sections: BuiltSection[] = [];
  if (services.length > 0) sections.push({ kind: "services", items: services });
  if (campaigns.length > 0) sections.push({ kind: "campaigns", items: campaigns });
  if (targetAudience) sections.push({ kind: "targetAudience", text: targetAudience });
  if (levers.length > 0) sections.push({ kind: "offer", items: levers });

  return { sections, isEmpty: sections.length === 0 };
}

/**
 * The line under the heading.
 *
 * States the COUNTS the visitor can check against the sections below it, and
 * nothing else — no adjectives, no claim about quality, and no figure we have
 * not measured. `null` when there is nothing to count, so the caller drops the
 * line rather than printing a sentence with zeroes in it.
 */
export function builtSubtitle(summary: BuiltSummary): string | null {
  const parts: string[] = [];
  for (const s of summary.sections) {
    // The target audience is prose, not a quantity: nothing to count.
    if (s.kind === "targetAudience") continue;
    const n = s.items.length;
    if (s.kind === "services") parts.push(`${n} ${n === 1 ? "service" : "services"}`);
    if (s.kind === "campaigns") parts.push(`${n} ${n === 1 ? "campaign" : "campaigns"}`);
  }
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
