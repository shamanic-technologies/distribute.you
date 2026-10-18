"use client";

import Link from "next/link";
import { listCampaignEvents } from "@/lib/api";
import { pollOptions } from "@/lib/query-options";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  CAMPAIGN_HOLD_EVENTS,
  campaignHoldCopy,
  holdsByReason,
  readCampaignHold,
  type CampaignHold,
  type CampaignHoldGroup,
} from "@/lib/campaign-hold";

const HOLD_EVENTS_LIMIT = 25;

/**
 * Why a running campaign is not sending right now. The verdict is campaign-service's
 * (`lib/campaign-hold.ts`); nothing is decided here. Disabled on a paused campaign, so a
 * paused one never states a hold.
 */
export function useCampaignHold(campaignId: string, running: boolean): CampaignHold | null {
  const { data } = useAuthQuery(
    ["campaignHold", campaignId],
    () => listCampaignEvents(campaignId, { event: CAMPAIGN_HOLD_EVENTS, limit: HOLD_EVENTS_LIMIT }),
    { ...pollOptions, enabled: running },
  );
  if (!running || !data) return null;
  return readCampaignHold(data.events);
}

/**
 * A sales-funnel campaign's holds: campaign-service holds each PIPE (prod 2026-10-18: every
 * `campaign-hold` names a pipe's campaign id, never the funnel's), so this reads every
 * RUNNING pipe and folds them into one note per reason.
 */
export function useCampaignHolds(runningCampaignIds: readonly string[]): CampaignHoldGroup[] {
  const ids = [...runningCampaignIds].sort();
  const { data } = useAuthQuery(
    ["campaignHold", `pipes:${ids.join(",")}`],
    () =>
      Promise.all(
        ids.map(async (id) => [id, (await listCampaignEvents(id, { event: CAMPAIGN_HOLD_EVENTS, limit: HOLD_EVENTS_LIMIT })).events] as const),
      ),
    { ...pollOptions, enabled: ids.length > 0 },
  );
  if (ids.length === 0 || !data) return [];
  return holdsByReason(data.map(([id, events]) => [id, readCampaignHold(events)] as const));
}

/**
 * The note itself, amber like every held state in v2. `onAction` opens the control on this
 * page (the campaign's limits); `actionHref` leaves for it (billing, or the campaign a pipe
 * belongs to). A reason that is ours carries no action at all.
 */
export function CampaignHoldNote({
  hold,
  pipes,
  onAction,
  limitsHref,
  billingHref,
}: {
  hold: CampaignHold;
  /** The pipes it stops, when not all of them ("Lead found, Positive reply"). */
  pipes?: string | null;
  onAction?: () => void;
  limitsHref?: string | null;
  billingHref: string;
}) {
  const copy = campaignHoldCopy(hold);
  const href = copy.action === "billing" ? billingHref : copy.action === "campaign_budget" && !onAction ? (limitsHref ?? null) : null;
  return (
    // keel.css is unlayered, so a bg-* utility on a k-card loses: the amber tint rides an inline style.
    <div
      className="k-card flex flex-wrap items-center gap-3 px-4 py-3"
      style={{ background: "color-mix(in oklab, var(--data-amber) 10%, var(--bg-raised))" }}
      data-campaign-hold={hold.reason}
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[14px] font-medium">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--data-amber)]" aria-hidden />
          {copy.headline}
        </p>
        <p className="k-fg2 mt-0.5 text-[13px]">{copy.body}</p>
        {pipes && <p className="k-fg3 mt-1 text-[12px]">Waiting: {pipes}</p>}
      </div>
      {copy.actionLabel && copy.action === "campaign_budget" && onAction ? (
        <button type="button" className="k-btn-accent" onClick={onAction}>
          {copy.actionLabel}
        </button>
      ) : copy.actionLabel && href ? (
        <Link href={href} className="k-btn-accent">
          {copy.actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
