"use client";

import { useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getPublicChannelLegs } from "@/lib/api";
import { pollOptions } from "@/lib/query-options";
import { funnelLegIndexFromWire, type FunnelLegIndex } from "@/lib/stated-campaign-leg";

/**
 * The lookup that turns a campaign's stated `legKey` into the two steps it connects.
 *
 * Read from `GET /public/channels`, which is where features-service mints and
 * publishes those identifiers. It is a PLATFORM catalogue — no org, no brand, no
 * auth — so it is the same answer for every tenant and is cheap to hold: ~33 rows,
 * persisted like every other root, and it changes only when a channel is published.
 *
 * An empty index is the honest reading while the read is settling or has failed, and
 * it is safe by construction: `statedCampaignLeg` answers null against it, and every
 * caller falls through to the derivation it used before campaigns stated their leg.
 * So a failed catalogue read costs the SHARPER name, never the name.
 */
export function useFunnelLegIndex(): FunnelLegIndex {
  const { data } = useAuthQuery(["publicChannelLegs"], () => getPublicChannelLegs(), pollOptions);
  return useMemo(() => funnelLegIndexFromWire(data), [data]);
}
