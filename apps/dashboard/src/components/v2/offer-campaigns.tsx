"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { ApiError, getBrand, getOfferCampaignBudgets, setCampaignStatus, setOfferCampaignBudget } from "@/lib/api";
import { formatCentsAsUsdAdaptive } from "@/lib/format-number";
import {
  budgetRefusalCopy,
  campaignKey,
  campaignTag,
  campaignsQuery,
  parseBudgetText,
  type CampaignBudgetRow,
  type CampaignPeriod,
  type OfferCampaign,
} from "@/lib/offer-campaign-budgets";
import { channelWriteErrorMessage } from "@/lib/channel-start";
import { createCampaignForPair } from "@/lib/start-pair";
import { invalidateCampaignMoney } from "@/lib/write-invalidation";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { useMissions, type Mission } from "@/components/v2/use-missions";
import { ChannelChip, PathAvatar } from "@/components/v2/offer-sales-paths";
import { EmptyNote, SectionTitle, Shimmer, StateDot } from "@/components/v2/ui";

const money = (cents: number) => formatCentsAsUsdAdaptive(cents);
const per = (period: CampaignPeriod) => (period === "month" ? "/month" : "/day");

/**
 * The offer's CAMPAIGNS (owner 2026-10-04): every channel x leg its sales paths use, each
 * with ONE budget (a MAX for a reactive one) and an on/off status. The budget is
 * billing's ceiling row, the status campaign-service's; nothing here decides a rule.
 */
