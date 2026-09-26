"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ApiError,
  getBrand,
  getBrandCampaignBudgets,
  getFeature,
  getOfferEconomics,
  getWorkflowProjectionLadder,
  listCampaignsByBrand,
  prefillFeatureInputs,
  prefillToStringMap,
  saveCampaignBudget,
  saveOfferLifetimeRevenue,
  setCampaignStatus,
  startCampaign,
} from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { invalidateCampaignMoney, invalidateConversionRates } from "@/lib/write-invalidation";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { channelLegs, legFor } from "@/lib/legs";
import { channelIsFundable } from "@/lib/channel-fundable";
import {
  buildControlRows,
  parseDailyBudgetUsd,
  type ControlRow,
  type OfferableChannel,
} from "@/lib/campaign-controls";
import { channelTotalCents, runningAfterBudget } from "@/lib/campaign-budget";
import { useChannelMinimums } from "@/lib/use-channel-minimums";
import {
  channelBudgetBelowMinimum,
  channelBudgetFloorMessage,
  channelBudgetHint,
  channelMinimumCents,
  projectedChannelTotalUsd,
} from "@/lib/channel-minimums";
import {
  CHANNEL_RUN_STATE_LABEL,
  ChannelStartRefusal,
  channelRunState,
  channelStartBlocker,
  channelWriteErrorMessage,
  startableWorkflowDynastySlug,
} from "@/lib/channel-start";
import { CampaignIdentity } from "@/components/campaigns/campaign-identity";
import { SettingsSaveRow } from "@/components/settings/settings-save-row";
import { Skeleton } from "@/components/skeleton";

/**
 * How an OFFER is sold: what a client won through it is worth, and the campaigns that
 * sell it — one per (leg x channel), each with its daily budget and its running state.
 *
 * A campaign is (offer x leg x channel). The rows are every leg a channel we can run
 * performs, so a customer sees what is running AND what could, and starts a campaign
 * from the row it lives on. Two writes per row and both are ONE Save: billing's
 * per-campaign ceiling, then campaign-service's status (a create when no campaign
 * exists yet — money starts nothing, so a funded row with no campaign runs nothing
 * until a person starts it).
 *
 * The conversion rates are the BRAND's (one per leg), edited on Brand Settings; this
 * card holds only what belongs to the offer.
 */
export function OfferCampaignsCard({ brandId, offerId }: { brandId: string; offerId: string }) {
  return (
    <div className="space-y-6">
      <OfferLifetimeRevenue brandId={brandId} offerId={offerId} />
      <OfferCampaignRows brandId={brandId} offerId={offerId} />
    </div>
  );
}

/** A refusal is OUR copy, keyed on the status; `err.message` is a downstream body. */
function lifetimeRevenueErrorMessage(err: unknown): string {
  const status = err instanceof ApiError ? err.status : null;
  if (status === 403) return "You do not have access to this offer.";
  if (status === 404) return "This offer no longer exists.";
  if (status === 400) return "A lifetime revenue is a whole number of dollars.";
  return "We could not save the lifetime revenue. Try again in a moment.";
}

