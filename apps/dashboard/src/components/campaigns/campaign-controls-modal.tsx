"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  getBrandFunnelBudgets,
  listCampaignsByBrand,
  saveBrandFunnelBudget,
  setCampaignStatus,
  type BrandFunnelBudgets,
} from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import {
  ROLLUP_LABEL,
  buildControlRows,
  controlWriteErrorMessage,
  controlsDiff,
  diffSummary,
  hasChanges,
  projectedFunnelTotalsUsd,
  rollupStatus,
  type ControlDraft,
  type ControlRow,
} from "@/lib/campaign-controls";
import { funnelBudgetBelowMinimum, funnelBudgetTip } from "@/lib/sales-funnels";
import { CampaignIdentity } from "@/components/campaigns/campaign-identity";
import { Skeleton } from "@/components/skeleton";

/**
 * Is this running, and how hard — for a brand, an offer, or one campaign.
 *
 * ONE modal, three entry points. The rows are always CAMPAIGNS whatever the
 * grain, because a campaign is the only thing either write can address: the
 * brand and the offer are scopes, not things billing or campaign-service fund.
 * A grain that edited an aggregate would have to split it back across the
 * campaigns, and no split the customer did not state is honest.
 *
 * Each row carries the two answers a campaign has, and they stay INDEPENDENT:
 *
 *   - a toggle, which flips campaign-service's own status. It costs nothing to
 *     reverse and leaves the ceiling untouched, so the amount survives a pause.
 *   - a daily budget, billing's (offer x funnel x channel) row.
 *
 * Collapsing the two into one field (pause = set it to zero) is what this
 * replaces: zero throws the amount away, and billing's per-funnel floor only
 * lets a funnel funded under its minimum be KEPT or RAISED — so a campaign
 * grandfathered under the floor, stopped that way, could never be restarted at
 * the figure it was running.
 *
 * ⚠️ Restarting FIRES THE WORKFLOW IMMEDIATELY rather than at the next tick, so
 * the summary above Confirm says so.
 *
 * The writes are a FAN-OUT (there is no bulk endpoint), so a failure is reported
 * per row and the modal stays open. It never claims a success it does not have.
 */
