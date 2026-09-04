/**
 * A PERSON's campaigns, nested the way the product sells them: offer > funnel > campaign.
 *
 * The cards come from lead-service, which serves them on the row under `?include=campaigns`
 * (v0.67.0). They are NOT grouped out of the rows here, and that distinction is the whole
 * reason this file exists twice: a brand-scoped read answers ONE ROW PER PERSON
 * (`DISTINCT ON (lead_id)`), so grouping rows can only ever produce one card however many
 * campaigns the person is really in. The database holds 11 for one sampled person; the
 * endpoint returns 1. 56,809 people fleet-wide sit in more than one campaign.
 *
 * Everything a campaign decided about a person (which audience picked them, which offer
 * they were contacted for, what was sent and what came back) belongs UNDER the campaign
 * that decided it. Opening one row and stating one audience presents one campaign's
 * answer as the person's.
 *
 * ALIAS-FREE on purpose, so this carries real unit tests rather than a source-substring
 * guard: every input is structural and nothing is imported. Keep it that way — a runtime
 * `@/...` import turns `tests/lead-campaign-tree.test.ts` into resolution failures.
 *
 * It DERIVES nothing. Grouping is on values the card already carries (its own offer, and
 * the funnel of the campaign it names), and ordering is the caller's.
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
 *  campaign this person was contacted by, and dropping its card would hide a fact
 *  lead-service just took the trouble to serve. */
