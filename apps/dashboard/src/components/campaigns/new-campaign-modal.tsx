"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  createCampaignWithoutBrandEnrichment,
  getBrandSalesEconomics,
  listAudiences,
  getBrandProfile,
  runtimeGoalForOptimizationGoal,
  type Campaign,
  type RuntimeGoal,
} from "@/lib/api";
import { MaturityBadge } from "@/components/maturity-badge";
import { Skeleton } from "@/components/skeleton";

// New Campaign (v2 staff/beta) — Phase B.
//
// Kevin's brief: "reprendre littéralement le flow d'onboarding d'une brand, avec
// des étapes en moins." A campaign inherits the brand's identity (URL, profile,
// conversion economics). Per the campaign v2 model it OWNS its own goal /
// audiences / services / click destination / daily budget. Phase B flips the
// former read-only review panes to EDITABLE and persists the picked config on
// create. Null / unchanged-from-inherit is written as null so a new campaign
// never clobbers the brand or sibling campaigns (null = inherit everywhere).
//
// The goal enum on a campaign is the campaign-service RuntimeGoal vocabulary
// (signup / meetingBooked / purchase), NOT the brand-level BrandOptimizationGoal.

type GoalChoice = RuntimeGoal | "inherit";

const RUNTIME_GOAL_LABEL: Record<RuntimeGoal, string> = {
  signup: "Signups",
  meetingBooked: "Sales meetings",
  purchase: "Website purchases",
};

const GOAL_OPTIONS: { value: GoalChoice; label: string }[] = [
  { value: "inherit", label: "Inherit from brand" },
  { value: "signup", label: RUNTIME_GOAL_LABEL.signup },
  { value: "meetingBooked", label: RUNTIME_GOAL_LABEL.meetingBooked },
  { value: "purchase", label: RUNTIME_GOAL_LABEL.purchase },
];

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

function sameStringSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sb = new Set(b);
  return a.every((x) => sb.has(x));
}

function StepLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{children}</span>;
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
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inherited-from-brand context. One-shot reads.
  const economicsQ = useAuthQuery(["brandSalesEconomics", brandId], () => getBrandSalesEconomics(brandId));
  const audiencesQ = useAuthQuery(["audiences", brandId, "active"], () =>
    listAudiences(brandId, { status: "active" }),
  );
  const profileQ = useAuthQuery(["brandProfile", brandId], () => getBrandProfile(brandId));

  const brandGoal = economicsQ.data?.salesEconomics?.optimizationGoal ?? "sales_meetings";
  const inheritedRuntimeGoal = runtimeGoalForOptimizationGoal(brandGoal);
  const audiences = useMemo(() => audiencesQ.data?.audiences ?? [], [audiencesQ.data]);
  const inheritedServices = useMemo(() => servicesFrom(profileQ.data?.current?.fields), [profileQ.data]);
  const brandHost = hostnameOf(template.brandUrls?.[0]);

  // Editable per-campaign config. Seeded from the brand once its context loads.
  const [goal, setGoal] = useState<GoalChoice>("inherit");
  const [selectedAudienceIds, setSelectedAudienceIds] = useState<string[] | null>(null);
  const [services, setServices] = useState<string[] | null>(null);
  const [serviceDraft, setServiceDraft] = useState("");
  const [destination, setDestination] = useState("");
  const [budget, setBudget] = useState("");

  const economicsReady = economicsQ.data !== undefined || economicsQ.isError;
  const audiencesReady = audiencesQ.data !== undefined || audiencesQ.isError;
  const profileReady = profileQ.data !== undefined || profileQ.isError;

  // Seed the goal picker with the inherited brand goal once economics resolve.
  useEffect(() => {
    if (economicsReady) setGoal((g) => (g === "inherit" && economicsQ.data ? inheritedRuntimeGoal : g));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [economicsReady]);

  // Default = all active audiences selected (= inherit the brand's full set).
  useEffect(() => {
    if (audiencesReady && selectedAudienceIds === null) {
      setSelectedAudienceIds(audiences.map((a) => a.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audiencesReady, audiences]);

  // Seed services from the brand profile.
  useEffect(() => {
    if (profileReady && services === null) setServices(inheritedServices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileReady, inheritedServices]);

  const currentServices = services ?? [];
  const currentAudienceIds = selectedAudienceIds ?? [];

  const toggleAudience = (id: string) => {
    setSelectedAudienceIds((prev) => {
      const base = prev ?? audiences.map((a) => a.id);
      return base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    });
  };

  const addService = () => {
    const v = serviceDraft.trim();
    if (!v) return;
    setServices((prev) => {
      const base = prev ?? inheritedServices;
      return base.includes(v) ? base : [...base, v];
    });
    setServiceDraft("");
  };

  const removeService = (s: string) => {
    setServices((prev) => (prev ?? inheritedServices).filter((x) => x !== s));
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      // Null = inherit. Only write a concrete value when the user diverged from the
      // brand's inherited config.
      const goalPatch: RuntimeGoal | null = goal === "inherit" ? null : goal;

      const allAudienceIds = audiences.map((a) => a.id);
      const isFullAudienceSet =
        currentAudienceIds.length === 0 || sameStringSet(currentAudienceIds, allAudienceIds);
      const audienceIdsPatch: string[] | null = isFullAudienceSet ? null : currentAudienceIds;

      const servicesPatch: string[] | null = sameStringSet(currentServices, inheritedServices)
        ? null
        : currentServices;

      const destinationPatch: string | null = destination.trim() !== "" ? destination.trim() : null;

      const goalLabel = goal === "inherit" ? RUNTIME_GOAL_LABEL[inheritedRuntimeGoal] : RUNTIME_GOAL_LABEL[goal];

      const { campaign } = await createCampaignWithoutBrandEnrichment({
        // No name prompt (Kevin): auto-name from brand host + goal.
        name: `${brandHost} — ${goalLabel}`,
        workflowSlug: template.workflowSlug ?? "",
        brandUrls: template.brandUrls,
        featureSlug: template.featureSlug ?? undefined,
        featureInputs: template.featureInputs ?? undefined,
        goal: goalPatch,
        audienceIds: audienceIdsPatch,
        servicesOffered: servicesPatch,
        clickDestinationUrl: destinationPatch,
        // Blank budget → omit → campaign inherits the brand daily budget (null-inherit).
        ...(budget.trim() !== ""
          ? { maxBudgetDailyUsd: String(Math.max(0, Math.round(Number(budget)))) }
          : {}),
      });
      router.push(`${basePath}/channels/${campaign.id}`);
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
          <span className="ml-auto text-xs font-medium text-gray-400">Step {step + 1} of 3</span>
        </div>

        {step === 0 ? (
          <>
            <p className="mb-4 text-sm text-gray-500">
              This campaign runs under {brandHost}&apos;s strategy. Pick its goal and which
              audiences it targets. Leave the defaults to inherit from the brand.
            </p>

            <div className="mb-4 space-y-4">
              <div>
                <StepLabel>Goal</StepLabel>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {GOAL_OPTIONS.map((opt) => {
                    const active = goal === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setGoal(opt.value)}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          active
                            ? "border-brand-300 bg-brand-50 text-brand-700 ring-2 ring-brand-300"
                            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        {opt.label}
                        {opt.value === "inherit" && (
                          <span className="ml-1 text-xs text-gray-400">
                            ({RUNTIME_GOAL_LABEL[inheritedRuntimeGoal]})
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <StepLabel>Audiences</StepLabel>
                <p className="mt-0.5 text-xs text-gray-400">
                  All selected inherits the brand&apos;s full set. Deselect to target a subset.
                </p>
                {!audiencesReady ? (
                  <Skeleton className="mt-1.5 h-16 w-full" />
                ) : audiences.length === 0 ? (
                  <p className="mt-1.5 text-xs text-gray-400">No active audience yet</p>
                ) : (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {audiences.map((a) => {
                      const on = currentAudienceIds.includes(a.id);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => toggleAudience(a.id)}
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                            on
                              ? "border-brand-200 bg-brand-50 text-brand-700"
                              : "border-gray-200 bg-white text-gray-400 hover:border-gray-300"
                          }`}
                        >
                          {a.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
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
        ) : step === 1 ? (
          <>
            <p className="mb-4 text-sm text-gray-500">
              What this campaign offers, and where its clicks should land. Leave blank to inherit
              from the brand.
            </p>

            <div className="mb-4 space-y-4">
              <div>
                <StepLabel>Services</StepLabel>
                {!profileReady ? (
                  <Skeleton className="mt-1.5 h-8 w-full" />
                ) : (
                  <>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {currentServices.length === 0 ? (
                        <span className="text-xs text-gray-400">No services yet</span>
                      ) : (
                        currentServices.map((s) => (
                          <span
                            key={s}
                            className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700"
                          >
                            {s}
                            <button
                              type="button"
                              onClick={() => removeService(s)}
                              className="text-brand-400 hover:text-brand-700"
                              aria-label={`Remove ${s}`}
                            >
                              ×
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="text"
                        value={serviceDraft}
                        onChange={(e) => setServiceDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addService();
                          }
                        }}
                        placeholder="Add a service"
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-300"
                      />
                      <button
                        type="button"
                        onClick={addService}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                      >
                        Add
                      </button>
                    </div>
                  </>
                )}
              </div>

              <label className="block">
                <StepLabel>Click destination</StepLabel>
                <input
                  type="url"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="inherits brand"
                  className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-300"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Where outreach clicks land. Leave blank to use the brand&apos;s destination.
                </p>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
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
              <StepLabel>Daily budget (optional)</StepLabel>
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
                onClick={() => setStep(1)}
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
