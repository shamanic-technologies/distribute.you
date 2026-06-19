"use client";

import { useState } from "react";
import { useOrganization, useOrganizationList, useSession } from "@clerk/nextjs";
import { XMarkIcon } from "@heroicons/react/24/outline";
import posthog from "posthog-js";
import { extractDomain } from "@/lib/extract-domain";
import { upsertBrand, extractBrandFields, SALES_PROFILE_FIELDS } from "@/lib/api";

/** Normalize bare-or-full user input into an `https://…` URL for upsertBrand. */
function toUrl(input: string): string {
  const t = input.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function ModalShell({
  title,
  subtitle,
  onClose,
  closable,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  closable: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={() => closable && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold text-gray-900">{title}</h2>
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
          </div>
          {closable && (
            <button
              onClick={onClose}
              className="-mr-1 -mt-1 rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

function UrlField({
  value,
  onChange,
  onSubmit,
  disabled,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  autoFocus?: boolean;
}) {
  const domain = extractDomain(value);
  return (
    <>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. acme.com"
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "Enter" && domain && !disabled) onSubmit();
        }}
        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
      />
      {value.trim() && !domain && (
        <p className="mt-2 text-sm text-red-500">Please enter a valid URL (e.g. acme.com)</p>
      )}
    </>
  );
}

/**
 * Add a brand to the CURRENTLY-ACTIVE org. No org creation, no onboarding-complete
 * write (the active org already passed the edge gate). Mirrors the brand half of
 * default-onboarding: upsertBrand (org-scoped via the active-org Bearer) → extract
 * fields in the background → full reload onto the new brand.
 */
export function BrandCreateModal({ onClose }: { onClose: () => void }) {
  const { organization } = useOrganization();
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const domain = extractDomain(url);

  const handleSubmit = async () => {
    if (!domain || submitting) return;
    if (!organization?.id) {
      setError("No active organization. Please reload and try again.");
      return;
    }
    setSubmitting(true);
    setError(null);
    posthog.capture("brand_create_started", { source: "add-brand-modal" });
    try {
      const { brandId } = await upsertBrand(toUrl(url));
      extractBrandFields([brandId], SALES_PROFILE_FIELDS).catch(() => {});
      posthog.capture("brand_create_completed", { brand_id: brandId, source: "add-brand-modal" });
      // Full reload so React Query / persisted caches + the breadcrumb switcher's
      // module-level brand cache all reset and refetch under the new brand.
      window.location.href = `/orgs/${organization.id}/brands/${brandId}`;
    } catch (err) {
      posthog.capture("brand_create_failed", { source: "add-brand-modal" });
      setError(err instanceof Error ? err.message : "Failed to create brand");
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      title="Add a brand"
      subtitle="Drop the website you want to promote. We'll set up the brand and pull in its profile."
      onClose={onClose}
      closable={!submitting}
    >
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <UrlField value={url} onChange={setUrl} onSubmit={handleSubmit} disabled={submitting} autoFocus />
      <button
        onClick={handleSubmit}
        disabled={!domain || submitting}
        className={`mt-4 w-full rounded-xl bg-brand-600 px-6 py-3 font-medium text-white transition hover:bg-brand-700 ${
          submitting ? "cursor-wait" : "disabled:cursor-not-allowed disabled:opacity-50"
        }`}
      >
        {submitting ? "Creating brand…" : "Create brand"}
      </button>
    </ModalShell>
  );
}

/**
 * Create a NEW organization, then its first brand — distinct from /onboarding
 * (no booking / account-type steps). Two steps: org URL → first brand (prefilled
 * with the org domain). The org is created only at final submit so an abandon at
 * step 2 leaves no orphan org. Mirrors default-onboarding's force-new path:
 * createOrganization → setActive → upsertBrand → mark onboarding-complete (the new
 * org must carry the edge-gate flag or proxy.ts bounces it to /onboarding) →
 * re-mint the token before navigating so the fresh claim is in the cookie.
 */
export function OrgCreateModal({ onClose }: { onClose: () => void }) {
  const { createOrganization, setActive } = useOrganizationList();
  const { session } = useSession();
  const [step, setStep] = useState<"org" | "brand">("org");
  const [orgUrl, setOrgUrl] = useState("");
  const [brandUrl, setBrandUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orgDomain = extractDomain(orgUrl);
  const brandDomain = extractDomain(brandUrl);

  const handleOrgContinue = () => {
    if (!orgDomain) return;
    // Prefill the first brand with the org's own website — the common case is an
    // org promoting its own domain first. Fully editable on the next step.
    setBrandUrl((prev) => prev || orgUrl.trim());
    setStep("brand");
  };

  const handleSubmit = async () => {
    if (!orgDomain || !brandDomain || submitting) return;
    if (!createOrganization || !setActive) {
      setError("Organization setup is not ready yet. Please try again.");
      return;
    }
    setSubmitting(true);
    setError(null);
    posthog.capture("org_create_started", { domain: orgDomain });
    try {
      const org = await createOrganization({ name: orgDomain });
      await setActive({ organization: org.id });
      posthog.capture("org_create_completed", { org_id: org.id, domain: orgDomain });
      // Brand upsert runs under the now-active new org (per-call Bearer reflects
      // setActive immediately — same ordering proven in default-onboarding).
      posthog.capture("brand_create_started", { source: "create-org-modal" });
      const { brandId } = await upsertBrand(toUrl(brandUrl));
      // The new org needs the onboarding-complete edge-gate flag, else proxy.ts
      // redirects it straight to /onboarding. Idempotent server-side.
      await fetch("/api/onboarding/complete", { method: "POST" }).catch((e) =>
        console.error("[dashboard] failed to mark onboarding complete:", e),
      );
      // Re-mint so the fresh orgMeta.onboardingComplete claim is in the cookie the
      // edge gate reads on the next navigation (DIS-111 stale-token loop).
      await session?.getToken({ skipCache: true }).catch(() => {});
      extractBrandFields([brandId], SALES_PROFILE_FIELDS).catch(() => {});
      posthog.capture("brand_create_completed", { brand_id: brandId, source: "create-org-modal" });
      window.location.href = `/orgs/${org.id}/brands/${brandId}`;
    } catch (err) {
      posthog.capture("org_create_failed", { domain: orgDomain });
      setError(err instanceof Error ? err.message : "Failed to create organization");
      setSubmitting(false);
    }
  };

  if (step === "org") {
    return (
      <ModalShell
        title="New organization"
        subtitle="An organization holds your brands and billing. What's its website?"
        onClose={onClose}
        closable={!submitting}
      >
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <UrlField value={orgUrl} onChange={setOrgUrl} onSubmit={handleOrgContinue} disabled={false} autoFocus />
        <button
          onClick={handleOrgContinue}
          disabled={!orgDomain}
          className="mt-4 w-full rounded-xl bg-brand-600 px-6 py-3 font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue
        </button>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      title="Your first brand"
      subtitle="Which brand do you want to promote first in this organization?"
      onClose={onClose}
      closable={!submitting}
    >
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <UrlField value={brandUrl} onChange={setBrandUrl} onSubmit={handleSubmit} disabled={submitting} autoFocus />
      <button
        onClick={handleSubmit}
        disabled={!brandDomain || submitting}
        className={`mt-4 w-full rounded-xl bg-brand-600 px-6 py-3 font-medium text-white transition hover:bg-brand-700 ${
          submitting ? "cursor-wait" : "disabled:cursor-not-allowed disabled:opacity-50"
        }`}
      >
        {submitting ? "Setting up…" : "Create organization"}
      </button>
      {!submitting && (
        <button
          onClick={() => setStep("org")}
          className="mt-3 w-full text-center text-sm font-semibold text-gray-400 transition hover:text-gray-600"
        >
          Back
        </button>
      )}
    </ModalShell>
  );
}