export function OfferCampaigns({
  orgId,
  brandId,
  offerId,
  campaigns,
  pending,
}: {
  orgId: string;
  brandId: string;
  offerId: string;
  campaigns: readonly OfferCampaign[];
  pending: boolean;
}) {
  const query = campaignsQuery(campaigns);
  const budgets = useAuthQuery(
    ["offerCampaignBudgets", brandId, offerId, query],
    () => getOfferCampaignBudgets(brandId, offerId, query),
    { enabled: !!offerId && campaigns.length > 0 },
  );
  const { missions } = useMissions(orgId, brandId, { allOffers: true });
  const rowsByKey = useMemo(() => {
    const m = new Map<string, CampaignBudgetRow>();
    for (const r of budgets.data?.items ?? []) m.set(campaignKey(r.featureSlug, r.legKey), r);
    return m;
  }, [budgets.data]);
  const missionByKey = useMemo(() => {
    const m = new Map<string, Mission>();
    for (const x of missions) {
      const c = x.row.campaign;
      if (c.offerId === offerId && c.featureSlug && c.legKey) m.set(campaignKey(c.featureSlug, c.legKey), x);
    }
    return m;
  }, [missions, offerId]);

  const settled = budgets.isFetchedAfterMount || budgets.data !== undefined;

  return (
    <section>
      <SectionTitle count={pending ? null : campaigns.length}>Campaigns</SectionTitle>
      <p className="k-fg2 -mt-1 mb-3 text-[13px]">Each channel on each step, with its own budget.</p>
      {pending || (campaigns.length > 0 && !settled && !budgets.isError) ? (
        <div className="space-y-2">
          <Shimmer className="h-10 rounded-[10px]" />
          <Shimmer className="h-10 rounded-[10px]" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="k-card">
          <EmptyNote>No campaign yet. Tick the legs and channels this offer sells through.</EmptyNote>
        </div>
      ) : budgets.isError && !budgets.data ? (
        <div className="k-card">
          <EmptyNote>Could not read this offer&apos;s budgets.</EmptyNote>
        </div>
      ) : (
        <div className="k-card overflow-hidden">
          <div className="k-scroll overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead>
                <tr className="k-line-subtle border-b">
                  <th className="k-label px-3 py-2.5 pl-4 text-left font-normal">Campaign</th>
                  <th className="k-label px-3 py-2.5 text-left font-normal">Works</th>
                  <th className="k-label px-3 py-2.5 text-right font-normal">Budget</th>
                  <th className="k-label w-[150px] px-3 py-2.5 pr-4 text-right font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const key = campaignKey(c.featureSlug, c.legKey);
                  return (
                    <CampaignRow
                      key={key}
                      brandId={brandId}
                      offerId={offerId}
                      campaign={c}
                      budget={rowsByKey.get(key) ?? null}
                      mission={missionByKey.get(key) ?? null}
                      queryKey={["offerCampaignBudgets", brandId, offerId, query]}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function CampaignRow({
  brandId,
  offerId,
  campaign,
  budget,
  mission,
  queryKey,
}: {
  brandId: string;
  offerId: string;
  campaign: OfferCampaign;
  budget: CampaignBudgetRow | null;
  mission: Mission | null;
  queryKey: readonly unknown[];
}) {
  const channels = useAcquisitionChannels();
  const def = channels.find((d) => d.featureSlug === campaign.featureSlug);
  useEffect(() => {
    if (!budget) console.error("[offer-campaigns] billing served no row for a listed campaign", campaign);
    if (!campaign.name) console.error("[offer-campaigns] features-service served no campaignName", campaign);
  }, [budget, campaign]);
  return (
    <tr className="k-row k-line-subtle h-12 border-b last:border-b-0">
      <td className="px-3 py-2 pl-4">
        <span className="flex items-center gap-2.5">
          {campaign.name && <PathAvatar name={campaign.name} size={28} />}
          <span className="font-semibold">{campaign.name ?? campaign.channelName}</span>
        </span>
      </td>
      <td className="px-3 py-2">
        {/* The leg read in order: the step it starts from (reactive only), the channel, the step it lands on. */}
        <span className="k-fg2 inline-flex flex-wrap items-center gap-1.5">
          {campaign.fromLabel && (
            <>
              <span>{campaign.fromLabel}</span>
              <span className="k-fg3">→</span>
            </>
          )}
          <ChannelChip name={campaign.channelName} def={def} notRun={campaign.managed === false} />
          <span className="k-fg3">→</span>
          <span>{campaign.toLabel}</span>
        </span>
      </td>
      <td className="px-3 py-2 text-right">
        {budget ? (
          <InlineBudget brandId={brandId} offerId={offerId} campaign={campaign} row={budget} queryKey={queryKey} />
        ) : (
          <span className="k-fg4">—</span>
        )}
      </td>
      <td className="px-3 py-2 pr-4 text-right">
        <CampaignStatus brandId={brandId} offerId={offerId} campaign={campaign} mission={mission} budgetSet={budget?.budgetCents != null} />
      </td>
    </tr>
  );
}

/**
 * The campaign's budget as text; a click turns it into its field, leaving it saves
 * (Enter too), Esc drops it. The typed value shows while billing answers; a refusal
 * reopens the field with the text kept and says why in billing's terms.
 */
function InlineBudget({
  brandId,
  offerId,
  campaign,
  row,
  queryKey,
}: {
  brandId: string;
  offerId: string;
  campaign: OfferCampaign;
  row: CampaignBudgetRow;
  queryKey: readonly unknown[];
}) {
  const qc = useQueryClient();
  const [text, setText] = useState<string | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shown = pending ?? row.budgetCents;

  const commit = async () => {
    if (text === null) return;
    if (text.trim() === "" && row.budgetCents == null) {
      setText(null);
      return;
    }
    const cents = parseBudgetText(text, row.period);
    if (cents == null) {
      setError(row.period === "month" ? "Whole dollars, above 0." : "A dollar amount, above 0.");
      return;
    }
    if (cents === row.budgetCents) {
      setText(null);
      return;
    }
    setText(null);
    setError(null);
    setPending(cents);
    try {
      const saved = await setOfferCampaignBudget(brandId, offerId, { featureSlug: campaign.featureSlug, legKey: campaign.legKey, budgetCents: cents });
      qc.setQueryData(queryKey, saved);
      invalidateCampaignMoney(qc);
    } catch (err) {
      console.error("[offer-campaigns] budget save refused", { campaign, err });
      setText(String(row.period === "month" ? cents / 100 : (cents / 100).toFixed(2)));
      setError(budgetRefusalCopy(err instanceof ApiError ? err.body : undefined, money));
    } finally {
      setPending(null);
    }
  };

  if (!row.budgetable) return <span className="k-fg4">—</span>;

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="k-chip">{campaignTag(campaign)}</span>
      {text !== null ? (
        <span className="inline-flex items-center gap-1">
          <span className="k-fg3">$</span>
          <input
            autoFocus
            inputMode="decimal"
            aria-label={`${campaign.reactive ? "Maximum budget" : "Budget"} for ${campaign.name ?? campaign.channelName}, ${per(row.period)}`}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setText(null);
                setError(null);
              }
            }}
            className="k-input h-6 w-20 px-1.5 text-right text-[13px] tabular-nums"
          />
          <span className="k-fg3 text-[12px]">{per(row.period)}</span>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setText(shown == null ? "" : String(row.period === "month" ? shown / 100 : (shown / 100).toFixed(2)))}
          className="k-hover h-6 rounded-[6px] px-1.5 tabular-nums"
        >
          {shown == null ? (
            <span className="k-fg3">Set a {campaign.reactive ? "max " : ""}budget</span>
          ) : (
            <>
              {campaign.reactive && <span className="k-fg3">Max </span>}
              <span className="k-fg">{money(shown)}</span>
              <span className="k-fg3">{per(row.period)}</span>
            </>
          )}
        </button>
      )}
      {error && <span className="text-[11.5px] text-[var(--data-rose)]">{error}</span>}
    </span>
  );
}

