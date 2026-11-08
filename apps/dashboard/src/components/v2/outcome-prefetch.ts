"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getHeldPeople, listBrandOffers, listOutcomePeople } from "@/lib/api";
import { useStaffMode } from "@/lib/use-staff-mode";
import { OUTCOME_PEOPLE_PAGE_SIZE } from "@/lib/v2/outcome-people";
import type { Outcome } from "@/lib/v2/outcomes";

/**
 * Instant outcome pages (owner 2026-11-08 « Affichage trop lent, tu peux le rendre instant? »): the first page of an
 * outcome's list is asked when its link or row is HOVERED (or focused), so the click opens on rows already in the
 * cache. The keys and fetchers live here ONCE: the page's own reads use the same builders, so a warm entry is the
 * one the page reads (a drifted key would warm nothing).
 */

/** Rows per page of the Lead found people list (human-service snapshot `/people`). */
export const HELD_PEOPLE_PAGE = 100;

export const heldPeopleKey = (brandId: string, staff: boolean, offset: number, acceptedOnly: boolean) =>
  ["staffHeldPeople", brandId, staff, offset, acceptedOnly] as const;
export const fetchHeldPeople = (brandId: string, staff: boolean, offset: number, acceptedOnly: boolean) =>
  getHeldPeople(brandId, staff, { limit: HELD_PEOPLE_PAGE, offset, acceptedOnly });

export const brandOffersKey = (brandId: string) => ["brandOffers", brandId] as const;

export const outcomePeopleKey = (brandId: string, crmStep: string, contactedOnly: boolean, offset: number) =>
  ["outcomePeople", brandId, crmStep, contactedOnly ? "contacted" : "all", offset] as const;
export const fetchOutcomePeople = (brandId: string, crmStep: string, contactedOnly: boolean, offset: number) =>
  listOutcomePeople(brandId, crmStep, { limit: OUTCOME_PEOPLE_PAGE_SIZE, offset, contactedByUs: contactedOnly });

/** Same freshness as the global default: a hover within a minute of the last read asks nothing. */
const WARM_STALE_MS = 60_000;

/** Returns a warm-up for one outcome: call it on the link's / row's `onMouseEnter` and `onFocus`. */
export function useOutcomePrefetch(brandId: string): (outcome: Outcome) => void {
  const queryClient = useQueryClient();
  const { staffMode: staff } = useStaffMode();
  return useCallback(
    (outcome: Outcome) => {
      if (!brandId) return;
      if (outcome.items.kind === "leads-found") {
        void queryClient.prefetchQuery({
          queryKey: heldPeopleKey(brandId, staff, 0, false),
          queryFn: () => fetchHeldPeople(brandId, staff, 0, false),
          staleTime: WARM_STALE_MS,
        });
        void queryClient.prefetchQuery({ queryKey: brandOffersKey(brandId), queryFn: () => listBrandOffers(brandId), staleTime: WARM_STALE_MS });
        return;
      }
      if (outcome.items.kind === "people") {
        const { crmStep } = outcome.items;
        void queryClient.prefetchQuery({
          queryKey: outcomePeopleKey(brandId, crmStep, false, 0),
          queryFn: () => fetchOutcomePeople(brandId, crmStep, false, 0),
          staleTime: WARM_STALE_MS,
        });
      }
    },
    [queryClient, brandId, staff],
  );
}
