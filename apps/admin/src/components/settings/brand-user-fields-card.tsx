"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { getBrandUserFields, saveBrandUserFields } from "@/lib/api";
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

// A Brand-Settings editor card for ONE subset of the confirmed user-fields. Two
// instances are mounted: Services sold and the Hormozi offer levers. Both read/write
// the shared ["brandUserFields", brandId] store, so the levers card sees the services
// the Services card saved.
export function BrandUserFieldsCard({
  brandId,
  defs,
  blurb,
}: {
  brandId: string;
  defs: FieldDef[];
  blurb: string;
}) {
  const queryClient = useQueryClient();

  const { data, isPending } = useAuthQuery(
    ["brandUserFields", brandId],
    () => getBrandUserFields(brandId),
  );

  const [draft, setDraft] = useState<ProfileFields | null>(null);
  const [saved, setSaved] = useState(false);

  const baseline = cloneSubset(userFieldsToProfile(data?.fields), defs);
  const fields = draft ?? baseline;
  const dirty = draft !== null && !subsetEqual(draft, baseline, defs);

  const saveMut = useMutation({
    mutationFn: (f: ProfileFields) => saveBrandUserFields(brandId, profileToPayload(f, defs)),
    onSuccess: (res) => {
      queryClient.setQueryData(["brandUserFields", brandId], res);
      queryClient.invalidateQueries({ queryKey: ["brandUserFields", brandId] });
      setDraft(null);
      setSaved(true);
    },
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
        <p className="text-sm text-gray-500 mb-4">{blurb}</p>

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
