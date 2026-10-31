"use client";

import { useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getPublicCatalogue } from "@/lib/api";
import { pollOptions } from "@/lib/query-options";
import {
  acquisitionChannelsFromFeatures,
  channelSourcesFromCatalogue,
  withRetiredChannels,
  type AcquisitionChannelDef,
} from "@/lib/acquisition-channels";

/**
 * The channels this environment sells, as the surfaces that name a campaign read
 * them.
 *
 * features-service's PUBLIC CATALOGUE owns which channels exist (`GET /public/channels`,
 * P5.1 owner 2026-10-31: never a local list, never the seeded features list, which missed
 * every channel declared since), so this is a projection of the catalogue read the legs and
 * pipe marks already share (`["publicCatalogue"]`), not a read of its own. A channel
 * published upstream is namable, markable and fundable here on the next poll, with no edit.
 *
 * An empty list is the honest reading while the read is still settling or has failed:
 * every caller already treats an unresolved channel as one to print plainly rather than
 * to guess at, so the surfaces degrade to a name and no tile instead of to a wrong tile.
 */
export function useAcquisitionChannels(): AcquisitionChannelDef[] {
  const { data } = useAuthQuery(["publicCatalogue"], () => getPublicCatalogue(), pollOptions);
  return useMemo(
    () =>
      data
        ? withRetiredChannels(
            acquisitionChannelsFromFeatures(channelSourcesFromCatalogue(data.channels)),
            // A RETIRED channel names and marks its past campaigns, never offered (`retired`, P5.1).
            acquisitionChannelsFromFeatures(channelSourcesFromCatalogue(data.retiredChannels ?? [])),
          )
        : [],
    [data],
  );
}
