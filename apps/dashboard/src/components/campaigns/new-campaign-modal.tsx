"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  createCampaignWithoutBrandEnrichment,
  getBrandSalesEconomics,
  listAudiences,
  getBrandProfile,
  type Campaign,
  type BrandOptimizationGoal,
} from "@/lib/api";
import { MaturityBadge } from "@/components/maturity-badge";
import { Skeleton } from "@/components/skeleton";

// New Campaign (v2 staff/beta) — Phase A.
//
// Kevin's brief: "reprendre littéralement le flow d'onboarding d'une brand, avec
// des étapes en moins." A campaign inherits the brand's identity (URL, profile,
// conversion economics) and, per the campaign v2 model, owns its own goal /
// audiences / services / destination / budget. Phase A ships the onboarding-style
// STEPPED flow with NO name prompt, and persists the one field that is already
// per-campaign on the wire: the daily budget. Goal / audiences / services are
// shown as INHERITED-FROM-BRAND review (read-only, manage in brand settings) so
// creating a second campaign never clobbers the brand or sibling campaigns.
// Phase B (campaign-service per-campaign goal/audience/services/destination) flips
// those review panes to editable + persisted.

const GOAL_LABEL: Record<BrandOptimizationGoal, string> = {
  signups: "Maximising signups",
  sales_meetings: "Maximising sales meetings",
  website_visits: "Maximising website visits",
  positive_replies: "Maximising positive replies",
  form_submissions: "Maximising form submissions",
  website_purchase: "Maximising website purchases",
  sales: "Maximising sales",
};

function hostnameOf(url: string | undefined): string {
  if (!url) return "New campaign";
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function servicesFrom(fields: Record<string, string | string[]> | undefined): string[] {
  const raw = fields?.services;
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : [raw]).map((s) => s.trim()).filter(Boolean);
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
      {children}
    </span>
  );
}

function InheritedRow({
  label,
  brandHref,
  children,
  pending,
}: {
  label: string;
  brandHref: string;
  children: React.ReactNode;
  pending: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
        <a href={brandHref} className="text-xs font-medium text-brand-600 hover:underline">
          Edit in brand
        </a>
      </div>
      {pending ? <Skeleton className="h-5 w-40" /> : <div className="flex flex-wrap gap-1.5">{children}</div>}
    </div>
  );
}

export function NewCampaignModal({
  template,
  brandId,
  basePath,
  onClose,
}: {
  /** An existing campaign of this brand — the sending config to clone. */
  template: Campaign;
  brandId: string;
  basePath: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1>(0);
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inherited-from-brand context for the review step. One-shot reads.
  const economicsQ = useAuthQuery(["brandSalesEconomics", brandId], () => getBrandSalesEconomics(brandId));
  const audiencesQ = useAuthQuery(["audiences", brandId, "active"], () =>
    listAudiences(brandId, { status: "active" }),
  );
  const profileQ = useAuthQuery(["brandProfile", brandId], () => getBrandProfile(brandId));

  const goal = economicsQ.data?.salesEconomics?.optimizationGoal ?? "sales_meetings";
  const audiences = useMemo(() => audiencesQ.data?.audiences ?? [], [audiencesQ.data]);
  const services = useMemo(() => servicesFrom(profileQ.data?.current?.fields), [profileQ.data]);
  const brandHost = hostnameOf(template.brandUrls?.[0]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const { campaign } = await createCampaignWithoutBrandEnrichment({
        // No name prompt (Kevin): auto-name from brand host + goal.
        name: `${brandHost} — ${GOAL_LABEL[goal]}`,
        workflowSlug: template.workflowSlug ?? "",
        brandUrls: template.brandUrls,
        featureSlug: template.featureSlug ?? undefined,
        featureInputs: template.featureInputs ?? undefined,
        // Blank budget → omit → campaign inherits the brand daily budget (null-inherit).
        ...(budget.trim() !== ""
          ? { maxBudgetDailyUsd: String(Math.max(0, Math.round(Number(budget)))) }
          : {}),
      });
      router.push(`${basePath}/campaigns/${campaign.id}`);
    } catch (e) {
      console.error("[dashboard] create campaign failed", e);
      setError(e instanceof Error ? e.message : "Could not create the campaign.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center gap-2">
          <h2 className="font-display text-lg font-bold text-gray-800">New campaign</h2>
          <MaturityBadge level="beta" />
          <span className="ml-auto text-xs font-medium text-gray-400">Step {step + 1} of 2</span>
        </div>

        {step === 0 ? (
          <>
            <p className="mb-4 text-sm text-gray-500">
              This campaign runs under {brandHost}&apos;s strategy. It keeps your brand&apos;s goal,
              audiences and services, with its own budget and stats.
            </p>
            <div className="mb-4 space-y-2.5">
              <InheritedRow label="Goal" brandHref={`${basePath}`} pending={economicsQ.data === undefined && !economicsQ.isError}>
                <Chip>{GOAL_LABEL[goal]}</Chip>
              </InheritedRow>
              <InheritedRow
                label="Audiences"
                brandHref={`${basePath}/audiences`}
                pending={audiencesQ.data === undefined && !audiencesQ.isError}
              >
                {audiences.length === 0 ? (
                  <span className="text-xs text-gray-400">No active audience yet</span>
                ) : (
                  audiences.map((a) => <Chip key={a.id}>{a.name}</Chip>)
                )}
              </InheritedRow>
              <InheritedRow
                label="Services"
                brandHref={`${basePath}/profile`}
                pending={profileQ.data === undefined && !profileQ.isError}
              >
                {services.length === 0 ? (
                  <span className="text-xs text-gray-400">—</span>
                ) : (
                  services.map((s) => <Chip key={s}>{s}</Chip>)
                )}
              </InheritedRow>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-gray-500">
              Set this campaign&apos;s daily budget. Leave blank to use the brand daily budget.
            </p>
            <label className="mb-4 block">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Daily budget (optional)
              </span>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm text-gray-500">$</span>
                <input
                  autoFocus
                  type="number"
                  min={0}
                  step={1}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="inherits brand"
                  className="w-32 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-300"
                />
                <span className="text-sm text-gray-500">/ day</span>
              </div>
              <p className="mt-1 text-xs text-gray-400">Leave blank to use the brand daily budget.</p>
            </label>

            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setStep(0)}
                disabled={busy}
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={create}
                disabled={busy}
                className={`rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white ${
                  busy ? "cursor-wait" : "hover:bg-brand-700"
                }`}
              >
                {busy ? "Creating…" : "Create campaign"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
