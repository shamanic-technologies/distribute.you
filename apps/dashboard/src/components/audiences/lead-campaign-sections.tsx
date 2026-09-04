"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { tenantBasePath } from "@/lib/offer-path";
import { OfferMark } from "@/components/marks/offer-mark";
import { CampaignIdentity } from "@/components/campaigns/campaign-identity";
import { SALES_FUNNELS } from "@/lib/sales-funnels";
import type {
  LeadCampaignCardLike,
  LeadCampaignNode,
  LeadCampaignTree,
  LeadOfferNode,
} from "@/lib/lead-campaign-tree";

/**
 * A PERSON's campaigns in the lead panel, nested offer > funnel > campaign, with
 * everything a campaign decided about them sitting UNDER that campaign.
 *
 * The cards are lead-service's own (`?include=campaigns`), not a grouping of rows: a
 * brand-scoped read answers one row per person, so grouping rows draws one card however
 * many campaigns the person is really in.
 *
 * ONE CARD IS OPEN AT A TIME, and that is not only a space decision. The open card is
 * what the page fetches an email for, so several open cards would be several requests
 * for a panel nobody has finished reading; and eleven full timelines stacked in a 480px
 * sheet is a wall rather than an answer. The first card opens by default, so a person in
 * one campaign never has to click to see anything.
 *
 * The AUDIENCE and the TIMELINE both live inside the card because that is where they
 * were decided: lead-service stores the audience on the membership row and now answers
 * the delivery evidence per campaign, and content-generation-service answers the email
 * per campaign. Two campaigns genuinely picked this person for two different reasons and
 * sent them two different messages.
 */

/** What the panel needs to draw an audience, whatever it could resolve about one. */
export interface LeadCampaignAudience {
  id: string;
  /** Null when the audience is not in the brand's list (archived away, or still
   *  loading). The card then states the attribution without naming it, rather than
   *  hiding a real fact behind a missing label. */
  name: string | null;
  avatarUrl: string | null;
  description: string | null;
  /** The audience's OWN offer, which is where its page lives. */
  offerId: string | null;
}

