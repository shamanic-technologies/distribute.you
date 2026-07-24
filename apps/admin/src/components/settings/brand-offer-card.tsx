"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  getBrandUserFields,
  saveBrandUserFields,
  extractBrandFields,
  fieldResultsToMap,
  flattenFieldValue,
  SALES_PROFILE_FIELDS,
  USER_FIELD_KEYS,
  type BrandUserFields,
  type UserFieldKey,
  type UserFieldValue,
} from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import {
  ALL_FIELDS,
  cloneFields,
  fieldsEqual,
  ListEditor,
  TextEditor,
  type ProfileFields,
} from "@/components/brand-profile/field-editor";

// The 6 Hormozi value-equation offer levers + the paid `services` list — the same
// confirmed user-fields the customer dashboard onboarding walks through, AI-prefilled
// from the brand's site. Staff can review + edit them here. Mirrors the dashboard
// Strategy page's inline offer editor (getBrandUserFields ↔ saveBrandUserFields).

// The extract-fields key that seeds each user-field. dreamOutcome is seeded from the
// `valueProposition` extraction (it REPLACED valueProposition); the rest match 1:1.
const EXTRACT_KEY_FOR_FIELD: Record<string, string> = {
  dreamOutcome: "valueProposition",
};

/** Confirmed user-fields map → the plain fields bag the inline editors work with. */
function userFieldsToProfile(fields: BrandUserFields | undefined): ProfileFields {
  const out: ProfileFields = {};
  for (const key of USER_FIELD_KEYS) {
    const v = fields?.[key]?.value;
    if (v != null) out[key] = v;
  }
  return out;
}

/** Fields bag → the saveBrandUserFields PUT body. Only the 7 user-field keys are
 *  sent (every sent key is confirmed); empty values are omitted so a blank field
 *  never clobbers a confirmed one. */
function profileToUserFieldsPayload(
  fields: ProfileFields,
): Partial<Record<UserFieldKey, UserFieldValue>> {
  const out: Partial<Record<UserFieldKey, UserFieldValue>> = {};
  for (const key of USER_FIELD_KEYS) {
    const v = fields[key];
    if (Array.isArray(v)) {
      const cleaned = v.map((s) => s.trim()).filter(Boolean);
      if (cleaned.length) out[key] = cleaned;
    } else if (typeof v === "string" && v.trim()) {
      out[key] = v;
    }
  }
  return out;
}

const coerceListField = (v: string | string[] | undefined): string[] =>
  Array.isArray(v) ? v : typeof v === "string" && v.trim() ? [v.trim()] : [];

const isEmptyField = (v: string | string[] | undefined): boolean =>
  Array.isArray(v) ? v.length === 0 : !(typeof v === "string" && v.trim());

