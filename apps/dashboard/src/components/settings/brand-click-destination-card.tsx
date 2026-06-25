"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { getBrand, saveBrandClickDestination, type BrandDetail } from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { bareHost, validateDestination } from "@/lib/click-destination-validation";

// The page outreach clicks land on. Must be a URL on the brand's OWN domain
// (or a subdomain of it) — a click destination pointing off-domain is rejected
// both here (UX) and by brand-service (fail-loud). Empty input = the brand
// homepage default (https://<domain>). Validation logic lives in the api-free
// lib module so it's unit-testable.

type BrandClickDestinationCardProps = {
  brandId: string;
  variant?: "card" | "section";
};

export function BrandClickDestinationCard({
  brandId,
  variant = "card",
}: BrandClickDestinationCardProps) {
  const queryClient = useQueryClient();
  const isSection = variant === "section";

  // Reuse the shared brand query (overview + brand-info) → one fetch. Gives both
  // the saved clickDestinationUrl and the domain we validate against.
  const { data, isPending } = useAuthQuery(["brand", brandId], () => getBrand(brandId));
  const brand = data?.brand ?? null;
  const brandDomain = brand?.domain ?? null;
  const defaultUrl = brandDomain ? `https://${bareHost(brandDomain)}` : "";

  // null until hydrated; "" = unset (placeholder = homepage default).
  const [value, setValue] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const hydrated = useRef(false);

  // Seed once from the saved value (or "" when unset). Mark hydrated even when
  // unset so a later background refetch never clobbers in-progress edits.
  useEffect(() => {
    if (hydrated.current || data === undefined) return;
    setValue(brand?.clickDestinationUrl ?? "");
    hydrated.current = true;
  }, [data, brand]);

  const { mutate, isPending: saving, error } = useMutation({
    mutationFn: (url: string) => saveBrandClickDestination(brandId, url),
    onSuccess: (res) => {
      // Write the fresh value back into the shared brand cache so the overview /
      // brand-info readers see it without waiting on a refetch.
      queryClient.setQueryData(
        ["brand", brandId],
        (prev: { brand: BrandDetail } | null | undefined) =>
          prev?.brand
            ? { brand: { ...prev.brand, clickDestinationUrl: res.clickDestinationUrl } }
            : prev,
      );
      setValue(res.clickDestinationUrl ?? "");
      setDirty(false);
      setSaved(true);
    },
  });

  function update(next: string) {
    setValue(next);
    setDirty(true);
    setSaved(false);
    setValidationError(null);
  }

  function handleSave() {
    if (value === null || brandDomain === null) return;
    // Empty = the homepage default (on-domain by construction).
    const candidate = value.trim() || defaultUrl;
    const result = validateDestination(candidate, brandDomain);
    if (!result.ok) {
      setValidationError(result.error);
      return;
    }
    setValidationError(null);
    mutate(result.url);
  }

  if (isPending || value === null) {
    return (
      <div className={isSection ? "p-5" : "bg-white rounded-xl border border-gray-200 p-5"}>
        <div className="h-4 w-48 bg-gray-100 rounded animate-pulse mb-4" />
        <div className="h-3 w-32 bg-gray-100 rounded animate-pulse mb-2" />
        <div className="h-9 w-full max-w-sm bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className={isSection ? "p-5" : "bg-white rounded-xl border border-gray-200"}>
      <div className={isSection ? "" : "p-5"}>
        <h3 className="mb-1 text-sm font-semibold text-gray-900">Click destination</h3>
        <p className="text-sm text-gray-500 mb-4">
          When a prospect clicks the link in your outreach, this is the page they land on.
          It must be a page on your brand domain
          {brandDomain ? ` (${bareHost(brandDomain)})` : ""}. Defaults to your homepage.
        </p>

        <div className="max-w-sm">
          <label className="block text-xs text-gray-500 mb-1">Destination URL</label>
          <input
            type="url"
            inputMode="url"
            value={value}
            placeholder={defaultUrl || "https://yoursite.com/pricing"}
            onChange={(e) => update(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
          <p className="mt-1.5 text-xs text-gray-400">
            Leave empty to send clicks to your homepage.
          </p>
        </div>

        {validationError && <p className="mt-4 text-sm text-red-600">{validationError}</p>}
        {error && (
          <p className="mt-4 text-sm text-red-600">
            Could not save: {error instanceof Error ? error.message : "unknown error"}
          </p>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          {saved && !dirty && <span className="text-sm text-green-600">Saved ✓</span>}
        </div>
      </div>
    </div>
  );
}