function OfferLifetimeRevenue({ brandId, offerId }: { brandId: string; offerId: string }) {
  const queryClient = useQueryClient();
  const economicsQ = useAuthQuery(["offerEconomics", brandId, offerId], () =>
    getOfferEconomics(brandId, offerId),
  );

  // Seeded from the read and RE-SEEDED on a new payload, never a once-per-mount latch
  // (the disk snapshot paints first); a field the user touched outranks the server.
  const [value, setValue] = useState("");
  const [baseline, setBaseline] = useState("");
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState(false);
  const seededFrom = useRef<unknown>(null);
  useEffect(() => {
    const data = economicsQ.data;
    if (!data || seededFrom.current === data) return;
    seededFrom.current = data;
    const next = data.lifetimeRevenueUsd == null ? "" : String(data.lifetimeRevenueUsd);
    setBaseline(next);
    if (!touched) setValue(next);
  }, [economicsQ.data, touched]);

  const trimmed = value.replace(/,/g, "").trim();
  const parsed = trimmed === "" ? null : /^\d+$/.test(trimmed) ? Number(trimmed) : undefined;
  const dirty = value.trim() !== baseline.trim();

  const mutation = useMutation({
    mutationFn: () => saveOfferLifetimeRevenue(brandId, offerId, parsed ?? null),
    onSuccess: (data) => {
      queryClient.setQueryData(["offerEconomics", brandId, offerId], data);
      seededFrom.current = data;
      const next = data.lifetimeRevenueUsd == null ? "" : String(data.lifetimeRevenueUsd);
      setBaseline(next);
      setValue(next);
      setTouched(false);
      setSaved(true);
      // Every money figure divides by it, so the priced surfaces are re-read now.
      invalidateConversionRates(queryClient);
    },
    onError: (err) => console.error("[dashboard] saveOfferLifetimeRevenue failed", err),
  });

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5" data-offer-lifetime-revenue>
      <h2 className="text-sm font-semibold text-gray-800">Lifetime revenue</h2>
      <p className="mt-0.5 mb-3 text-xs text-gray-500">
        What a client won through this offer is worth to you over their lifetime. Every
        return we show is priced on it.
      </p>
      {economicsQ.isPending && !economicsQ.isError ? (
        <Skeleton className="h-9 w-40" />
      ) : economicsQ.isError ? (
        <p className="text-sm text-gray-500">We could not read this offer right now.</p>
      ) : (
        <label className="flex w-48 items-center gap-1 rounded-md border border-gray-200 px-2 py-1.5 text-sm focus-within:ring-2 focus-within:ring-brand-300">
          <span className="text-gray-400">$</span>
          <input
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(e) => {
              setTouched(true);
              setSaved(false);
              setValue(e.target.value);
            }}
            aria-label="Lifetime revenue in dollars"
            className="w-full text-right tabular-nums outline-none"
          />
        </label>
      )}
      {parsed === undefined && (
        <p className="mt-2 text-xs text-red-600">Enter a whole number of dollars, or leave it empty.</p>
      )}
      {mutation.isError && (
        <p className="mt-2 text-xs text-red-600">{lifetimeRevenueErrorMessage(mutation.error)}</p>
      )}
      <SettingsSaveRow
        dirty={dirty}
        saving={mutation.isPending}
        saved={saved}
        disabled={parsed === undefined}
        onSave={() => mutation.mutate()}
      />
    </section>
  );
}

