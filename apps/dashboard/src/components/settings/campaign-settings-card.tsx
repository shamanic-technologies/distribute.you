"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ApiError,
  getBrandFunnelBudgets,
  getCampaign,
  saveBrandFunnelBudget,
  setCampaignStatus,
  type BrandFunnelBudgets,
} from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { invalidateCampaignMoney } from "@/lib/write-invalidation";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import {
  campaignBudgetScope,
  campaignSavedCents,
  minimumCampaignBudgetUsd,
  projectedFunnelTotalUsd,
} from "@/lib/campaign-budget";
import { controlWriteErrorMessage, isRunningStatus } from "@/lib/campaign-controls";
import { FUNNEL_MIN_DAILY_BUDGET_USD, funnelBudgetBelowMinimum } from "@/lib/sales-funnels";
import { SettingsSaveRow } from "@/components/settings/settings-save-row";
import { Skeleton } from "@/components/skeleton";

/**
 * Campaign Settings — is this campaign running, and what may it spend in a day.
 *
 * A campaign IS (offer x sales funnel x acquisition channel), and it carries TWO
 * independent answers to that question:
 *
 *   - a STATUS, which campaign-service stores on the campaign row;
 *   - a daily CEILING, which billing keys on exactly that triple.
 *
 * They are deliberately NOT one field, and this page is where a customer states
 * both. Pausing keeps the ceiling untouched, so restarting is one click and the
 * amount is still there; zeroing the ceiling throws the amount away, and
 * billing's per-funnel floor only lets a funnel funded under its minimum be KEPT
 * or RAISED — so a campaign grandfathered under the floor, stopped that way,
 * could never be restarted at the figure it was running. Pause is therefore what
 * the copy offers, and zero survives as the way to genuinely defund.
 *
 * Both are committed by ONE Save, so a toggle that writes instantly does not sit
 * beside a field that does not. What it is about to do is stated above the
 * button rather than reported after: money and a campaign's life are what this
 * screen changes.
 *
 * The narrowing that turns billing's per-pair figure into THIS campaign's money
 * lives in `lib/campaign-budget.ts`, because the Campaigns table and the campaign
 * Overview state the very same figure read-only, and the controls modal edits it
 * at three grains. Several windows onto one number are fine; a second narrowing
 * is how they would come to disagree.
 *
 * DELIBERATELY NOT ON THIS PAGE:
 *   - the campaign's NAME, its audiences and its click destination. Those are
 *     statements about the OFFER, which has its own Settings page.
 *   - the offer, the funnel, the channel, the feature. Those are what the
 *     campaign IS: changing one does not configure this campaign, it makes it
 *     another one.
 */

