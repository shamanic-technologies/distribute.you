"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  getBrandSalesEconomics,
  saveBrandSalesEconomics,
  type BrandBusinessModel,
  type BrandFunnelStage,
  type BrandOptimizationGoal,
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
  visitToClosePct: "5",
} as const;

type PctKey =
  | "replyToMeetingPct"
  | "visitToMeetingPct"
  | "meetingToClosePct"
  | "visitToClosePct";

type FormState = {
  lifetimeRevenueUsd: string;
  replyToMeetingPct: string;
  visitToMeetingPct: string;
  meetingToClosePct: string;
  visitToClosePct: string;
  businessModel: BrandBusinessModel | null;
  funnelStages: BrandFunnelStage[];
  optimizationGoal: BrandOptimizationGoal;
};

// The funnel elements a brand can have (multi-select).
const FUNNEL_STAGES: { value: BrandFunnelStage; label: string; tip: string }[] = [
  {
    value: "website_signup",
    label: "Website Signup",
    tip: "Visitors create an account / sign up on your website.",
  },
  {
    value: "website_purchase",
    label: "Website Purchase",
    tip: "Visitors buy directly on your website (self-serve).",
  },
  {
    value: "sales_meeting",
    label: "Sales Meeting",
    tip: "Leads book a sales meeting before becoming customers.",
  },
];

// The single metric the brand optimises for ($ Sales is the default).
const OPTIMIZATION_GOALS: { value: BrandOptimizationGoal; label: string }[] = [
  { value: "signups", label: "# Signups" },
  { value: "booked_meetings", label: "# Booked Meetings" },
  { value: "sales", label: "$ Sales" },
];

const PCT_FIELDS: { key: PctKey; label: string; tip: string }[] = [
  {
    key: "replyToMeetingPct",
    label: "Positive reply → meeting",
    tip: "Of leads who reply positively, the share you turn into a booked meeting.",
  },
  {
    key: "visitToMeetingPct",
    label: "Website visit → meeting",
    tip: "Of leads who click through to your website, the share that book a meeting.",
  },
  {
    key: "meetingToClosePct",
    label: "Meeting → close",
    tip: "Of booked meetings, the share that become paying customers.",
  },
  {
    key: "visitToClosePct",
    label: "Website visit → close",
    tip: "Of leads who visit your website, the share that buy without a meeting (self-serve).",
  },
];

const toInt = (v: string) => Math.round(parseFloat(v) || 0);

export function BrandSalesEconomicsCard({ brandId }: { brandId: string }) {
  const queryClient = useQueryClient();

  const { data, isPending } = useAuthQuery(
    ["brandSalesEconomics", brandId],
    () => getBrandSalesEconomics(brandId),
  );

  const [form, setForm] = useState<FormState | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const hydrated = useRef(false);

  // Seed the form once from the saved set (or defaults when unset). Mark hydrated even
  // when unset so a later background refetch never clobbers in-progress edits.
  useEffect(() => {
    if (hydrated.current || data === undefined) return;
    const e = data.salesEconomics;
    setForm(
      e
        ? {
            lifetimeRevenueUsd: String(e.lifetimeRevenueUsd),
            replyToMeetingPct: String(e.replyToMeetingPct),
            visitToMeetingPct: String(e.visitToMeetingPct),
            meetingToClosePct: String(e.meetingToClosePct),
            visitToClosePct: String(e.visitToClosePct),
            businessModel: e.businessModel,
            funnelStages: e.funnelStages,
            optimizationGoal: e.optimizationGoal,
          }
        : {
            ...DEFAULTS,
            businessModel: null,
            funnelStages: [],
            optimizationGoal: "sales",
          },
    );
    hydrated.current = true;
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
      setDirty(false);
      setSaved(true);
    },
  });

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setDirty(true);
    setSaved(false);
  }

  function toggleFunnelStage(stage: BrandFunnelStage) {
    setForm((f) =>
      f
        ? {
            ...f,
            funnelStages: f.funnelStages.includes(stage)
              ? f.funnelStages.filter((s) => s !== stage)
              : [...f.funnelStages, stage],
          }
        : f,
    );
    setDirty(true);
    setSaved(false);
  }

  function handleSave() {
    if (!form) return;
    mutate({
      lifetimeRevenueUsd: toInt(form.lifetimeRevenueUsd),
      replyToMeetingPct: toInt(form.replyToMeetingPct),
      visitToMeetingPct: toInt(form.visitToMeetingPct),
      meetingToClosePct: toInt(form.meetingToClosePct),
      visitToClosePct: toInt(form.visitToClosePct),
      businessModel: form.businessModel,
      funnelStages: form.funnelStages,
      optimizationGoal: form.optimizationGoal,
    });
  }

  if (isPending || !form) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="h-4 w-48 bg-gray-100 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
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
        <p className="text-sm text-gray-500 mb-4">
          Customer value + conversion funnel, reused across every sales campaign for this
          brand. These power the revenue projections.
        </p>

        {/* Business model */}
        <div className="mb-5">
          <label className="block text-xs text-gray-500 mb-1.5">Business model</label>
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {(["b2c", "b2b"] as const).map((m) => {
              const active = form.businessModel === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => update("businessModel", m)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
                    active
                      ? "bg-white shadow-sm text-brand-700 ring-1 ring-brand-200"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {m.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sales funnel elements (multi-select) */}
        <div className="mb-5">
          <label className="block text-xs text-gray-500 mb-1.5">Sales funnel</label>
          <div className="flex flex-wrap gap-2">
            {FUNNEL_STAGES.map((s) => {
              const active = form.funnelStages.includes(s.value);
              return (
                <button
                  key={s.value}
                  type="button"
                  title={s.tip}
                  onClick={() => toggleFunnelStage(s.value)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-lg border transition ${
                    active
                      ? "bg-brand-50 border-brand-200 text-brand-700 ring-1 ring-brand-200"
                      : "bg-white border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

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

          {/* Conversion rates */}
          {PCT_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="block text-xs text-gray-500 mb-1" title={f.tip}>
                {f.label}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
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
