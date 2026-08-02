"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/skeleton";
import { MetricLabel } from "@/components/visibility/metric-info";
import { pollOptions } from "@/lib/query-options";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  extractBrandFields,
  fieldResultsToMap,
  getBrandUserFields,
  saveBrandUserFields,
  USER_FIELD_KEYS,
  USER_PROFILE_FIELDS,
} from "@/lib/api";
import type { BrandUserFields, UserFieldKey, UserFieldValue } from "@/lib/api";
import {
  ALL_FIELDS,
  cloneFields,
  fieldsEqual,
  ListEditor,
  TextEditor,
  type ProfileFields,
} from "@/components/brand-profile/field-editor";
import {
  coerceListField,
  coerceTextField,
  OFFER_LEVERS,
} from "@/lib/strategy-model";
import {
  applyExtractionToDraft,
  prefillDefsFor,
  LEVER_PREFILL_KEYS,
  SERVICES_PREFILL_KEYS,
} from "@/lib/offer-prefill";

/**
 * The confirmed user-fields map → a plain fields bag (key → value) the inline
 * editors work with. A list-kind field with no value becomes []; a text one "".
 */
function userFieldsToProfile(fields: BrandUserFields | undefined): ProfileFields {
  const out: ProfileFields = {};
  for (const key of USER_FIELD_KEYS) {
    const v = fields?.[key]?.value;
    if (v != null) out[key] = v;
  }
  return out;
}

/**
 * A fields bag → the saveBrandUserFields PUT body. All 7 user-field keys are sent
 * (every sent key is confirmed server-side), INCLUDING the ones the user emptied.
 * The PUT replaces the value of each key it receives and leaves an omitted key
 * untouched, and a key with no confirmed row falls back to the AI `suggested`
 * prefill on the next read — so omitting empties (the old behaviour) made "clear
 * this field" impossible: the deleted entry came back on the next read. Sending the
 * empty value writes a confirmed-empty row, which clears the field for good.
 * `cloneFields` defaults every key ([] for list, "" for text), so the bag always
 * carries all 7.
 */
function profileToUserFieldsPayload(fields: ProfileFields): Partial<Record<UserFieldKey, UserFieldValue>> {
  const out: Partial<Record<UserFieldKey, UserFieldValue>> = {};
  for (const key of USER_FIELD_KEYS) {
    const v = fields[key];
    const isList = ALL_FIELDS.find((f) => f.key === key)?.kind === "list";
    // Coerce by kind on the way OUT too. cloneFields already normalised the bag, so this
    // is belt-and-braces — but the old `typeof v === "string" ? v.trim() : ""` was the
    // destructive half of the shape-mismatch bug: an array in a text-kind lever was
    // written back as a confirmed-EMPTY row, silently deleting a value the user never
    // touched. Coercing heals the row instead of blanking it.
    out[key] = isList ? coerceListField(v) : coerceTextField(v).trim();
  }
  return out;
}

/**
 * One of the two "Update from my website" buttons on the offer card.
 *
 * The in-flight label stays at full opacity and says what is happening: a disabled
 * button carrying `disabled:opacity-40` fades the very word meant to signal work and
 * reads as a dead control. Only the genuinely-unavailable state fades.
 */
