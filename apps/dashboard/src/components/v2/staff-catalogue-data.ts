"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useAuthQuery, useOrgQueryGate } from "@/lib/use-auth-query";
import { getOfferSalesPaths, getStaffCatalogueObject, getWorkflowRankLadder, listSalesFunnelCampaigns, listStaffCatalogue } from "@/lib/api";
import { isOngoingFunnelCampaign, type SalesFunnelCampaign } from "@/lib/sales-funnel-campaigns";
import { pollOptions } from "@/lib/query-options";
import {
  ongoingChannelsAndSteps,
  ongoingFunnelIds,
  ongoingPipeIds,
  type CatalogueDetailByObject,
  type CatalogueObject,
  type CatalogueReadObject,
} from "@/lib/staff-catalogue";
import { featureLegId } from "@/lib/outbound-leg-key";
import { useOngoingCampaigns, type OngoingCampaign } from "@/components/v2/ongoing-campaigns";
import { crewParam } from "@/components/v2/workflows-data";

/**
 * The catalogue's economics are recomputed by features-service every ~15 minutes (warmed off
 * the request path), so a minute is fresh enough and keeps a staff tab from hammering it with
 * one read per ongoing object every 5s.
 */
const CATALOGUE_REFRESH_MS = 60_000;
const catalogueOptions = {
  staleTime: CATALOGUE_REFRESH_MS,
  refetchInterval: (q: { state: { status: string; data: unknown } }) =>
    q.state.status === "error" && q.state.data === undefined ? false : CATALOGUE_REFRESH_MS,
  retry: false,
} as const;

export function staffCatalogueObjectKey(object: CatalogueReadObject, id: string, pipe?: string | null) {
  return ["staffCatalogueObject", object, id, pipe ?? null] as const;
}

/** One page of an object's rows, as served (`q`, `limit`, the object's filters). */
export function useStaffCatalogueList(object: CatalogueReadObject, query: Record<string, string | undefined>, enabled = true) {
  return useAuthQuery(["staffCatalogueList", object, query], () => listStaffCatalogue(object, query), {
    ...catalogueOptions,
    enabled,
    placeholderData: (prev) => prev,
  });
}

/** One object by id (a workflow also names its pipe). */
export function useStaffCatalogueObject<K extends CatalogueReadObject>(object: K, id: string | null, pipe?: string | null) {
  return useAuthQuery(
    staffCatalogueObjectKey(object, id ?? "", pipe),
    () => getStaffCatalogueObject(object, id as string, pipe ? { pipe } : {}),
    { ...catalogueOptions, enabled: !!id && (object !== "workflows" || !!pipe) },
  );
}

/** Many objects of one kind by id, in the ids' order; a failed read is logged and left out. */
function useObjects<K extends CatalogueObject>(object: K, ids: string[], enabled: boolean) {
  const gate = useOrgQueryGate();
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: staffCatalogueObjectKey(object, id),
      queryFn: () => getStaffCatalogueObject(object, id),
      ...catalogueOptions,
      enabled: enabled && gate,
    })),
  });
  const data = results.map((r) => r.data).filter((d): d is CatalogueDetailByObject[K] => d !== undefined);
  const settled = results.every((r) => r.data !== undefined || r.isFetchedAfterMount || r.isError);
  for (let i = 0; i < results.length; i++) {
    if (results[i].isError && results[i].data === undefined) {
      console.error(`[v2] catalogue ${object} unreadable`, { id: ids[i], error: results[i].error?.message });
    }
  }
  return { data, settled };
}

/** The selected offer's SALES FUNNEL campaigns (campaign-service), each with its units. */
export function useFunnelCampaigns(brandId: string, offerId: string | null, enabled = true) {
  return useAuthQuery(["salesFunnelCampaigns", brandId, offerId], () => listSalesFunnelCampaigns(brandId, offerId as string), {
    ...pollOptions,
    enabled: enabled && !!brandId && !!offerId,
  });
}

/** An ongoing funnel campaign with its funnel's served face (catalogue). */
export interface OngoingFunnelCampaign {
  campaign: SalesFunnelCampaign;
  face: string | null;
}

/** A workflow an ON campaign runs: the producer's money pick for that campaign, on its pipe. */
export interface OngoingWorkflow {
  slug: string;
  pipeId: string;
  /** The `<channel slug>|<leg key>` the workflow page is asked for. */
  crew: string;
  campaignId: string;
  detail: CatalogueDetailByObject["workflows"] | null;
}

export interface OngoingCatalogue {
  steps: CatalogueDetailByObject["steps"][];
  "sales-paths": CatalogueDetailByObject["sales-paths"][];
  channels: CatalogueDetailByObject["channels"][];
  pipes: CatalogueDetailByObject["pipes"][];
  "sales-funnels": CatalogueDetailByObject["sales-funnels"][];
  workflows: OngoingWorkflow[];
  /** The offer's ongoing SALES FUNNEL campaigns (campaign-service status), each with its funnel's face. */
  campaigns: OngoingFunnelCampaign[];
  /** The ON campaigns each pipe id is, for a page that names them. */
  campaignsByPipe: Map<string, OngoingCampaign[]>;
  /** Every read answered once (a failure counts as answered: it is logged, never a blink). */
  settled: boolean;
}

/**
 * What the selected offer's ON campaigns use, per business object (owner 2026-10-10: a
 * Staff section lists the ONGOING ones). Every name, mark and figure is the catalogue's own
 * read of that object; this only joins ids (`lib/staff-catalogue.ts`).
 */
