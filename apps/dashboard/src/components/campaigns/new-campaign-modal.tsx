"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCampaignWithoutBrandEnrichment, type Campaign } from "@/lib/api";
import { MaturityBadge } from "@/components/maturity-badge";

// New Campaign (v2 staff/beta). A brand's audiences + sales-economics are brand-wide,
// so a second campaign only needs a name + (optional) its own daily budget — it CLONES
// the brand's existing campaign's sending config (workflow, brand URLs, feature inputs),
// which is guaranteed valid because that campaign already runs. Leaving the budget blank
// = inherit the brand daily budget (null-inherit). On create, navigate to the new
// campaign's overview.
export function NewCampaignModal({
  template,
  basePath,
  onClose,
}: {
  /** An existing campaign of this brand — the sending config to clone. */
  template: Campaign;
  basePath: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) { setError("Give the campaign a name."); return; }
    setBusy(true);
    setError(null);
    try {
      const { campaign } = await createCampaignWithoutBrandEnrichment({
        name: trimmedName,
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
        className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center gap-2">
          <h2 className="font-display text-lg font-bold text-gray-800">New campaign</h2>
          <MaturityBadge level="beta" />
        </div>
        <p className="mb-4 text-sm text-gray-500">
          Same audiences and strategy as this brand, run as a separate campaign with its own
          budget and stats.
        </p>

        <label className="mb-3 block">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Enterprise push"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-300"
          />
        </label>

        <label className="mb-4 block">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Daily budget (optional)
          </span>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm text-gray-500">$</span>
            <input
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
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
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
      </div>
    </div>
  );
}
