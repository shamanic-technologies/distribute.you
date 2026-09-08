"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getFleetFunnelReturn, getOfferSalesFunnels } from "@/lib/api";
import { Skeleton } from "@/components/skeleton";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { SalesFunnelMark } from "@/components/marks/sales-funnel-mark";
import { formatUsdAdaptive } from "@/lib/format-number";
import { formatRoi } from "@/lib/format-roi";
import { channelSlugLabel } from "@/lib/campaign-title";
import { acquisitionChannelForFeatureSlug } from "@/lib/acquisition-channels";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import {
  FUNNEL_BLURB,
  fleetFunnelState,
  undeclaredFunnels,
  type FleetFunnelState,
} from "@/lib/offer-funnel-catalogue";

const RETURN_TIP =
  "The median across our clients of what a dollar through this funnel came back as, on the channel where it came back most. It is their expected pipeline over what they spent, so read it as what the path has done for them and not as a forecast for you.";

const CAC_TIP =
  "The median across those clients of what one paying client cost them through this funnel. It is what they paid, not a price we are quoting you.";

/**
 * The funnels this offer does NOT sell through yet, one card each.
 *
 * The table above lists what a customer already stated, so the paths they are not on
 * are invisible: they cannot see that a fifth way exists, what it is, or whether it
 * pays for anybody else. These cards state all three, and stop there.
 *
 * They WRITE NOTHING. Declaring a funnel is Offer Settings' Sales Funnels card and it is
 * the only writer of it — a second one is how two surfaces come to disagree about what a
 * brand said it sells. The card offers the way there and nothing more.
 *
 * Every figure is served verbatim. The fleet's return and the price it rests on come off
 * ONE pair, the best-returning channel for that funnel, never an average across channels:
 * an average describes no channel anybody could buy.
 */
export function OfferFunnelCatalogue({
  brandId,
  offerId,
  settingsHref,
}: {
  brandId: string;
  offerId: string;
  settingsHref: string;
}) {
  // What this offer has STATED, from brand-service's own declaration rather than from
  // the money view above it. A funnel declared and never funded carries no revenue row,
  // so reading the table would offer it back as something the customer has never tried.
  // The key is byte-equal to the one Offer Settings polls, so the two share an entry.
  const declaredQ = useAuthQuery(
    ["offerSalesFunnels", brandId, offerId],
    () => getOfferSalesFunnels(brandId, offerId),
    { enabled: Boolean(brandId && offerId) },
  );

  // What our other clients GOT through each funnel. Public and org-less on purpose: a
  // card offering a funnel nobody here sells has no spend of its own to price it with.
  // One read for every card on the page.
  //
  // Deliberately NOT the channel-funnel price list this card used to read. That one is a
  // projection through the fleet's mean declared rates and its mean lifetime revenue, so
  // it describes no client in particular; this is the middle client's own realized
  // return, which is the figure a reader is entitled to compare their own against.
  const economicsQ = useAuthQuery(["fleetFunnelReturn"], () => getFleetFunnelReturn());

  const channels = useAcquisitionChannels();

  const missing = useMemo(
    () => undeclaredFunnels((declaredQ.data?.funnels ?? []).map((f) => f.funnelKey)),
    [declaredQ.data],
  );

  // Reveal on SETTLE. A failed declaration read is the one thing that must hide the
  // whole section: without it we cannot tell a funnel the customer never stated from one
  // they already sell, and offering a funnel they run reads as the product forgetting.
  const declaredSettled = declaredQ.data !== undefined;
  const economicsSettled = economicsQ.data !== undefined || economicsQ.isError;

  if (declaredQ.isPending && !declaredQ.isError) {
    return (
      <section className="space-y-3">
        <Skeleton className="h-4 w-48 rounded" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      </section>
    );
  }
  if (!declaredSettled || missing.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Other ways to sell this offer</h2>
        <p className="mt-1 text-sm text-gray-500 max-w-3xl">
          Paths this offer does not sell through yet, and what each one returned for the
          clients who do.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {missing.map((def) => {
          const state = fleetFunnelState({
            pairs: economicsQ.data,
            funnelKey: def.key,
            settled: economicsSettled,
            errored: economicsQ.isError,
          });
          return (
            <article
              key={def.key}
              className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <SalesFunnelMark def={def} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{def.name}</p>
                  {/* WRAPS rather than truncates: the whole point of the card is what
                      this funnel is, and a four-step path losing its last step to an
                      ellipsis answers half the question. The cards stretch to one row
                      height anyway, so the second line costs nothing. */}
                  <p className="text-xs text-gray-500">{def.steps.join("  →  ")}</p>
                </div>
              </div>

              <p className="text-xs leading-5 text-gray-600">{FUNNEL_BLURB[def.key]}</p>

              <FleetFigures state={state} channels={channels} />

              <Link
                href={settingsHref}
                className="mt-auto inline-flex w-fit items-center rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-600 transition hover:bg-brand-100"
              >
                Set this funnel up
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/**
 * The fleet block of one card.
 *
 * Four states, and three of them say different things. An unsettled read draws a
 * skeleton over the figures alone, so the card's own shell (its name, its steps, its
 * blurb and its way in) is on screen from the first paint. A read that FAILED states
 * nothing at all: we have no opinion, and reporting it as unmeasured would be a claim
 * about the fleet we cannot make. `$ CAC` is dropped rather than dashed when the
 * producer states no cost per paying client, because a free-standing figure with a dash
 * under a label reads as a number we looked for and lost.
 *
 * `thin` is the fleet's own verdict and it is a TAG, never a number: too few clients
 * are past the spend floor for a median to describe anything, so the card says so and
 * states nothing else. It deliberately names NEITHER the floor NOR how many clients are
 * behind it — both are our own bookkeeping, they answer a question nobody asked, and
 * printing a count next to a refusal invites a reader to do the arithmetic themselves.
 */
function FleetFigures({
  state,
  channels,
}: {
  state: FleetFunnelState | null;
  channels: ReturnType<typeof useAcquisitionChannels>;
}) {
  if (state === null) {
    return (
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="h-3 w-40 rounded" />
      </div>
    );
  }
  if (state.kind === "unread") return null;
  if (state.kind === "thin") {
    // Full-perimeter 1px border, per the no-side-accent rule; the brand ramp so the pill
    // rotates with the customer's own tint rather than staying our blue. Every class is
    // in the `html.dark` remapped set, tinted and untinted alike.
    return (
      <span className="inline-flex w-fit items-center rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-brand-600">
        Not enough data yet
      </span>
    );
  }

  const channel = acquisitionChannelForFeatureSlug(state.channelSlug, channels);
  const channelName =
    channel?.name ?? state.channelName ?? channelSlugLabel(state.channelSlug);

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="inline-flex items-baseline gap-1">
          <span className="text-xs text-gray-500">Median return</span>
          <span className="text-sm font-semibold text-gray-800">
            {formatRoi(state.medianReturnPerDollar)}
          </span>
          <InfoTooltip tip={RETURN_TIP} />
        </span>
        {state.medianCostPerPaidClientUsd !== null && (
          <span className="inline-flex items-baseline gap-1">
            <span className="text-xs text-gray-500">$ CAC</span>
            <span className="text-sm font-semibold text-gray-800">
              {formatUsdAdaptive(state.medianCostPerPaidClientUsd)}
            </span>
            <InfoTooltip tip={CAC_TIP} />
          </span>
        )}
      </div>
      <p className="text-[11px] text-gray-400">
        via {channelName}
        {state.brandCount !== null && <> · across {state.brandCount} clients</>}
      </p>
    </div>
  );
}