export function LeadCampaignSections<C extends LeadCampaignCardLike>({
  tree,
  audienceFor,
  openRowId,
  onToggle,
  renderDetail,
}: {
  tree: LeadCampaignTree<C>;
  audienceFor: (card: C) => LeadCampaignAudience | null;
  /** The one open card, or null when the reader closed it. */
  openRowId: string | null;
  onToggle: (rowId: string) => void;
  /** What the open card shows below its audience — the timeline of THAT campaign. The
   *  page renders it, because it owns the read that fetches that campaign's email. */
  renderDetail: (node: LeadCampaignNode<C>) => ReactNode;
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
            collapsible={many}
            audienceFor={audienceFor}
            openRowId={openRowId}
            onToggle={onToggle}
            renderDetail={renderDetail}
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
 * A card whose offer lead-service could not resolve renders the band with no name and
 * no link rather than being hidden — the campaigns under it are real, and lead-service
 * is fail-soft here, so an absent offer means "we could not say" as often as "there is
 * none".
 */
function OfferBand<C extends LeadCampaignCardLike>({
  offer,
  showFunnels,
  collapsible,
  audienceFor,
  openRowId,
  onToggle,
  renderDetail,
}: {
  offer: LeadOfferNode<C>;
  showFunnels: boolean;
  collapsible: boolean;
  audienceFor: (card: C) => LeadCampaignAudience | null;
  openRowId: string | null;
  onToggle: (rowId: string) => void;
  renderDetail: (node: LeadCampaignNode<C>) => ReactNode;
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
              {funnel.campaigns.map((node) => (
                <CampaignCard
                  key={node.rowId}
                  node={node}
                  collapsible={collapsible}
                  open={openRowId === node.rowId}
                  onToggle={onToggle}
                  audience={audienceFor(node.card)}
                  renderDetail={renderDetail}
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
 *
 * The header is a `role="button"` div rather than a real button element, because the
 * open body contains its own links and a nested interactive element inside a button is
 * invalid HTML — the same reason the Sales Funnels settings card does it this way. With ONE
 * campaign there is nothing to switch between, so the header is not a control at all.
 */
function CampaignCard<C extends LeadCampaignCardLike>({
  node,
  collapsible,
  open,
  onToggle,
  audience,
  renderDetail,
}: {
  node: LeadCampaignNode<C>;
  collapsible: boolean;
  open: boolean;
  onToggle: (rowId: string) => void;
  audience: LeadCampaignAudience | null;
  renderDetail: (node: LeadCampaignNode<C>) => ReactNode;
}) {
  const funnel = SALES_FUNNELS.find((f) => f.key === node.info?.funnelKey) ?? null;
  const identity = (
    <CampaignIdentity
      funnel={funnel}
      featureSlug={node.info?.featureSlug ?? null}
      legKey={node.info?.legKey ?? null}
    />
  );
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      {collapsible ? (
        <div
          role="button"
          tabIndex={0}
          aria-expanded={open}
          onClick={() => onToggle(node.rowId)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onToggle(node.rowId);
            }
          }}
          className="flex min-w-0 cursor-pointer items-center gap-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
        >
          <div className="min-w-0 flex-1">{identity}</div>
          <svg
            className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      ) : (
        identity
      )}
      {open && (
        <>
          {audience ? (
            <AudienceRow audience={audience} />
          ) : (
            /* Attributed to no audience. Stated rather than hidden: an empty card under
               a campaign that really contacted this person reads as a rendering gap,
               while "no audience" is a real answer lead-service gives for a lead served
               before the attribution existed. */
            <p className="mt-3 border-t border-gray-200 pt-3 text-sm text-gray-500">
              No audience attributed
            </p>
          )}
          {renderDetail(node)}
        </>
      )}
    </div>
  );
}

/**
 * WHICH saved audience this campaign picked the person for.
 *
 * Size / remaining-to-contact deliberately do NOT live here: the Audiences page owns
 * every audience number and the targeting filters. The link carries `?audienceId=`,
 * the deep-link seed `CustomerAudiencesPage` reads on first paint, so that audience's
 * detail panel opens with its colored targeting tags.
 */
function AudienceRow({ audience }: { audience: LeadCampaignAudience }) {
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
  const audienceOfferId = audience.offerId ?? routeOfferId ?? null;
  // No offer resolvable ⟹ NO link. Some audiences predate the offer level and are
  // filed under none, so there is no page to open; a link to a 404 is worse than a
  // row that simply states the audience. Same render while the lookup is in flight —
  // we do not claim either way before we know.
  const detailHref = audienceOfferId
    ? `${tenantBasePath(orgId, brandId, audienceOfferId)}/audiences?audienceId=${audience.id}`
    : null;
  return (
    <div className="mt-3 border-t border-gray-200 pt-3">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-400">Audience</p>
      <div className="flex items-center gap-3">
        {audience.avatarUrl ? (
          <img
            src={audience.avatarUrl}
            alt=""
            className="h-9 w-9 shrink-0 rounded border border-gray-200 bg-white object-cover"
            loading="lazy"
          />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-brand-100 text-sm font-semibold text-brand-700">
            {(audience.name ?? "?").charAt(0).toUpperCase()}
          </span>
        )}
        {/* An audience the brand's list does not carry (archived, or still loading) is
            still a real attribution. Naming it "an audience we can no longer list" keeps
            the fact and admits the gap; inventing a name from its id would not. */}
        <p className="text-sm font-medium text-gray-800">
          {audience.name ?? <span className="text-gray-500">An audience no longer listed</span>}
        </p>
      </div>
      {audience.description && <p className="mt-2 text-sm text-gray-600">{audience.description}</p>}
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
