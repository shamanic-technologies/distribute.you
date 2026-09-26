/**
 * A PERSON's campaigns, nested the way the product sells them: offer > campaign.
 *
 * The cards come from lead-service, which serves them on the row under `?include=campaigns`
 * (v0.67.0). They are NOT grouped out of the rows here, and that distinction is the whole
 * reason this file exists: a brand-scoped read answers ONE ROW PER PERSON
 * (`DISTINCT ON (lead_id)`), so grouping rows can only ever produce one card however many
 * campaigns the person is really in. The database holds 11 for one sampled person; the
 * endpoint returns 1. 56,809 people fleet-wide sit in more than one campaign.
 *
 * Everything a campaign decided about a person (which audience picked them, which offer
 * they were contacted for, what was sent and what came back) belongs UNDER the campaign
 * that decided it.
 *
 * ALIAS-FREE on purpose, so this carries real unit tests: every input is structural and
 * nothing is imported. It DERIVES nothing: grouping is on the offer the card carries.
 */

/** The card fields this module reads. Structural, never the api.ts `LeadCampaignEvidence`. */
export interface LeadCampaignCardLike {
  /** The `leads_campaigns` row this card speaks for. Unique per card, so it is the key. */
  id: string;
  campaignId: string;
  audienceId?: string | null;
  offer?: { id: string; name: string | null } | null;
}

/** What the caller can say about the campaign a card names. Every field optional: a
 *  campaign the campaigns read has not returned (or has not settled) is still a real
 *  campaign this person was contacted by. */
export interface CampaignInfo {
  featureSlug?: string | null;
  legKey?: string | null;
  status?: string | null;
}

export interface LeadCampaignNode<C extends LeadCampaignCardLike = LeadCampaignCardLike> {
  /** The `leads_campaigns` row id — unique per card and the React key. */
  rowId: string;
  campaignId: string;
  info: CampaignInfo | null;
  card: C;
}

export interface LeadOfferNode<C extends LeadCampaignCardLike = LeadCampaignCardLike> {
  offerId: string | null;
  offerName: string | null;
  campaigns: LeadCampaignNode<C>[];
}

export interface LeadCampaignTree<C extends LeadCampaignCardLike = LeadCampaignCardLike> {
  offers: LeadOfferNode<C>[];
  /** Every campaign card the tree will draw, across every band. */
  campaignCount: number;
  /** Distinct audiences across the whole tree — what the table's Audience column has to
   *  state for a person several campaigns picked for different reasons. */
  audienceCount: number;
}

/**
 * Group a person's served campaign cards into offer > campaign.
 *
 * `campaignInfoOf` answers what the caller knows about a campaign id. It is a lookup,
 * never a fetch: the campaigns read the page already polls is what fills it.
 */
export function buildLeadCampaignTree<C extends LeadCampaignCardLike>(
  cards: readonly C[],
  campaignInfoOf: (campaignId: string) => CampaignInfo | null,
): LeadCampaignTree<C> {
  const offers: LeadOfferNode<C>[] = [];
  const offerIndex = new Map<string, LeadOfferNode<C>>();
  const seen = new Set<string>();
  const audienceIds = new Set<string>();
  let campaignCount = 0;

  for (const card of cards) {
    // One card per membership row. lead-service already emits one per campaign; guarding
    // it means a producer that ever relaxes that cannot silently double every card.
    if (seen.has(card.id)) continue;
    seen.add(card.id);

    const offerId = card.offer?.id ?? null;
    const offerKey = offerId ?? " no-offer";
    let offerNode = offerIndex.get(offerKey);
    if (!offerNode) {
      offerNode = { offerId, offerName: card.offer?.name ?? null, campaigns: [] };
      offerIndex.set(offerKey, offerNode);
      offers.push(offerNode);
    }

    if (card.audienceId) audienceIds.add(card.audienceId);
    offerNode.campaigns.push({
      rowId: card.id,
      campaignId: card.campaignId,
      info: campaignInfoOf(card.campaignId),
      card,
    });
    campaignCount += 1;
  }

  return { offers, campaignCount, audienceCount: audienceIds.size };
}

/** The first card of the tree in render order — what a panel opens by default, so a
 *  person in one campaign never has to click to see anything. Null for an empty tree. */
export function firstCampaignRowId(tree: LeadCampaignTree): string | null {
  return firstCampaignNode(tree)?.rowId ?? null;
}

/**
 * WHICH levels of the hierarchy every one of a person's campaigns agrees on.
 *
 * The panel states the AGREED part as its own stacked cards — Brand, then Offer, then
 * (when there is only one campaign) Leg, Channel and Audience — and lists only what
 * varies underneath.
 *
 * DERIVED FROM THE CARDS, never from the route: the rows an offer-scoped page receives
 * are the BRAND's (lead-service does not filter by offer), so a person listed on an offer
 * page routinely carries campaigns of another offer.
 */
export interface LeadPanelScope<C extends LeadCampaignCardLike = LeadCampaignCardLike> {
  /** The one offer every card names, or null when they differ or none is stated. */
  offer: { id: string; name: string | null } | null;
  /** The single card, when the person has exactly one campaign — the only case in
   *  which the leg, the channel and the audience are facts about the PERSON. */
  sole: LeadCampaignNode<C> | null;
}

export function leadPanelScope<C extends LeadCampaignCardLike>(
  tree: LeadCampaignTree<C>,
): LeadPanelScope<C> {
  const onlyOffer = tree.offers.length === 1 ? tree.offers[0] : null;
  // An offer lead-service could not resolve is NOT an agreed offer: `null` there means
  // "we could not say" as often as "there is none".
  const offer =
    onlyOffer && onlyOffer.offerId
      ? { id: onlyOffer.offerId, name: onlyOffer.offerName }
      : null;
  const sole = tree.campaignCount === 1 ? firstCampaignNode(tree) : null;
  return { offer, sole };
}

/** The first card in render order, as a node. */
export function firstCampaignNode<C extends LeadCampaignCardLike>(
  tree: LeadCampaignTree<C>,
): LeadCampaignNode<C> | null {
  for (const offer of tree.offers) {
    const first = offer.campaigns[0];
    if (first) return first;
  }
  return null;
}
