"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/skeleton";
import { MetricLabel } from "@/components/visibility/metric-info";
import { pollOptions } from "@/lib/query-options";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getOfferUserFields,
  saveOfferUserFields,
  USER_FIELD_KEYS,
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
 * A fields bag → the saveOfferUserFields PUT body. All 7 user-field keys are sent
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
 * "What we use to optimize your conversion" — the offer through the Alex Hormozi
 * value equation, edited inline. The 7 user-fields are confirmed brand data, and
 * the stronger they are the better each email converts.
 *
 * Offer Settings is where a proposition is CHANGED, so this card is the edit
 * surface: each lever is a hover-to-edit zone (the pencil appears on hover); Save
 * confirms the edited values via saveOfferUserFields.
 *
 * The 7 fields are what an OFFER promises, so they are read and written on the
 * offer's own routes and cached under a key carrying the offer. A brand selling a
 * $200 self-serve plan and a $20k contract has two different answers to every one
 * of these, and the brand-scoped routes have exactly one place to put them.
 */
export function BrandOfferCard({ brandId, offerId }: { brandId: string; offerId: string }) {
  const queryClient = useQueryClient();
  // Offer-fields inline edit: null = follow the saved baseline, an object = working edits.
  const [offerDraft, setOfferDraft] = useState<ProfileFields | null>(null);

  // Confirmed user-fields — the 7 offer fields we optimise conversion against.
  // Each carries a provenance ("confirmed" once the user saved it, "suggested"
  // while it is still the AI prefill).
  const { data: userFieldsData, isPending: profilePending } = useAuthQuery(
    ["offerUserFields", brandId, offerId],
    () => getOfferUserFields(brandId, offerId),
    { ...pollOptions, enabled: !!brandId && !!offerId },
  );

  // Baseline bag = each user-field's value (list-kind default []). The edited
  // levers are saved back as confirmed user-fields; unedited keys are left as-is.
  const offerBaseline = cloneFields(userFieldsToProfile(userFieldsData?.fields));
  const offerFields = offerDraft ?? offerBaseline;
  const offerDirty = offerDraft !== null && !fieldsEqual(offerDraft, offerBaseline);

  const saveOfferMut = useMutation({
    mutationFn: (fields: ProfileFields) =>
      saveOfferUserFields(brandId, offerId, profileToUserFieldsPayload(fields)),
    onSuccess: () => {
      setOfferDraft(null);
      queryClient.invalidateQueries({ queryKey: ["offerUserFields", brandId, offerId] });
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
