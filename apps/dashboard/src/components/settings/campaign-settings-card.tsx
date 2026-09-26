"use client";

import {
  campaignStartRefusalMessage,
  isPaymentDeclinedStop,
  PAYMENT_DECLINED_LABEL,
} from "@/lib/payment-declined";
import { PaymentDeclinedNotice } from "@/components/billing/payment-declined-notice";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ApiError,
  getBrandCampaignBudgets,
  getCampaign,
  saveCampaignBudget,
  setCampaignStatus,
  type BrandCampaignBudgets,
} from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { invalidateCampaignMoney } from "@/lib/write-invalidation";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import {
  campaignBudgetScope,
  campaignSavedCents,
  channelTotalCents,
  runningAfterBudget,
} from "@/lib/campaign-budget";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { legFor } from "@/lib/legs";
import { useChannelMinimums } from "@/lib/use-channel-minimums";
import {
  channelBudgetBelowMinimum,
  channelMinimumCents,
  fmtDailyFloorUsd,
  minimumChannelBudgetUsd,
  projectedChannelTotalUsd,
} from "@/lib/channel-minimums";
import { controlWriteErrorMessage, isRunningStatus } from "@/lib/campaign-controls";
import { SettingsSaveRow } from "@/components/settings/settings-save-row";
import { Skeleton } from "@/components/skeleton";

/**
 * Campaign Settings — is this campaign running, and what may it spend in a day.
 *
 * A campaign IS (offer x leg x acquisition channel), and it carries TWO
 * independent answers to that question:
 *
 *   - a STATUS, which campaign-service stores on the campaign row;
 *   - a daily CEILING, which billing keys on exactly that address.
 *
 * They are deliberately NOT one field, and this page is where a customer states
 * both. Pausing keeps the ceiling untouched, so restarting is one click and the
 * amount is still there; zeroing the ceiling throws the amount away, and
 * billing's per-channel floor only lets a channel funded under its minimum be KEPT
 * or RAISED — so a campaign grandfathered under the floor, stopped that way,
 * could never be restarted at the figure it was running. Pause is therefore what
 * the copy offers, and zero survives as the way to genuinely defund.
 *
 * Both are committed by ONE Save, so a toggle that writes instantly does not sit
 * beside a field that does not. What it is about to do is stated above the
 * button rather than reported after: money and a campaign's life are what this
 * screen changes.
 *
 * The lookup that turns billing's answer into THIS campaign's money lives in
 * `lib/campaign-budget.ts`, because the Campaigns table and the campaign
 * Overview state the very same figure read-only, and the controls modal edits it
 * at three grains. Several windows onto one number are fine; a second lookup
 * is how they would come to disagree.
 *
 * DELIBERATELY NOT ON THIS PAGE:
 *   - the campaign's NAME, its audiences and its click destination. Those are
 *     statements about the OFFER, which has its own Settings page.
 *   - the offer, the leg, the channel. Those are what the
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
 * the channel allows.
 *
 * It names both numbers and then offers pause, because the customer who typed a
 * figure under the floor was trying to spend less — and the honest answer to
 * that is not a floor they cannot reach, it is the control that stops the
 * campaign without losing anything.
 */
export function budgetClampMessage(fromUsd: number, toUsd: number): string {
  return `$${fromUsd} is under what this channel may be funded at, so we put it back to $${toUsd} a day. Pause the campaign instead if you want it to stop for now — its budget is kept and restarting is one click.`;
}

/**
 * A refusal is rendered as OUR copy, branched on the status. `apiCall` puts the
 * whole downstream response body verbatim into `ApiError.message`, so printing
 * the message would put a JSON blob in front of a customer.
 */
