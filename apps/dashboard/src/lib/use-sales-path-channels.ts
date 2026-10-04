"use client";

import { useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getPublicCatalogue } from "@/lib/api";
import { pollOptions } from "@/lib/query-options";
import { salesPathChannels, type SalesPathChannel } from "@/lib/offer-active-sales-paths";

/**
 * The channels a sales path can use (features-service `salesPathEligible` on `GET /public/channels`),
 * off the same query key as `useLegCatalogue`, so it is one read. Empty while the read settles.
 */
export function useSalesPathChannels(): { channels: SalesPathChannel[]; settled: boolean } {
  const q = useAuthQuery(["publicCatalogue"], () => getPublicCatalogue(), pollOptions);
  const channels = useMemo(() => (q.data ? salesPathChannels(q.data.channels) : []), [q.data]);
  return { channels, settled: q.data !== undefined || q.isError };
}
