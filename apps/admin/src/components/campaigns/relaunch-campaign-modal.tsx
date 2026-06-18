"use client";

import { useEffect, useMemo, useState } from "react";
import type { Campaign } from "@/lib/api";

export type BudgetFrequency = "one-off" | "daily" | "weekly" | "monthly";

const BUDGET_FREQUENCIES: { value: BudgetFrequency; label: string }[] = [
  { value: "one-off", label: "One-off" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export interface RelaunchBudget {
  amount: string;
  frequency: BudgetFrequency;
}

/**
 * Pick the active budget field (first non-null wins) and convert to
 * { amount, frequency }. Returns null if no budget is set on the campaign.
 */
export function deriveBudgetFromCampaign(campaign: Pick<Campaign,
  "maxBudgetDailyUsd" | "maxBudgetWeeklyUsd" | "maxBudgetMonthlyUsd" | "maxBudgetTotalUsd"
>): RelaunchBudget | null {
  if (campaign.maxBudgetDailyUsd) return { amount: campaign.maxBudgetDailyUsd, frequency: "daily" };
  if (campaign.maxBudgetWeeklyUsd) return { amount: campaign.maxBudgetWeeklyUsd, frequency: "weekly" };
  if (campaign.maxBudgetMonthlyUsd) return { amount: campaign.maxBudgetMonthlyUsd, frequency: "monthly" };
  if (campaign.maxBudgetTotalUsd) return { amount: campaign.maxBudgetTotalUsd, frequency: "one-off" };
  return null;
}

/**
 * Build the budget subset of the createCampaign payload from edited values.
 * Exactly one of the four maxBudget*Usd fields will be set.
 */
export function buildBudgetParams(amount: string, frequency: BudgetFrequency): Record<string, string> {
  switch (frequency) {
    case "one-off": return { maxBudgetTotalUsd: amount };
    case "daily": return { maxBudgetDailyUsd: amount };
    case "weekly": return { maxBudgetWeeklyUsd: amount };
    case "monthly": return { maxBudgetMonthlyUsd: amount };
  }
}

interface Props {
  open: boolean;
  campaign: Campaign;
  submitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onConfirm: (budget: RelaunchBudget) => void;
}

export function RelaunchCampaignModal({ open, campaign, submitting, errorMessage, onClose, onConfirm }: Props) {
  const initial = useMemo(() => deriveBudgetFromCampaign(campaign), [campaign]);
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [frequency, setFrequency] = useState<BudgetFrequency>(initial?.frequency ?? "monthly");

  useEffect(() => {
    if (open) {
      setAmount(initial?.amount ?? "");
      setFrequency(initial?.frequency ?? "monthly");
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const handleConfirm = () => {
    if (!amount.trim() || submitting) return;
    onConfirm({ amount: amount.trim(), frequency });
  };

  const featureInputEntries = campaign.featureInputs ? Object.entries(campaign.featureInputs) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => { if (!submitting) onClose(); }}>
      <div
        className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-gray-800">Relaunch Campaign</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 transition disabled:opacity-50"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Brand URLs (read-only) */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Brand{campaign.brandUrls.length > 1 ? "s" : ""}
            </label>
            <div className="space-y-1">
              {campaign.brandUrls.map((url, idx) => (
                <div
                  key={`${url}-${idx}`}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg"
                >
                  <span className="text-sm text-gray-700 truncate">{url}</span>
                  {idx === 0 ? (
                    <span className="ml-auto text-xs text-gray-400 bg-white px-2 py-0.5 rounded">Primary</span>
                  ) : (
                    <span className="ml-auto text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Co-brand</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Workflow (read-only) */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Workflow
            </label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700">{campaign.workflowSlug ?? "—"}</span>
            </div>
          </div>

          {/* Feature inputs (read-only) */}
          {featureInputEntries.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                Campaign Inputs
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {featureInputEntries.map(([key, value]) => (
                  <div key={key}>
                    <span className="block text-xs text-gray-500 mb-1">{key}</span>
                    <input
                      type="text"
                      value={value}
                      disabled
                      readOnly
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Budget (editable) */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Budget
            </label>
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  disabled={submitting}
                  className="w-28 pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:opacity-50"
                />
              </div>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as BudgetFrequency)}
                disabled={submitting}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:opacity-50"
              >
                {BUDGET_FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              You can change the budget amount and frequency. Other settings are copied from the original campaign.
            </p>
          </div>

          {errorMessage && (
            <p className="text-sm text-red-600">{errorMessage}</p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || !amount.trim()}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Relaunching…" : "Confirm Relaunch"}
          </button>
        </div>
      </div>
    </div>
  );
}
