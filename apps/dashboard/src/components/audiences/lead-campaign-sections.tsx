"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { AudienceWire } from "@/lib/api";
import { tenantBasePath } from "@/lib/offer-path";
import { OfferMark } from "@/components/marks/offer-mark";
import { CampaignIdentity } from "@/components/campaigns/campaign-identity";
import { SALES_FUNNELS } from "@/lib/sales-funnels";
import type { LeadCampaignNode, LeadCampaignTree, LeadOfferNode } from "@/lib/lead-campaign-tree";

/**
 * A PERSON's campaigns in the lead panel, nested offer > funnel > campaign, with
 * everything a campaign decided about them sitting UNDER that campaign.
 *
 * A lead row is a `(person x campaign)` row, so one person routinely has several — 11
 * campaign identities across 9 offers for one sampled production lead. The panel used
 * to open ONE of those rows and state its offer and its audience as if they were the
 * person's, which is a campaign's answer wearing the person's name.
 *
 * The AUDIENCE lives inside its campaign card because that is where it was decided:
 * lead-service stores the attribution on the `leads_campaigns` row, so two campaigns
 * genuinely picked this person for two different reasons and a single card can only
 * state one of them.
 *
 * The TIMELINE deliberately does NOT nest here yet, and that is a wire fact rather
 * than a layout choice: lead-service flattens delivery evidence brand-wide on a
 * brand-scoped read, and the by-lead email read answers with one generation for a
 * person who has one per campaign (5,539 leads carry two or more). Nesting it today
 * would print byte-identical rows under every card. It moves inside once both
 * producers answer per campaign — see the two spawned changes.
 */

/** Bands render only when they DISAMBIGUATE — a header over a set of one states
 *  nothing, and the campaign card's own leg line already names its funnel. */
