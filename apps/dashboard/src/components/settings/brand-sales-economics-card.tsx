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
import {
  formatLocaleInteger,
  formatLocaleNumberInputValue,
  parseLocaleNumberInput,
} from "@/lib/format-number";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { MaturityBadge } from "@/components/maturity-badge";

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
  // Single-step conversions for the beta website_visits / positive_replies goals.
  visitToPaidClientPct: "5",
  replyToPaidClientPct: "25",
  // Two-step conversions for the beta form_submissions goal (mirror the signup pair).
  visitToFormSubmissionPct: "25",
  formSubmissionToPaidClientPct: "20",
} as const;

type PctKey =
  | "replyToMeetingPct"
  | "visitToMeetingPct"
  | "meetingToClosePct"
  | "visitToSignupPct"
  | "signupToPaidClientPct"
  | "visitToPaidClientPct"
  | "replyToPaidClientPct"
  | "visitToFormSubmissionPct"
  | "formSubmissionToPaidClientPct";
type RequiredFieldKey =
  | "lifetimeRevenueUsd"
  | "replyToMeetingPct"
  | "visitToMeetingPct"
  | "meetingToClosePct"
  | "visitToSignupPct"
  | "signupToPaidClientPct"
  | "visitToPaidClientPct"
  | "replyToPaidClientPct"
  | "visitToFormSubmissionPct"
  | "formSubmissionToPaidClientPct";

type FormState = {
  lifetimeRevenueUsd: string;
  replyToMeetingPct: string;
  visitToMeetingPct: string;
  meetingToClosePct: string;
  visitToSignupPct: string;
  signupToPaidClientPct: string;
  visitToPaidClientPct: string;
  replyToPaidClientPct: string;
  visitToFormSubmissionPct: string;
  formSubmissionToPaidClientPct: string;
  optimizationGoal: BrandOptimizationGoal;
};

type SalesEconomicsQueryData = { salesEconomics: BrandSalesEconomics | null };

function defaultForm(): FormState {
  return {
    lifetimeRevenueUsd: formatLocaleInteger(Number(DEFAULTS.lifetimeRevenueUsd)),
    replyToMeetingPct: formatLocaleNumberInputValue(Number(DEFAULTS.replyToMeetingPct)),
    visitToMeetingPct: formatLocaleNumberInputValue(Number(DEFAULTS.visitToMeetingPct)),
    meetingToClosePct: formatLocaleNumberInputValue(Number(DEFAULTS.meetingToClosePct)),
    visitToSignupPct: formatLocaleNumberInputValue(Number(DEFAULTS.visitToSignupPct)),
    signupToPaidClientPct: formatLocaleNumberInputValue(Number(DEFAULTS.signupToPaidClientPct)),
    visitToPaidClientPct: formatLocaleNumberInputValue(Number(DEFAULTS.visitToPaidClientPct)),
    replyToPaidClientPct: formatLocaleNumberInputValue(Number(DEFAULTS.replyToPaidClientPct)),
    visitToFormSubmissionPct: formatLocaleNumberInputValue(Number(DEFAULTS.visitToFormSubmissionPct)),
    formSubmissionToPaidClientPct: formatLocaleNumberInputValue(Number(DEFAULTS.formSubmissionToPaidClientPct)),
    optimizationGoal: "sales_meetings",
  };
}

function formFromEconomics(e: BrandSalesEconomics | null | undefined): FormState {
  if (!e) return defaultForm();
  return {
    lifetimeRevenueUsd: formatLocaleInteger(e.lifetimeRevenueUsd),
    replyToMeetingPct: formatLocaleNumberInputValue(e.replyToMeetingPct),
    visitToMeetingPct: formatLocaleNumberInputValue(e.visitToMeetingPct),
    meetingToClosePct: formatLocaleNumberInputValue(e.meetingToClosePct),
    visitToSignupPct: formatLocaleNumberInputValue(e.visitToSignupPct),
    signupToPaidClientPct: formatLocaleNumberInputValue(e.signupToPaidClientPct),
    visitToPaidClientPct: formatLocaleNumberInputValue(e.visitToPaidClientPct),
    replyToPaidClientPct: formatLocaleNumberInputValue(e.replyToPaidClientPct),
    // Optional on the wire until brand-service prod serves them — fall back to the seed default.
    visitToFormSubmissionPct: formatLocaleNumberInputValue(
      e.visitToFormSubmissionPct ?? Number(DEFAULTS.visitToFormSubmissionPct),
    ),
    formSubmissionToPaidClientPct: formatLocaleNumberInputValue(
      e.formSubmissionToPaidClientPct ?? Number(DEFAULTS.formSubmissionToPaidClientPct),
    ),
    optimizationGoal: e.optimizationGoal,
  };
}

const OPTIMIZATION_GOALS: {
  value: BrandOptimizationGoal;
  label: string;
  beta?: boolean;
}[] = [
  { value: "signups", label: "# Signups" },
  { value: "sales_meetings", label: "# Sales Meetings" },
  { value: "website_visits", label: "# Website visits", beta: true },
  { value: "positive_replies", label: "# Positive Replies", beta: true },
  { value: "form_submissions", label: "# Form submissions", beta: true },
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
    key: "meetingToClosePct",
    label: "Meeting → Paid client",
    tip: "Of leads who book a meeting, the share that become paying customers.",
    goals: ["sales_meetings"],
  },
  {
    key: "visitToSignupPct",
    label: "Website visit → signup",
    tip: "Of leads who visit your website, the share that sign up.",
    goals: ["signups"],
  },
  {
    key: "signupToPaidClientPct",
    label: "Signup → Paid client",
    tip: "Of leads who sign up, the share that become paying customers.",
    goals: ["signups"],
  },
  {
    key: "visitToPaidClientPct",
    label: "Website visit → Paid client",
    tip: "Of leads who click through to your website, the share that become paying customers.",
    goals: ["website_visits"],
  },
  {
    key: "replyToPaidClientPct",
    label: "Positive reply → Paid client",
    tip: "Of leads who reply positively, the share that become paying customers.",
    goals: ["positive_replies"],
  },
  {
    key: "visitToFormSubmissionPct",
    label: "Website visit → form submission",
    tip: "Of leads who visit your website, the share that submit a form.",
    goals: ["form_submissions"],
  },
  {
    key: "formSubmissionToPaidClientPct",
    label: "Form submission → Paid client",
    tip: "Of leads who submit a form, the share that become paying customers.",
    goals: ["form_submissions"],
  },
];

