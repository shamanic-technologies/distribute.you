"use client";

import { useMemo } from "react";
import { useFeatures } from "@/lib/features-context";
import {
  acquisitionChannelsFromFeatures,
  type AcquisitionChannelDef,
} from "@/lib/acquisition-channels";

/**
 * The channels this environment sells, as the surfaces that name a campaign read
 * them.
 *
 * features-service owns which channels exist, and the app already fetches every
 * feature once for the whole session, so this is a projection of a query that is
 * already in flight rather than a read of its own. That is what keeps the list
 * live: a channel published upstream is namable, markable and fundable here on
 * the next poll, with no edit.
 *
 * An empty list is the honest reading while the features query is still settling
 * or has failed: every caller already treats an unresolved channel as one to
 * print plainly rather than to guess at, so the surfaces degrade to a name and
 * no tile instead of to a wrong tile.
 */
export function useAcquisitionChannels(): AcquisitionChannelDef[] {
  const { features } = useFeatures();
  return useMemo(() => acquisitionChannelsFromFeatures(features), [features]);
}
