"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { getSourcingOrigins } from "@/lib/api";
import { featureSlugsWithSourcing } from "@/lib/sourcing-scope";

/** The served sourcing-origin catalogue (features-service, public). Changes with a deploy, not live. */
export function useSourcingOrigins() {
  return useAuthQuery(["sourcingOrigins"], () => getSourcingOrigins(), { staleTime: 10 * 60_000 });
}

/**
 * The feature slugs a one-channel cost read filters on: the channel + the sourcing origins it
 * sources from, so the channel's cost-name breakdown keeps Apollo / email find / verify once
 * serve runs carry the origin's slug. `undefined` until the catalogue lands (the cost read
 * waits on it rather than reading the channel alone and jumping later).
 */
export function useFeatureCostSlugs(featureSlug: string): { slugs: string[] | undefined; isError: boolean } {
  const { data, isError } = useSourcingOrigins();
  return { slugs: data ? featureSlugsWithSourcing(featureSlug, data.originsByChannel) : undefined, isError };
}