export function CampaignControlsModal({
  brandId,
  offerId,
  campaignId,
  onClose,
}: {
  brandId: string;
  /** Scope to one offer's campaigns. Omitted at brand grain. */
  offerId?: string;
  /** Scope to exactly one campaign. Omitted at brand and offer grain. */
  campaignId?: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  // Both keys are byte-equal to the ones the Campaigns table, Offer Settings and
  // Campaign Settings already read, so opening this costs no new request.
  const campaignsQ = useAuthQuery(["campaigns", brandId], () => listCampaignsByBrand(brandId));
  const budgetsQ = useAuthQuery(["brandFunnelBudgets", brandId], () =>
    getBrandFunnelBudgets(brandId),
  );

  const rows = useMemo(
    () =>
      buildControlRows(campaignsQ.data?.campaigns ?? [], budgetsQ.data, { offerId, campaignId }),
    [campaignsQ.data, budgetsQ.data, offerId, campaignId],
  );

  // SEEDED from the queries and RE-SEEDED whenever either payload is a different
  // object than the one the drafts were built from — never a once-per-mount
  // latch, which would pin the form to the on-disk snapshot the local-first cache
  // paints first and ignore the fresher answer that lands a moment later. A row
  // the user has TOUCHED outranks the server, or the form would rewrite itself
  // mid-edit.
  const [drafts, setDrafts] = useState<Record<string, ControlDraft>>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const seededFrom = useRef<unknown>(null);

  useEffect(() => {
    const payload = campaignsQ.data && budgetsQ.data ? [campaignsQ.data, budgetsQ.data] : null;
    if (!payload) return;
    if (
      Array.isArray(seededFrom.current) &&
      seededFrom.current[0] === payload[0] &&
      seededFrom.current[1] === payload[1]
    ) {
      return;
    }
    seededFrom.current = payload;
    setDrafts((prev) => {
      const next: Record<string, ControlDraft> = {};
      for (const row of rows) {
        next[row.campaignId] = touched.has(row.campaignId)
          ? (prev[row.campaignId] ?? draftFor(row))
          : draftFor(row);
      }
      return next;
    });
  }, [campaignsQ.data, budgetsQ.data, rows, touched]);

  const [failures, setFailures] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const savedFunnelCents = useMemo(() => {
    const out: Record<string, number> = {};
    for (const f of budgetsQ.data?.funnels ?? []) out[f.funnelKey] = f.dailyBudgetCents;
    return out;
  }, [budgetsQ.data]);

  const projected = useMemo(
    () => projectedFunnelTotalsUsd(rows, drafts, savedFunnelCents),
    [rows, drafts, savedFunnelCents],
  );

  const diff = useMemo(() => controlsDiff(rows, drafts), [rows, drafts]);
  const summary = diffSummary(rows, diff);
  const restarting = diff.statusWrites.some((w) => w.activate);

  // A row whose funnel would land under its floor blocks Confirm. billing holds
  // the same rule and its 400 is what decides; this is here to make typing
  // pleasant, not to be the source of truth.
  const belowFloor = useMemo(
    () =>
      rows
        .filter((row) => {
          if (!row.scope) return false;
          const key = row.scope.def.key;
          return funnelBudgetBelowMinimum(key, projected[key] ?? 0, savedFunnelCents[key] ?? 0);
        })
        .map((r) => r.campaignId),
    [rows, projected, savedFunnelCents],
  );

  const blocked = diff.invalidRows.length > 0 || belowFloor.length > 0;
  const settled =
    (campaignsQ.data !== undefined || campaignsQ.isError) &&
    (budgetsQ.data !== undefined || budgetsQ.isError);

  function edit(campaignId: string, patch: Partial<ControlDraft>) {
    setTouched((prev) => new Set(prev).add(campaignId));
    setDrafts((prev) => ({
      ...prev,
      [campaignId]: { ...(prev[campaignId] ?? { running: false, budget: "" }), ...patch },
    }));
  }

  /** The bulk row: one decision for every campaign on screen. */
  function setAllRunning(running: boolean) {
    setTouched(new Set(rows.map((r) => r.campaignId)));
    setDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        next[row.campaignId] = { ...(next[row.campaignId] ?? draftFor(row)), running };
      }
      return next;
    });
  }

  async function confirm() {
    setSaving(true);
    setFailures({});
    const nextFailures: Record<string, string> = {};
    let latestBudgets: BrandFunnelBudgets | null = null;

    // Sequential rather than parallel: the budget writes all address the same
    // brand row set and billing answers with the WHOLE set each time, so racing
    // them would leave whichever landed last in the cache regardless of order.
    for (const write of diff.statusWrites) {
      const row = rows.find((r) => r.campaignId === write.campaignId);
      const featureSlug = row?.scope?.featureSlug;
      if (!featureSlug) {
        // campaign-service validates the workflow's tracking headers before it
        // flips the row, so an activate with no channel to name would 400. Say so
        // rather than sending a request we know is refused.
        nextFailures[write.campaignId] = controlWriteErrorMessage(400, "status");
        continue;
      }
      try {
        await setCampaignStatus(write.campaignId, write.activate ? "activate" : "stop", {
          brandId,
          featureSlug,
        });
      } catch (err) {
        console.error("[dashboard] setCampaignStatus failed", err);
        nextFailures[write.campaignId] = controlWriteErrorMessage(
          err instanceof ApiError ? err.status : null,
          "status",
        );
      }
    }

    for (const write of diff.budgetWrites) {
      try {
        latestBudgets = await saveBrandFunnelBudget(
          brandId,
          write.funnelKey,
          write.cents,
          write.featureSlug,
          write.offerId ?? undefined,
        );
      } catch (err) {
        console.error("[dashboard] saveBrandFunnelBudget failed", err);
        nextFailures[write.campaignId] = controlWriteErrorMessage(
          err instanceof ApiError ? err.status : null,
          "budget",
        );
      }
    }

    // Write what billing answered into the cache the page reads, THEN invalidate
    // the lists — a bare invalidate would leave a failed refetch showing the
    // pre-save figures.
    if (latestBudgets) {
      queryClient.setQueryData(["brandFunnelBudgets", brandId], latestBudgets);
    }
    await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    await queryClient.invalidateQueries({ queryKey: ["brandDailyBudget", brandId] });

    setSaving(false);
    setTouched(new Set());
    seededFrom.current = null;

    if (Object.keys(nextFailures).length > 0) {
      // Something did not land, so the modal stays open saying which row.
      setFailures(nextFailures);
      return;
    }
    onClose();
  }

  const rollup = rollupStatus(rows);
  const scopeWord = campaignId ? "campaign" : offerId ? "offer" : "brand";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="campaign-controls-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-xl border border-gray-200 bg-white shadow-xl sm:max-w-2xl sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 id="campaign-controls-title" className="text-sm font-semibold text-gray-800">
            {campaignId ? "Campaign" : `Campaigns of this ${scopeWord}`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {!settled ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">
              No campaign to control here yet.
            </p>
          ) : (
            <>
              {rows.length > 1 && (
                <div className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    {ROLLUP_LABEL[rollup]}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAllRunning(true)}
                      className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Restart all
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllRunning(false)}
                      className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Pause all
                    </button>
                  </div>
                </div>
              )}

              <ul className="divide-y divide-gray-100">
                {rows.map((row) => {
                  const draft = drafts[row.campaignId] ?? draftFor(row);
                  const key = row.scope?.def.key;
                  const floorHit = belowFloor.includes(row.campaignId);
                  const invalid = diff.invalidRows.includes(row.campaignId);
                  return (
                    <li key={row.campaignId} className="py-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        {/* The SAME identity the Campaigns table's first column
                            states, from the same component: this modal changes
                            a campaign's money, so it must name the campaign the
                            way the row you clicked to get here named it. */}
                        <div className="min-w-0 text-sm text-gray-800">
                          <CampaignIdentity
                            funnel={row.scope?.def ?? null}
                            featureSlug={row.scope?.featureSlug ?? null}
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={draft.running}
                            aria-label={draft.running ? "Pause this campaign" : "Restart this campaign"}
                            onClick={() => edit(row.campaignId, { running: !draft.running })}
                            className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                              draft.running ? "bg-green-500" : "bg-gray-300"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                                draft.running ? "left-[22px]" : "left-0.5"
                              }`}
                            />
                          </button>
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <span className="text-gray-400">$</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={draft.budget}
                              disabled={!row.scope}
                              onChange={(e) => edit(row.campaignId, { budget: e.target.value })}
                              aria-label="Daily budget in dollars"
                              className="w-20 rounded-md border border-gray-200 px-2 py-1 text-right tabular-nums focus:ring-2 focus:ring-brand-300 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                            />
                            <span className="text-xs text-gray-400">/ day</span>
                          </div>
                        </div>
                      </div>
                      {!row.scope && (
                        <p className="mt-1.5 text-xs text-gray-500">
                          This campaign predates the sales funnels, so it has no budget of its own.
                          It can still be paused and restarted.
                        </p>
                      )}
                      {invalid && (
                        <p className="mt-1.5 text-xs text-red-600">
                          Enter a whole number of dollars, or leave it empty to stop funding it.
                        </p>
                      )}
                      {floorHit && key && (
                        <p className="mt-1.5 text-xs text-red-600">
                          {funnelBudgetTip(key, savedFunnelCents[key] ?? 0)}
                        </p>
                      )}
                      {failures[row.campaignId] && (
                        <p className="mt-1.5 text-xs text-red-600">{failures[row.campaignId]}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        <div className="border-t border-gray-200 px-5 py-3">
          {summary && (
            <p className="mb-2 text-xs text-gray-600">
              {summary}
              {restarting && " Restarting sends right away, not at the next daily tick."}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={saving || blocked || !hasChanges(diff)}
              className={`rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white ${
                saving
                  ? "cursor-wait"
                  : "disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-700"
              }`}
            >
              {saving ? "Saving..." : "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** What a row looks like before anyone has touched it: exactly what is stored. */
function draftFor(row: ControlRow): ControlDraft {
  return {
    running: row.running,
    // Whole dollars, always — a ceiling is a configured whole-dollar value, and
    // cents read wrong on one. Zero renders empty, which is the same thing the
    // parser reads back as zero.
    budget: row.savedCents > 0 ? String(Math.round(row.savedCents / 100)) : "",
  };
}
