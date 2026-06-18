"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  getBrandSalesEconomics,
  saveBrandSalesEconomics,
  type BrandOptimizationGoal,
  type BrandSalesEconomics,
  type BrandSalesEconomicsInput,
} from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";

// Seed values when a brand has never saved economics — mirrors the campaign-creation
// form's SALES_ECON_DEFAULTS so both surfaces start from the same numbers.
const DEFAULTS = {
  lifetimeRevenueUsd: "4000",
  replyToMeetingPct: "40",
  visitToMeetingPct: "20",
  meetingToClosePct: "25",
  // Self-serve close is now two steps: visit→signup × signup→paid = the old
  // visit→close (25 × 20% = 5%, matching the prior default).
  visitToSignupPct: "25",
  signupToPaidClientPct: "20",
} as const;

type PctKey =
  | "replyToMeetingPct"
  | "visitToMeetingPct"
  | "meetingToClosePct"
  | "visitToSignupPct"
  | "signupToPaidClientPct";
type RequiredFieldKey =
  | "lifetimeRevenueUsd"
  | "replyToMeetingPct"
  | "visitToMeetingPct"
  | "visitToSignupPct";

type FormState = {
  lifetimeRevenueUsd: string;
  replyToMeetingPct: string;
  visitToMeetingPct: string;
  meetingToClosePct: string;
  visitToSignupPct: string;
  signupToPaidClientPct: string;
  optimizationGoal: BrandOptimizationGoal;
};

type SalesEconomicsQueryData = { salesEconomics: BrandSalesEconomics | null };

function defaultForm(): FormState {
  return {
    ...DEFAULTS,
    optimizationGoal: "sales_meetings",
  };
}

function formFromEconomics(e: BrandSalesEconomics | null | undefined): FormState {
  if (!e) return defaultForm();
  return {
    lifetimeRevenueUsd: String(e.lifetimeRevenueUsd),
    replyToMeetingPct: String(e.replyToMeetingPct),
    visitToMeetingPct: String(e.visitToMeetingPct),
    meetingToClosePct: String(e.meetingToClosePct),
    visitToSignupPct: String(e.visitToSignupPct),
    signupToPaidClientPct: String(e.signupToPaidClientPct),
    optimizationGoal: e.optimizationGoal,
  };
}

const OPTIMIZATION_GOALS: {
  value: BrandOptimizationGoal;
  label: string;
}[] = [
  { value: "signups", label: "# Signups" },
  { value: "sales_meetings", label: "# Sales Meetings" },
];

const PCT_FIELDS: {
  key: PctKey;
  label: string;
  tip: string;
  goals: BrandOptimizationGoal[];
}[] = [
  {
    key: "replyToMeetingPct",
    label: "Positive reply → meeting",
    tip: "Of leads who reply positively, the share you turn into a booked meeting.",
    goals: ["sales_meetings"],
  },
  {
    key: "visitToMeetingPct",
    label: "Website visit → meeting",
    tip: "Of leads who click through to your website, the share that book a meeting.",
    goals: ["sales_meetings"],
  },
  {
    key: "visitToSignupPct",
    label: "Website visit → signup",
    tip: "Of leads who visit your website, the share that sign up.",
    goals: ["signups"],
  },
];

const REQUIRED_FIELDS_BY_GOAL: Record<BrandOptimizationGoal, RequiredFieldKey[]> = {
  signups: ["visitToSignupPct"],
  sales_meetings: ["replyToMeetingPct", "visitToMeetingPct"],
};

const REQUIRED_FIELD_LABELS: Record<RequiredFieldKey, string> = {
  lifetimeRevenueUsd: "Customer Lifetime Revenue",
  replyToMeetingPct: "Positive reply → meeting",
  visitToMeetingPct: "Website visit → meeting",
  visitToSignupPct: "Website visit → signup",
};

const hasNumericValue = (v: string) => v.trim() !== "" && Number.isFinite(Number(v));
const toIntOrDefault = (v: string, fallback: string) =>
  Math.round(hasNumericValue(v) ? Number(v) : Number(fallback));
const toPctOrDefault = (v: string, fallback: string) =>
  hasNumericValue(v) ? Number(v) : Number(fallback);