export interface CampaignInfo {
  funnelKey?: string | null;
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

export interface LeadFunnelNode<C extends LeadCampaignCardLike = LeadCampaignCardLike> {
  /** Normalized funnel key, or null when the campaign states none (a campaign created
   *  before the funnel model) or the campaigns read has not answered for it. */
  funnelKey: string | null;
  campaigns: LeadCampaignNode<C>[];
}

export interface LeadOfferNode<C extends LeadCampaignCardLike = LeadCampaignCardLike> {
  offerId: string | null;
  offerName: string | null;
  funnels: LeadFunnelNode<C>[];
}

export interface LeadCampaignTree<C extends LeadCampaignCardLike = LeadCampaignCardLike> {
  offers: LeadOfferNode<C>[];
  /** Every campaign card the tree will draw, across every band. */
  campaignCount: number;
  /** Bands render only when they DISAMBIGUATE. One funnel across the whole tree means
   *  the funnel band names something the campaign card's own leg line already says, and
   *  a header over a set of one states nothing. */
  showFunnels: boolean;
  /** Distinct audiences across the whole tree — what the table's Audience column has to
   *  state for a person several campaigns picked for different reasons. */
  audienceCount: number;
}

/**
 * Group a person's served campaign cards into offer > funnel > campaign.
 *
 * `campaignInfoOf` answers what the caller knows about a campaign id. It is a lookup,
 * never a fetch: the campaigns read the page already polls is what fills it, so nesting
 * a panel costs no request.
 *
 * `normalizeFunnelKey` is passed in for the same reason the module is alias-free — the
 * wire carries two spellings of every funnel and the normalizer lives behind the alias.
 * Absent, keys group verbatim.
 */
export function buildLeadCampaignTree<C extends LeadCampaignCardLike>(
  cards: readonly C[],
  campaignInfoOf: (campaignId: string) => CampaignInfo | null,
  normalizeFunnelKey?: (key: string) => string,
): LeadCampaignTree<C> {
  const norm = (key: string | null | undefined): string | null =>
    key ? (normalizeFunnelKey ? normalizeFunnelKey(key) : key) : null;

  const offers: LeadOfferNode<C>[] = [];
  const offerIndex = new Map<string, LeadOfferNode<C>>();
  const funnelIndex = new Map<string, LeadFunnelNode<C>>();
  const seen = new Set<string>();
  const funnelKeys = new Set<string>();
  const audienceIds = new Set<string>();
  let campaignCount = 0;

  for (const card of cards) {
    // One card per membership row. lead-service already emits one per campaign, so a
    // collision is impossible today; guarding it means a producer that ever relaxes that
    // cannot silently double every card.
    if (seen.has(card.id)) continue;
    seen.add(card.id);

    const offerId = card.offer?.id ?? null;
    const offerKey = offerId ?? " no-offer";
    let offerNode = offerIndex.get(offerKey);
    if (!offerNode) {
      offerNode = { offerId, offerName: card.offer?.name ?? null, funnels: [] };
      offerIndex.set(offerKey, offerNode);
      offers.push(offerNode);
    }

    const info = campaignInfoOf(card.campaignId);
    const funnelKey = norm(info?.funnelKey);
    if (funnelKey) funnelKeys.add(funnelKey);
    const funnelSlot = `${offerKey} ${funnelKey ?? " no-funnel"}`;
    let funnelNode = funnelIndex.get(funnelSlot);
    if (!funnelNode) {
      funnelNode = { funnelKey, campaigns: [] };
      funnelIndex.set(funnelSlot, funnelNode);
      offerNode.funnels.push(funnelNode);
    }

    if (card.audienceId) audienceIds.add(card.audienceId);
    funnelNode.campaigns.push({
      rowId: card.id,
      campaignId: card.campaignId,
      info,
      card,
    });
    campaignCount += 1;
  }

  return {
    offers,
    campaignCount,
    // A campaign stating NO funnel is not a second funnel — it is one we could not
    // name. Counting it would draw a band over a single real funnel and a blank one.
    showFunnels: funnelKeys.size > 1,
    audienceCount: audienceIds.size,
  };
}

/** The first card of the tree in render order — what a panel opens by default, so a
 *  person in one campaign never has to click to see anything. Null for an empty tree. */
export function firstCampaignRowId(tree: LeadCampaignTree): string | null {
  for (const offer of tree.offers) {
    for (const funnel of offer.funnels) {
      const first = funnel.campaigns[0];
      if (first) return first.rowId;
    }
  }
  return null;
}

/**
 * WHICH levels of the hierarchy every one of a person's campaigns agrees on.
 *
 * The panel states the AGREED part as its own stacked cards — Brand, then Offer, then
 * Funnel, then (when there is only one campaign) Leg, Channel and Audience — and lists
 * only what varies underneath. So a campaign-scoped panel reads as six cards one above
 * another, a funnel-scoped one as three cards over a list of leg x channel, and a
 * brand-scoped one as one card over the whole nest.
 *
 * DERIVED FROM THE CARDS, never from the route, and that is the load-bearing half. The
 * rows a funnel- or offer-scoped page receives are the BRAND's (lead-service filters
 * neither), so a person listed on a funnel page routinely carries campaigns of another
 * funnel. Stating the route's funnel as a fact about them would be false; stating what
 * their own cards agree on never is, and in the ordinary case the two coincide.
 *
 * CASCADING: a level is agreed only when every level above it is. An offer that varies
 * makes "one funnel" meaningless, so the walk stops at the first disagreement.
 */
export interface LeadPanelScope<C extends LeadCampaignCardLike = LeadCampaignCardLike> {
  /** The one offer every card names, or null when they differ or none is stated. */
  offer: { id: string; name: string | null } | null;
  /** The one funnel, or null. Requires the offer to be agreed first. */
  funnelKey: string | null;
  /** The single card, when the person has exactly one campaign — the only case in
   *  which the leg, the channel and the audience are facts about the PERSON rather
   *  than about one of several campaigns. */
  sole: LeadCampaignNode<C> | null;
}

export function leadPanelScope<C extends LeadCampaignCardLike>(
  tree: LeadCampaignTree<C>,
): LeadPanelScope<C> {
  const onlyOffer = tree.offers.length === 1 ? tree.offers[0] : null;
  // An offer lead-service could not resolve is NOT an agreed offer: `null` there means
  // "we could not say" as often as "there is none", and a card stating an unnamed offer
  // asserts the second.
  const offer =
    onlyOffer && onlyOffer.offerId
      ? { id: onlyOffer.offerId, name: onlyOffer.offerName }
      : null;
  const onlyFunnel = offer && onlyOffer && onlyOffer.funnels.length === 1 ? onlyOffer.funnels[0] : null;
  const funnelKey = onlyFunnel?.funnelKey ?? null;
  const sole = tree.campaignCount === 1 ? firstCampaignNode(tree) : null;
  return { offer, funnelKey, sole };
}

/** The first card in render order, as a node. */
export function firstCampaignNode<C extends LeadCampaignCardLike>(
  tree: LeadCampaignTree<C>,
): LeadCampaignNode<C> | null {
  for (const offer of tree.offers) {
    for (const funnel of offer.funnels) {
      const first = funnel.campaigns[0];
      if (first) return first;
    }
  }
  return null;
}
