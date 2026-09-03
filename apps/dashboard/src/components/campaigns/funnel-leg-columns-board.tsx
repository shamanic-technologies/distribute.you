"use client";

import { useCallback, useMemo, useState } from "react";
import { funnelLegs } from "@/lib/campaign-leg";
import {
  buildLegColumns,
  channelsForLeg,
  type LegChannelCard,
  type LegChannelState,
} from "@/lib/funnel-leg-columns";
import {
  funnelChannelBudgets,
  type ChannelFeatureRow,
  channelsForFunnel,
} from "@/lib/funnel-channels";
import { fmtDailyBudgetUsd } from "@/lib/campaign-budget";
import { buildControlRows, type OfferableChannel } from "@/lib/campaign-controls";
import type { SalesFunnelDef } from "@/lib/sales-funnels";
import { getBrandFunnelBudgets, getChannelFunnelEconomics, listCampaignsByBrand } from "@/lib/api";
import {
  channelStepCostUsd,
  legChannelPrice,
  legPriceLabel,
  type LegChannelPrice,
} from "@/lib/funnel-leg-price";
import { formatUsdAdaptive } from "@/lib/format-number";
import { LearningTag } from "@/components/learning-tag";
import { useAuthQuery } from "@/lib/use-auth-query";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
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
  // The status half. Byte-equal to the key the controls modal, the Campaigns table and
  // every other campaign surface already poll, so asking costs no request — and reading
  // the SAME rows is what stops the card and the modal it opens from disagreeing.
  const campaignsQ = useAuthQuery(["campaigns", brandId], () => listCampaignsByBrand(brandId));
  // The fleet's price list. Public and org-less on purpose: a card's whole job is to
  // offer a channel this brand has NOT funded, which by definition has no spend of its
  // own to price it with. One read for the whole board — the pairs are keyed on
  // (channel, funnel), so every card looks itself up in the same answer.
  const economicsQ = useAuthQuery(["channelFunnelEconomics"], () => getChannelFunnelEconomics());

  const legs = useMemo(() => funnelLegs(funnel), [funnel]);
  const catalogue = useAcquisitionChannels();

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

  const funnelChannels = useMemo(
    () => channelsForFunnel(funnel.key, (features ?? []) as ChannelFeatureRow[]),
    [funnel.key, features],
  );

  // Every channel of this funnel a customer may fund, whether or not one runs today.
  // The modal files them under the same triple a campaign row uses, so a channel that
  // already has a campaign is never listed twice.
  //
  // Derived straight off the arrows rather than off the laid-out columns: the columns
  // now carry a verdict that is itself resolved from these rows, and reading one out of
  // the other would be a cycle.
  const offerable = useMemo<OfferableChannel[]>(
    () =>
      legs.flatMap((leg) =>
        channelsForLeg(leg, funnelChannels).map((channel) => ({
          funnelKey: funnel.key,
          featureSlug: channel.featureSlug,
          channelName: channel.name,
          offerId: offerId ?? null,
        })),
      ),
    [legs, funnelChannels, funnel.key, offerId],
  );

  /**
   * Is this channel running — campaign-service's own answer, taken from the SAME
   * resolver the modal writes through.
   *
   * `undefined` while the campaigns read is unsettled: a card must not state a verdict
   * it does not have. A channel appearing under two arrows of one funnel, or under two
   * offers at brand grain, is running when ANY of its rows is — the same roll-up the
   * modal's own pill states, so the two can never disagree.
   */
  const runningBySlug = useMemo<Record<string, boolean> | undefined>(() => {
    if (campaignsQ.isPending && !campaignsQ.isError) return undefined;
    const rows = buildControlRows(
      campaignsQ.data?.campaigns ?? [],
      budgetsQ.data,
      catalogue,
      { offerId, funnelKey: funnel.key },
      offerable,
    );
    const out: Record<string, boolean> = {};
    for (const row of rows) {
      const slug = row.scope?.featureSlug;
      if (!slug) continue;
      out[slug] = (out[slug] ?? false) || row.running;
    }
    return out;
  }, [
    campaignsQ.data,
    campaignsQ.isPending,
    campaignsQ.isError,
    budgetsQ.data,
    catalogue,
    offerId,
    funnel.key,
    offerable,
  ]);

  const columns = useMemo(
    () =>
      buildLegColumns({
        legs,
        channels: funnelChannels,
        savedCentsBySlug,
        runningBySlug,
      }),
    [legs, funnelChannels, savedCentsBySlug, runningBySlug],
  );

  /**
   * What this channel charges for the outcome of this arrow.
   *
   * `Free` is a fact about the CHANNEL (the customer works it themselves), so it needs
   * no measurement and is stated the moment the catalogue is there. A price is a fact
   * about the FLEET, so it exists only once someone has spent through that pair — and a
   * platform channel nobody has run yet reads `Learning`, the word this dashboard
   * already uses for a figure withheld for want of evidence. Never a zero, which would
   * read as free.
   *
   * WHICH of the two unpriced words it reads is the channel's own running state: one
   * that is running is accumulating the evidence, so it reads `Learning`; one that is
   * paused or was never funded is not, so `Learning` there would promise a figure that
   * cannot arrive until someone turns it on, and it reads `Unknown cost` instead. Both
   * read the SAME running answer the status pill below states, so a card cannot say
   * `Learning` above a pill saying `Paused`.
   *
   * `settled` is what keeps both honest: before the price list lands we do not know which
   * of the states a card is in, and stating a verdict that a price then replaces is the
   * surface contradicting itself a moment later.
   *
   * The step is indexed by the arrow's own `toIndex` and NAMED from this funnel's own
   * `steps`: the producer calls the reply funnel's first step "Positive reply" while
   * this app reads "Sales interest", so the words come from here and only the position
   * crosses the boundary.
   */
  const priceFor = useCallback(
    (
      toIndex: number,
      channel: { featureSlug: string; operatedBy: string | null },
      running: boolean | undefined,
    ) =>
      legChannelPrice({
        operatedBy: channel.operatedBy,
        settled: economicsQ.data !== undefined || economicsQ.isError,
        running,
        costPerStepUsd: economicsQ.data
          ? channelStepCostUsd({
              pairs: economicsQ.data,
              channelSlug: channel.featureSlug,
              funnelKey: funnel.key,
              stepIndex: toIndex,
              expectedStepCount: funnel.steps.length,
            })
          : null,
      }),
    [economicsQ.data, economicsQ.isError, funnel.key, funnel.steps.length],
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
                  price={priceFor(col.leg.toIndex, card.channel, runningBySlug?.[card.channel.featureSlug])}
                  stepLabel={funnel.steps[col.leg.toIndex] ?? ""}
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

/** One word per state. `unknown` never renders — the tile draws a skeleton for it. */
const STATE_LABEL: Record<LegChannelState, string> = {
  running: "Running",
  paused: "Paused",
  not_funded: "Not funded",
  unknown: "",
};

/**
 * One channel under one arrow.
 *
 * A `role="button"` div rather than a `<button>`: the card carries its own status pill
 * and its own figures, and a nested interactive element inside a button is invalid HTML.
 */
function LegChannelTile({
  card,
  pending,
  price,
  stepLabel,
  onOpen,
}: {
  card: LegChannelCard;
  pending: boolean;
  /** What it costs per outcome of this arrow, or null when there is nothing to state. */
  price: LegChannelPrice | null;
  /** The arrow's destination step, in the FUNNEL's own words. */
  stepLabel: string;
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
        {/* The price, in the brand's TERTIARY — the same accent and the same tile the
            Learning tag wears on every campaign surface, carrying `tone-tile` so on a
            customer's dashboard it is THEIR tertiary rather than ours.
            A RUNNING channel the fleet has not spent enough through says so in the
            dashboard's own word for that, through the SHARED `LearningTag`: one component
            owns `Learning` everywhere, so this card cannot come to say it differently. It
            carries no `(i)` — the card is small, and the tag sits beside two other figures.
            A channel that is PAUSED or was never funded reads `Unknown cost` in the pause
            grey instead: nothing is running, so no figure is coming, and `Learning` there
            would promise one that cannot arrive. Grey rather than the tertiary, and no
            `tone-tile`: that is a verdict, and a verdict never rotates with the brand hue.
            Null is none of them: a read has not landed, so the slot holds its own size
            rather than stating a verdict a price would replace. */}
        {price === null ? (
          <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
        ) : price.kind === "learning" ? (
          <span className="shrink-0">
            <LearningTag withInfo={false} />
          </span>
        ) : price.kind === "unknown" ? (
          <span className="shrink-0 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-gray-500">
            Unknown cost
          </span>
        ) : (
          <span className="tone-tile shrink-0 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-orange-600">
            {legPriceLabel(price, stepLabel, formatUsdAdaptive)}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between">
        {/* What the channel is DOING, never what it is funded at. Green means a
            campaign is live; a funded channel that has been stopped reads Paused and
            still states its ceiling, because that is exactly what is true of it. A
            channel at zero is not an error and not a warning — it is one the brand has
            not bought, so it reads plain. */}
        {card.state === "unknown" ? (
          <Skeleton className="h-5 w-20 rounded-full" />
        ) : (
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              card.state === "running" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
            }`}
          >
            {STATE_LABEL[card.state]}
          </span>
        )}
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
