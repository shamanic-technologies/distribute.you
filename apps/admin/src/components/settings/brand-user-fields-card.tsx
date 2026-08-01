"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  getBrandUserFields,
  saveBrandUserFields,
  extractBrandFields,
  fieldResultsToMap,
  USER_PROFILE_FIELDS,
} from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import {
  ListEditor,
  TextEditor,
  type FieldDef,
  type ProfileFields,
} from "@/components/brand-profile/field-editor";
import {
  cloneSubset,
  coerceListField,
  coerceTextField,
  profileToPayload,
  subsetEqual,
  userFieldsToProfile,
} from "@/lib/user-fields-form";
import {
  applyExtractionToDraft,
  prefillDefsFor,
  LEVER_PREFILL_KEYS,
  SERVICES_PREFILL_KEYS,
} from "@/lib/offer-prefill";

// A Brand-Settings editor card for ONE subset of the confirmed user-fields. Two
// instances are mounted: Services sold (its own AI prefill) and the Hormozi offer
// levers (its own AI prefill, CONDITIONED on the entered services). Both read/write
// the shared ["brandUserFields", brandId] store, so the levers card sees the services
// the Services card saved.
export function BrandUserFieldsCard({
  brandId,
  defs,
  blurb,
  // When true, read the saved `services` from the shared cache and feed it into the
  // AI-prefill extraction (so the levers are generated with the services as context).
  conditionOnServices = false,
}: {
  brandId: string;
  defs: FieldDef[];
  blurb: string;
  conditionOnServices?: boolean;
}) {
  const queryClient = useQueryClient();

  const { data, isPending } = useAuthQuery(
    ["brandUserFields", brandId],
    () => getBrandUserFields(brandId),
  );

  const [draft, setDraft] = useState<ProfileFields | null>(null);
  const [saved, setSaved] = useState(false);
  const [prefillError, setPrefillError] = useState<string | null>(null);

  const baseline = cloneSubset(userFieldsToProfile(data?.fields), defs);
  const fields = draft ?? baseline;
  const dirty = draft !== null && !subsetEqual(draft, baseline, defs);

  const servicesContext = conditionOnServices
    ? coerceListField(data?.fields?.services?.value ?? undefined)
    : undefined;

  const saveMut = useMutation({
    mutationFn: (f: ProfileFields) => saveBrandUserFields(brandId, profileToPayload(f, defs)),
    onSuccess: (res) => {
      queryClient.setQueryData(["brandUserFields", brandId], res);
      queryClient.invalidateQueries({ queryKey: ["brandUserFields", brandId] });
      setDraft(null);
      setSaved(true);
    },
  });

  // Re-read the brand's site and RESET every field in this card to what comes back.
  // A reset, not a top-up: a field the extraction answers is overwritten, and one it
  // does not answer is cleared, so what is on screen afterwards is exactly what was
  // produced. Values land in the DRAFT — nothing is persisted until the user reviews
  // and saves.
  //
  // Both cards run `suggest` mode. The services card used to run the default
  // `extract`, which is site-grounded and returns the literal string "Unknown" for
  // anything the site does not state outright — a value nobody wants to read in a
  // field. `suggest` makes brand-service answer as Alex Hormozi with a panel of the
  // brand's industry experts and always write a best-effort value.
  //
  // The levers are generated FROM the brand's services, and brand-service supplies
  // that itself: it injects the brand's CONFIRMED fields into the prompt as
  // authoritative context. So the services must be SAVED for the levers to be about
  // them, which is what the disabled state below enforces.
  const prefillKeys = conditionOnServices ? LEVER_PREFILL_KEYS : SERVICES_PREFILL_KEYS;
  const prefillMut = useMutation({
    mutationFn: () =>
      extractBrandFields([brandId], prefillDefsFor(prefillKeys, USER_PROFILE_FIELDS), {
        resetCache: true,
        mode: "suggest",
      }),
    onSuccess: (resp) => {
      const map = fieldResultsToMap(resp.fields);
      setDraft((prev) => applyExtractionToDraft(prev ?? baseline, defs, map) as ProfileFields);
    },
    onError: (err) => setPrefillError(err instanceof Error ? err.message : "Prefill failed"),
  });

  // A levers prefill with no confirmed services would be generated against nothing.
  // Say so rather than running it and returning something generic.
  const leversBlockedOnServices = conditionOnServices && (servicesContext?.length ?? 0) === 0;

  const setText = (key: string, value: string) =>
    setDraft((prev) => ({ ...(prev ?? baseline), [key]: value }));

  const addItem = (key: string, raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setDraft((prev) => {
      const cur = prev ?? baseline;
      const arr = coerceListField(cur[key]);
      if (arr.some((v) => v.toLowerCase() === value.toLowerCase())) return cur;
      return { ...cur, [key]: [...arr, value] };
    });
  };

  const removeItem = (key: string, value: string) =>
    setDraft((prev) => {
      const cur = prev ?? baseline;
      const arr = coerceListField(cur[key]);
      return { ...cur, [key]: arr.filter((v) => v !== value) };
    });

  const handleSave = () => {
    if (!dirty || saveMut.isPending) return;
    setSaved(false);
    saveMut.mutate(fields);
  };

  const prefillLabel = prefillMut.isPending
    ? "Updating…"
    : conditionOnServices
      ? "Update the offer from my website"
      : "Update services from my website";

  if (isPending) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="h-4 w-48 bg-gray-100 rounded animate-pulse mb-4" />
        <div className="space-y-4">
          {Array.from({ length: Math.min(defs.length, 4) }).map((_, i) => (
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
          <p className="text-sm text-gray-500">{blurb}</p>
          <button
            type="button"
            onClick={() => {
              setPrefillError(null);
              prefillMut.mutate();
            }}
            disabled={prefillMut.isPending || leversBlockedOnServices}
            title={
              leversBlockedOnServices
                ? "Save the brand's services first — the offer is written from them."
                : undefined
            }
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-brand-200 bg-brand-50 text-brand-700 transition ${
              prefillMut.isPending
                ? "cursor-wait"
                : "hover:bg-brand-100 disabled:opacity-40 disabled:cursor-not-allowed"
            }`}
          >
            {prefillLabel}
          </button>
        </div>
        {leversBlockedOnServices && (
          <p className="-mt-2 mb-4 text-xs text-gray-400">
            Save the brand&apos;s services first. The offer is written from them.
          </p>
        )}

        <div className="space-y-4">
          {defs.map((f) => {
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
                    values={coerceListField(fields[f.key])}
                    placeholder={f.placeholder}
                    onAdd={(v) => addItem(f.key, v)}
                    onRemove={(v) => removeItem(f.key, v)}
                  />
                ) : (
                  <TextEditor
                    value={coerceTextField(fields[f.key])}
                    placeholder={f.placeholder}
                    onText={(v) => setText(f.key, v)}
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
            disabled={!dirty || saveMut.isPending}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {saveMut.isPending ? "Saving..." : "Save"}
          </button>
          {saved && !dirty && <span className="text-sm text-green-600">Saved ✓</span>}
        </div>
      </div>
    </div>
  );
}