/** A budget field holds whole dollars, or nothing. Blank is zero — the defund. */
export function parseDailyBudgetUsd(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return 0;
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

/**
 * What a clamp says, once a typed figure has been put back to the smallest one
 * the funnel allows.
 *
 * It names both numbers and then offers pause, because the customer who typed a
 * figure under the floor was trying to spend less — and the honest answer to
 * that is not a floor they cannot reach, it is the control that stops the
 * campaign without losing anything.
 */
export function budgetClampMessage(fromUsd: number, toUsd: number): string {
  return `$${fromUsd} is under what this funnel may be funded at, so we put it back to $${toUsd} a day. Pause the campaign instead if you want it to stop for now — its budget is kept and restarting is one click.`;
}

/**
 * A refusal is rendered as OUR copy, branched on the status. `apiCall` puts the
 * whole downstream response body verbatim into `ApiError.message`, so printing
 * the message would put a JSON blob in front of a customer.
 */
export function campaignBudgetErrorMessage(err: unknown): string {
  return controlWriteErrorMessage(err instanceof ApiError ? err.status : null, "budget");
}

export function CampaignSettingsCard({
  brandId,
  offerId,
  campaignId,
}: {
  brandId: string;
  offerId: string;
  campaignId: string;
}) {
  const queryClient = useQueryClient();

  // The same key the campaign Overview and the top-bar campaign name already
  // poll, so all three share one request.
  const { data: campaignData, isPending, isError } = useAuthQuery(
    ["campaign", campaignId],
    () => getCampaign(campaignId),
  );
  const campaign = campaignData?.campaign ?? null;

  // billing's ceilings, on the brand-scoped key the funnels card already reads.
  const {
    data: budgetData,
    isPending: budgetPending,
    isError: budgetError,
  } = useAuthQuery(["brandFunnelBudgets", brandId], () => getBrandFunnelBudgets(brandId));

  const channels = useAcquisitionChannels();
  const scope = campaign ? campaignBudgetScope(campaign, channels) : null;
  const savedCents = scope ? campaignSavedCents(scope, offerId, budgetData) : 0;
  const savedFunnelCents = scope
    ? (budgetData?.funnels.find((f) => f.funnelKey === scope.def.key)?.dailyBudgetCents ?? 0)
    : 0;
  // campaign-service's own word, read through the SAME set the Campaigns table's
  // pill and the controls modal read. A second list of running-words is how two
  // surfaces come to disagree about whether one campaign is live.
  const savedRunning = campaign ? isRunningStatus(campaign.status) : false;

  // SEEDED from the queries and RE-SEEDED whenever the payload is a different
  // object than the one they were built from — never a once-per-mount latch,
  // which would pin the form to the on-disk snapshot the local-first cache paints
  // first and ignore the fresher answer that lands a moment later. A field the
  // user has touched outranks the server, or it would rewrite itself mid-edit.
  const [value, setValue] = useState("");
  const [baseline, setBaseline] = useState("");
  const [touched, setTouched] = useState(false);
  const seededFrom = useRef<BrandFunnelBudgets | null>(null);

  useEffect(() => {
    if (!budgetData || !scope || seededFrom.current === budgetData) return;
    seededFrom.current = budgetData;
    // Whole dollars, always — a daily budget is a configured ceiling, and cents
    // read wrong on one.
    const next = savedCents > 0 ? String(Math.round(savedCents / 100)) : "";
    setBaseline(next);
    if (!touched) setValue(next);
  }, [budgetData, scope, savedCents, touched]);

  const [running, setRunning] = useState(false);
  const [statusTouched, setStatusTouched] = useState(false);
  const seededStatusFrom = useRef<unknown>(null);

  useEffect(() => {
    if (!campaignData || seededStatusFrom.current === campaignData) return;
    seededStatusFrom.current = campaignData;
    if (!statusTouched) setRunning(savedRunning);
  }, [campaignData, savedRunning, statusTouched]);

  const [clamped, setClamped] = useState<{ from: number; to: number } | null>(null);
  const [saved, setSaved] = useState(false);

  const funnelKey = scope?.def.key ?? null;

  /**
   * Put a figure the funnel may not be funded at back to the smallest one it
   * may, on BLUR rather than on every keystroke: typing `1` on the way to `10`
   * must not jump to the floor under the cursor.
   *
   * ZERO is left alone. Defunding is an ordinary state, and the floor governs
   * what may be NEWLY stated rather than whether a customer may stop.
   */
  function clampToMinimum(): number | null {
    const typed = parseDailyBudgetUsd(value);
    if (!funnelKey || typed === null || typed <= 0) return typed;
    const projected = projectedFunnelTotalUsd(savedFunnelCents, savedCents, typed);
    if (!funnelBudgetBelowMinimum(funnelKey, projected, savedFunnelCents)) {
      setClamped(null);
      return typed;
    }
    const min = minimumCampaignBudgetUsd(funnelKey, savedFunnelCents, savedCents);
    setValue(String(min));
    setClamped({ from: typed, to: min });
    // RETURNED as well as set: `setValue` does not land before this tick ends,
    // so a Save that read `value` back would write the figure we just refused.
    return min;
  }

  const { mutate, isPending: saving, error } = useMutation({
    mutationFn: async ({ cents, nextRunning }: { cents: number | null; nextRunning: boolean | null }) => {
      // Status first, then money, the same order the controls modal commits in.
      // campaign-service validates the workflow's tracking headers before it
      // flips the row, so a campaign naming no channel cannot be restarted — the
      // toggle is disabled for one rather than sending a request we know is
      // refused.
      if (nextRunning !== null && campaign?.featureSlug) {
        await setCampaignStatus(campaignId, nextRunning ? "activate" : "stop", {
          brandId,
          featureSlug: campaign.featureSlug,
        });
      }
      if (cents !== null && scope) {
        return await saveBrandFunnelBudget(brandId, scope.def.key, cents, scope.featureSlug, offerId);
      }
      return null;
    },
    onSuccess: (set) => {
      // Write what billing answered into the cache the page reads, THEN
      // invalidate the lists — a bare invalidate would leave a failed refetch
      // showing the pre-save figure.
      if (set) {
        queryClient.setQueryData(["brandFunnelBudgets", brandId], set);
        seededFrom.current = set;
        // Show exactly what persisted, so the field can never claim a ceiling
        // billing normalized differently.
        const persisted = scope ? campaignSavedCents(scope, offerId, set) : 0;
        const next = persisted > 0 ? String(Math.round(persisted / 100)) : "";
        setBaseline(next);
        setValue(next);
      }
      // Every figure that states what this campaign may spend, or whether it runs —
      // including `brandSpendableBudget`, the running total the header reads.
      invalidateCampaignMoney(queryClient);
      seededStatusFrom.current = null;
      setTouched(false);
      setStatusTouched(false);
      setClamped(null);
      setSaved(true);
    },
    onError: (err) => {
      // Loud in the console (status + body), our own copy on screen.
      console.error("[dashboard] campaign settings save failed", err);
    },
  });

  if ((isPending || budgetPending) && !campaign) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-9 w-full max-w-xs" />
      </div>
    );
  }

  if (isError || budgetError || !campaign) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
        We could not load this campaign&apos;s settings. Try again in a moment.
      </div>
    );
  }

  // LIVE compare against the last-saved figures, never a sticky edited flag —
  // typing a value and undoing it, or flipping a toggle back, has to disarm the
  // button.
  const budgetDirty = scope !== null && value.trim() !== baseline;
  const statusDirty = running !== savedRunning;
  const dirty = budgetDirty || statusDirty;

  const typed = parseDailyBudgetUsd(value);
  const blocker =
    scope === null
      ? null
      : typed === null
        ? "Enter a whole number of dollars, or leave it empty to stop funding this campaign."
        : null;

  // What Save is about to do, said before it does it. Restarting FIRES THE
  // WORKFLOW IMMEDIATELY rather than at the next daily tick, so it says so.
  const summary = !dirty
    ? null
    : [
        statusDirty
          ? running
            ? "Restarting this campaign now — it starts sending immediately, not at the next daily tick."
            : "Pausing this campaign. Its daily budget is kept, so restarting it is one click."
          : null,
        budgetDirty && typed !== null
          ? typed > 0
            ? `Setting its daily budget to $${typed}.`
            : "Defunding it, which is not the same as pausing: the amount is not kept."
          : null,
      ]
        .filter(Boolean)
        .join(" ");

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="mb-1 text-sm font-semibold text-gray-900">
              {running ? "Running" : "Paused"}
            </h3>
            <p className="text-sm text-gray-500">
              {campaign.featureSlug
                ? running
                  ? "This campaign is reaching people. Pause it to stop, and its daily budget is kept for when you restart it."
                  : "This campaign is not reaching anyone. Restarting it starts sending immediately, not at the next daily tick."
                : "This campaign names no acquisition channel, so it cannot be restarted from here."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={running}
            aria-label={running ? "Pause this campaign" : "Restart this campaign"}
            disabled={!campaign.featureSlug}
            onClick={() => {
              setStatusTouched(true);
              setSaved(false);
              setRunning((prev) => !prev);
            }}
            className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40 ${
              running ? "bg-green-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                running ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </section>

      {scope === null ? (
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-1 text-sm font-semibold text-gray-900">Daily budget</h3>
          <p className="text-sm text-gray-500">
            This campaign predates the sales funnels, so it has no budget of its own yet. Fund it on
            Offer Settings, where each funnel states what it may spend in a day.
          </p>
        </section>
      ) : (
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-1 text-sm font-semibold text-gray-900">Daily budget</h3>
          <p className="mb-3 text-sm text-gray-500">
            The most this campaign may spend in a day, selling {scope.def.name} through{" "}
            {scope.channelName}. From ${FUNNEL_MIN_DAILY_BUDGET_USD[scope.def.key]} a day. To stop
            it for a while, pause it above rather than setting this to zero: pausing keeps the
            amount, and zero gives it up.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">$</span>
            <input
              type="text"
              inputMode="numeric"
              value={value}
              placeholder="0"
              onChange={(e) => {
                setTouched(true);
                setSaved(false);
                setClamped(null);
                setValue(e.target.value);
              }}
              onBlur={clampToMinimum}
              className="w-32 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
            <span className="text-sm text-gray-500">/ day</span>
          </div>
          {clamped && (
            <p className="mt-2 text-sm text-amber-700">
              {budgetClampMessage(clamped.from, clamped.to)}
            </p>
          )}
          {savedCents === 0 && !budgetDirty && (
            <p className="mt-2 text-xs text-gray-500">
              This campaign is not funded right now, so it is not sending whatever its status says.
            </p>
          )}
        </section>
      )}

      {blocker && <p className="text-sm text-red-600">{blocker}</p>}
      {error && <p className="text-sm text-red-600">{campaignBudgetErrorMessage(error)}</p>}
      {summary && <p className="text-sm text-gray-600">{summary}</p>}

      <SettingsSaveRow
        dirty={dirty}
        saving={saving}
        saved={saved}
        disabled={blocker !== null}
        onSave={() => {
          if (blocker !== null) return;
          // The blur clamp has already run for a mouse Save; running it again
          // covers the keyboard path and can only leave the field on a figure
          // billing accepts.
          const nextTyped = clampToMinimum();
          const cents = nextTyped === null ? null : nextTyped * 100;
          mutate({
            cents: scope !== null && cents !== null && cents !== savedCents ? cents : null,
            nextRunning: statusDirty ? running : null,
          });
        }}
      />
    </div>
  );
}