export function useOngoingCatalogue(orgId: string, brandId: string, offerId: string | null, enabled: boolean): OngoingCatalogue {
  const { campaigns, settled: campaignsSettled } = useOngoingCampaigns(orgId, brandId, offerId);
  // The same read (and key) the ongoing campaigns already make: the offer's paths, ticked or not.
  const salesPaths = useAuthQuery(
    ["offerSalesPaths", brandId, offerId, "catalogue"],
    () => getOfferSalesPaths(brandId, offerId as string, "catalogue"),
    { enabled: enabled && !!brandId && !!offerId },
  );

  const pipeIds = useMemo(() => ongoingPipeIds(campaigns.map((c) => c.m.row.campaign)), [campaigns]);
  const campaignsByPipe = useMemo(() => {
    const out = new Map<string, OngoingCampaign[]>();
    for (const c of campaigns) {
      const { featureSlug, legKey } = c.m.row.campaign;
      if (!featureSlug || !legKey) continue;
      const id = featureLegId(featureSlug, legKey);
      out.set(id, [...(out.get(id) ?? []), c]);
    }
    return out;
  }, [campaigns]);

  const pipes = useObjects("pipes", pipeIds, enabled);
  const { channelIds, stepIds } = useMemo(() => ongoingChannelsAndSteps(pipes.data), [pipes.data]);
  const channels = useObjects("channels", channelIds, enabled);
  const steps = useObjects("steps", stepIds, enabled);

  const funnelIds = useMemo(() => ongoingFunnelIds(salesPaths.data?.paths ?? [], pipeIds), [salesPaths.data, pipeIds]);
  const funnels = useObjects("sales-funnels", funnelIds, enabled);
  const pathIds = useMemo(() => [...new Set(funnels.data.map((f) => f.salesPathId))], [funnels.data]);
  const paths = useObjects("sales-paths", pathIds, enabled);

  // Workflows: the money pick of each ON campaign's ranking (the same read and key the
  // Workflows page asks, so opening it costs nothing), then that workflow on its pipe.
  const specs = useMemo(
    () =>
      campaigns
        .map((c) => c.m.row.campaign)
        .filter((c): c is typeof c & { featureSlug: string; legKey: string } => !!c.featureSlug && !!c.legKey)
        .map((c) => ({ featureSlug: c.featureSlug, legKey: c.legKey, campaignId: c.id })),
    [campaigns],
  );
  const gate = useOrgQueryGate();
  const ladders = useQueries({
    queries: specs.map((s) => ({
      queryKey: ["workflowRankLadder", brandId, s.legKey, s.campaignId],
      queryFn: () => getWorkflowRankLadder({ featureSlug: s.featureSlug, brandId, leg: s.legKey, campaignId: s.campaignId }),
      enabled: enabled && gate,
      // The sidebar mounts on every page: a minute-old pick is fine there (the Workflows page polls its own).
      staleTime: CATALOGUE_REFRESH_MS,
      retry: false,
    })),
  });
  const picks = specs
    .map((s, i) => ({ s, slug: ladders[i]?.data?.recommendedWorkflowDynastySlug ?? null }))
    .filter((x): x is { s: (typeof specs)[number]; slug: string } => !!x.slug);
  const workflowDetails = useQueries({
    queries: picks.map(({ s, slug }) => {
      const pipe = featureLegId(s.featureSlug, s.legKey);
      return {
        queryKey: staffCatalogueObjectKey("workflows", slug, pipe),
        queryFn: () => getStaffCatalogueObject("workflows", slug, { pipe }),
        ...catalogueOptions,
        enabled: enabled && gate,
      };
    }),
  });
  const workflows: OngoingWorkflow[] = picks.map(({ s, slug }, i) => ({
    slug,
    pipeId: featureLegId(s.featureSlug, s.legKey),
    crew: crewParam(s),
    campaignId: s.campaignId,
    detail: workflowDetails[i]?.data ?? null,
  }));

  const funnelCampaigns = useFunnelCampaigns(brandId, offerId, enabled);
  const ongoingFunnelCampaigns = useMemo(() => (funnelCampaigns.data ?? []).filter(isOngoingFunnelCampaign), [funnelCampaigns.data]);
  const campaignFunnels = useObjects("sales-funnels", [...new Set(ongoingFunnelCampaigns.map((c) => c.salesFunnelId))], enabled);
  const faceByFunnel = new Map(campaignFunnels.data.map((f) => [f.id, f.face.svgPath] as const));
  const campaignsOut: OngoingFunnelCampaign[] = ongoingFunnelCampaigns.map((c) => ({ campaign: c, face: faceByFunnel.get(c.salesFunnelId) ?? null }));
  const funnelCampaignsSettled = !offerId || funnelCampaigns.data !== undefined || funnelCampaigns.isFetchedAfterMount;

  const laddersSettled = ladders.every((r) => r.data !== undefined || r.isFetchedAfterMount || r.isError);
  const offerSettled = !offerId || salesPaths.data !== undefined || salesPaths.isError;
  return {
    steps: steps.data,
    "sales-paths": paths.data,
    channels: channels.data,
    pipes: pipes.data,
    "sales-funnels": funnels.data,
    workflows,
    campaigns: campaignsOut,
    campaignsByPipe,
    settled: funnelCampaignsSettled && campaignsSettled && offerSettled && pipes.settled && channels.settled && steps.settled && funnels.settled && paths.settled && laddersSettled,
  };
}
