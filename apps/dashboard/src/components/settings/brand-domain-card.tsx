"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { attachBrandWebsite, getBrand, type BrandDetail } from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";

// One-time brand-domain setup for a no-website brand (domain === null). Once a
// domain is attached it becomes the brand's identity and CANNOT be changed here —
// so this whole section renders only while domain is null, and disappears the
// moment a domain is set. Attaching a domain also unlocks the Click Destination
// card below (its default lands on the new domain's homepage).

/** Normalize + validate a user-supplied website URL. Requires a real http(s) host. */
function validateWebsite(input: string): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Enter your brand's website URL (e.g. https://acme.com)." };
  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, error: "Enter a valid website URL (e.g. https://acme.com)." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "The URL must start with http:// or https://." };
  }
  // A real domain has a dot and a non-empty host (rejects "localhost", "acme").
  if (!parsed.hostname.includes(".") || parsed.hostname.startsWith(".") || parsed.hostname.endsWith(".")) {
    return { ok: false, error: "Enter a full domain (e.g. https://acme.com)." };
  }
  return { ok: true, url: parsed.toString() };
}

export function BrandDomainCard({ brandId }: { brandId: string }) {
  const queryClient = useQueryClient();

  // Reuse the shared brand query (overview + click-destination) → one fetch.
  const { data, isPending } = useAuthQuery(["brand", brandId], () => getBrand(brandId));
  const brand = data?.brand ?? null;
  const brandDomain = brand?.domain ?? null;

  const [value, setValue] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const { mutate, isPending: saving, error } = useMutation({
    mutationFn: (url: string) => attachBrandWebsite(brandId, url),
    onSuccess: (res) => {
      // Write the new domain + url into the shared brand cache so the Click
      // Destination card unlocks (default → new domain) and this section vanishes.
      queryClient.setQueryData(
        ["brand", brandId],
        (prev: { brand: BrandDetail } | null | undefined) =>
          prev?.brand
            ? { brand: { ...prev.brand, domain: res.domain, url: res.url } }
            : prev,
      );
    },
  });

  function handleSave() {
    const result = validateWebsite(value);
    if (!result.ok) {
      setValidationError(result.error);
      return;
    }
    setValidationError(null);
    mutate(result.url);
  }

  // While the brand is loading, don't flash the section (avoids a section that
  // appears then disappears for the common website-brand case).
  if (isPending) return null;
  // Domain already set → identity is fixed, nothing to configure here.
  if (brandDomain !== null) return null;

  return (
    <section className="mb-10">
      <h2 className="mb-3 text-lg font-semibold text-gray-900">Brand Domain</h2>
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="p-5">
          <h3 className="mb-1 text-sm font-semibold text-gray-900">Set your brand domain</h3>
          <p className="text-sm text-gray-500 mb-4">
            Your brand doesn&apos;t have a website yet. Add your domain to unlock click
            destinations and website-based goals. This can only be set once, so make sure it&apos;s right.
          </p>

          <div className="max-w-sm">
            <label className="block text-xs text-gray-500 mb-1">Website URL</label>
            <input
              type="url"
              inputMode="url"
              value={value}
              placeholder="https://acme.com"
              onChange={(e) => {
                setValue(e.target.value);
                setValidationError(null);
              }}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
            <p className="mt-1.5 text-xs text-gray-400">
              Once saved, your domain can&apos;t be changed here.
            </p>
          </div>

          {validationError && <p className="mt-4 text-sm text-red-600">{validationError}</p>}
          {error && (
            <p className="mt-4 text-sm text-red-600">
              Could not save: {error instanceof Error ? error.message : "unknown error"}
            </p>
          )}

          <div className="mt-5">
            <button
              onClick={handleSave}
              disabled={saving || value.trim().length === 0}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
