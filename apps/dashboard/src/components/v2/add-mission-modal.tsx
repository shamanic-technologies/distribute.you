"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "@tanstack/react-query";
import {
  getBrand,
  getBrandCampaignBudgets,
  listBrandOffers,
  listCampaignsByBrand,
  saveCampaignBudget,
  setCampaignStatus,
} from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { acquisitionChannelForFeatureSlug } from "@/lib/acquisition-channels";
import { channelSlugLabel } from "@/lib/campaign-title";
import { buildControlRows, parseDailyBudgetUsd } from "@/lib/campaign-controls";
import { channelTotalCents } from "@/lib/campaign-budget";
import { useChannelMinimums } from "@/lib/use-channel-minimums";
import {
  channelBudgetBelowMinimum,
  channelBudgetFloorMessage,
  channelMinimumCents,
  projectedChannelTotalUsd,
} from "@/lib/channel-minimums";
import { channelWriteErrorMessage } from "@/lib/channel-start";
import { createCampaignForPair } from "@/lib/start-pair";
import { invalidateCampaignMoney } from "@/lib/write-invalidation";
import { CrewMark } from "@/components/v2/crew-mark";
import { CrewTriggerTag } from "@/components/v2/crew-trigger-tag";
import type { CrewSummary, Mission } from "@/components/v2/use-missions";

/**
 * Add a mission: one crew working for one offer, with its own budget.
 *
 * Three questions and one Save. Which crew (only the crews a customer can put to work),
 * which offer, and how much. A DAILY crew takes a daily budget it spends every day; an
 * EVENT crew (it waits for a step, like a positive reply) takes a daily CAP, spent only
 * when that step is reached, and not counted in the daily budget.
 *
 * The writes are the ones Offer Settings makes: billing's per-(offer x leg x channel)
 * ceiling, then campaign-service's status — a restart when the mission exists, a create
 * (`createCampaignForPair`) when it does not. The channel floor is judged the same way.
 */
