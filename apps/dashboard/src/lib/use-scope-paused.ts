"use client";

import { useMemo } from "react";
import { listCampaignsByBrand } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { buildControlRows, type ControlRow } from "@/lib/campaign-controls";
import { pausedByFunnel, pausedByOffer, scopeIsPaused } from "@/lib/scope-paused";

/**
 * Whether the scope a surface is about is STOPPED, at whatever grain it is on.
 *
 * The rows are `buildControlRows` — the SAME rows `CampaignControlsTrigger` builds for
 * the pill on that scope's own header — so the tag under a heading and the word beside it
 * cannot disagree. That is the whole reason this reads the controls path rather than
 * `useCampaignRows`: two derivations of one verdict is how a screen comes to say `Paused`
 * at the top and `Learning` in the middle.
 *
 * It costs NO network. `["campaigns", brandId]` is the key `useCampaignRows` and the
 * controls trigger already poll on every one of these pages, and the channels are a memo
 * over the features query the session already holds.
 *
 * Budgets are deliberately NOT read: `running` is decided by campaign-service's own word
 * on the row, and `buildControlRows` uses the budget set only to fill `savedCents`. So a
 * surface that states no money needs no second query to state a status.
 */
export function useScopePaused(
  brandId: string,
  {
    offerId,
    funnelKey,
    campaignId,
    enabled = true,
  }: {
    offerId?: string;
    /**
     * Scope to ONE sales funnel. Pair it with `offerId`: billing keys a ceiling on
     * (funnel x channel x offer), so a bare funnel spans every offer selling it and
     * would answer for a sibling offer's campaigns.
     */
    funnelKey?: string | null;
    campaignId?: string;
    enabled?: boolean;
  } = {},
): { paused: boolean; settled: boolean } {
  const { rows, settled } = useScopeControlRows(brandId, { offerId, funnelKey, campaignId, enabled });
  return { paused: settled ? scopeIsPaused(rows) : false, settled };
}

/**
 * The same verdict for every OFFER of a brand at once, for the Offers table.
 *
 * A row cannot call a hook, so the map is built once at brand grain and read per row —
 * the shape `useOfferLearning` already uses for the learning half of the same cell. It
 * spans every channel (`ALL_OFFERS` in the campaigns-table sense) by construction:
 * `buildControlRows` with no offer filter keeps every acquisition-channel campaign the
 * brand has.
 */
export function usePausedByOffer(
  brandId: string,
  { enabled = true }: { enabled?: boolean } = {},
): { pausedByOfferId: Map<string, boolean>; settled: boolean } {
  const { rows, settled } = useScopeControlRows(brandId, { enabled });
  const pausedByOfferId = useMemo(() => pausedByOffer(rows), [rows]);
  return { pausedByOfferId, settled };
}

/**
 * The same verdict for every SALES FUNNEL of one offer, for the funnels table.
 *
 * Keyed on the NORMALIZED funnel key, so a caller looks its row up through
 * `normalizeSalesFunnelKey` rather than on whichever spelling the wire happened to carry.
 */
export function usePausedByFunnel(
  brandId: string,
  offerId: string,
  { enabled = true }: { enabled?: boolean } = {},
): { pausedByFunnelKey: Map<string, boolean>; settled: boolean } {
  const { rows, settled } = useScopeControlRows(brandId, { offerId, enabled });
  const pausedByFunnelKey = useMemo(() => pausedByFunnel(rows), [rows]);
  return { pausedByFunnelKey, settled };
}

/**
 * The rows every reader above shares.
 *
 * Reveal on SETTLE (resolved OR errored): a failed read answers `false` — the word the
 * surface used before this existed — rather than claiming a scope is stopped on evidence
 * we do not have.
 */
function useScopeControlRows(
  brandId: string,
  {
    offerId,
    funnelKey,
    campaignId,
    enabled = true,
  }: {
    offerId?: string;
    funnelKey?: string | null;
    campaignId?: string;
    enabled?: boolean;
  },
): { rows: ControlRow[]; settled: boolean } {
  const campaignsQ = useAuthQuery(["campaigns", brandId], () => listCampaignsByBrand(brandId), {
    enabled: enabled && Boolean(brandId),
  });
  const channels = useAcquisitionChannels();

  const rows = useMemo(
    () =>
      buildControlRows(campaignsQ.data?.campaigns ?? [], undefined, channels, {
        offerId,
        funnelKey,
        campaignId,
      }),
    [campaignsQ.data, channels, offerId, funnelKey, campaignId],
  );

  const settled = campaignsQ.data !== undefined || campaignsQ.isError;
  return { rows, settled };
}
