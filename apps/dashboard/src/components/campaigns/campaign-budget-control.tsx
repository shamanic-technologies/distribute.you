"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@/lib/use-auth-query";
import { updateCampaignDailyBudget, type Campaign } from "@/lib/api";
import { MaturityBadge } from "@/components/maturity-badge";

// Per-campaign daily budget editor (v2 beta). Audiences + sales-economics stay
// brand-wide; the DAILY BUDGET is the one per-campaign override. When unset the
// campaign inherits the brand daily budget live (null-inherit) — the control shows
// "inherits brand" and lets a staff user set an explicit per-campaign budget or
// clear it back to inheriting. Daily budget renders WHOLE dollars (CLAUDE.md
// daily-budget carve-out), so the input is an integer USD.
export function CampaignBudgetControl({
  campaignId,
  campaign,
  brandDailyBudgetCents,
}: {
  campaignId: string;
  campaign: Campaign | null;
  /** Brand daily budget (billing) — the value inherited when the campaign has none. */
  brandDailyBudgetCents: number | null;
}) {
  const queryClient = useQueryClient();
  const inherited = campaign?.maxBudgetDailyUsd == null;
  const campaignBudgetUsd = campaign?.maxBudgetDailyUsd != null ? Number(campaign.maxBudgetDailyUsd) : null;
  const brandBudgetUsd = brandDailyBudgetCents != null ? brandDailyBudgetCents / 100 : null;
  const effectiveUsd = campaignBudgetUsd ?? brandBudgetUsd;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>("");

  const { mutate, isPending: saving } = useMutation({
    mutationFn: (value: string | null) => updateCampaignDailyBudget(campaignId, value),
    onSuccess: (res) => {
      // Write the fresh campaign into the cache the overview reads (avoid an
      // invalidate-then-refetch flash), then reconcile the list.
      queryClient.setQueryData(["campaign", campaignId], { campaign: res.campaign });
      setEditing(false);
      return queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });

  const fmtWhole = (usd: number | null | undefined) =>
    usd == null ? "—" : `$${Math.round(usd).toLocaleString("en-US")}`;

  if (editing) {
    const save = () => {
      const trimmed = draft.trim();
      // Empty → clear to inherit; a number → set explicit campaign budget.
      mutate(trimmed === "" ? null : String(Math.max(0, Math.round(Number(trimmed)))));
    };
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">$</span>
        <input
          type="number"
          min={0}
          step={1}
          autoFocus
          value={draft}
          placeholder={brandBudgetUsd != null ? String(Math.round(brandBudgetUsd)) : "0"}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-sm focus:ring-2 focus:ring-brand-300 focus:border-brand-300 outline-none"
        />
        <span className="text-sm text-gray-500">/ day</span>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className={`rounded-lg bg-brand-600 px-3 py-1 text-sm font-medium text-white ${
            saving ? "cursor-wait" : "hover:bg-brand-700"
          }`}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Daily budget</span>
      <span className="text-sm font-semibold text-gray-900">{fmtWhole(effectiveUsd)} / day</span>
      {inherited && <span className="text-xs text-gray-400">(inherits brand)</span>}
      <button
        type="button"
        onClick={() => { setDraft(campaignBudgetUsd != null ? String(Math.round(campaignBudgetUsd)) : ""); setEditing(true); }}
        className="text-xs font-medium text-brand-600 hover:text-brand-700"
      >
        Edit
      </button>
      <MaturityBadge level="beta" />
    </div>
  );
}