export function AddMissionModal({
  brandId,
  crews,
  missions,
  initialOfferId = null,
  onClose,
}: {
  brandId: string;
  crews: CrewSummary[];
  missions: Mission[];
  initialOfferId?: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const offered = crews.filter((c) => c.offered && c.legKey);
  const [crewKey, setCrewKey] = useState<string | null>(offered[0]?.crew.key ?? null);
  const [offerId, setOfferId] = useState<string | null>(initialOfferId);
  const [budget, setBudget] = useState("");

  const offersQ = useAuthQuery(["brandOffers", brandId], () => listBrandOffers(brandId));
  const campaignsQ = useAuthQuery(["campaigns", brandId], () => listCampaignsByBrand(brandId));
  const budgetsQ = useAuthQuery(["brandCampaignBudgets", brandId], () => getBrandCampaignBudgets(brandId));
  const brandQ = useAuthQuery(["brand", brandId], () => getBrand(brandId));
  const channels = useAcquisitionChannels();
  const minimums = useChannelMinimums();

  const offers = offersQ.data?.offers ?? [];
  useEffect(() => {
    if (!offerId && offers.length > 0) setOfferId(offers[0].offerId);
  }, [offerId, offers]);

  const crew = offered.find((c) => c.crew.key === crewKey) ?? null;
  const isEvent = crew?.trigger?.kind === "event";
  const channelName = crew
    ? acquisitionChannelForFeatureSlug(crew.featureSlug, channels)?.name ?? channelSlugLabel(crew.featureSlug)
    : "";

  // The existing mission for this (offer x leg x channel), if any: the same identity
  // collapse Offer Settings reads, so a second Add of the same pair edits it.
  const row = useMemo(() => {
    if (!crew?.legKey || !offerId) return null;
    const rows = buildControlRows(
      campaignsQ.data?.campaigns ?? [],
      budgetsQ.data,
      channels,
      { offerId, legKey: crew.legKey, featureSlug: crew.featureSlug },
      [{ legKey: crew.legKey, featureSlug: crew.featureSlug, channelName, offerId }],
    );
    return rows.find((r) => r.scope !== null) ?? null;
  }, [crew, offerId, campaignsQ.data, budgetsQ.data, channels, channelName]);

  const typed = budget.trim() === "" ? null : parseDailyBudgetUsd(budget);
  const savedChannelCents = crew ? channelTotalCents(crew.featureSlug, budgetsQ.data) : 0;
  const minimumCents = channelMinimumCents(minimums, crew?.featureSlug);
  const belowFloor =
    typed != null &&
    channelBudgetBelowMinimum(minimumCents, projectedChannelTotalUsd(savedChannelCents, row?.savedCents ?? 0, typed), savedChannelCents);

  // An event crew works what a daily crew brings on the same offer. Without one
  // running there, it has nothing to wake on, and it says so rather than looking idle.
  const feederRunning =
    !isEvent ||
    !crew?.leg?.fromKey ||
    missions.some((m) => m.offerId === offerId && m.running && m.leg?.toKey === crew.leg?.fromKey);

  const already = row?.running ? row : null;
  const submittable = !!crew && !!offerId && !!row?.scope && typed != null && typed > 0 && !belowFloor;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!crew?.legKey || !offerId || !row?.scope || typed == null) return;
      await saveCampaignBudget(brandId, { offerId, legKey: crew.legKey, featureSlug: crew.featureSlug }, typed * 100);
      if (row.campaignId) {
        if (!row.running) {
          await setCampaignStatus(row.campaignId, "activate", { brandId, featureSlug: crew.featureSlug });
        }
        return;
      }
      await createCampaignForPair({
        brandId,
        offerId,
        featureSlug: crew.featureSlug,
        legKey: crew.legKey,
        channelName,
        legLabel: crew.leg?.label ?? null,
        brandName: brandQ.data?.brand?.name ?? brandQ.data?.brand?.domain ?? "Brand",
      });
    },
    onSuccess: () => {
      invalidateCampaignMoney(queryClient);
      onClose();
    },
    onError: (err) => console.error("[dashboard v2] add mission failed", err),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !mutation.isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, mutation.isPending]);

  if (typeof document === "undefined") return null;
  const host = document.getElementById("v2-portal") ?? document.body;
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-[#1010121f] px-3 pt-[10vh]"
      onMouseDown={() => !mutation.isPending && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="v2-add-mission-title"
        className="k-popover flex max-h-[80vh] w-full max-w-[480px] flex-col overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--line-subtle)] px-4">
          <span id="v2-add-mission-title" className="k-label">
            Add a mission
          </span>
          <button
            type="button"
            aria-label="Close"
            className="k-btn-ghost ml-auto h-7 w-7 justify-center p-0"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            ×
          </button>
        </div>

        <form
          className="overflow-y-auto px-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (submittable && !mutation.isPending) mutation.mutate();
          }}
        >
          <p className="k-label">Crew</p>
          <div className="mt-1.5 grid gap-1.5" role="radiogroup" aria-label="Crew">
            {offered.map((c) => {
              const on = c.crew.key === crewKey;
              return (
                <button
                  key={c.crew.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setCrewKey(c.crew.key)}
                  className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-left ${
                    on ? "k-selected shadow-[inset_0_0_0_1px_var(--accent)]" : "k-hover shadow-[inset_0_0_0_1px_var(--line-subtle)]"
                  }`}
                >
                  <CrewMark color={c.crew.color} glyph={c.crew.glyph} size={24} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium">{c.crew.name}</span>
                    {c.trigger && <CrewTriggerTag trigger={c.trigger} className="k-fg2 mt-0.5 text-[12px]" />}
                  </span>
                </button>
              );
            })}
          </div>

          <label htmlFor="v2-add-mission-offer" className="k-label mt-4 block">
            Offer
          </label>
          {offers.length === 0 ? (
            <p className="k-fg3 mt-1.5 text-[13px]">{offersQ.isPending ? "Loading offers..." : "Add an offer first."}</p>
          ) : (
            <select
              id="v2-add-mission-offer"
              value={offerId ?? ""}
              onChange={(e) => setOfferId(e.target.value)}
              className="k-input mt-1.5 w-full px-2"
            >
              {offers.map((o) => (
                <option key={o.offerId} value={o.offerId}>
                  {o.name ?? "Offer"}
                </option>
              ))}
            </select>
          )}

          <label htmlFor="v2-add-mission-budget" className="k-label mt-4 block">
            {isEvent ? "Daily cap" : "Daily budget"}
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="k-fg3 text-[13px]">$</span>
            <input
              id="v2-add-mission-budget"
              type="text"
              inputMode="numeric"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder={row && row.savedCents > 0 ? String(Math.round(row.savedCents / 100)) : "10"}
              className="k-input w-24 px-2.5 text-right tabular-nums"
            />
            <span className="k-fg3 text-[13px]">/ day</span>
          </div>
          <p className="k-fg3 mt-1.5 text-[12px] leading-[18px]">
            {isEvent
              ? `Spent only when a ${crew?.leg?.fromLabel?.toLowerCase() ?? "lead"} comes in, never more than this a day. Not counted in your daily budget.`
              : "Spent every day, on the people this offer targets."}
          </p>
          {budget.trim() !== "" && typed === null && (
            <p className="mt-1.5 text-[12px] text-[var(--data-rose)]">Enter a whole number of dollars.</p>
          )}
          {belowFloor && minimumCents !== null && (
            <p className="mt-1.5 text-[12px] text-[var(--data-rose)]">
              {channelBudgetFloorMessage(channelName, minimumCents, savedChannelCents)}
            </p>
          )}
          {!feederRunning && (
            <p className="mt-3 rounded-[8px] bg-[var(--bg-inset)] px-2.5 py-2 text-[12px] leading-[18px] text-[var(--fg-2)]">
              {crew?.crew.name} works the {crew?.leg?.fromLabel?.toLowerCase() ?? "leads"} another crew brings on this offer.
              Nothing brings them here yet, so it will wait until one does.
            </p>
          )}
          {already && (
            <p className="k-fg3 mt-3 text-[12px]">This mission is already running. Saving changes its {isEvent ? "cap" : "budget"}.</p>
          )}

          {mutation.isError && (
            <p role="alert" className="mt-3 text-[13px] text-[var(--data-rose)]">
              {channelWriteErrorMessage(mutation.error, "start")}
            </p>
          )}

          <div className="mt-5 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} disabled={mutation.isPending} className="k-btn-ghost">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!submittable || mutation.isPending}
              className={`k-btn-accent ${mutation.isPending ? "cursor-wait" : "disabled:cursor-not-allowed disabled:opacity-40"}`}
            >
              {mutation.isPending ? "Starting..." : already ? "Save" : "Start mission"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    host,
  );
}