export function BrandOfferCard({ brandId }: { brandId: string }) {
  const queryClient = useQueryClient();

  const { data, isPending } = useAuthQuery(
    ["brandUserFields", brandId],
    () => getBrandUserFields(brandId),
  );

  const [offerDraft, setOfferDraft] = useState<ProfileFields | null>(null);
  const [saved, setSaved] = useState(false);
  const [prefillError, setPrefillError] = useState<string | null>(null);

  const offerBaseline = cloneFields(userFieldsToProfile(data?.fields));
  const offerFields = offerDraft ?? offerBaseline;
  const offerDirty = offerDraft !== null && !fieldsEqual(offerDraft, offerBaseline);

  const saveMut = useMutation({
    mutationFn: (fields: ProfileFields) =>
      saveBrandUserFields(brandId, profileToUserFieldsPayload(fields)),
    onSuccess: (res) => {
      queryClient.setQueryData(["brandUserFields", brandId], res);
      queryClient.invalidateQueries({ queryKey: ["brandUserFields", brandId] });
      setOfferDraft(null);
      setSaved(true);
    },
  });

  // Re-run the site extraction and fill EMPTY offer fields with the AI suggestions.
  // Only fills blanks — never overwrites a value the user already has. The user still
  // reviews + Saves (values land in the draft, not persisted until Save).
  const prefillMut = useMutation({
    mutationFn: () =>
      extractBrandFields([brandId], SALES_PROFILE_FIELDS, { resetCache: true }),
    onSuccess: (resp) => {
      const map = fieldResultsToMap(resp.fields);
      setOfferDraft((prev) => {
        const cur = prev ?? offerBaseline;
        const next: ProfileFields = { ...cur };
        for (const f of ALL_FIELDS) {
          if (!isEmptyField(cur[f.key])) continue;
          const raw = map[EXTRACT_KEY_FOR_FIELD[f.key] ?? f.key];
          if (raw == null) continue;
          if (f.kind === "list") {
            const items = Array.isArray(raw)
              ? raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
              : flattenFieldValue(raw)
                  .split(/\r?\n/)
                  .map((s) => s.trim())
                  .filter(Boolean);
            if (items.length) next[f.key] = items;
          } else {
            const text = flattenFieldValue(raw).trim();
            if (text) next[f.key] = text;
          }
        }
        return next;
      });
    },
    onError: (err) =>
      setPrefillError(err instanceof Error ? err.message : "Prefill failed"),
  });

  const setOfferText = (key: string, value: string) =>
    setOfferDraft((prev) => ({ ...(prev ?? offerBaseline), [key]: value }));

  const addOfferItem = (key: string, raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setOfferDraft((prev) => {
      const cur = prev ?? offerBaseline;
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

  const handleSave = () => {
    if (!offerDirty || saveMut.isPending) return;
    setSaved(false);
    saveMut.mutate(offerFields);
  };

  if (isPending) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="h-4 w-48 bg-gray-100 rounded animate-pulse mb-4" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="h-3 w-32 bg-gray-100 rounded animate-pulse mb-2" />
              <div className="h-9 w-full bg-gray-100 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <p className="text-sm text-gray-500">
            The services you sell + the 6 offer levers we write every email around. AI
            prefills them from the brand site; review and confirm.
          </p>
          <button
            type="button"
            onClick={() => {
              setPrefillError(null);
              prefillMut.mutate();
            }}
            disabled={prefillMut.isPending}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {prefillMut.isPending ? "Prefilling…" : "✨ Prefill with AI"}
          </button>
        </div>

        <div className="space-y-4">
          {ALL_FIELDS.map((f) => {
            const provenance = data?.fields?.[f.key]?.provenance;
            const suggested = provenance === "suggested" || provenance === "extracted";
            return (
              <div key={f.key}>
                <label className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                  {f.label}
                  {suggested && (
                    <span className="inline-flex items-center rounded-full bg-brand-50 border border-brand-200 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
                      AI-suggested
                    </span>
                  )}
                </label>
                {f.kind === "list" ? (
                  <ListEditor
                    values={coerceListField(offerFields[f.key])}
                    placeholder={f.placeholder}
                    onAdd={(v) => addOfferItem(f.key, v)}
                    onRemove={(v) => removeOfferItem(f.key, v)}
                  />
                ) : (
                  <TextEditor
                    value={typeof offerFields[f.key] === "string" ? (offerFields[f.key] as string) : ""}
                    placeholder={f.placeholder}
                    onText={(v) => setOfferText(f.key, v)}
                  />
                )}
              </div>
            );
          })}
        </div>

        {saveMut.error && (
          <p className="mt-4 text-sm text-red-600">
            Could not save:{" "}
            {saveMut.error instanceof Error ? saveMut.error.message : "unknown error"}
          </p>
        )}
        {prefillError && <p className="mt-4 text-sm text-red-600">{prefillError}</p>}

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={!offerDirty || saveMut.isPending}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {saveMut.isPending ? "Saving..." : "Save"}
          </button>
          {saved && !offerDirty && (
            <span className="text-sm text-green-600">Saved ✓</span>
          )}
        </div>
      </div>
    </div>
  );
}