function OfferCampaignRows({ brandId, offerId }: { brandId: string; offerId: string }) {
  const campaignsQ = useAuthQuery(["campaigns", brandId], () => listCampaignsByBrand(brandId));
  const budgetsQ = useAuthQuery(["brandCampaignBudgets", brandId], () =>
    getBrandCampaignBudgets(brandId),
  );
  const channels = useAcquisitionChannels();
  const catalogue = useLegCatalogue();

  // Every (leg, channel) a customer may start for this offer: the legs each FUNDABLE
  // channel OF OURS performs, read off the published catalogue. A channel
  // campaign-service cannot run would take a ceiling and produce nothing, and a leg a
  // person works by hand is not something we run, so neither is offered (#4410). A
  // campaign that already exists on either still gets its row, from the campaigns read.
  const offerable = useMemo<OfferableChannel[]>(() => {
    const out: OfferableChannel[] = [];
    for (const channel of channels) {
      if (channel.operatedBy === "customer" || !channelIsFundable(channel)) continue;
      for (const leg of channelLegs(catalogue, channel.featureSlug)) {
        out.push({
          legKey: leg.legKey,
          featureSlug: channel.featureSlug,
          channelName: channel.name,
          offerId,
        });
      }
    }
    return out;
  }, [channels, catalogue, offerId]);

  // A campaign that names no leg has no ceiling to edit and nothing to start; a stopped
  // one is history, so it is not listed. A RUNNING one still is, so nothing live hides.
  const rows = useMemo(
    () =>
      buildControlRows(
        campaignsQ.data?.campaigns ?? [],
        budgetsQ.data,
        channels,
        { offerId },
        offerable,
      ).filter((row) => row.scope !== null || row.running),
    [campaignsQ.data, budgetsQ.data, channels, offerId, offerable],
  );

  const settled =
    (campaignsQ.data !== undefined || campaignsQ.isError) &&
    (budgetsQ.data !== undefined || budgetsQ.isError);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5" data-offer-campaigns>
      <h2 className="text-sm font-semibold text-gray-800">Campaigns</h2>
      <p className="mt-0.5 mb-3 text-xs text-gray-500">
        One per outcome and channel. Give a campaign a daily budget and start it; pausing
        keeps its budget.
      </p>
      {!settled ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-4 text-sm text-gray-500">No channel can run a campaign for this offer yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map((row) => (
            <OfferCampaignRow
              key={row.rowId}
              row={row}
              brandId={brandId}
              offerId={offerId}
              savedChannelCents={channelTotalCents(row.scope?.featureSlug ?? "", budgetsQ.data)}
              legLabel={legFor(catalogue, row.legKey)?.label ?? null}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function OfferCampaignRow({
  row,
  brandId,
  offerId,
  savedChannelCents,
  legLabel,
}: {
  row: ControlRow;
  brandId: string;
  offerId: string;
  savedChannelCents: number;
  legLabel: string | null;
}) {
  const queryClient = useQueryClient();
  const minimums = useChannelMinimums();
  const brandQ = useAuthQuery(["brand", brandId], () => getBrand(brandId));

  const savedBudget = row.savedCents > 0 ? String(Math.round(row.savedCents / 100)) : "";
  const [budget, setBudget] = useState(savedBudget);
  const [running, setRunning] = useState(row.running);
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed from the served row whenever it changes, unless the user is mid-edit.
  useEffect(() => {
    if (touched) return;
    setBudget(savedBudget);
    setRunning(row.running);
  }, [savedBudget, row.running, touched]);

  const typed = parseDailyBudgetUsd(budget);
  const typedCents = typed === null ? null : typed * 100;
  const effectiveRunning = runningAfterBudget({
    running,
    nextCents: typedCents,
    savedCents: row.savedCents,
  });
  const state = channelRunState({ settled: true, campaignId: row.campaignId, running: row.running });
  const startBlocker =
    running && !row.running ? channelStartBlocker({ state, typedCents: typedCents ?? 0 }) : null;

  const featureSlug = row.scope?.featureSlug ?? null;
  const minimumCents = channelMinimumCents(minimums, featureSlug);
  const belowFloor =
    typed !== null &&
    channelBudgetBelowMinimum(
      minimumCents,
      projectedChannelTotalUsd(savedChannelCents, row.savedCents, typed),
      savedChannelCents,
    );

  const budgetChanged = typedCents !== null && typedCents !== row.savedCents;
  const statusChanged = effectiveRunning !== row.running;
  const dirty = touched && (budgetChanged || statusChanged);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!row.scope || typedCents === null) return;
      if (budgetChanged) {
        await saveCampaignBudget(
          brandId,
          { offerId, legKey: row.scope.legKey, featureSlug: row.scope.featureSlug },
          typedCents,
        );
      }
      if (!statusChanged) return;
      if (row.campaignId) {
        if (effectiveRunning) {
          await setCampaignStatus(row.campaignId, "activate", {
            brandId,
            featureSlug: row.scope.featureSlug,
          });
        } else {
          for (const id of row.runningCampaignIds) {
            await setCampaignStatus(id, "stop", { brandId, featureSlug: row.scope.featureSlug });
          }
        }
        return;
      }
      // No campaign yet: turning it ON creates one. The workflow is the producer's own
      // pick for THIS leg — never one of ours.
      const ladder = await getWorkflowProjectionLadder({
        featureSlug: row.scope.featureSlug,
        brandId,
        leg: row.scope.legKey,
      });
      const workflowDynastySlug = startableWorkflowDynastySlug(
        ladder.recommendedWorkflowDynastySlug,
      );
      if (!workflowDynastySlug) {
        throw new ChannelStartRefusal(
          `${row.scope.channelName} has no workflow ready for this outcome yet, so there is nothing to start.`,
        );
      }
      const [{ feature }, prefill] = await Promise.all([
        getFeature(row.scope.featureSlug),
        prefillFeatureInputs(row.scope.featureSlug, [brandId], offerId),
      ]);
      const prefilled = prefillToStringMap(prefill.prefilled);
      const featureInputs: Record<string, string> = {};
      for (const input of feature.inputs ?? []) {
        const value = prefilled[input.key]?.trim();
        if (value) featureInputs[input.key] = value;
      }
      const brandName = brandQ.data?.brand?.name ?? brandQ.data?.brand?.domain ?? "Brand";
      await startCampaign({
        // The leg AND the channel are in the name: campaign-service refuses a name the org
        // already holds, and an offer is sold through several (leg, channel) pairs.
        name: `${brandName} — ${legLabel ?? row.scope.legKey} (${row.scope.channelName})`,
        brandId,
        featureSlug: row.scope.featureSlug,
        featureInputs,
        workflowDynastySlug,
        offerId,
        legKey: row.scope.legKey,
      });
    },
    onSuccess: () => {
      invalidateCampaignMoney(queryClient);
      setTouched(false);
      setSaved(true);
      setError(null);
    },
    onError: (err) => {
      console.error("[dashboard] offer campaign write failed", err);
      setError(channelWriteErrorMessage(err, effectiveRunning ? "start" : "pause"));
    },
  });

  return (
    <li className="py-3" data-offer-campaign-row={row.rowId}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-sm text-gray-800">
          <CampaignIdentity featureSlug={featureSlug} legKey={row.legKey} />
          <p className="mt-0.5 text-xs text-gray-500">{CHANNEL_RUN_STATE_LABEL[state]}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={effectiveRunning}
            aria-label={effectiveRunning ? "Pause this campaign" : "Start this campaign"}
            disabled={!row.scope}
            onClick={() => {
              setTouched(true);
              setSaved(false);
              setRunning(!running);
            }}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${
              effectiveRunning ? "bg-green-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                effectiveRunning ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <span className="text-gray-400">$</span>
            <input
              type="text"
              inputMode="numeric"
              value={budget}
              disabled={!row.scope}
              onChange={(e) => {
                setTouched(true);
                setSaved(false);
                setBudget(e.target.value);
              }}
              aria-label="Daily budget in dollars"
              className="w-20 rounded-md border border-gray-200 px-2 py-1 text-right tabular-nums focus:ring-2 focus:ring-brand-300 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
            />
            <span className="text-xs text-gray-400">/ day</span>
          </div>
        </div>
      </div>
      {running && !effectiveRunning && (
        <p className="mt-1.5 text-xs text-gray-500">
          A daily budget of $0 pauses this campaign. Give it an amount to run it.
        </p>
      )}
      {minimumCents !== null && !belowFloor && (
        <p className="mt-1.5 text-xs text-gray-400">
          {channelBudgetHint(minimumCents, savedChannelCents)}
        </p>
      )}
      {typed === null && (
        <p className="mt-1.5 text-xs text-red-600">
          Enter a whole number of dollars, or leave it empty to stop funding it.
        </p>
      )}
      {belowFloor && minimumCents !== null && row.scope && (
        <p className="mt-1.5 text-xs text-red-600">
          {channelBudgetFloorMessage(row.scope.channelName, minimumCents, savedChannelCents)}
        </p>
      )}
      {startBlocker && <p className="mt-1.5 text-xs text-red-600">{startBlocker}</p>}
      {statusChanged && effectiveRunning && (
        <p className="mt-1.5 text-xs text-gray-500">
          Starting sends right away, not at the next daily tick.
        </p>
      )}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      <SettingsSaveRow
        dirty={dirty}
        saving={mutation.isPending}
        saved={saved}
        disabled={typed === null || belowFloor || startBlocker !== null}
        onSave={() => mutation.mutate()}
      />
    </li>
  );
}
