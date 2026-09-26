"use client";

import { useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getPublicCatalogue, type Campaign } from "@/lib/api";
import { pollOptions } from "@/lib/query-options";
import { EMPTY_LEG_CATALOGUE, legCatalogueFromWire, legFor, type LegCatalogue, type LegDef } from "@/lib/legs";

/**
 * The platform's step and leg catalogue, read from `GET /public/channels`.
 *
 * A PLATFORM catalogue (no org, no brand, no auth), so it is the same answer for every
 * tenant, cheap to hold and persisted like every other root. The query key is shared
 * with `useChannelMinimums`, so the legs and the channel floors are one read.
 *
 * An EMPTY catalogue is the honest reading while the read settles or has failed: every
 * caller then names a campaign by its channel alone rather than by a guessed leg.
 */
export function useLegCatalogue(): LegCatalogue {
  const { data } = useAuthQuery(["publicCatalogue"], () => getPublicCatalogue(), pollOptions);
  return useMemo(() => (data ? legCatalogueFromWire(data) : EMPTY_LEG_CATALOGUE), [data]);
}

/** The leg a campaign states it is bought for, resolved against the catalogue. */
export function useCampaignLeg(
  campaign: Pick<Campaign, "legKey"> | null | undefined,
): LegDef | null {
  const catalogue = useLegCatalogue();
  return legFor(catalogue, campaign?.legKey);
}
