"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getOfferSalesPath, getOfferUserFields, saveOfferUserFields, type BrandUserFields } from "@/lib/api";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { v2Href, v2OfferHref } from "@/lib/v2/routes";
import { SALES_PATH_CHANNEL_SLUGS } from "@/lib/offer-sales-path";
import { isColdEmailChannel } from "@/lib/offer-levers-home";
import {
  giveListLines,
  giveListsEqual,
  giveListsPayload,
  parseGiveListText,
  validatedLegSections,
  type GiveLists,
} from "@/lib/offer-channel-settings";
import { AcquisitionChannelMark } from "@/components/marks/acquisition-channel-mark";
import { EmptyNote, SectionTitle, Shimmer } from "@/components/v2/ui";
import { V2Page, offerTabs, useOfferName } from "@/components/v2/setup-pages";

type GiveDraft = { giveForFree: string; neverGive: string };

const GIVE_FIELDS = [
  { key: "giveForFree", label: "We give for free", placeholder: "A free audit\nA 20 minute call" },
  { key: "neverGive", label: "We never give", placeholder: "Discounts\nFree samples" },
] as const;

/**
 * An offer's channels (beta): per leg its sales path validated, the channels that can
 * work it and each channel's own settings. Cold email's settings are the offer's two
 * give lists, read and written on the offer's user-fields, the store content-generation
 * reads on every email. Which channel works a leg is not stored anywhere yet, so the
 * channels are listed, not picked.
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

  const { sections, unknown } = useMemo(
    () => validatedLegSections(catalogue, path.data?.legKeys ?? [], SALES_PATH_CHANNEL_SLUGS),
    [catalogue, path.data],
  );
  useEffect(() => {
    if (catalogue.legs.size > 0 && unknown.length > 0) {
      console.error("[offer-channels] saved legs the catalogue does not list", { offerId, unknown });
    }
  }, [catalogue.legs.size, unknown, offerId]);

  const baseline = useMemo<GiveLists | null>(() => giveListsFrom(fields.data?.fields), [fields.data]);
  const suggested = useMemo(() => {
    const f = fields.data?.fields;
    return GIVE_FIELDS.some((g) => f?.[g.key]?.provenance !== "confirmed" && giveListLines(f?.[g.key]?.value).length > 0);
  }, [fields.data]);

  // null = follow what brand-service serves; an object = the user's working text.
  const [draft, setDraft] = useState<GiveDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isBeta) return null;

  const shown: GiveDraft = draft ?? {
    giveForFree: (baseline?.giveForFree ?? []).join("\n"),
    neverGive: (baseline?.neverGive ?? []).join("\n"),
  };
  const edited: GiveLists = { giveForFree: parseGiveListText(shown.giveForFree), neverGive: parseGiveListText(shown.neverGive) };
  const dirty = draft !== null && baseline !== null && !giveListsEqual(edited, baseline);

  const edit = (key: keyof GiveDraft, text: string) => {
    setSaved(false);
    setError(null);
    setDraft({ ...shown, [key]: text });
  };

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await saveOfferUserFields(brandId, offerId, giveListsPayload(edited));
      qc.setQueryData(["offerUserFields", brandId, offerId], res);
      // setQueryData never reaches the on-disk cache: re-read so a reload paints the saved lists.
      await qc.invalidateQueries({ queryKey: ["offerUserFields", brandId, offerId] });
      setDraft(null);
      setSaved(true);
    } catch (err) {
      console.error("[offer-channels] give lists save failed", err);
      setError("Could not save these lists. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const pathSettled = path.isFetchedAfterMount || path.data !== undefined;
  const fieldsSettled = fields.isFetchedAfterMount || fields.data !== undefined;
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
      sub="What each channel may and may not do, on every leg of this offer's sales path."
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
          {sections.map((s) => (
            <section key={s.legKey}>
              <SectionTitle count={s.channels.length}>
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
                              <Shimmer className="h-[132px] rounded-[8px]" />
                              <Shimmer className="h-[132px] rounded-[8px]" />
                            </div>
                          ) : fields.isError && !fields.data ? (
                            <p className="k-fg3 text-[13px]">Could not read this offer&apos;s give lists.</p>
                          ) : (
                            <>
                              <div className="grid gap-3 sm:grid-cols-2">
                                {GIVE_FIELDS.map((g) => {
                                  const id = `${s.legKey}-${g.key}`;
                                  const count = parseGiveListText(shown[g.key]).length;
                                  return (
                                    <div key={g.key} className="min-w-0">
                                      <div className="mb-1.5 flex items-baseline justify-between gap-2">
                                        <label htmlFor={id} className="k-label">
                                          {g.label}
                                        </label>
                                        <span className="k-fg3 text-[12px] tabular-nums">{count === 0 ? "Empty" : `${count} ${count === 1 ? "item" : "items"}`}</span>
                                      </div>
                                      <textarea
                                        id={id}
                                        value={shown[g.key]}
                                        onChange={(e) => edit(g.key, e.target.value)}
                                        placeholder={g.placeholder}
                                        rows={5}
                                        // k-input pins a 28px control height; this field holds a list.
                                        style={{ height: "auto" }}
                                        className="k-input w-full resize-y px-2.5 py-2 text-[13px] leading-[20px]"
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="mt-2.5 flex min-h-7 items-center justify-end gap-2">
                                {error && <span className="mr-auto text-[12px] text-[var(--data-rose)]">{error}</span>}
                                {!dirty && saved && <span className="k-fg3 text-[12px]">Saved</span>}
                                {dirty && (
                                  <>
                                    <span className="k-fg3 mr-auto text-[12px]">One item per line. Every cold email of this offer follows these lists.</span>
                                    <button type="button" className="k-btn-ghost h-7 px-2.5" onClick={() => setDraft(null)} disabled={saving}>
                                      Discard
                                    </button>
                                    <button type="button" className="k-btn-strong h-7 px-3" onClick={save} disabled={saving}>
                                      {saving ? "Saving…" : "Save"}
                                    </button>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </V2Page>
  );
}

/** The two lists as brand-service serves them; null until the read answers. */
function giveListsFrom(f: BrandUserFields | undefined): GiveLists | null {
  if (!f) return null;
  return { giveForFree: giveListLines(f.giveForFree?.value), neverGive: giveListLines(f.neverGive?.value) };
}
