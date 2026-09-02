"use client";

import { useMemo, useState } from "react";
import { funnelLegs } from "@/lib/campaign-leg";
import { buildLegColumns, type LegChannelCard } from "@/lib/funnel-leg-columns";
import {
  funnelChannelBudgets,
  type ChannelFeatureRow,
  channelsForFunnel,
} from "@/lib/funnel-channels";
import { fmtDailyBudgetUsd } from "@/lib/campaign-budget";
import type { OfferableChannel } from "@/lib/campaign-controls";
import type { SalesFunnelDef } from "@/lib/sales-funnels";
import { getBrandFunnelBudgets } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { useFeatures } from "@/lib/features-context";
import { AcquisitionChannelMark } from "@/components/marks/acquisition-channel-mark";
import { FunnelLegMark } from "@/components/marks/funnel-leg-mark";
import { CampaignControlsModal } from "@/components/campaigns/campaign-controls-modal";
import { Skeleton } from "@/components/skeleton";

/**
 * One funnel as its own ARROWS, side by side, with everything that can work each one.
 *
 * The table beside it answers "how is this funnel doing" and can only show the channels
 * that already run, because a channel nobody funded has no campaign and so no row. This
 * answers the other question — what ELSE could work this arrow — which is the only way a
 * customer reaches a channel they have not bought yet.
 *
 * Every card opens the SAME `CampaignControlsModal` the Overview opens. Several windows
 * onto one number are fine; a second way of WRITING it is not.
 */
export function FunnelLegColumnsBoard({
  brandId,
  offerId,
  funnel,
}: {
  brandId: string;
  offerId?: string;
  funnel: SalesFunnelDef;
}) {
  const { features } = useFeatures();
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  const budgetsQ = useAuthQuery(["brandFunnelBudgets", brandId], () =>
    getBrandFunnelBudgets(brandId),
  );

  const legs = useMemo(() => funnelLegs(funnel), [funnel]);

  // The ceilings come from the SAME resolver Offer Settings reads, so the two surfaces
  // cannot state different money for one channel. It owns the offer-scoped narrowing;
  // this component only lays the answer out.
  const savedCentsBySlug = useMemo(() => {
    const offerable = channelsForFunnel(funnel.key, (features ?? []) as ChannelFeatureRow[]);
    const funnelTotal =
      budgetsQ.data?.funnels?.find((f) => f.funnelKey === funnel.key)?.dailyBudgetCents ?? 0;
    const resolved = funnelChannelBudgets(
      funnel.key,
      offerable,
      budgetsQ.data?.channels,
      funnelTotal,
      budgetsQ.data?.offers,
      offerId,
    );
    return Object.fromEntries(resolved.map((r) => [r.channel.featureSlug, r.savedCents]));
  }, [funnel.key, features, budgetsQ.data, offerId]);

  const columns = useMemo(
    () =>
      buildLegColumns({
        legs,
        channels: channelsForFunnel(funnel.key, (features ?? []) as ChannelFeatureRow[]),
        savedCentsBySlug,
      }),
    [legs, funnel.key, features, savedCentsBySlug],
  );

  // Every channel of this funnel a customer may fund, whether or not one runs today.
  // The modal files them under the same triple a campaign row uses, so a channel that
  // already has a campaign is never listed twice.
  const offerable = useMemo<OfferableChannel[]>(
    () =>
      columns.flatMap((col) =>
        col.cards.map((card) => ({
          funnelKey: funnel.key,
          featureSlug: card.channel.featureSlug,
          channelName: card.channel.name,
          offerId: offerId ?? null,
        })),
      ),
    [columns, funnel.key, offerId],
  );

  // Reveal on SETTLE: a failed budget read paints the cards with no ceiling rather than
  // an eternal skeleton. The channels themselves come from the features list, which the
  // session already holds.
  const pending = budgetsQ.isPending && !budgetsQ.isError;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {columns.map((col) => (
          <section key={col.leg.toKey} className="flex flex-col gap-3">
            <header className="flex items-center gap-2">
              <FunnelLegMark fromKey={col.leg.fromKey} toKey={col.leg.toKey} size="sm" />
              <h3 className="min-w-0 text-sm font-medium text-gray-900">{col.leg.label}</h3>
            </header>

            {col.cards.length === 0 ? (
              // Stated rather than omitted: a missing column would tell a customer their
              // funnel is shorter than it is.
              <p className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-xs text-gray-500">
                Nothing sells this step yet. You work it yourself for now.
              </p>
            ) : (
              col.cards.map((card) => (
                <LegChannelTile
                  key={card.channel.featureSlug}
                  card={card}
                  pending={pending}
                  onOpen={() => setOpenSlug(card.channel.featureSlug)}
                />
              ))
            )}
          </section>
        ))}
      </div>

      {openSlug && (
        <CampaignControlsModal
          brandId={brandId}
          offerId={offerId}
          funnelKey={funnel.key}
          offerable={offerable}
          onClose={() => setOpenSlug(null)}
        />
      )}
    </>
  );
}

/**
 * One channel under one arrow.
 *
 * A `role="button"` div rather than a `<button>`: the card carries its own status pill
 * and its own figures, and a nested interactive element inside a button is invalid HTML.
 */
function LegChannelTile({
  card,
  pending,
  onOpen,
}: {
  card: LegChannelCard;
  pending: boolean;
  onOpen: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="cursor-pointer rounded-xl border border-gray-200 bg-white p-3 text-left transition hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:outline-none"
    >
      <div className="flex items-start gap-2">
        <AcquisitionChannelMark def={card.channel} size="sm" dimmed={!card.funded} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium text-gray-900">{card.channel.name}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{card.channel.summary}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        {/* Green means money is behind it. A channel at zero is not an error and not a
            warning — it is one the brand has not bought, so it reads plain. */}
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            card.funded
              ? "bg-green-50 text-green-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {card.funded ? "Running" : "Not funded"}
        </span>
        {pending ? (
          <Skeleton className="h-4 w-16" />
        ) : (
          <span className="text-xs tabular-nums text-gray-600">
            {card.funded ? `${fmtDailyBudgetUsd(card.savedCents)} / day` : "—"}
          </span>
        )}
      </div>
    </div>
  );
}
