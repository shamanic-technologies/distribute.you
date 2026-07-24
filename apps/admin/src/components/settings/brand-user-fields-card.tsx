"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  getBrandUserFields,
  saveBrandUserFields,
  extractBrandFields,
  fieldResultsToMap,
  flattenFieldValue,
} from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import {
  ListEditor,
  TextEditor,
  type FieldDef,
  type ProfileFields,
} from "@/components/brand-profile/field-editor";
import {
  buildExtractDefs,
  cloneSubset,
  coerceListField,
  EXTRACT_KEY_FOR_FIELD,
  isEmptyField,
  profileToPayload,
  subsetEqual,
  userFieldsToProfile,
} from "@/lib/user-fields-form";

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

  // Re-run the site extraction and fill EMPTY fields with the AI suggestions. Only
  // fills blanks — never overwrites an existing value. Values land in the draft; the
  // user reviews + Saves. For the levers card, the extraction is conditioned on the
  // saved services (buildExtractDefs prepends them to each field's description).
  const prefillMut = useMutation({
    mutationFn: () =>
      extractBrandFields(
        [brandId],
        buildExtractDefs(defs, servicesContext),
        { resetCache: true },
      ),
    onSuccess: (resp) => {
      const map = fieldResultsToMap(resp.fields);
      setDraft((prev) => {
        const cur = prev ?? baseline;
        const next: ProfileFields = { ...cur };
        for (const f of defs) {
          if (!isEmptyField(cur[f.key])) continue;
          const raw = map[EXTRACT_KEY_FOR_FIELD[f.key] ?? f.key];
          if (raw == null) continue;
          if (f.kind === "list") {
            const items = Array.isArray(raw)
              ? raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
              : flattenFieldValue(raw).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
            if (items.length) next[f.key] = items;
          } else {
            const text = flattenFieldValue(raw).trim();
            if (text) next[f.key] = text;
          }
        }
        return next;
      });
    },
    onError: (err) => setPrefillError(err instanceof Error ? err.message : "Prefill failed"),
  });

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
    ? "Prefilling…"
    : conditionOnServices
      ? "✨ Prefill from services"
      : "✨ Prefill with AI";

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
            disabled={prefillMut.isPending}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {prefillLabel}
          </button>
        </div>

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
                    value={typeof fields[f.key] === "string" ? (fields[f.key] as string) : ""}
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
