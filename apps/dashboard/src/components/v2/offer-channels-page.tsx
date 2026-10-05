"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import {
  getBrandConversionRates,
  getOfferSalesPath,
  getOfferUserFields,
  saveOfferUserFields,
  stateBrandLegRates,
  type EffectiveLegRate,
  type BrandUserFields,
} from "@/lib/api";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { invalidateConversionRates } from "@/lib/write-invalidation";
import { SALES_PATH_CHANNEL_SLUGS } from "@/lib/offer-sales-path";
import { formatRatePct, LEG_RATE_RULE, rateSourceLabel, roundLegRatePct } from "@/lib/brand-conversion-rates";
import {
  giveListLines,
  giveListsEqual,
  giveListsPayload,
  legRateFor,
  parseGiveListText,
  parseRatePct,
  validatedLegSections,
  type GiveLists,
} from "@/lib/offer-channel-settings";
import { EmptyNote, Shimmer } from "@/components/v2/ui";

const GIVE_FIELDS = [
  { key: "giveForFree", label: "We give for free" },
  { key: "neverGive", label: "We never give" },
] as const;

/**
 * Cold email's settings on one offer: what its emails may give and never give (the
 * offer's two give lists, on its user-fields, what content-generation reads on every
 * email) and the brand's conversion rate on each validated leg cold email works.
 * Everything saves on its own when the field is left: no Save button.
 */
