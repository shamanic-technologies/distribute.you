"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getBrandOffer, getCampaign } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { CampaignTitle } from "@/components/campaigns/campaign-title";
import { OfferMark } from "@/components/marks/offer-mark";

/**
 * WHERE you are, below the tenant: the offer, and the campaign under it.
 *
 * Tenant identity — org and brand — stays in the sidebar switcher and is
 * deliberately absent here. It would restate what the switcher already names,
 * and it is the part that does not change as you move around.
 *
 * What DOES change is which proposition you are looking at and which campaign
 * of it. The switcher names the offer only while it is open, and carries no
 * campaign tier at all (a campaign is picked from its offer's own table, with
 * the numbers beside it), so without this the bar says nothing about a page you
 * reached three levels deep.
 *
 * Home ▸ Offer ▸ Campaign — home being the brand, the thing the tenant IS.
 *
 * ⚠️ This component keyed the campaign at path segment 4 and stopped working
 * the day campaigns moved under the offer: it silently rendered nothing on
 * every campaign page. Path shapes belong in `offerRouteFromPath` below, parsed
 * once, so a future level shift breaks in one place with a test on it rather
 * than in whichever component happened to hardcode an index.
 */

export interface OfferRoute {
  orgId: string;
  brandId: string;
  offerId: string;
  /** Present only on `.../offers/:offerId/campaigns/:id`. */
  campaignId: string | null;
}

/**
 * The offer (and campaign) a path names, or null when it names neither.
 *
 * `/orgs/:orgId/brands/:brandId/offers/:offerId[/campaigns/:campaignId]`
 *
 * The campaigns LIST (`/offers/:offerId/campaigns`, no id) is an offer route
 * with no campaign — the bar names the offer and stops, which is exactly true.
 */
export function offerRouteFromPath(pathname: string): OfferRoute | null {
  const p = pathname.split("/").filter(Boolean);
  if (p[0] !== "orgs" || p[2] !== "brands" || p[4] !== "offers") return null;
  const [, orgId, , brandId, , offerId, section, campaignId] = p;
  if (!orgId || !brandId || !offerId) return null;
  return {
    orgId,
    brandId,
    offerId,
    campaignId: section === "campaigns" && campaignId ? campaignId : null,
  };
}

/** A crumb whose label has not arrived yet. Never a placeholder word. */
const CrumbSkeleton = ({ width }: { width: string }) => (
  <span className={`h-4 ${width} animate-pulse rounded bg-gray-100`} />
);

const Separator = () => (
  <span className="shrink-0 text-gray-300" aria-hidden="true">
    /
  </span>
);

const HomeIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
    />
  </svg>
);

export function HeaderPageContext() {
  const pathname = usePathname() ?? "";
  const route = offerRouteFromPath(pathname);

  // Both keys are byte-equal to the ones the pages below already poll, so the
  // bar costs no extra request — React Query serves it from the same entry.
  const offerQ = useAuthQuery(
    ["brandOffer", route?.brandId ?? "none", route?.offerId ?? "none"],
    () => getBrandOffer(route!.brandId, route!.offerId),
    { enabled: route !== null, ...pollOptions },
  );

  const campaignQ = useAuthQuery(
    ["campaign", route?.campaignId ?? "none"],
    () => getCampaign(route!.campaignId as string),
    { enabled: route?.campaignId != null, ...pollOptions },
  );

  if (!route) return null;

  const brandPath = `/orgs/${route.orgId}/brands/${route.brandId}`;
  const offerPath = `${brandPath}/offers/${route.offerId}`;
  const offer = offerQ.data?.offer ?? null;
  const campaign = campaignQ.data?.campaign ?? null;
  // The offer crumb is a LINK only while it is not the page you are on — a
  // breadcrumb's last item is where you already are.
  const offerIsCurrent = route.campaignId === null;

  const offerLabel = offer ? (
    <>
      <OfferMark size="sm" />
      <span className="truncate">{offer.name}</span>
    </>
  ) : (
    <>
      <OfferMark size="sm" />
      <CrumbSkeleton width="w-24" />
    </>
  );

  return (
    <nav className="flex min-w-0 items-center gap-1.5 text-sm" aria-label="Breadcrumb">
      <Link
        href={brandPath}
        aria-label="Brand overview"
        className="shrink-0 text-gray-400 transition hover:text-gray-600"
      >
        <HomeIcon />
      </Link>

      <Separator />

      {offerIsCurrent ? (
        <span
          aria-current="page"
          className="flex min-w-0 items-center gap-1.5 font-medium text-gray-800"
        >
          {offerLabel}
        </span>
      ) : (
        <Link
          href={offerPath}
          className="flex min-w-0 items-center gap-1.5 text-gray-500 transition hover:text-gray-800"
        >
          {offerLabel}
        </Link>
      )}

      {route.campaignId !== null && (
        <>
          <Separator />
          {/* A campaign is named as what it IS — the funnel it buys, through the
              channel it buys it on — by the same component the Campaigns table
              renders, marks included. */}
          {campaign ? (
            <CampaignTitle
              campaign={campaign}
              size="sm"
              className="font-medium text-gray-800"
            />
          ) : (
            <CrumbSkeleton width="w-28" />
          )}
        </>
      )}
    </nav>
  );
}
