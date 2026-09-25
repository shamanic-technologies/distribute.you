"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { listBrandOffers } from "@/lib/api";
import {
  LANDING_RESOLVE_BUDGET_MS,
  hasLandingIntent,
  landingOfferHref,
  soleChildId,
} from "@/lib/landing-drilldown";

/**
 * Carries a sign-in landing down to the deepest scope that has no choice left in it.
 *
 * Mounted by the Overview page, which serves BOTH the brand and the offer grain, so one
 * hook walks the whole thing: brand -> its sole offer, which is the end of the walk. See
 * `lib/landing-drilldown.ts` for why the walk is gated on a marker param rather than on
 * the bare URL.
 *
 * The read is a key the destination page ALREADY polls — `brandOffers` feeds the brand
 * Overview's Offers table — so the walk costs no request and, the root being in
 * `PERSISTABLE_QUERY_ROOTS`, resolves from disk on every visit after the first. On an
 * offer the walk has nothing left to do and only strips its marker.
 *
 * It counts the rows the page WOULD RENDER, deliberately: a page is only skipped when
 * the table it would have shown holds exactly one row, so drilling past a level can
 * never hide a second offer from the reader.
 *
 * Returns whether the caller should hold its render — and a held render is the route's
 * own `DashboardPageSkeleton`, never a blank: the walk is a navigation, so it should look
 * like every other navigation in the app. Reveal on SETTLE: a read that ERRORS stops the
 * walk and renders this page, rather than holding a skeleton forever.
 *
 * The hold is BOUNDED, and that bound is the whole difference between the two cases a
 * user actually experiences. The persisted answer arrives from IndexedDB in an effect a
 * tick after mount — fast, local, and the case for every visit after the first — so the
 * walk waits for it. A genuinely cold first-ever visit has to go to the network over the
 * slow features-service path, which is seconds: waiting for that would trade a page the
 * reader can already use for a skeleton, and jumping once it lands would move the page
 * out from under someone already reading it. Past the bound the walk is CANCELLED for
 * good (`gaveUp` latches), so a late answer can neither hold nor jump — the brand
 * Overview is simply where that visit lands.
 */
export function useLandingDrilldown({
  orgId,
  brandId,
  offerId,
}: {
  orgId: string;
  brandId: string;
  offerId: string | undefined;
}): { holding: boolean } {
  const router = useRouter();
  const searchParams = useSearchParams();
  const landing = hasLandingIntent(searchParams);

  const brandPath = `/orgs/${orgId}/brands/${brandId}`;
  const offerPath = offerId
    ? `${brandPath}/offers/${encodeURIComponent(offerId)}`
    : null;
  const here = offerPath ?? brandPath;

  // Only the brand grain has a level left to walk.
  const offersQ = useAuthQuery(
    ["brandOffers", brandId],
    () => listBrandOffers(brandId),
    { enabled: landing && !offerId && Boolean(brandId), ...pollOptions },
  );
  // An offer is the end of the walk: nothing to read, the marker is simply stripped.
  const settled = offerId ? true : offersQ.data !== undefined || offersQ.isError;

  const [gaveUpAt, setGaveUpAt] = useState<string | null>(null);
  const gaveUp = gaveUpAt === here;
  useEffect(() => {
    if (!landing || settled) return;
    const t = setTimeout(() => setGaveUpAt(here), LANDING_RESOLVE_BUDGET_MS);
    return () => clearTimeout(t);
  }, [landing, settled, here]);

  const next = !landing || !settled || gaveUp || offerId
    ? null
    : (() => {
        const id = soleChildId(offersQ.data?.offers, (o) => o.offerId);
        return id ? landingOfferHref(brandPath, id) : null;
      })();

  const target = landing && (settled || gaveUp) ? (next ?? here) : null;
  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  return { holding: landing && !gaveUp && (!settled || next !== null) };
}
