"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { stateBrandLegRates, type EffectiveLegRate } from "@/lib/api";
import { useQueryClient } from "@/lib/use-auth-query";
import { invalidateConversionRates } from "@/lib/write-invalidation";
import {
  legId,
  legRatePatch,
  formatRatePct,
  rateFieldSeed,
  rateSourceLabel,
  statedFromEffective,
} from "@/lib/brand-conversion-rates";
import { RateInput } from "@/components/rate-input";
import { SettingsSaveRow } from "@/components/settings/settings-save-row";

// The brand's conversion rates, one row per LEG, and the ONLY editor of them.
//
// Each row states the rate every money figure is priced on and WHERE it came from
// (measured on the brand's own leads, the brand's own value, or the median of our
// clients). The field beside it is the brand's OWN value: it opens on what the
// brand stated, else on the median as a prefill, and it is written only when the
// person edits it. A measured rate wins over the brand's value once enough leads
// reached the step, which the row says rather than hides.

/** brand-service writes the sentence; `err.message` is the whole downstream body verbatim. */
function saveErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status?: number }).status;
    const body = (err as { body?: { error?: string } }).body;
    if (status === 400 && body?.error) return body.error;
    if (status === 403) return "You do not have access to this brand.";
    if (status === 404) return "This brand no longer exists.";
  }
  return "Could not save the rates. Try again in a moment.";
}

export function LegRatesEditor({
  brandId,
  legs,
  minMeasured,
  saveLabel = "Save",
  onSaved,
}: {
  brandId: string;
  legs: EffectiveLegRate[];
  minMeasured: number;
  saveLabel?: string;
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  // Only the legs a person touched are in here, which is what keeps a prefilled
  // median from being written as if the brand had stated it.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const stated = legs.map(statedFromEffective);
  const { patch, invalid } = legRatePatch(stated, drafts);
  const dirty = patch.length > 0 || invalid.length > 0;

  const mutation = useMutation({
    mutationFn: () => stateBrandLegRates(brandId, patch),
    onSuccess: async () => {
      // Re-read BEFORE clearing the drafts: cleared first, the fields would fall back
      // to the pre-save values for the length of the read, and a saved rate would
      // look like it had not taken.
      invalidateConversionRates(queryClient);
      await queryClient.refetchQueries({ queryKey: ["brandConversionRates", brandId] });
      setDrafts({});
      setSaved(true);
      onSaved?.();
    },
    onError: (err) => {
      console.error("[dashboard] stateBrandLegRates failed", err);
      setError(saveErrorMessage(err));
    },
  });

  function save() {
    if (invalid.length > 0) {
      setError("A rate is a number between 0 and 100.");
      return;
    }
    setError(null);
    mutation.mutate();
  }

  return (
    <div>
      <ul className="divide-y divide-gray-100">
        {legs.map((leg) => {
          const id = legId(leg);
          const value = id in drafts ? drafts[id] : rateFieldSeed(leg);
          const measuredWins = leg.source === "measured";
          return (
            <li key={id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-800">
                  {leg.fromStep} <span className="text-gray-300">→</span> {leg.toStep}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {leg.effectiveRatePct !== null && (
                    <>
                      <span className="font-medium text-gray-700">{formatRatePct(leg.effectiveRatePct)}</span>{" "}
                      ·{" "}
                    </>
                  )}
                  <span data-rate-source={leg.source ?? "none"}>{rateSourceLabel(leg)}</span>
                </p>
                {measuredWins && (
                  <p className="mt-0.5 text-xs text-gray-400">
                    Measured once {minMeasured} leads reached this step, so it is used instead of your value.
                  </p>
                )}
              </div>
              <RateInput
                ariaLabel={`${leg.fromStep} to ${leg.toStep}`}
                value={value}
                onChange={(next) => {
                  setSaved(false);
                  setError(null);
                  setDrafts((prev) => ({ ...prev, [id]: next }));
                }}
              />
            </li>
          );
        })}
      </ul>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <SettingsSaveRow
        dirty={dirty}
        saving={mutation.isPending}
        saved={saved}
        onSave={save}
        label={saveLabel}
      />
    </div>
  );
}