export function LeadCampaignSections({
  tree,
  audienceFullOf,
}: {
  tree: LeadCampaignTree;
  /** The human-service audience row for an id, for the description only. Null while the
   *  lookup is in flight or when the audience was archived away. */
  audienceFullOf: (audienceId: string) => AudienceWire | null;
}) {
  if (tree.campaignCount === 0) return null;
  const many = tree.campaignCount > 1;
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
        {many ? `Campaigns (${tree.campaignCount})` : "Campaign"}
      </h3>
      <div className="space-y-4">
        {tree.offers.map((offer) => (
          <OfferBand
            key={offer.offerId ?? "no-offer"}
            offer={offer}
            showFunnels={tree.showFunnels}
            audienceFullOf={audienceFullOf}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * The offer this person was contacted to be sold, above the campaigns that sold it.
 *
 * Always drawn, even for a single offer: unlike the funnel, nothing inside the card
 * names the proposition, so dropping the band at one would lose a fact rather than
 * remove a repetition.
 *
 * A row whose offer lead-service could not resolve renders the band with no name and
 * no link rather than being hidden — the campaigns under it are real, and lead-service
 * is fail-soft here, so an absent offer means "we could not say" as often as "there is
 * none".
 */
function OfferBand({
  offer,
  showFunnels,
  audienceFullOf,
}: {
  offer: LeadOfferNode;
  showFunnels: boolean;
  audienceFullOf: (audienceId: string) => AudienceWire | null;
}) {
  const params = useParams();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  return (
    <div>
      {/* The mark leads the name here exactly as it does in the top bar, the tenant
          switcher, the Offers table and the leads table's own Offer column — an offer
          wears one mark on every surface that names one. */}
      <div className="flex min-w-0 items-center gap-2">
        <OfferMark size="sm" />
        <p className="truncate text-sm font-medium text-gray-800">
          {offer.offerName ?? <span className="text-gray-500">Unnamed offer</span>}
        </p>
        {offer.offerId && (
          <Link
            href={`/orgs/${orgId}/brands/${brandId}/offers/${offer.offerId}`}
            className="ml-auto shrink-0 text-xs text-brand-600 hover:text-brand-700 hover:underline"
          >
            View offer
          </Link>
        )}
      </div>
      {/* A 1px neutral rail, the same connector idiom the tenant switcher uses to draw
          a child under its parent. Indent alone is not hierarchy, and a colored side
          accent above 1px is banned repo-wide. */}
      <div className="mt-2 ml-3 space-y-3 border-l border-gray-200 pl-3">
        {offer.funnels.map((funnel) => (
          <div key={funnel.funnelKey ?? "no-funnel"}>
            {showFunnels && (
              <p className="mb-2 text-xs font-medium text-gray-500">
                {SALES_FUNNELS.find((f) => f.key === funnel.funnelKey)?.name ?? "Funnel not stated"}
              </p>
            )}
            <div className="space-y-3">
              {funnel.campaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.rowId}
                  campaign={campaign}
                  audienceFullOf={audienceFullOf}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * ONE campaign, named the way every other surface names one, holding what it decided.
 *
 * `CampaignIdentity` is the shared vocabulary — the leg it buys, then the channel it
 * buys it through — so a campaign cannot read one way here and another way in the
 * Campaigns table or the budget modal.
 */
function CampaignCard({
  campaign,
  audienceFullOf,
}: {
  campaign: LeadCampaignNode;
  audienceFullOf: (audienceId: string) => AudienceWire | null;
}) {
  const funnel =
    SALES_FUNNELS.find((f) => f.key === campaign.info?.funnelKey) ?? null;
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <CampaignIdentity
        funnel={funnel}
        featureSlug={campaign.info?.featureSlug ?? null}
        legKey={campaign.info?.legKey ?? null}
      />
      {campaign.audience ? (
        <AudienceRow
          inline={campaign.audience}
          full={audienceFullOf(campaign.audience.id)}
        />
      ) : (
        /* Attributed to no audience. Stated rather than hidden: an empty card under a
           campaign that really contacted this person reads as a rendering gap, while
           "no audience" is a real answer lead-service gives for a lead served before
           the attribution existed. */
        <p className="mt-3 border-t border-gray-200 pt-3 text-sm text-gray-500">
          No audience attributed
        </p>
      )}
    </div>
  );
}

/**
 * WHICH saved audience this campaign picked the person for.
 *
 * `inline` = the `{id,name,avatarUrl}` served on the lead row (always present when
 * attributed); `full` = the matching human-service audience row looked up by id
 * (description only), null until `listAudiences` resolves or when the audience was
 * archived away.
 *
 * Size / remaining-to-contact deliberately do NOT live here: the Audiences page owns
 * every audience number and the targeting filters. The link carries `?audienceId=`,
 * the deep-link seed `CustomerAudiencesPage` reads on first paint, so that audience's
 * detail panel opens with its colored targeting tags.
 */
function AudienceRow({
  inline,
  full,
}: {
  inline: { id: string; name: string; avatarUrl: string | null };
  full: AudienceWire | null;
}) {
  const params = useParams();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  // Present on the offer and campaign routes, absent on the brand one.
  const routeOfferId = params.offerId as string | undefined;
  // An audience's page lives under the OFFER it was assembled for, so the link is
  // built from the AUDIENCE's own `offerId` — not from whichever route the reader
  // happens to be on. Building it from the route sent every brand-level reader to
  // `/brands/:id/audiences`, a path that does not exist (audiences moved down to
  // the offer), so the card's one affordance was a 404 on the brand Leads page.
  // The route id stays as the fallback for the case the lookup misses (an audience
  // archived out of the list): inside an offer, that offer's page is the right one.
  const audienceOfferId = full?.offerId ?? routeOfferId ?? null;
  // No offer resolvable ⟹ NO link. Some audiences predate the offer level and are
  // filed under none, so there is no page to open; a link to a 404 is worse than a
  // row that simply states the audience. Same render while the lookup is in flight —
  // we do not claim either way before we know.
  const detailHref = audienceOfferId
    ? `${tenantBasePath(orgId, brandId, audienceOfferId)}/audiences?audienceId=${inline.id}`
    : null;
  const avatarUrl = inline.avatarUrl ?? full?.avatarUrl ?? null;
  const description = full?.description ?? null;
  return (
    <div className="mt-3 border-t border-gray-200 pt-3">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-400">Audience</p>
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="h-9 w-9 shrink-0 rounded border border-gray-200 bg-white object-cover"
            loading="lazy"
          />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-brand-100 text-sm font-semibold text-brand-700">
            {inline.name.charAt(0).toUpperCase()}
          </span>
        )}
        <p className="text-sm font-medium text-gray-800">{inline.name}</p>
      </div>
      {description && <p className="mt-2 text-sm text-gray-600">{description}</p>}
      {detailHref && (
        <Link
          href={detailHref}
          className="mt-3 inline-block text-sm text-brand-600 hover:text-brand-700 hover:underline"
        >
          View audience details
        </Link>
      )}
    </div>
  );
}
