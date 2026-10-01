"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { invalidateConversionRates } from "@/lib/write-invalidation";
import { v2Href, v2OfferHref } from "@/lib/v2/routes";
import { SALES_PATH_CHANNEL_SLUGS } from "@/lib/offer-sales-path";
import { isColdEmailChannel } from "@/lib/offer-levers-home";
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
import { AcquisitionChannelMark } from "@/components/marks/acquisition-channel-mark";
import { EmptyNote, SectionTitle, Shimmer } from "@/components/v2/ui";
import { V2Page, offerTabs, useOfferName } from "@/components/v2/setup-pages";

const GIVE_FIELDS = [
  { key: "giveForFree", label: "We give for free" },
  { key: "neverGive", label: "We never give" },
] as const;

/**
 * An offer's channels (beta): per leg its sales path validated, the brand's conversion
 * rate on that leg, the channels that can work it and each channel's own settings.
 * Cold email's settings are the offer's two give lists, on the offer's user-fields
 * (what content-generation reads on every email). Everything saves on its own when the
 * field is left: no Save button. Which channel works a leg is not stored anywhere yet,
 * so the channels are listed, not picked.
 */
export function V2OfferChannelsPage() {
  const { orgId, brandId, offerId } = useParams<{ orgId: string; brandId: string; offerId: string }>();
  const name = useOfferName(brandId, offerId);
  const isBeta = useIsBetaUser();
  const catalogue = useLegCatalogue();
  const channels = useAcquisitionChannels();
  const qc = useQueryClient();

  const path = useAuthQuery(["offerSalesPath", brandId, offerId], () => getOfferSalesPath(brandId, offerId), {
    enabled: isBeta && !!offerId,
  });
  const fields = useAuthQuery(["offerUserFields", brandId, offerId], () => getOfferUserFields(brandId, offerId), {
    ...pollOptions,
    enabled: isBeta && !!brandId && !!offerId,
  });
  // The EFFECTIVE rate per leg (features-service): measured, else what the brand stated,
  // else the fleet median, else a benchmark. Never re-derived here.
  const rates = useAuthQuery(["brandConversionRates", brandId], () => getBrandConversionRates(brandId), {
    ...pollOptions,
    enabled: isBeta && !!brandId,
  });

  const { sections, unknown } = useMemo(
    () => validatedLegSections(catalogue, path.data?.legKeys ?? [], SALES_PATH_CHANNEL_SLUGS),
    [catalogue, path.data],
  );
  useEffect(() => {
    if (catalogue.legs.size > 0 && unknown.length > 0) {
      console.error("[offer-channels] saved legs the catalogue does not list", { offerId, unknown });
    }
  }, [catalogue.legs.size, unknown, offerId]);

  const served = useMemo<GiveLists | null>(() => giveListsFrom(fields.data?.fields), [fields.data]);
  const suggested = useMemo(() => {
    const f = fields.data?.fields;
    return GIVE_FIELDS.some((g) => f?.[g.key]?.provenance !== "confirmed" && giveListLines(f?.[g.key]?.value).length > 0);
  }, [fields.data]);

  if (!isBeta) return null;

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
  const channelDef = (slug: string) => channels.find((c) => c.featureSlug === slug);

  return (
    <V2Page
      crumbs={[
        { label: "Offers", href: v2Href(orgId, brandId, "offers") },
        { label: name ?? " ", href: v2OfferHref(orgId, brandId, offerId) },
        { label: "Channels" },
      ]}
      title={name ?? " "}
      sub="What each channel may and may not do, on every leg of this offer's sales path. Click a value to change it."
      tabs={offerTabs(orgId, brandId, offerId, "channels", isBeta)}
      width="max-w-[1280px]"
    >
      {!pathSettled || catalogue.legs.size === 0 ? (
        <div className="space-y-2">
          <Shimmer className="h-10 rounded-[10px]" />
          <Shimmer className="h-10 rounded-[10px]" />
          <Shimmer className="h-10 rounded-[10px]" />
        </div>
      ) : path.isError && !path.data ? (
        <EmptyNote>Could not read this offer&apos;s sales path.</EmptyNote>
      ) : sections.length === 0 ? (
        <div className="k-card">
          <EmptyNote>
            No leg of this offer&apos;s sales path is validated yet.{" "}
            <Link href={v2OfferHref(orgId, brandId, offerId, "sales-path")} className="text-[var(--accent)] hover:underline">
              Open the sales path
            </Link>
          </EmptyNote>
        </div>
      ) : (
        <div className="space-y-8">
          {sections.map((s) => {
            const rate = s.fromKey === null ? undefined : legRateFor(rates.data?.legs ?? [], s.legKey);
            return (
              <section key={s.legKey}>
                <SectionTitle
                  count={s.channels.length}
                  right={
                    s.fromKey === null ? null : !ratesSettled ? (
                      <Shimmer className="h-5 w-24 rounded-[6px]" />
                    ) : rates.isError && !rates.data ? (
                      <span>Could not read the conversion rate</span>
                    ) : rate ? (
                      <InlineRate key={`${rate.fromStep}|${rate.toStep}`} rate={rate} onSave={(v) => saveRate(rate, v)} />
                    ) : (
                      <MissingRate leg={s.legKey} />
                    )
                  }
                >
                  {stepLabel(s.fromKey)} <span className="k-fg3">→</span> {stepLabel(s.toKey)}
                </SectionTitle>
                <ul className="k-card divide-y divide-[var(--line-subtle)] overflow-hidden">
                  {s.channels.length === 0 && (
                    <li className="flex items-center gap-3 px-4 py-3">
                      <span className="min-w-0 flex-1 text-[13px]">Your team</span>
                      <span className="k-fg3 text-[12px]">No settings</span>
                    </li>
                  )}
                  {s.channels.map((slug) => {
                    const def = channelDef(slug);
                    const hasSettings = isColdEmailChannel(slug);
                    return (
                      <li key={slug} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {def && <AcquisitionChannelMark def={def} size="xs" />}
                          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{def?.name ?? slug}</span>
                          {!hasSettings && <span className="k-fg3 text-[12px]">No settings</span>}
                          {hasSettings && suggested && <span className="k-chip">Suggested, not saved</span>}
                        </div>
                        {hasSettings && (
                          <div className="mt-3">
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
                                  <InlineList
                                    key={g.key}
                                    id={`${s.legKey}-${g.key}`}
                                    label={g.label}
                                    lines={served[g.key]}
                                    onSave={(lines) => saveList(g.key, lines)}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </V2Page>
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
function giveListsFrom(f: BrandUserFields | undefined): GiveLists | null {
  if (!f) return null;
  return { giveForFree: giveListLines(f.giveForFree?.value), neverGive: giveListLines(f.neverGive?.value) };
}