export function BrandSalesEconomicsCard({ brandId }: { brandId: string }) {
  const queryClient = useQueryClient();
  const initialData = queryClient.getQueryData<SalesEconomicsQueryData>([
    "brandSalesEconomics",
    brandId,
  ]);

  const { data } = useAuthQuery(
    ["brandSalesEconomics", brandId],
    () => getBrandSalesEconomics(brandId),
  );

  const [form, setForm] = useState<FormState>(() =>
    formFromEconomics(initialData?.salesEconomics),
  );
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const hydrated = useRef(initialData !== undefined);

  // The editor paints immediately from cache/defaults; the backend read only hydrates
  // it once, and never clobbers an edit the user has already started.
  useEffect(() => {
    if (hydrated.current || data === undefined) return;
    hydrated.current = true;
    if (!dirtyRef.current) setForm(formFromEconomics(data.salesEconomics));
  }, [data]);

  const { mutate, isPending: saving, error } = useMutation({
    mutationFn: (input: BrandSalesEconomicsInput) =>
      saveBrandSalesEconomics(brandId, input),
    onSuccess: (res) => {
      // Write the fresh row to the shared cache so the campaign form + revenue
      // overview read the new values without waiting on a refetch.
      queryClient.setQueryData(["brandSalesEconomics", brandId], res);
      // Economics drive the server-computed revenue overview — nudge it to refetch.
      queryClient.invalidateQueries({ queryKey: ["featureRevenue"] });
      dirtyRef.current = false;
      setDirty(false);
      setSaved(true);
    },
  });

  function markDirty() {
    dirtyRef.current = true;
    setDirty(true);
    setSaved(false);
    setValidationError(null);
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    markDirty();
  }

  function handleSave() {
    const requiredFields: RequiredFieldKey[] = [
      "lifetimeRevenueUsd",
      ...REQUIRED_FIELDS_BY_GOAL[form.optimizationGoal],
    ];
    const missing = requiredFields.filter((key) => !hasNumericValue(form[key]));
    if (missing.length > 0) {
      setValidationError(
        `Fill ${missing.map((key) => REQUIRED_FIELD_LABELS[key]).join(", ")} before saving.`,
      );
      return;
    }

    mutate({
      lifetimeRevenueUsd: toIntOrDefault(
        form.lifetimeRevenueUsd,
        DEFAULTS.lifetimeRevenueUsd,
      ),
      replyToMeetingPct: toPctOrDefault(
        form.replyToMeetingPct,
        DEFAULTS.replyToMeetingPct,
      ),
      visitToMeetingPct: toPctOrDefault(
        form.visitToMeetingPct,
        DEFAULTS.visitToMeetingPct,
      ),
      meetingToClosePct: toPctOrDefault(
        form.meetingToClosePct,
        DEFAULTS.meetingToClosePct,
      ),
      visitToSignupPct: toPctOrDefault(
        form.visitToSignupPct,
        DEFAULTS.visitToSignupPct,
      ),
      signupToPaidClientPct: toPctOrDefault(
        form.signupToPaidClientPct,
        DEFAULTS.signupToPaidClientPct,
      ),
      optimizationGoal: form.optimizationGoal,
    });
  }

  const visiblePctFields = PCT_FIELDS.filter((f) =>
    f.goals.includes(form.optimizationGoal),
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="p-5">
        <p className="text-sm text-gray-500 mb-4">
          Customer value + conversion rates, reused across every sales campaign for this
          brand. These power the revenue projections.
        </p>

        {/* Optimization goal (single-choice) */}
        <div className="mb-5">
          <label className="block text-xs text-gray-500 mb-1.5">Optimization goal</label>
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {OPTIMIZATION_GOALS.map((g) => {
              const active = form.optimizationGoal === g.value;
              return (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => update("optimizationGoal", g.value)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
                    active
                      ? "bg-white shadow-sm text-brand-700 ring-1 ring-brand-200"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Customer Lifetime Revenue */}
          <div>
            <label
              className="block text-xs text-gray-500 mb-1"
              title="Average total revenue (not gross margin) one customer brings over their lifetime."
            >
              Customer Lifetime Revenue
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                $
              </span>
              <input
                type="number"
                min="0"
                step="100"
                value={form.lifetimeRevenueUsd}
                onChange={(e) => update("lifetimeRevenueUsd", e.target.value)}
                className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </div>
          </div>

          {/* Conversion rates — only those relevant to the selected goal */}
          {visiblePctFields.map((f) => (
            <div key={f.key}>
              <label className="block text-xs text-gray-500 mb-1" title={f.tip}>
                {f.label}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form[f.key]}
                  onChange={(e) => update(f.key, e.target.value)}
                  className="w-full pl-3 pr-7 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  %
                </span>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600">
            Could not save: {error instanceof Error ? error.message : "unknown error"}
          </p>
        )}
        {validationError && (
          <p className="mt-4 text-sm text-red-600">{validationError}</p>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          {saved && !dirty && (
            <span className="text-sm text-green-600">Saved ✓</span>
          )}
        </div>
      </div>
    </div>
  );
}