function PrefillButton({
  label,
  pendingLabel,
  pending,
  disabled,
  title,
  onClick,
}: {
  label: string;
  pendingLabel: string;
  pending: boolean;
  disabled: boolean;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      title={title}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 transition ${
        pending ? "cursor-wait" : "hover:bg-brand-100 disabled:opacity-40 disabled:cursor-not-allowed"
      }`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

/**
 * "What we use to optimize your conversion" — the offer through the Alex Hormozi
 * value equation, edited inline. The 7 user-fields are confirmed brand data, and
 * the stronger they are the better each email converts.
 *
 * Moved here from the retired Strategy page, which was a read-only recap of the
 * brand's objective + best model. Brand Settings is where a brand is CHANGED, so
 * this card is the edit surface: each lever is a hover-to-edit zone (the pencil
 * appears on hover); Save confirms the edited values via saveBrandUserFields.
 * The two "Update from my website" buttons are a RESET into the draft — nothing
 * is persisted until the user presses Save.
 */
export function BrandOfferCard({ brandId }: { brandId: string }) {
  const queryClient = useQueryClient();
  // Offer-fields inline edit: null = follow the saved baseline, an object = working edits.
  const [offerDraft, setOfferDraft] = useState<ProfileFields | null>(null);

  // Confirmed user-fields — the 7 offer fields we optimise conversion against.
  // Each carries a provenance ("confirmed" once the user saved it, "suggested"
  // while it is still the AI prefill).
  const { data: userFieldsData, isPending: profilePending } = useAuthQuery(
    ["brandUserFields", brandId],
    () => getBrandUserFields(brandId),
    { ...pollOptions, enabled: !!brandId },
  );

  // Baseline bag = each user-field's value (list-kind default []). The edited
  // levers are saved back as confirmed user-fields; unedited keys are left as-is.
  const offerBaseline = cloneFields(userFieldsToProfile(userFieldsData?.fields));
  const offerFields = offerDraft ?? offerBaseline;
  const offerDirty = offerDraft !== null && !fieldsEqual(offerDraft, offerBaseline);

  const saveOfferMut = useMutation({
    mutationFn: (fields: ProfileFields) => saveBrandUserFields(brandId, profileToUserFieldsPayload(fields)),
    onSuccess: () => {
      setOfferDraft(null);
      queryClient.invalidateQueries({ queryKey: ["brandUserFields", brandId] });
    },
  });

  const setOfferText = (key: string, value: string) =>
    setOfferDraft((prev) => ({ ...(prev ?? offerBaseline), [key]: value }));

  const addOfferItem = (key: string, raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setOfferDraft((prev) => {
      const cur = prev ?? offerBaseline;
      // Coerce a LEGACY string value to a list first, so adding an item to a
      // corrupted socialProof re-persists it as an array on save (heals the row).
      const arr = coerceListField(cur[key]);
      if (arr.some((v) => v.toLowerCase() === value.toLowerCase())) return cur;
      return { ...cur, [key]: [...arr, value] };
    });
  };

  const removeOfferItem = (key: string, value: string) =>
    setOfferDraft((prev) => {
      const cur = prev ?? offerBaseline;
      const arr = coerceListField(cur[key]);
      return { ...cur, [key]: arr.filter((v) => v !== value) };
    });

  const saveOffer = () => {
    if (!offerDirty || saveOfferMut.isPending) return;
    saveOfferMut.mutate(offerFields);
  };

  // ── "Update from my website" ───────────────────────────────────────────────
  // Two buttons, because the two halves of the offer are written from different
  // inputs: the services are read off the site, and the six Hormozi levers are
  // written FROM those services. One button would have to invent the levers before
  // it had settled what the brand actually sells.
  //
  // Both are a RESET into the DRAFT: the fields they own take whatever came back,
  // and a field the extraction did not answer is cleared. Nothing is persisted until
  // the user reviews it and presses Save, which is what makes a destructive reset
  // safe to offer.
  const [prefillError, setPrefillError] = useState<string | null>(null);

  const savedServices = coerceListField(offerBaseline.services);
  const draftServices = coerceListField(offerFields.services);
  const servicesDirty =
    savedServices.length !== draftServices.length ||
    savedServices.some((v, i) => v !== draftServices[i]);

  const prefillServicesMut = useMutation({
    mutationFn: () =>
      extractBrandFields([brandId], prefillDefsFor(SERVICES_PREFILL_KEYS, USER_PROFILE_FIELDS), {
        resetCache: true,
        mode: "suggest",
        // Write these again from scratch. Without it brand-service hands back the
        // value the user already confirmed — it injects confirmed fields into the
        // prompt as authoritative AND overlays them onto the response — so a button
        // that says "update from my website" would return the user's own input.
        regenerateFieldKeys: [...SERVICES_PREFILL_KEYS],
      }),
    onSuccess: (resp) => {
      const map = fieldResultsToMap(resp.fields);
      const targets = ALL_FIELDS.filter((f) => SERVICES_PREFILL_KEYS.includes(f.key));
      setOfferDraft((prev) => applyExtractionToDraft(prev ?? offerBaseline, targets, map));
    },
    // The real error goes to the console; the user gets our own copy. An `apiCall`
    // failure carries the downstream response body verbatim in its message.
    onError: (err) => {
      console.error("[dashboard] offer prefill failed:", err);
      setPrefillError("Could not read your website. Try again.");
    },
  });

  const prefillLeversMut = useMutation({
    // The levers are written FROM the services, and brand-service supplies that
    // itself: it injects the brand's CONFIRMED fields into the generation as
    // authoritative context. So services the user has typed but not saved are
    // invisible to it — confirm them first rather than generating an offer for a
    // list of services the backend has never seen.
    mutationFn: async () => {
      if (servicesDirty) {
        await saveBrandUserFields(brandId, { services: draftServices });
        await queryClient.invalidateQueries({ queryKey: ["brandUserFields", brandId] });
      }
      return extractBrandFields([brandId], prefillDefsFor(LEVER_PREFILL_KEYS, USER_PROFILE_FIELDS), {
        resetCache: true,
        mode: "suggest",
        // Only the levers. The brand's confirmed SERVICES are deliberately left out
        // of this list so they still reach the model as authoritative context — the
        // levers are written from them.
        regenerateFieldKeys: [...LEVER_PREFILL_KEYS],
      });
    },
    onSuccess: (resp) => {
      const map = fieldResultsToMap(resp.fields);
      const targets = ALL_FIELDS.filter((f) => LEVER_PREFILL_KEYS.includes(f.key));
      setOfferDraft((prev) => applyExtractionToDraft(prev ?? offerBaseline, targets, map));
    },
    // The real error goes to the console; the user gets our own copy. An `apiCall`
    // failure carries the downstream response body verbatim in its message.
    onError: (err) => {
      console.error("[dashboard] offer prefill failed:", err);
      setPrefillError("Could not read your website. Try again.");
    },
  });

  const prefilling = prefillServicesMut.isPending || prefillLeversMut.isPending;
  // With no services at all there is nothing for the levers to be about.
  const leversBlockedOnServices = draftServices.length === 0;

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-800">
            What we use to optimize your conversion
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Your offer through the Alex Hormozi value equation. We write the emails
            around these. Click any field to edit it.
          </p>
        </div>
        <div className="shrink-0">
          <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:items-center">
            <PrefillButton
              label="Update services from my website"
              pendingLabel="Reading your website…"
              pending={prefillServicesMut.isPending}
              disabled={prefilling}
              onClick={() => {
                setPrefillError(null);
                prefillServicesMut.mutate();
              }}
            />
            <PrefillButton
              label="Update the offer from my website"
              pendingLabel="Writing your offer…"
              pending={prefillLeversMut.isPending}
              disabled={prefilling || leversBlockedOnServices}
              title={
                leversBlockedOnServices
                  ? "Add what you sell first. The offer is written from your services."
                  : undefined
              }
              onClick={() => {
                setPrefillError(null);
                prefillLeversMut.mutate();
              }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <img
            src="/alex-hormozi.png"
            alt="Alex Hormozi"
            className="h-9 w-9 shrink-0 rounded-full border border-gray-300 object-cover"
          />
          <p className="text-xs text-gray-500">
            The stronger and clearer these are, the better each email converts. Anything
            marked not set is worth filling in.
          </p>
        </div>

        {profilePending ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <>
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
              {OFFER_LEVERS.map((lever) => {
                // Kind + placeholder come from the shared user-field set
                // (services / socialProof are lists, the rest free text).
                const def = ALL_FIELDS.find((f) => f.key === lever.key);
                const kind = def?.kind ?? "text";
                const placeholder = def?.placeholder ?? "";
                const value = offerFields[lever.key];
                return (
                  <li key={lever.key} className="px-4 py-3">
                    <p className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      <MetricLabel text={lever.label} tip={lever.tip} placement="top" />
                    </p>
                    {kind === "text" ? (
                      <TextEditor
                        value={coerceTextField(value)}
                        placeholder={placeholder}
                        onText={(v) => setOfferText(lever.key, v)}
                      />
                    ) : (
                      <ListEditor
                        values={coerceListField(value)}
                        placeholder={placeholder}
                        onAdd={(v) => addOfferItem(lever.key, v)}
                        onRemove={(v) => removeOfferItem(lever.key, v)}
                      />
                    )}
                  </li>
                );
              })}
            </ul>

            {prefillError ? (
              <p className="mt-4 text-xs text-red-600">{prefillError}</p>
            ) : null}

            <p className="mt-4 text-xs text-gray-400">
              Updating from your website rewrites these fields with what we read there.
              Nothing is saved until you press Save.
            </p>

            {offerDirty ? (
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOfferDraft(null)}
                  className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={saveOffer}
                  disabled={saveOfferMut.isPending}
                  className={`rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition ${
                    saveOfferMut.isPending
                      ? "cursor-wait"
                      : "hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  }`}
                >
                  {saveOfferMut.isPending ? "Saving…" : "Save changes"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
