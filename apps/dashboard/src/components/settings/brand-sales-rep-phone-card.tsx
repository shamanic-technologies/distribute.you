"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  clearBrandSalesRepPhone,
  getBrandSalesRepPhone,
  setBrandSalesRepPhone,
} from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { SettingsSaveRow } from "@/components/settings/settings-save-row";

// The number rung when a prospect replies saying they are interested.
//
// One number per BRAND, and that grain is the whole design. A campaign is
// (offer x funnel x channel), so a number stored per campaign is the same number
// retyped once per channel selling one offer — four rows for one fact on the
// brand this was built for, drifting from the first edit — and a brand with no
// campaign yet could declare nothing at all. The rep answers for the brand.
//
// NOT SET is a first-class state, not an empty form. Most brands will never set
// one, and that reads as "nobody to ring" rather than as something unfinished —
// so the card says so in words instead of leaving a blank box to interpret.
//
// What a valid number IS belongs to brand-service: it takes any typed format
// carrying a country code and stores strict E.164, and refuses a national number
// with no country code rather than guessing a country (a guess dials a different
// person). Its refusal is rendered verbatim. Do NOT re-implement that rule here —
// a second copy of a validation rule is how the two come to disagree, and the
// disagreement would be a call placed to the wrong human.

/** brand-service writes the sentence; `err.message` is the whole downstream body verbatim. */
function saveErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status?: number }).status;
    const body = (err as { body?: { error?: string } }).body;
    if (status === 400 && body?.error) return body.error;
    if (status === 403) return "You do not have access to this brand.";
    if (status === 404) return "This brand no longer exists.";
  }
  return "Could not save the number. Try again in a moment.";
}

export function BrandSalesRepPhoneCard({ brandId }: { brandId: string }) {
  const queryClient = useQueryClient();

  const { data, isPending, isError } = useAuthQuery(
    ["brandSalesRepPhone", brandId],
    () => getBrandSalesRepPhone(brandId),
  );

  // The last SAVED value, and the live field. `dirty` is a live compare against
  // that baseline, never a sticky edited latch — typing a change and undoing it
  // has to disarm Save again.
  const saved = data ?? null;
  const [value, setValue] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  // Re-seed when the payload is a DIFFERENT object than the one the field was
  // built from. The first payload to settle is the on-disk one, so a once-per-mount
  // latch would seed from the previous visit and ignore the fresher server answer.
  // Identity, not deep equality: React Query returns the same reference when
  // nothing changed, so an unchanged refetch costs nothing and cannot loop.
  const seededFrom = useRef<object | null>(null);
  const touched = useRef(false);
  useEffect(() => {
    if (data === undefined) return;
    const token = { data };
    if (seededFrom.current !== null && touched.current) return;
    seededFrom.current = token;
    setValue(data ?? "");
  }, [data]);

  const save = useMutation({
    mutationFn: (next: string) =>
      next.trim() ? setBrandSalesRepPhone(brandId, next.trim()) : clearBrandSalesRepPhone(brandId),
    onSuccess: (next) => {
      // The response IS what this query reads, so write it rather than invalidating:
      // a re-read is a second round trip to learn what we were just told.
      queryClient.setQueryData(["brandSalesRepPhone", brandId], next);
      touched.current = false;
      setValue(next ?? "");
      setJustSaved(true);
    },
    onError: (err) => {
      console.error("[dashboard] setBrandSalesRepPhone failed", err);
    },
  });

  const dirty = value.trim() !== (saved ?? "");

  if (isPending) {
    return (
      <div className="p-5">
        <div className="h-4 w-64 animate-pulse rounded bg-gray-100" />
        <div className="mt-4 h-10 w-full max-w-sm animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="p-5">
      <p className="mb-4 text-sm text-gray-600">
        When someone replies to one of this brand&apos;s campaigns saying they are interested, we
        ring this number straight away and tell you who it is. If we managed to find the
        prospect&apos;s own number in time, the call offers to put you through to them.
      </p>

      <label htmlFor="sales-rep-phone" className="mb-1.5 block text-sm font-medium text-gray-800">
        Number to ring
      </label>
      <input
        id="sales-rep-phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={value}
        onChange={(e) => {
          touched.current = true;
          setJustSaved(false);
          setValue(e.target.value);
        }}
        placeholder="+33 7 70 65 75 85"
        className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300"
      />
      <p className="mt-1.5 text-xs text-gray-500">
        Include the country code. Leave it empty and nobody is rung.
      </p>

      {isError && (
        <p className="mt-3 text-sm text-gray-600">
          We could not read the current number. Nothing was changed.
        </p>
      )}

      {save.isError && (
        <p className="mt-3 text-sm text-red-600">{saveErrorMessage(save.error)}</p>
      )}

      {!dirty && !saved && !justSaved && (
        <p className="mt-3 text-sm text-gray-500">
          No number set, so nobody is rung when a reply lands.
        </p>
      )}

      <SettingsSaveRow
        dirty={dirty}
        saving={save.isPending}
        saved={justSaved && !dirty}
        onSave={() => save.mutate(value)}
      />
    </div>
  );
}
