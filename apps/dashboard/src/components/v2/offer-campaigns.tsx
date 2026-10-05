"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { getBrand, setCampaignStatus } from "@/lib/api";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { campaignKey, campaignTag, sortCampaigns, type OfferCampaign } from "@/lib/offer-campaigns";
import { channelWriteErrorMessage } from "@/lib/channel-start";
import { createCampaignForPair } from "@/lib/start-pair";
import { invalidateCampaignMoney } from "@/lib/write-invalidation";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { useMissions, type Mission } from "@/components/v2/use-missions";
import { ChannelChip, PathAvatar } from "@/components/v2/offer-sales-paths";
import { EmptyNote, SectionTitle, Shimmer, StateDot } from "@/components/v2/ui";

/**
 * The offer's CAMPAIGNS (owner 2026-10-05): every channel x leg its sales paths use, with
 * its type, its ROI (features-service) and an on/off status (campaign-service). No money
 * here: billing allocates the plan to the ONE proactive campaign that is on (campaign-service
 * keeps a single one on per offer) and a max to each reactive one. Sorted on first,
 * proactive first, ROI high to low; an on row reads on a light green fill.
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
  const { missions } = useMissions(orgId, brandId, { allOffers: true });
  const missionByKey = useMemo(() => {
    const m = new Map<string, Mission>();
    for (const x of missions) {
      const c = x.row.campaign;
      if (c.offerId === offerId && c.featureSlug && c.legKey) m.set(campaignKey(c.featureSlug, c.legKey), x);
    }
    return m;
  }, [missions, offerId]);
  const running = (c: OfferCampaign) => missionByKey.get(campaignKey(c.featureSlug, c.legKey))?.running ?? false;
  const sorted = useMemo(() => sortCampaigns(campaigns, running), [campaigns, missionByKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // The proactive campaign that is on now: turning another one on moves the plan to it.
  const activeProactive = sorted.find((c) => !c.reactive && running(c)) ?? null;

  return (
    <section>
      <SectionTitle count={pending ? null : campaigns.length}>Campaigns</SectionTitle>
      <p className="k-fg2 -mt-1 mb-3 text-[13px]">One proactive campaign at a time. Reactive ones follow its leads.</p>
      {pending ? (
        <div className="space-y-2">
          <Shimmer className="h-10 rounded-[10px]" />
          <Shimmer className="h-10 rounded-[10px]" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="k-card">
          <EmptyNote>No campaign yet. Tick the legs and channels this offer sells through.</EmptyNote>
        </div>
      ) : (
        <div className="k-card overflow-hidden">
          <div className="k-scroll overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead>
                <tr className="k-line-subtle border-b">
                  <th className="k-label px-3 py-2.5 pl-4 text-left font-normal">Campaign</th>
                  <th className="k-label px-3 py-2.5 text-left font-normal">Works</th>
                  <th className="k-label px-3 py-2.5 text-left font-normal">Type</th>
                  <th className="k-label px-3 py-2.5 text-right font-normal">ROI</th>
                  <th className="k-label w-[150px] px-3 py-2.5 pr-4 text-right font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c) => {
                  const key = campaignKey(c.featureSlug, c.legKey);
                  return (
                    <CampaignRow
                      key={key}
                      brandId={brandId}
                      offerId={offerId}
                      campaign={c}
                      mission={missionByKey.get(key) ?? null}
                      replaces={!c.reactive && activeProactive && activeProactive !== c ? activeProactive : null}
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
  mission,
  replaces,
}: {
  brandId: string;
  offerId: string;
  campaign: OfferCampaign;
  mission: Mission | null;
  /** The proactive campaign this one would take the plan from if turned on. */
  replaces: OfferCampaign | null;
}) {
  const channels = useAcquisitionChannels();
  const def = channels.find((d) => d.featureSlug === campaign.featureSlug);
  const [pressed, setPressed] = useState<boolean | null>(null);
  useEffect(() => setPressed(null), [mission?.running]);
  useEffect(() => {
    if (!campaign.name) console.error("[offer-campaigns] features-service served no campaignName", campaign);
  }, [campaign]);
  const on = pressed ?? mission?.running ?? false;
  return (
    <tr className={`k-row k-line-subtle h-12 border-b last:border-b-0 ${on ? "bg-[color-mix(in_oklab,var(--run)_9%,transparent)]" : ""}`}>
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
      <td className="px-3 py-2">
        <span className="k-chip">{campaignTag(campaign)}</span>
      </td>
      <td
        className={`px-3 py-2 text-right font-semibold tabular-nums ${roiIsGood(campaign.roi) ? "text-[var(--run)]" : ""}`}
        title={campaign.roiUnavailable ?? undefined}
      >
        {formatRoi(campaign.roi)}
      </td>
      <td className="px-3 py-2 pr-4 text-right">
        <CampaignStatus
          brandId={brandId}
          offerId={offerId}
          campaign={campaign}
          mission={mission}
          on={on}
          setPressed={setPressed}
          replaces={replaces}
        />
      </td>
    </tr>
  );
}

/**
 * On/off: the dot and word in a button with a chevron, opening a one-item menu with the
 * other state (campaign-service's status). Turning a proactive campaign on while another
 * is on says the plan moves; campaign-service stops the other one itself. A channel we do
 * not run yet has no switch.
 */
function CampaignStatus({
  brandId,
  offerId,
  campaign,
  mission,
  on,
  setPressed,
  replaces,
}: {
  brandId: string;
  offerId: string;
  campaign: OfferCampaign;
  mission: Mission | null;
  on: boolean;
  setPressed: (v: boolean | null) => void;
  replaces: OfferCampaign | null;
}) {
  const qc = useQueryClient();
  const brandQ = useAuthQuery(["brand", brandId], () => getBrand(brandId));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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

  if (campaign.managed === false) {
    return (
      <span title="We charge nothing until we launch this channel.">
        <StateDot running={false} label="Not run yet" />
      </span>
    );
  }

  const toggle = async () => {
    setOpen(false);
    setError(null);
    const next = !on;
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

  const switching = !on && replaces;
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
        <StateDot running={on} label={on ? "On" : "Off"} hold={on ? null : mission?.paymentHold ?? null} />
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="k-fg3">
          <path d="M2.5 4l2.5 2.5L7.5 4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="k-popover absolute right-0 top-full z-50 mt-1 w-[240px] p-1 text-left">
          {switching && (
            <p className="k-fg2 px-2 pb-1 pt-1.5 text-[12px]">
              Your plan moves here from {replaces.name ?? replaces.channelName}, which turns off.
            </p>
          )}
          <button type="button" role="menuitem" className="k-row w-full rounded-[6px] px-2 py-1.5 text-left text-[13px]" onClick={toggle}>
            {on ? "Turn off" : switching ? "Turn on instead" : "Turn on"}
          </button>
        </div>
      )}
      {error && <span className="mt-1 max-w-[220px] text-[11.5px] text-[var(--data-rose)]">{error}</span>}
    </div>
  );
}
