"use client";

import { useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getSourcingOrigins, listAudiences, type AudienceWire, type SourcingOrigin } from "@/lib/api";

/**
 * An offer's audiences (profiles and the lists built for them) and the sources a list can
 * come from. The audience reads are the SAME keys `useAudienceTable` polls (one cache entry,
 * one poll, and a status write there re-reads them here); the sources are features-service's
 * `/public/sourcing-origins`. Nothing is computed: `lib/profile-lists.ts` names the joins.
 */
export function useProfileLists(brandId: string, offerId: string | undefined) {
  const scope = offerId ?? "brand";
  const active = useAuthQuery(
    ["audiences", brandId, "active", scope],
    () => listAudiences(brandId, { status: "active", offerId }),
    pollOptions,
  );
  const paused = useAuthQuery(
    ["audiences", brandId, "paused", scope],
    () => listAudiences(brandId, { status: "paused", offerId }),
    pollOptions,
  );
  const archived = useAuthQuery(
    ["audiences", brandId, "archived", scope],
    () => listAudiences(brandId, { status: "archived", offerId }),
    pollOptions,
  );
  const origins = useAuthQuery(["sourcingOrigins"], () => getSourcingOrigins());

  const audiences: AudienceWire[] = useMemo(
    () => [active.data, paused.data, archived.data].flatMap((d) => d?.audiences ?? []),
    [active.data, paused.data, archived.data],
  );
  const byId = useMemo(() => new Map(audiences.map((a) => [a.id, a])), [audiences]);
  const reads = [active, paused, archived];
  return {
    audiences,
    byId,
    origins: (origins.data ?? []) as SourcingOrigin[],
    originsSettled: origins.data !== undefined || origins.isError,
    settled: reads.every((r) => r.isFetchedAfterMount || r.data !== undefined),
    error: reads.find((r) => r.error && r.data === undefined)?.error ?? null,
  };
}
