"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Shimmer } from "@/components/v2/ui";
import { EditableAnswer } from "@/components/v2/editable-answer";
import { pollOptions } from "@/lib/query-options";
import { ORG_DESYNC_ERROR, ORG_DESYNC_STATUS } from "@/lib/org-desync";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  ApiError,
  getBrand,
  getOfferUserFields,
  saveOfferUserFields,
  USER_FIELD_KEYS,
} from "@/lib/api";
import type { BrandUserFields, UserFieldKey, UserFieldValue } from "@/lib/api";
import {
  ALL_FIELDS,
  cloneFields,
  fieldsEqual,
  type ProfileFields,
} from "@/components/brand-profile/field-editor";
import { coerceTextField, OFFER_LEVERS } from "@/lib/strategy-model";
import { buildOfferLLMPrompt } from "@/components/onboarding/llm-prompt";

/**
 * List-kind levers edited as ONE textarea rather than a chip list. Both list levers
 * go through it: a testimonial or a service description is a paragraph, which a chip
 * input made unreadable, and a chip input only added what was typed on Enter, so text
 * typed and then saved was silently dropped (services, 2026-09-29). Storage is
 * unchanged (a string[]): each non-empty LINE is one item, so a comma inside an item
 * stays inside it.
 */
const TEXTAREA_LIST_KEYS: ReadonlySet<string> = new Set(["services", "socialProof"]);

const TEXTAREA_LIST_PLACEHOLDER: Record<string, string> = {
  services: "One service or product you sell per line",
  socialProof: "One testimonial, case study or result per line",
};

function linesToList(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.map((v) => v.trim()).filter((v) => v.length > 0);
  return (value ?? "")
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

/** What the save failure says. From the STATUS, never the error body. */
function saveErrorMessage(err: unknown): string {
  if (
    err instanceof ApiError &&
    err.status === ORG_DESYNC_STATUS &&
    err.body?.error === ORG_DESYNC_ERROR
  ) {
    return "Not saved: another tab switched organization. Reload this page, then save again.";
  }
  return "Not saved. Your edits are still here, try again.";
}

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
    // Coerce by kind on the way OUT too. cloneFields already normalised the bag, so this
    // is belt-and-braces — but the old `typeof v === "string" ? v.trim() : ""` was the
    // destructive half of the shape-mismatch bug: an array in a text-kind lever was
    // written back as a confirmed-EMPTY row, silently deleting a value the user never
    // touched. Coercing heals the row instead of blanking it.
    out[key] = TEXTAREA_LIST_KEYS.has(key) ? linesToList(v) : coerceTextField(v).trim();
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
    onSuccess: (res, sent) => {
      // The response IS the read this card polls: write it, so the saved values
      // show at once instead of the pre-save copy until the next poll.
      queryClient.setQueryData(["offerUserFields", brandId, offerId], res);
      // Drop the draft only if nothing was typed since this save left: a point edited
      // while the save was in flight keeps its text and saves on its own blur.
      setOfferDraft((cur) => (cur === sent ? null : cur));
      // setQueryData never reaches the on-disk cache (only a query-function run is
      // persisted), so a reload right after Save painted the PRE-save copy from disk.
      // Re-read through the query function so the disk copy is the saved one; the
      // button stays on "Saving…" until it is.
      return queryClient.invalidateQueries({ queryKey: ["offerUserFields", brandId, offerId] });
    },
    onError: (err) => {
      // A failed save keeps the draft and SAYS so. It used to render nothing, so
      // the button went back to "Save changes" and the edits were lost on reload.
      console.error("[dashboard] saveOfferUserFields failed", err);
    },
  });

  // The business line of the prompt. Same key as the brand identity card, so it is
  // already in cache on this page.
  const { data: brandData } = useAuthQuery(["brand", brandId], () => getBrand(brandId), {
    enabled: !!brandId,
  });
  const business = brandData?.brand.domain || brandData?.brand.name || null;
  const [llmCopied, setLlmCopied] = useState(false);

  // Copies what is ON SCREEN (unsaved edits included), the way the onboarding
  // lever steps do: the reader asks their own LLM, then pastes back field by field.
  const copyAllForLLM = () => {
    if (!business) return;
    const prompt = buildOfferLLMPrompt(
      OFFER_LEVERS.map((lever) => {
        const value = offerFields[lever.key];
        return {
          label: lever.label,
          tip: lever.tip,
          value: TEXTAREA_LIST_KEYS.has(lever.key)
            ? linesToList(value).join("\n")
            : coerceTextField(value),
        };
      }),
      business,
    );
    void navigator.clipboard.writeText(prompt).then(() => {
      setLlmCopied(true);
      setTimeout(() => setLlmCopied(false), 2000);
    });
  };

  const setOfferText = (key: string, value: string) =>
    setOfferDraft((prev) => ({ ...(prev ?? offerBaseline), [key]: value }));

  // Autosave: leaving a point saves the whole bag (v2 has no Save button on an
  // inline value, owner 2026-10-01).
  const saveOffer = () => {
    if (!offerDirty || saveOfferMut.isPending) return;
    saveOfferMut.mutate(offerFields);
  };

  return (
    <section>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="k-fg text-[14px] font-medium">Your offer, in seven points</h2>
          <p className="k-fg3 mt-0.5 text-[12px]">We write every email around these. Click a point to edit it.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {saveOfferMut.isPending ? <span className="k-fg3 text-[12px]">Saving...</span> : null}
          <button
            type="button"
            onClick={copyAllForLLM}
            disabled={profilePending || !business}
            className="k-btn-ghost h-7 px-2 text-[12px]"
          >
            {llmCopied ? "Copied" : "Copy all for LLM"}
          </button>
        </div>
      </div>

      {saveOfferMut.isError ? (
        <p role="alert" className="mt-2 text-[12px] text-[var(--data-rose)]">
          {saveErrorMessage(saveOfferMut.error)}
        </p>
      ) : null}

      {profilePending ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="k-card p-3">
              <Shimmer className="h-4 w-1/3 rounded-md" />
              <Shimmer className="mt-2 h-3 w-2/3 rounded-md" />
              <Shimmer className="mt-3 h-10 w-full rounded-md" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {OFFER_LEVERS.map((lever) => {
            // The two list levers (services, socialProof) are stored as a list, one item
            // per line; the others are text, where each line is one bullet too.
            const def = ALL_FIELDS.find((f) => f.key === lever.key);
            const value = offerFields[lever.key];
            return (
              <div key={lever.key} className="k-card p-3">
                <p className="k-fg text-[13px] font-medium">{lever.label}</p>
                <p className="k-fg3 mt-0.5 text-[12px]">{lever.tip}</p>
                <div className="mt-2">
                  {TEXTAREA_LIST_KEYS.has(lever.key) ? (
                    <EditableAnswer
                      value={Array.isArray(value) ? linesToList(value).join("\n") : (value ?? "")}
                      placeholder={TEXTAREA_LIST_PLACEHOLDER[lever.key] ?? def?.placeholder ?? ""}
                      onValue={(v) => setOfferText(lever.key, v)}
                      onDone={saveOffer}
                      disabled={false}
                      label={lever.label}
                    />
                  ) : (
                    <EditableAnswer
                      value={coerceTextField(value)}
                      placeholder={def?.placeholder ?? "Click to answer"}
                      onValue={(v) => setOfferText(lever.key, v)}
                      onDone={saveOffer}
                      disabled={false}
                      label={lever.label}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