export function ColdEmailChannelSettings({ brandId, offerId, channelSlug }: { brandId: string; offerId: string; channelSlug: string }) {
  const catalogue = useLegCatalogue();
  const qc = useQueryClient();

  const path = useAuthQuery(["offerSalesPath", brandId, offerId], () => getOfferSalesPath(brandId, offerId), {
    enabled: !!offerId,
  });
  const fields = useAuthQuery(["offerUserFields", brandId, offerId], () => getOfferUserFields(brandId, offerId), {
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
      validatedLegSections(catalogue, path.data?.legKeys ?? [], SALES_PATH_CHANNEL_SLUGS).sections.filter(
        (s) => s.channels.includes(channelSlug) && s.fromKey !== null,
      ),
    [catalogue, path.data, channelSlug],
  );

  const served = useMemo<GiveLists | null>(() => giveListsFrom(fields.data?.fields), [fields.data]);
  const suggested = useMemo(() => {
    const f = fields.data?.fields;
    return GIVE_FIELDS.some((g) => f?.[g.key]?.provenance !== "confirmed" && giveListLines(f?.[g.key]?.value).length > 0);
  }, [fields.data]);

  /** One list changed: both keys go out (an omitted key is left as stored, an emptied one is []). */
  const saveList = async (key: keyof GiveLists, lines: string[]) => {
    if (!served) throw new Error("[offer-channels] give lists not read yet");
    const next = { ...served, [key]: lines };
    if (giveListsEqual(next, served)) return;
    const res = await saveOfferUserFields(brandId, offerId, giveListsPayload(next));
    qc.setQueryData(["offerUserFields", brandId, offerId], res);
    // setQueryData never reaches the on-disk cache: re-read so a reload paints the saved lists.
    await qc.invalidateQueries({ queryKey: ["offerUserFields", brandId, offerId] });
  };

  /** Writes the brand's OWN rate (null clears it, back to the median); the effective rate is re-read, never guessed. */
  const saveRate = async (rate: EffectiveLegRate, ratePct: number | null) => {
    if (rate.manualRatePct === ratePct) return;
    await stateBrandLegRates(brandId, [{ fromStep: rate.fromStep, toStep: rate.toStep, ratePct }]);
    // A rate prices every money figure: re-read all of them, and wait for this one.
    invalidateConversionRates(qc);
    await qc.refetchQueries({ queryKey: ["brandConversionRates", brandId] });
  };

  const pathSettled = path.isFetchedAfterMount || path.data !== undefined;
  const fieldsSettled = fields.isFetchedAfterMount || fields.data !== undefined;
  const ratesSettled = rates.isFetchedAfterMount || rates.data !== undefined;
  const stepLabel = (step: string | null) => (step ? catalogue.steps.get(step)?.label ?? step : "Start");

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
        <div>
          <h2 className="text-[14px] font-medium">What emails may offer</h2>
          <p className="k-fg3 mt-1 text-[12px]">Every email reads these two lists.</p>
          {suggested && <span className="k-chip mt-2 inline-flex">Suggested, not saved</span>}
        </div>
        <div className="k-card p-4">
          {!fieldsSettled ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Shimmer className="h-[88px] rounded-[8px]" />
              <Shimmer className="h-[88px] rounded-[8px]" />
            </div>
          ) : (fields.isError && !fields.data) || !served ? (
            <p className="k-fg3 text-[13px]">Could not read this offer&apos;s give lists.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {GIVE_FIELDS.map((g) => (
                <InlineList key={g.key} id={`${channelSlug}-${g.key}`} label={g.label} lines={served[g.key]} onSave={(lines) => saveList(g.key, lines)} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
        <div>
          <h2 className="text-[14px] font-medium">Conversion rates</h2>
          <p className="k-fg3 mt-1 text-[12px]">Shared by every offer of this brand.</p>
        </div>
        {!pathSettled || catalogue.legs.size === 0 ? (
          <Shimmer className="h-20 rounded-[12px]" />
        ) : path.isError && !path.data ? (
          <div className="k-card"><EmptyNote>Could not read this offer&apos;s sales path.</EmptyNote></div>
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
 * A list that reads as text and turns into a textarea on click. Leaving the field saves
 * it; while the save is in flight the typed lines are shown, and a refused save reopens
 * the field with the text kept and says so. Esc drops the edit.
 */
function InlineList({
  id,
  label,
  lines,
  onSave,
}: {
  id: string;
  label: string;
  lines: string[];
  onSave: (lines: string[]) => Promise<void>;
}) {
  const [text, setText] = useState<string | null>(null);
  const [pending, setPending] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shown = pending ?? lines;

  const commit = async () => {
    if (text === null) return;
    const next = parseGiveListText(text);
    setText(null);
    setPending(next);
    setError(null);
    try {
      await onSave(next);
    } catch (err) {
      console.error("[offer-channels] give list save failed", { label, err });
      setText(next.join("\n"));
      setError("Not saved. Try again.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="k-label">
          {label}
        </label>
        <span className={`text-[12px] tabular-nums ${error ? "text-[var(--data-rose)]" : "k-fg3"}`}>
          {error ?? (pending ? "Saving…" : shown.length === 0 ? "Empty" : `${shown.length} ${shown.length === 1 ? "item" : "items"}`)}
        </span>
      </div>
      {text !== null ? (
        <textarea
          id={id}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setText(null);
              setError(null);
            }
          }}
          rows={Math.max(3, text.split("\n").length + 1)}
          placeholder="One item per line"
          // k-input pins a 28px control height; this field holds a list.
          style={{ height: "auto" }}
          className="k-input w-full resize-y px-1.5 py-0.5 text-[13px] leading-[20px]"
        />
      ) : (
        <button
          id={id}
          type="button"
          onClick={() => setText(shown.join("\n"))}
          className="k-hover -mx-1.5 block w-[calc(100%+12px)] cursor-text rounded-[6px] px-1.5 py-0.5 text-left text-[13px] leading-[20px]"
        >
          {shown.length === 0 ? (
            <span className="k-fg3">Nothing yet. Click to add.</span>
          ) : (
            <ul className="space-y-0.5">
              {shown.map((l, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="k-fg3">•</span>
                  <span className="min-w-0">{l}</span>
                </li>
              ))}
            </ul>
          )}
        </button>
      )}
    </div>
  );
}

/**
 * The brand's conversion rate on one leg, as text that turns into an input on click.
 * Leaving the field (or Enter) saves the brand's own rate; empty clears it, and the
 * leg falls back to the median. Shared by every offer of the brand (the hover title).
 */
function InlineRate({ rate, onSave }: { rate: EffectiveLegRate; onSave: (ratePct: number | null) => Promise<void> }) {
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
      <span className="k-label">Conversion rate</span>
      {text === null && pending === undefined && <span className="k-fg3">{rateSourceLabel(rate)}</span>}
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

/** The two lists as brand-service serves them; null until the read answers. */
export function giveListsFrom(f: BrandUserFields | undefined): GiveLists | null {
  if (!f) return null;
  return { giveForFree: giveListLines(f.giveForFree?.value), neverGive: giveListLines(f.neverGive?.value) };
}
