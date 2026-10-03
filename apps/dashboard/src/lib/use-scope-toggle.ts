"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError, getBrandCampaignBudgets, listCampaignsByBrand, setCampaignStatus } from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import {
  buildControlRows,
  controlWriteErrorMessage,
  rollupStatus,
  scopeToggleWrites,
  type ControlRollup,
  type ControlRow,
} from "@/lib/campaign-controls";
import { campaignStartRefusalMessage, strongestPaymentHold, type PaymentHoldKind } from "@/lib/payment-declined";
import { invalidateCampaignMoney } from "@/lib/write-invalidation";

/**
 * Pause or Activate a whole scope in one press: a brand, an offer, or one campaign.
 *
 * This replaced the controls modal (owner 2026-10-03: "ne doit plus afficher une
 * modale avec des toggles, mais simplement permettre d'activer ou mettre en pause
 * l'offre"). A plan's budget is fixed, so the only answer left to give is whether the
 * scope runs.
 *
 * Both query keys are byte-equal to the ones every v2 page already polls, so this
 * costs no new request. The writes are a FAN-OUT (no bulk endpoint): every one is
 * attempted, and a failure is surfaced as one sentence rather than a silent half-pause.
 *
 * ⚠️ Activate FIRES THE WORKFLOW IMMEDIATELY rather than at the next tick.
 */
export function useScopeToggle(
  brandId: string,
  scope: { offerId?: string; featureSlug?: string | null; campaignId?: string; legKey?: string | null } = {},
): {
  rows: ControlRow[];
  settled: boolean;
  rollup: ControlRollup;
  hold: PaymentHoldKind | null;
  pending: boolean;
  error: string | null;
  toggle: () => Promise<void>;
} {
  const queryClient = useQueryClient();
  const campaignsQ = useAuthQuery(["campaigns", brandId], () => listCampaignsByBrand(brandId));
  const budgetsQ = useAuthQuery(["brandCampaignBudgets", brandId], () => getBrandCampaignBudgets(brandId));
  const channels = useAcquisitionChannels();
  const { offerId, featureSlug, campaignId, legKey } = scope;
  const rows = useMemo(
    () =>
      buildControlRows(campaignsQ.data?.campaigns ?? [], budgetsQ.data, channels, {
        offerId,
        featureSlug,
        campaignId,
        legKey,
      }),
    [campaignsQ.data, budgetsQ.data, channels, offerId, featureSlug, campaignId, legKey],
  );

  // Reveal on SETTLE (resolved OR errored): a failed read shows the honest answer
  // rather than an eternal skeleton.
  const settled =
    (campaignsQ.data !== undefined || campaignsQ.isError) &&
    (budgetsQ.data !== undefined || budgetsQ.isError);

  const served = rollupStatus(rows);
  // The PRESSED statement, held over the served one until campaign-service agrees
  // (its answer lands a few seconds after the write): a press whose only feedback
  // is a spinner reads dead. Keyed on the scope it was made on, and dropped on refusal.
  const scopeKey = `${brandId}|${offerId ?? ""}|${featureSlug ?? ""}|${campaignId ?? ""}|${legKey ?? ""}`;
  const [pressed, setPressed] = useState<{ key: string; rollup: ControlRollup } | null>(null);
  useEffect(() => {
    if (pressed && (pressed.key !== scopeKey || pressed.rollup === served)) setPressed(null);
  }, [pressed, scopeKey, served]);
  const held = pressed !== null && pressed.key === scopeKey;
  const rollup = held ? pressed.rollup : served;
  // Nothing runs AND the reason is payment: the surface names it. Activate stays
  // offered, because nothing resumes on its own once the card is fixed; while it is
  // not, campaign-service's refusal is shown verbatim.
  const hold = rollup === "paused" ? strongestPaymentHold(rows.map((r) => r.paymentHold)) : null;

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    // While a press is held the rows are the PRE-write ones, so a second press would
    // compute its writes off a stale status: wait for campaign-service to agree.
    if (pending || held || rollup === "none") return;
    const activate = rollup === "paused";
    setPending(true);
    setError(null);
    let failure: string | null = null;
    for (const write of scopeToggleWrites(rows, activate)) {
      if (!write.featureSlug) {
        // campaign-service validates the channel header before it flips the row.
        failure = controlWriteErrorMessage(400, "status");
        continue;
      }
      try {
        await setCampaignStatus(write.campaignId, activate ? "activate" : "stop", {
          brandId,
          featureSlug: write.featureSlug,
        });
      } catch (err) {
        console.error("[dashboard] setCampaignStatus failed", { campaignId: write.campaignId, err });
        // campaign-service's own sentence when it refused the start for a person
        // (a declined payment, or billing it could not read), verbatim.
        failure =
          (err instanceof ApiError ? campaignStartRefusalMessage(err.status, err.body) : null) ??
          controlWriteErrorMessage(err instanceof ApiError ? err.status : null, "status");
      }
    }
    invalidateCampaignMoney(queryClient);
    setPressed(failure ? null : { key: scopeKey, rollup: activate ? "active" : "paused" });
    setError(failure);
    setPending(false);
  }

  return { rows, settled, rollup, hold, pending: pending || held, error, toggle };
}