const REQUIRED_FIELDS_BY_GOAL: Record<BrandOptimizationGoal, RequiredFieldKey[]> = {
  signups: ["visitToSignupPct", "signupToPaidClientPct"],
  sales_meetings: ["replyToMeetingPct", "visitToMeetingPct", "meetingToClosePct"],
  website_visits: ["visitToPaidClientPct"],
  positive_replies: ["replyToPaidClientPct"],
  form_submissions: ["visitToFormSubmissionPct", "formSubmissionToPaidClientPct"],
};

const REQUIRED_FIELD_LABELS: Record<RequiredFieldKey, string> = {
  lifetimeRevenueUsd: "Customer Lifetime Revenue",
  replyToMeetingPct: "Positive reply → meeting",
  visitToMeetingPct: "Website visit → meeting",
  meetingToClosePct: "Meeting → Paid client",
  visitToSignupPct: "Website visit → signup",
  signupToPaidClientPct: "Signup → Paid client",
  visitToPaidClientPct: "Website visit → Paid client",
  replyToPaidClientPct: "Positive reply → Paid client",
  visitToFormSubmissionPct: "Website visit → form submission",
  formSubmissionToPaidClientPct: "Form submission → Paid client",
};

const hasNumericValue = (v: string) => parseLocaleNumberInput(v) !== null;
const parseNumberOrDefault = (v: string, fallback: string) =>
  parseLocaleNumberInput(v) ?? Number(fallback);
const toIntOrDefault = (v: string, fallback: string) =>
  Math.round(parseNumberOrDefault(v, fallback));
const toPctOrDefault = (v: string, fallback: string) =>
  parseNumberOrDefault(v, fallback);

export function BrandSalesEconomicsCard({ brandId }: { brandId: string }) {
  const isBeta = useIsBetaUser();
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
      // Economics drive every server-computed metric (revenue overview, pipeline
      // activity, workflow/strategy projections). Invalidate the whole cache so no
      // econ-derived number stays stale anywhere — one-time burst on a user save.
      queryClient.invalidateQueries();
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

  function normalizeNumberInput(key: Exclude<keyof FormState, "optimizationGoal">) {
    const parsed = parseLocaleNumberInput(form[key]);
    if (parsed === null) return;
    setForm((f) => ({ ...f, [key]: formatLocaleNumberInputValue(parsed) }));
  }

  // Customer Lifetime Revenue is whole dollars only — strip every non-digit on
  // input so a decimal separator can never be typed, regroup on blur.
  function updateInteger(key: "lifetimeRevenueUsd", raw: string) {
    update(key, raw.replace(/\D/g, ""));
  }

  function normalizeIntegerInput(key: "lifetimeRevenueUsd") {
    const parsed = parseLocaleNumberInput(form[key]);
    if (parsed === null) return;
    setForm((f) => ({ ...f, [key]: formatLocaleInteger(parsed) }));
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
      visitToPaidClientPct: toPctOrDefault(
        form.visitToPaidClientPct,
        DEFAULTS.visitToPaidClientPct,
      ),
      replyToPaidClientPct: toPctOrDefault(
        form.replyToPaidClientPct,
        DEFAULTS.replyToPaidClientPct,
      ),
      visitToFormSubmissionPct: toPctOrDefault(
        form.visitToFormSubmissionPct,
        DEFAULTS.visitToFormSubmissionPct,
      ),
      formSubmissionToPaidClientPct: toPctOrDefault(
        form.formSubmissionToPaidClientPct,
        DEFAULTS.formSubmissionToPaidClientPct,
      ),
      optimizationGoal: form.optimizationGoal,
    });
  }

  const visiblePctFields = PCT_FIELDS.filter((f) =>
    f.goals.includes(form.optimizationGoal),
  );

  // Beta goals show only for beta users — but never hide the currently-active goal
  // (a goal a beta teammate already saved must still render its button for everyone).
  const visibleGoals = OPTIMIZATION_GOALS.filter(
    (g) => !g.beta || isBeta || g.value === form.optimizationGoal,
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
          <div className="inline-flex flex-wrap rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {visibleGoals.map((g) => {
              const active = form.optimizationGoal === g.value;
              return (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => update("optimizationGoal", g.value)}
                  className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md transition ${
                    active
                      ? "bg-white shadow-sm text-brand-700 ring-1 ring-brand-200"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {g.label}
                  {g.beta && <MaturityBadge level="beta" />}
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
                type="text"
                inputMode="numeric"
                value={form.lifetimeRevenueUsd}
                onChange={(e) => updateInteger("lifetimeRevenueUsd", e.target.value)}
                onBlur={() => normalizeIntegerInput("lifetimeRevenueUsd")}
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
                  type="text"
                  inputMode="decimal"
                  value={form[f.key]}
                  onChange={(e) => update(f.key, e.target.value)}
                  onBlur={() => normalizeNumberInput(f.key)}
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