export function campaignBudgetErrorMessage(err: unknown): string {
  // A refused RESTART carries campaign-service's own sentence (a declined payment,
  // or billing it could not read): rendered verbatim rather than as a budget error.
  const refusal =
    err instanceof ApiError ? campaignStartRefusalMessage(err.status, err.body) : null;
  return refusal ?? controlWriteErrorMessage(err instanceof ApiError ? err.status : null, "budget");
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

  // billing's ceilings, on the brand-scoped key Offer Settings already reads.
  const {
    data: budgetData,
    isPending: budgetPending,
    isError: budgetError,
  } = useAuthQuery(["brandCampaignBudgets", brandId], () => getBrandCampaignBudgets(brandId));
  const catalogue = useLegCatalogue();

  const channels = useAcquisitionChannels();
  const scope = campaign ? campaignBudgetScope(campaign, channels) : null;
  const savedCents = scope ? campaignSavedCents(scope, budgetData) : 0;
  // The CHANNEL's total across the brand — billing's own grain for the floor. This
  // campaign's own ceiling is one share of it, so a customer splitting a funded channel
  // in two is never refused for each half being under a bar the whole clears.
  const savedChannelCents = scope ? channelTotalCents(scope.featureSlug, budgetData) : 0;
  // The floor is the CHANNEL's own published daily operating cost. Null
  // while the catalogue is settling or for a channel it does not price, which
  // states no floor here and leaves billing's 400 to decide.
  const minimums = useChannelMinimums();
  const minimumCents = channelMinimumCents(minimums, scope?.featureSlug);
  // campaign-service's own word, read through the SAME set the Campaigns table's
  // pill and the controls modal read. A second list of running-words is how two
  // surfaces come to disagree about whether one campaign is live.
  const savedRunning = campaign ? isRunningStatus(campaign.status) : false;
  // Stopped by billing over a declined card rather than by a person: a restart is
  // refused until the payment is fixed, so the card says so up front.
  const declined = campaign ? isPaymentDeclinedStop(campaign) : false;

  // SEEDED from the queries and RE-SEEDED whenever the payload is a different
  // object than the one they were built from — never a once-per-mount latch,
  // which would pin the form to the on-disk snapshot the local-first cache paints
  // first and ignore the fresher answer that lands a moment later. A field the
  // user has touched outranks the server, or it would rewrite itself mid-edit.
  const [value, setValue] = useState("");
  const [baseline, setBaseline] = useState("");
  const [touched, setTouched] = useState(false);
  const seededFrom = useRef<BrandCampaignBudgets | null>(null);

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

  const legKey = scope?.legKey ?? null;

  /**
   * Put a figure the channel may not be funded at back to the smallest one it
   * may, on BLUR rather than on every keystroke: typing `1` on the way to `10`
   * must not jump to the floor under the cursor.
   *
   * ZERO is left alone. Defunding is an ordinary state, and the floor governs
   * what may be NEWLY stated rather than whether a customer may stop.
   */
  function clampToMinimum(): number | null {
    const typed = parseDailyBudgetUsd(value);
    if (!legKey || typed === null || typed <= 0) return typed;
    const projected = projectedChannelTotalUsd(savedChannelCents, savedCents, typed);
    if (!channelBudgetBelowMinimum(minimumCents, projected, savedChannelCents)) {
      setClamped(null);
      return typed;
    }
    const min = minimumChannelBudgetUsd(minimumCents, savedChannelCents, savedCents);
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
        return await saveCampaignBudget(
          brandId,
          { offerId, legKey: scope.legKey, featureSlug: scope.featureSlug },
          cents,
        );
      }
      return null;
    },
    onSuccess: (row) => {
      // Show exactly what persisted, so the field can never claim a ceiling billing
      // normalized differently. The brand-wide list is re-read by the invalidation below.
      if (row) {
        const persisted = row.dailyBudgetCents ?? 0;
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

  const typed = parseDailyBudgetUsd(value);
  // A campaign funded at NOTHING does not send — campaign-service holds it on the
  // funding gate every tick — so taking the budget to zero pauses it, and this one
  // Save writes both. The switch below reads the same expression, or the card would
  // show a campaign as running while the Save pauses it.
  const effectiveRunning = runningAfterBudget({
    running,
    nextCents: typed === null ? null : typed * 100,
    savedCents,
  });
  const zeroed = running && !effectiveRunning;
  const statusDirty = effectiveRunning !== savedRunning;
  const dirty = budgetDirty || statusDirty;

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
          ? effectiveRunning
            ? "Restarting this campaign now — it starts sending immediately, not at the next daily tick."
            : zeroed
              ? "Pausing this campaign, because a budget of $0 never sends."
              : "Pausing this campaign. Its daily budget is kept, so restarting it is one click."
          : null,
        budgetDirty && typed !== null
          ? typed > 0
            ? `Setting its daily budget to $${typed}.`
            : "Giving up its amount: unlike pausing, the figure is not kept."
          : null,
      ]
        .filter(Boolean)
        .join(" ");

  return (
    <div className="space-y-4">
      {declined && <PaymentDeclinedNotice />}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="mb-1 text-sm font-semibold text-gray-900">
              {effectiveRunning ? "Running" : declined ? PAYMENT_DECLINED_LABEL : "Paused"}
            </h3>
            <p className="text-sm text-gray-500">
              {zeroed
                ? "A daily budget of $0 never sends, so this campaign is paused. Give it an amount to run it again."
                : campaign.featureSlug
                  ? effectiveRunning
                    ? "This campaign is reaching people. Pause it to stop, and its daily budget is kept for when you restart it."
                    : "This campaign is not reaching anyone. Restarting it starts sending immediately, not at the next daily tick."
                  : "This campaign names no acquisition channel, so it cannot be restarted from here."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={effectiveRunning}
            aria-label={effectiveRunning ? "Pause this campaign" : "Restart this campaign"}
            disabled={!campaign.featureSlug || zeroed}
            onClick={() => {
              setStatusTouched(true);
              setSaved(false);
              setRunning((prev) => !prev);
            }}
            className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40 ${
              effectiveRunning ? "bg-green-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                effectiveRunning ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </section>

      {scope === null ? (
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-1 text-sm font-semibold text-gray-900">Daily budget</h3>
          <p className="text-sm text-gray-500">
            This campaign names no leg, so it has no budget of its own yet. Fund it on Offer
            Settings, where each campaign states what it may spend in a day.
          </p>
        </section>
      ) : (
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-1 text-sm font-semibold text-gray-900">Daily budget</h3>
          <p className="mb-3 text-sm text-gray-500">
            The most this campaign may spend in a day, reaching{" "}
            {legFor(catalogue, scope.legKey)?.label ?? "its step"} through {scope.channelName}.
            {/* The floor is the channel's own published operating cost. A channel
                whose terms we could not read states none rather than a figure
                nobody chose for it — billing still holds one either way. */}
            {minimumCents !== null && ` From ${fmtDailyFloorUsd(minimumCents)} a day.`} Setting it
            to zero pauses the campaign — but to stop it for a while, prefer the switch above:
            pausing keeps the amount, and zero gives it up.
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
            nextRunning: statusDirty ? effectiveRunning : null,
          });
        }}
      />
    </div>
  );
}
