"use client";

import { useMemo, useState } from "react";
import { getBrandFunnelBudgets, listCampaignsByBrand } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  ROLLUP_LABEL,
  ROLLUP_STYLE,
  buildControlRows,
  rollupStatus,
  scopeTotalCents,
} from "@/lib/campaign-controls";
import { fmtDailyBudgetUsd } from "@/lib/campaign-budget";
import { CampaignControlsModal } from "@/components/campaigns/campaign-controls-modal";
import { Skeleton } from "@/components/skeleton";

/**
 * Is this running, and how hard — stated at whatever grain the page is on, and
 * the way into the modal that changes it.
 *
 * The whole control IS the pill, deliberately: a hover-revealed pencil is a dead
 * affordance on a phone (a finger produces no hover), which is the same reason
 * this repo's info tips are never a native `title`. It is a `role="button"` span
 * rather than a native button element, because it renders inside clickable
 * regions and a nested button is invalid HTML: the parser closes the outer one
 * early and the surrounding card breaks.
 *
 * The MONEY is read, never recomposed. At brand grain the caller passes billing's
 * own served total (`GET /brands/:id/daily-budget`, which the Overview already
 * reads); at offer grain there is no served figure, so the rows' own ceilings are
 * added up — the same shape as the funnels card's per-offer total, and for the
 * same reason: billing's per-funnel figure spans every offer selling it, so it
 * would name money a reader on one offer cannot see. That sum is honest only
 * because a ROW is a campaign IDENTITY (funnel x channel x offer) rather than a
 * stored campaign row: billing keys one ceiling on that triple, campaign-service
 * stores one campaign as many rows, and a list per row added the same ceiling up
 * once per row.
 */
export function CampaignControlsTrigger({
  brandId,
  offerId,
  campaignId,
  totalCentsOverride,
  className = "",
}: {
  brandId: string;
  /** Scope to one offer. Omitted at brand grain. */
  offerId?: string;
  /** Scope to one campaign. Omitted at brand and offer grain. */
  campaignId?: string;
  /**
   * billing's own served figure for this scope, when one exists. Brand grain
   * passes it; the others have none and the rows are added up instead.
   */
  totalCentsOverride?: number | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const campaignsQ = useAuthQuery(["campaigns", brandId], () => listCampaignsByBrand(brandId));
  const budgetsQ = useAuthQuery(["brandFunnelBudgets", brandId], () =>
    getBrandFunnelBudgets(brandId),
  );

  const rows = useMemo(
    () =>
      buildControlRows(campaignsQ.data?.campaigns ?? [], budgetsQ.data, { offerId, campaignId }),
    [campaignsQ.data, budgetsQ.data, offerId, campaignId],
  );

  // Reveal on SETTLE (resolved OR errored) — a failed read shows the honest
  // answer rather than an eternal skeleton.
  const settled =
    (campaignsQ.data !== undefined || campaignsQ.isError) &&
    (budgetsQ.data !== undefined || budgetsQ.isError);

  if (!settled) {
    return (
      <div className={`flex items-center justify-end gap-2.5 ${className}`}>
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-5 w-16" />
      </div>
    );
  }

  const rollup = rollupStatus(rows);
  const totalCents =
    totalCentsOverride !== undefined ? totalCentsOverride : scopeTotalCents(rows);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label="Change what is running and what it may spend"
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`group -mx-1 flex cursor-pointer items-center justify-end gap-2.5 rounded-md px-1 py-0.5 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${className}`}
      >
        <span className="text-sm tabular-nums text-gray-600">
          {fmtDailyBudgetUsd(totalCents)}
          <span className="text-gray-400"> / day</span>
        </span>
        <span
          className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${ROLLUP_STYLE[rollup]}`}
        >
          {ROLLUP_LABEL[rollup]}
        </span>
        {/* Persistent, not hover-only: a control discoverable only by accident is
            not discoverable on a touch screen at all. */}
        <svg
          className="h-3.5 w-3.5 shrink-0 text-gray-300 transition group-hover:text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
      </div>
      {open && (
        <CampaignControlsModal
          brandId={brandId}
          offerId={offerId}
          campaignId={campaignId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
