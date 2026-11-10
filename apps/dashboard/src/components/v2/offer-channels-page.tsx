"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import {
  getBrandConversionRates,
  listSalesFunnelCampaigns,
  stateBrandLegRates,
  type EffectiveLegRate,
} from "@/lib/api";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { invalidateConversionRates } from "@/lib/write-invalidation";
import { SALES_PATH_CHANNEL_SLUGS } from "@/lib/offer-sales-path";
import { formatRatePct, LEG_RATE_RULE, rateSourceLabel, roundLegRatePct } from "@/lib/brand-conversion-rates";
import { legRateFor, parseRatePct, validatedLegSections } from "@/lib/offer-channel-settings";
import { EmptyNote, Shimmer } from "@/components/v2/ui";
import { isProactiveFrom } from "@/lib/outbound-leg-key";

/**
 * Cold email's settings on one offer: the brand's conversion rate on each validated leg
 * cold email works. Saves on its own when the field is left: no Save button. The offer's
 * give lists live on the offer page (`offer-give-lists.tsx`, owner 2026-11-03).
 */
export function ColdEmailChannelSettings({ brandId, offerId, channelSlug }: { brandId: string; offerId: string; channelSlug: string }) {
  const catalogue = useLegCatalogue();
  const qc = useQueryClient();

  // The legs this offer sells through: its campaigns' parts, each campaign a sales funnel (owner
  // 2026-10-10; brand-service's per-offer ticked legs are retired).
  const path = useAuthQuery(["salesFunnelCampaigns", brandId, offerId], () => listSalesFunnelCampaigns(brandId, offerId), {
    ...pollOptions,
    enabled: !!brandId && !!offerId,
  });
  // The EFFECTIVE rate per leg (features-service): measured, else what the brand stated,
  // else the fleet median, else a benchmark. Never re-derived here.
  const rates = useAuthQuery(["brandConversionRates", brandId], () => getBrandConversionRates(brandId), {
    ...pollOptions,
    enabled: !!brandId,
  });

  const legs = useMemo(
    () =>
      validatedLegSections(catalogue, [...new Set((path.data ?? []).flatMap((c) => c.units.flatMap((u) => (u.legKey ? [u.legKey] : []))))], SALES_PATH_CHANNEL_SLUGS).sections.filter(
        (s) => s.channels.includes(channelSlug) && !isProactiveFrom(s.fromKey),
      ),
    [catalogue, path.data, channelSlug],
  );

  /** Writes the brand's OWN rate (null clears it, back to the median); the effective rate is re-read, never guessed. */
  const saveRate = async (rate: EffectiveLegRate, ratePct: number | null) => {
    if (rate.manualRatePct === ratePct) return;
    await stateBrandLegRates(brandId, [{ fromStep: rate.fromStep, toStep: rate.toStep, ratePct }]);
    // A rate prices every money figure: re-read all of them, and wait for this one.
    invalidateConversionRates(qc);
    await qc.refetchQueries({ queryKey: ["brandConversionRates", brandId] });
  };

  const pathSettled = path.isFetchedAfterMount || path.data !== undefined;
  const ratesSettled = rates.isFetchedAfterMount || rates.data !== undefined;
  const stepLabel = (step: string | null) => (step ? catalogue.steps.get(step)?.label ?? step : "Start");

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
        <div>
          <h2 className="text-[14px] font-medium">Conversion rates</h2>
          <p className="k-fg3 mt-1 text-[12px]">Shared by every offer of this brand.</p>
        </div>
        {!pathSettled || catalogue.legs.size === 0 ? (
          <Shimmer className="h-20 rounded-[12px]" />
        ) : path.isError && !path.data ? (
          <div className="k-card"><EmptyNote>Could not read this offer&apos;s campaigns.</EmptyNote></div>
        ) : legs.length === 0 ? (
          <div className="k-card"><EmptyNote>No step after the first one is validated for cold email yet.</EmptyNote></div>
        ) : (
          <ul className="k-card divide-y divide-[var(--line-subtle)] overflow-hidden">
            {legs.map((s) => {
              const rate = legRateFor(rates.data?.legs ?? [], s.legKey);
              return (
                <li key={s.legKey} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    {stepLabel(s.fromKey)} <span className="k-fg3">→</span> {stepLabel(s.toKey)}
                  </span>
                  {!ratesSettled ? (
                    <Shimmer className="h-5 w-24 rounded-[6px]" />
                  ) : rates.isError && !rates.data ? (
                    <span className="k-fg3 text-[12px]">Could not read the conversion rate</span>
                  ) : rate ? (
                    <InlineRate key={`${rate.fromStep}|${rate.toStep}`} rate={rate} onSave={(v) => saveRate(rate, v)} />
                  ) : (
                    <MissingRate leg={s.legKey} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * The brand's conversion rate on one leg, as text that turns into an input on click.
 * Leaving the field (or Enter) saves the brand's own rate; empty clears it, and the
 * leg falls back to the median. Shared by every offer of the brand (the hover title).
 */
/** `bare`: the rate alone, for a surface that already states the leg and its source (Today's panel). */
export function InlineRate({
  rate,
  onSave,
  bare = false,
}: {
  rate: EffectiveLegRate;
  onSave: (ratePct: number | null) => Promise<void>;
  bare?: boolean;
}) {
  const [text, setText] = useState<string | null>(null);
  const [pending, setPending] = useState<number | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const shown = pending !== undefined ? pending : rate.effectiveRatePct;

  const commit = async () => {
    if (text === null) return;
    const parsed = parseRatePct(text);
    if (!parsed.ok) {
      setError(LEG_RATE_RULE);
      return;
    }
    setText(null);
    setError(null);
    setPending(parsed.value);
    try {
      await onSave(parsed.value);
    } catch (err) {
      console.error("[offer-channels] leg rate save failed", { rate, err });
      setText(parsed.value === null ? "" : String(parsed.value));
      setError("Not saved. Try again.");
    } finally {
      setPending(undefined);
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-[var(--data-rose)]">{error}</span>}
      {!bare && <span className="k-label">Conversion rate</span>}
      {!bare && text === null && pending === undefined && <span className="k-fg3">{rateSourceLabel(rate)}</span>}
      {text !== null ? (
        <input
          autoFocus
          inputMode="decimal"
          aria-label="Conversion rate, percent"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setText(null);
              setError(null);
            }
          }}
          placeholder="%"
          className="k-input h-6 w-16 px-2 text-right text-[12px] tabular-nums"
        />
      ) : (
        <button
          type="button"
          title="Shared by every offer of this brand"
          onClick={() => setText(String(rate.manualRatePct != null ? roundLegRatePct(rate.manualRatePct) : shown === null ? "" : roundLegRatePct(shown)))}
          className="k-hover h-6 rounded-[6px] px-1.5 text-[13px] tabular-nums"
        >
          {shown === null ? <span className="k-fg4">—</span> : <span className="k-fg">{formatRatePct(shown)}</span>}
        </button>
      )}
    </span>
  );
}

/**
 * A leg between two steps with no effective rate: features-service names it under labels
 * the catalogue does not use. A producer bug, said out loud rather than filled in here.
 */
function MissingRate({ leg }: { leg: string }) {
  useEffect(() => {
    console.error("[offer-channels] features-service serves no conversion rate for this leg", { leg });
  }, [leg]);
  return <span>No conversion rate served for this leg</span>;
}
