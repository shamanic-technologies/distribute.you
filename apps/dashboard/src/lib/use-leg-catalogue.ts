"use client";

import { useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getPublicCatalogue, type Campaign } from "@/lib/api";
import { pollOptions } from "@/lib/query-options";
import { EMPTY_LEG_CATALOGUE, legCatalogueFromWire, legFor, type LegCatalogue, type LegDef, type PipeIdentity } from "@/lib/legs";

// One build per served body, shared by every mounted reader (a sidebar draws a pipe mark per row).
const built = new WeakMap<object, LegCatalogue>();
function catalogueOf(data: Parameters<typeof legCatalogueFromWire>[0] & object): LegCatalogue {
  let c = built.get(data);
  if (!c) {
    c = legCatalogueFromWire(data);
    built.set(data, c);
  }
  return c;
}

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
  return useMemo(() => (data ? catalogueOf(data) : EMPTY_LEG_CATALOGUE), [data]);
}

/**
 * One PIPE as the public catalogue serves it (name, icon, colour), with whether the catalogue
 * has answered: `settled` with a null `pipe` means the producer serves none for this id.
 */
export function usePublicPipe(pipeId: string | null): { pipe: PipeIdentity | null; settled: boolean } {
  const { data, isError } = useAuthQuery(["publicCatalogue"], () => getPublicCatalogue(), pollOptions);
  const pipe = data && pipeId ? (catalogueOf(data).pipes.get(pipeId) ?? null) : null;
  return { pipe, settled: !!data || isError };
}

/** The leg a campaign states it is bought for, resolved against the catalogue. */
export function useCampaignLeg(
  campaign: Pick<Campaign, "legKey"> | null | undefined,
): LegDef | null {
  const catalogue = useLegCatalogue();
  return legFor(catalogue, campaign?.legKey);
}