/**
 * On/off: the dot and word in a button with a chevron, opening a one-item menu with the
 * other state (campaign-service's status). A channel we do not run yet has no switch: its
 * budget is recorded and charged only when we launch it.
 */
function CampaignStatus({
  brandId,
  offerId,
  campaign,
  mission,
  budgetSet,
}: {
  brandId: string;
  offerId: string;
  campaign: OfferCampaign;
  mission: Mission | null;
  budgetSet: boolean;
}) {
  const qc = useQueryClient();
  const brandQ = useAuthQuery(["brand", brandId], () => getBrand(brandId));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pressed, setPressed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  useEffect(() => setPressed(null), [mission?.running]);

  if (campaign.managed === false) {
    return (
      <span title="Your budget is kept; we charge nothing until we launch this channel.">
        <StateDot running={false} label="Not run yet" />
      </span>
    );
  }
  const running = pressed ?? mission?.running ?? false;

  const toggle = async () => {
    setOpen(false);
    setError(null);
    const next = !running;
    setPressed(next);
    setBusy(true);
    try {
      if (mission) {
        await setCampaignStatus(mission.row.campaign.id, next ? "activate" : "stop", { brandId, featureSlug: campaign.featureSlug });
      } else {
        await createCampaignForPair({
          brandId,
          offerId,
          featureSlug: campaign.featureSlug,
          legKey: campaign.legKey,
          channelName: campaign.channelName,
          legLabel: campaign.fromLabel ? `${campaign.fromLabel} → ${campaign.toLabel}` : campaign.toLabel,
          brandName: brandQ.data?.brand?.name ?? brandQ.data?.brand?.domain ?? "Brand",
        });
      }
      invalidateCampaignMoney(qc);
    } catch (err) {
      console.error("[offer-campaigns] status change failed", { campaign, err });
      setPressed(null);
      setError(channelWriteErrorMessage(err, next ? "start" : "pause"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className="relative inline-flex flex-col items-end">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
        className="k-btn gap-1.5"
      >
        <StateDot running={running} label={running ? "On" : "Off"} hold={running ? null : mission?.paymentHold ?? null} />
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="k-fg3">
          <path d="M2.5 4l2.5 2.5L7.5 4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="k-popover absolute right-0 top-full z-50 mt-1 min-w-[160px] p-1 text-left">
          {!running && !budgetSet ? (
            <p className="k-fg3 px-2 py-1.5 text-[12px]">Set a budget first.</p>
          ) : (
            <button type="button" role="menuitem" className="k-row w-full rounded-[6px] px-2 py-1.5 text-left text-[13px]" onClick={toggle}>
              {running ? "Turn off" : "Turn on"}
            </button>
          )}
        </div>
      )}
      {error && <span className="mt-1 max-w-[220px] text-[11.5px] text-[var(--data-rose)]">{error}</span>}
    </div>
  );
}
