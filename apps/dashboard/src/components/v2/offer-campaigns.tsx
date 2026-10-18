"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import {
  getBrand,
  setCampaignStatus,
} from "@/lib/api";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { formatCount, formatUsdAdaptive } from "@/lib/format-number";
import { shownReturn, type StatBasis } from "@/lib/maturity";
import { useStatBasis } from "@/lib/use-stat-basis";
import { useRoutePrefetch } from "@/lib/use-route-prefetch";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { campaignNameFor, type LegCatalogue } from "@/lib/legs";
import { costPerResult, outcomeCount } from "@/components/v2/campaign-results";
import { campaignKey, sortCampaigns, type OfferCampaign } from "@/lib/offer-campaigns";
import { CampaignModeChip } from "@/components/v2/campaign-mode";
import { TriggerEventLines } from "@/components/v2/trigger-event-lines";
import { channelWriteErrorMessage } from "@/lib/channel-start";
import { createCampaignForPair, startReactiveCampaign } from "@/lib/start-pair";
import { invalidateCampaignMoney } from "@/lib/write-invalidation";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { useCampaigns, type V2Campaign } from "@/components/v2/use-campaigns";
import { EXPECTED_ROI_TIP } from "@/lib/offer-sales-paths";
import { ChannelChip, ExpectedLabel } from "@/components/v2/offer-sales-paths";
import { ServedPipeMark } from "@/components/v2/served-pipe-mark";
import { featureLegId } from "@/lib/outbound-leg-key";
import { EmptyNote, HoverScroll, MarkLines, SectionTitle, Shimmer, StateDot } from "@/components/v2/ui";
import { ProviderLogo } from "@/components/provider-logo";
import { roiToShow } from "@/lib/expected-return";
import { ROI_TIP, RoiValue } from "@/components/v2/roi-label";

/**
 * The offer's CAMPAIGNS (owner 2026-10-05): every channel x leg its sales paths use, with
 * its type, its ROI (features-service) and an on/off status (campaign-service). No budget:
 * what a campaign may spend is its sales funnel campaign's caps (owner 2026-10-10), and a
 * part of one is listed under it, never here. Sorted on first, proactive first, ROI high to
 * low; an on row reads on a light green fill.
 */
export function OfferCampaigns({
  orgId,
  brandId,
  offerId,
  campaigns,
  pending,
  title = "Campaigns",
  sub = "One proactive campaign at a time. Reactive ones follow its leads.",
  results = false,
  openRows = false,
  listedElsewhere,
}: {
  orgId: string;
  brandId: string;
  offerId: string;
  campaigns: readonly OfferCampaign[];
  pending: boolean;
  title?: string;
  sub?: string;
  /**
   * Sales path page (owner 2026-10-08, the old Campaigns page folded in): each campaign's
   * own results (ROI, outcomes, value, cost per outcome, invested), read off the SAME
   * features-service row its campaign page reads, and a row opens that page. The ROI is
   * the campaign's measured return, never the path forecast (that one stays on the paths
   * table): the two read 0.89x vs 1.32x for one campaign under one label.
   */
  results?: boolean;
  /** Sourcing page (owner 2026-10-09): a row opens its campaign's page too, when it has one. */
  openRows?: boolean;
  /** Campaigns another page lists (the Sourcing page's sources): never an unlisted row here. */
  listedElsewhere?: ReadonlySet<string>;
}) {
  const router = useRouter();
  const prefetch = useRoutePrefetch();
  const { basis } = useStatBasis();
  const catalogue = useLegCatalogue();
  const { campaigns: records } = useCampaigns(orgId, brandId, { allOffers: true });
  const campaignByKey = useMemo(() => {
    const m = new Map<string, V2Campaign>();
    for (const x of records) {
      const c = x.row.campaign;
      // A part of a sales-funnel campaign is listed under that campaign, never as one of these rows.
      if (c.salesFunnelCampaignId) continue;
      if (c.offerId === offerId && c.featureSlug && c.legKey) m.set(campaignKey(c.featureSlug, c.legKey), x);
    }
    return m;
  }, [records, offerId]);
  const running = (c: OfferCampaign) => campaignByKey.get(campaignKey(c.featureSlug, c.legKey))?.running ?? false;
  const measuredRoi = (c: OfferCampaign) => {
    const m = campaignByKey.get(campaignKey(c.featureSlug, c.legKey));
    return m ? shownReturn(m.row.revenue?.economicsMaturity, basis).value : null;
  };
  const sorted = useMemo(
    () => sortCampaigns(campaigns, running, results ? measuredRoi : undefined),
    [campaigns, campaignByKey, results, basis], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // A campaign the offer ran that features-service no longer lists (its channel or leg
  // left the offer): still one of the offer's campaigns, read only, opening its page.
  const unlisted = useMemo(() => {
    if (!results) return [];
    const listed = new Set(campaigns.map((c) => campaignKey(c.featureSlug, c.legKey)));
    return [...campaignByKey.entries()].filter(([k]) => !listed.has(k) && !listedElsewhere?.has(k)).map(([, m]) => m);
  }, [results, campaigns, campaignByKey, listedElsewhere]);
  // The proactive campaign that is on now: turning another one on moves the plan to it.
  // A SOURCE campaign runs beside the others (owner 2026-10-07): it neither takes nor gives the plan.
  const activeProactive = sorted.find((c) => c.kind === "outreach" && !c.reactive && running(c)) ?? null;
  // The triggers under the rows are the ones these campaigns wait on (an ON one always shows).
  const triggerCampaigns = useMemo(
    () => campaigns.map((c) => ({ featureSlug: c.featureSlug, legKey: c.legKey, on: running(c) })),
    [campaigns, campaignByKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <section>
      <SectionTitle count={pending ? null : campaigns.length + unlisted.length}>{title}</SectionTitle>
      <p className="k-fg2 -mt-1 mb-3 text-[13px]">{sub}</p>
      {pending ? (
        <div className="space-y-2">
          <Shimmer className="h-10 rounded-[10px]" />
          <Shimmer className="h-10 rounded-[10px]" />
        </div>
      ) : campaigns.length + unlisted.length === 0 ? (
        <div className="k-card">
          <EmptyNote>No campaign yet. Tick the legs and channels this offer sells through.</EmptyNote>
        </div>
      ) : (
        <div className="k-card overflow-hidden">
          <div className="k-scroll overflow-x-auto">
            <table className={`w-full text-[13px] ${results ? "min-w-[1180px]" : "min-w-[880px]"}`}>
              <thead>
                {results ? (
                  <tr className="k-line-subtle border-b">
                    <th className="k-label px-3 py-2.5 pl-4 text-left font-normal">Campaign</th>
                    <th className="k-label px-3 py-2.5 text-left font-normal">Type</th>
                    <th className="k-label px-3 py-2.5 text-right font-normal">
                      <ExpectedLabel tip={ROI_TIP}>ROI</ExpectedLabel>
                    </th>
                    <th className="k-label px-3 py-2.5 text-right font-normal"># Outcomes</th>
                    <th className="k-label px-3 py-2.5 text-right font-normal">$ Value</th>
                    <th className="k-label px-3 py-2.5 text-right font-normal">$ / Outcome</th>
                    <th className="k-label px-3 py-2.5 text-right font-normal">$ Invested</th>
                    <th className="k-label w-[130px] px-3 py-2.5 pr-4 text-right font-normal">Status</th>
                  </tr>
                ) : (
                  <tr className="k-line-subtle border-b">
                    <th className="k-label px-3 py-2.5 pl-4 text-left font-normal">Campaign</th>
                    <th className="k-label px-3 py-2.5 text-left font-normal">Works</th>
                    <th className="k-label px-3 py-2.5 text-left font-normal">Type</th>
                    <th className="k-label px-3 py-2.5 text-right font-normal">
                      <ExpectedLabel tip={EXPECTED_ROI_TIP}>ROI</ExpectedLabel>
                    </th>
                    <th className="k-label w-[150px] px-3 py-2.5 pr-4 text-right font-normal">Status</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {sorted.map((c) => {
                  const key = campaignKey(c.featureSlug, c.legKey);
                  const record = campaignByKey.get(key) ?? null;
                  return (
                    <CampaignRow
                      key={key}
                      results={results}
                      basis={basis}
                      catalogue={catalogue}
                      onOpen={
                        (results || openRows) && record
                          ? { go: () => router.push(record.href), warm: () => prefetch(record.href) }
                          : null
                      }
                      brandId={brandId}
                      offerId={offerId}
                      campaign={c}
                      record={record}
                      replaces={c.kind === "outreach" && !c.reactive && activeProactive && activeProactive !== c ? activeProactive : null}
                    />
                  );
                })}
                {unlisted.map((m) => (
                  <UnlistedRow
                    key={m.row.campaign.id}
                    record={m}
                    name={campaignNameFor(catalogue, m.row.campaign.featureSlug, m.row.campaign.legKey)}
                    basis={basis}
                    onOpen={() => router.push(m.href)}
                    onWarm={() => prefetch(m.href)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <TriggerEventLines brandId={brandId} offerId={offerId} campaigns={triggerCampaigns} catalogue={catalogue} />
        </div>
      )}
    </section>
  );
}

/** A campaign's leg read in order: the step it starts from (reactive only), the channel, the step it lands on. */
export function CampaignLeg({
  campaign,
  sources = [],
  showFedBy = false,
  className = "",
  compact = false,
}: {
  campaign: Pick<OfferCampaign, "featureSlug" | "channelName" | "managed" | "fromLabel" | "toLabel"> &
    Partial<Pick<OfferCampaign, "kind" | "fedByLabel" | "providerDomain">>;
  /** Sales path page: an outreach campaign fed by the source campaigns reads "Lead found -> ...". */
  showFedBy?: boolean;
  /** Where the leads come from, read before the channel: "[Apollo Cold Filters] → [Channel] → …". */
  sources?: readonly string[];
  className?: string;
  /** One line, 11px, no wrap (Today's Campaigns card). */
  compact?: boolean;
}) {
  const channels = useAcquisitionChannels();
  const def = channels.find((d) => d.featureSlug === campaign.featureSlug);
  const fromLabel = campaign.fromLabel ?? (showFedBy ? campaign.fedByLabel ?? null : null);
  return (
    <span
      className={`k-fg2 inline-flex items-center ${compact ? "gap-1 whitespace-nowrap text-[11px]" : "flex-wrap gap-1.5"} ${className}`}
    >
      {sources.map((name) => (
        <span key={name} className="contents">
          <span className="k-chip">{name}</span>
          <span className="k-fg3">→</span>
        </span>
      ))}
      {fromLabel && (
        <>
          <span>{fromLabel}</span>
          <span className="k-fg3">→</span>
        </>
      )}
      {campaign.kind === "source" ? (
        <span className="k-chip">
          <ProviderLogo domain={campaign.providerDomain ?? null} size={14} className="shrink-0 rounded-[3px]" />
          {campaign.channelName}
        </span>
      ) : (
        <ChannelChip name={campaign.channelName} def={def} notRun={campaign.managed === false} compact={compact} />
      )}
      <span className="k-fg3">→</span>
      <span>{campaign.toLabel}</span>
    </span>
  );
}

function CampaignRow({
  results,
  basis,
  catalogue,
  onOpen,
  brandId,
  offerId,
  campaign,
  record,
  replaces,
}: {
  /** Sales path page: the campaign's own results columns, the leg under its name. */
  results: boolean;
  basis: StatBasis;
  /** features-service's catalogue: the campaign's mode and the trigger of a reactive one. */
  catalogue: LegCatalogue;
  /** The row opens the campaign's page; null when it has none yet (never ran). */
  onOpen: { go: () => void; warm: () => void } | null;
  brandId: string;
  offerId: string;
  campaign: OfferCampaign;
  record: V2Campaign | null;
  /** The proactive campaign this one would take the plan from if turned on. */
  replaces: OfferCampaign | null;
}) {
  const [pressed, setPressed] = useState<boolean | null>(null);
  useEffect(() => setPressed(null), [record?.running]);
  useEffect(() => {
    if (!campaign.name) console.error("[offer-campaigns] features-service served no campaignName", campaign);
  }, [campaign]);
  const on = pressed ?? record?.running ?? false;
  // The status control (and its portalled menu, whose events bubble
  // through React's tree) never open the campaign page.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <tr
      className={`k-row k-line-subtle h-12 border-b last:border-b-0 ${onOpen ? "cursor-pointer" : ""} ${on ? "bg-[color-mix(in_oklab,var(--run)_9%,transparent)]" : ""}`}
      onClick={onOpen?.go}
      onMouseEnter={onOpen?.warm}
      onFocus={onOpen?.warm}
    >
      <td className="px-3 py-2 pl-4">
        {results ? (
          <MarkLines mark={(px) => <ServedPipeMark pipeId={featureLegId(campaign.featureSlug, campaign.legKey)} size={px} />}>
            <span className="block truncate font-semibold">{campaign.name ?? campaign.channelName}</span>
            <HoverScroll className="mt-1">
              <CampaignLeg campaign={campaign} showFedBy compact />
            </HoverScroll>
          </MarkLines>
        ) : (
          <span className="flex min-w-0 items-center gap-2.5">
            <ServedPipeMark pipeId={featureLegId(campaign.featureSlug, campaign.legKey)} size={28} />
            <span className="font-semibold">{campaign.name ?? campaign.channelName}</span>
          </span>
        )}
      </td>
      {!results && (
        <td className="px-3 py-2">
          <CampaignLeg campaign={campaign} showFedBy />
        </td>
      )}
      <td className="px-3 py-2">
        <CampaignModeChip catalogue={catalogue} featureSlug={campaign.featureSlug} legKey={campaign.legKey} reactive={campaign.reactive} />
      </td>
      {results ? (
        <CampaignResultCells record={record} basis={basis} />
      ) : (
        <td className={`px-3 py-2 text-right font-semibold tabular-nums ${roiIsGood(campaign.roi) ? "text-[var(--run)]" : ""}`}>
          {campaign.roi == null && campaign.roiUnavailable ? (
            // The served reason in words, readable on touch (a title= is not).
            <span className="k-fg3 text-[12px] font-normal">{campaign.roiUnavailable}</span>
          ) : (
            formatRoi(campaign.roi)
          )}
        </td>
      )}
      <td className="px-3 py-2 pr-4 text-right" onClick={stop}>
        <CampaignStatus
          brandId={brandId}
          offerId={offerId}
          campaign={campaign}
          record={record}
          on={on}
          setPressed={setPressed}
          replaces={replaces}
        />
      </td>
    </tr>
  );
}

const DASH = <span className="k-fg4">—</span>;

/**
 * A campaign's own results, as its campaign page states them (owner 2026-10-08): ROI,
 * outcomes, value, cost per outcome, money in. Every figure is a served field of the
 * campaign's features-service row (the campaigns read); nothing is computed here. A
 * campaign that never ran has none of them yet.
 */
export function CampaignResultCells({ record, basis }: { record: V2Campaign | null; basis: StatBasis }) {
  const g = record?.row.revenue;
  // Learning unless mature, or already above 1x to date (lib/maturity.ts shownReturn): the campaign page's ROI tile.
  const roi = shownReturn(g?.economicsMaturity, basis);
  const outcome = record ? outcomeCount(record) : null;
  const cost = record ? costPerResult(record, basis) : null;
  return (
    <>
      <td className="px-3 py-2 text-right font-semibold tabular-nums">
        {!record ? DASH : <RoiValue roi={roiToShow(roi, g?.expectedReturn)} learning={roi.learning} />}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {outcome ? (
          <>
            {formatCount(outcome.count)} <span className="k-fg3 text-[12px]">{outcome.unit}</span>
          </>
        ) : (
          DASH
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{g?.totalPipelineUsd != null ? formatUsdAdaptive(g.totalPipelineUsd) : DASH}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        {cost ? cost.unit ? cost.value : <span className="k-chip">{cost.value}</span> : DASH}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {g?.committedCostUsd != null ? formatUsdAdaptive(g.committedCostUsd) : DASH}
        {g?.actualCostUsd != null && g.committedCostUsd != null && g.committedCostUsd > g.actualCostUsd && (
          <span className="k-fg3 block text-[12px]">{formatUsdAdaptive(g.actualCostUsd)} spent</span>
        )}
      </td>
    </>
  );
}

/** A campaign the offer ran whose channel or leg it no longer lists: its results, read only. */
function UnlistedRow({
  record,
  name,
  basis,
  onOpen,
  onWarm,
}: {
  record: V2Campaign;
  name: string | null;
  basis: StatBasis;
  onOpen: () => void;
  onWarm: () => void;
}) {
  return (
    <tr className="k-row k-line-subtle h-12 cursor-pointer border-b last:border-b-0" onClick={onOpen} onMouseEnter={onWarm} onFocus={onWarm}>
      <td className="px-3 py-2 pl-4">
        <MarkLines mark={(px) => <ServedPipeMark pipeId={record.pipe.id} size={px} />}>
          <span className="block truncate font-semibold">{name ?? record.pipe.name}</span>
          <span className="k-fg3 mt-1 block text-[11px]">{record.leg?.label ?? "—"}</span>
        </MarkLines>
      </td>
      <td className="px-3 py-2">{DASH}</td>
      <CampaignResultCells record={record} basis={basis} />
      <td className="px-3 py-2 pr-4 text-right">
        <StateDot running={record.running} label={record.running ? "On" : "Off"} hold={record.running ? null : record.paymentHold} />
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
  record,
  on,
  setPressed,
  replaces,
}: {
  brandId: string;
  offerId: string;
  campaign: OfferCampaign;
  record: V2Campaign | null;
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
  const menuRef = useRef<HTMLDivElement>(null);
  // The table card clips (overflow-hidden + overflow-x-auto), so the menu is portalled and
  // placed `fixed` against the button: below it, or above it when the viewport ends first.
  const [menuAt, setMenuAt] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    const dismiss = () => setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("scroll", dismiss, { capture: true, passive: true });
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("scroll", dismiss, { capture: true });
      window.removeEventListener("resize", dismiss);
    };
  }, [open]);
  const openMenu = (button: HTMLButtonElement) => {
    if (open) return setOpen(false);
    const r = button.getBoundingClientRect();
    const right = window.innerWidth - r.right;
    setMenuAt(window.innerHeight - r.bottom < 140 ? { bottom: window.innerHeight - r.top + 4, right } : { top: r.bottom + 4, right });
    setOpen(true);
  };

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
      if (record) {
        await setCampaignStatus(record.row.campaign.id, next ? "activate" : "stop", { brandId, featureSlug: campaign.featureSlug });
      } else if (campaign.reactive || campaign.kind === "source") {
        // A source campaign runs no workflow: campaign-service starts it as a funded pair (v0.75.2).
        await startReactiveCampaign({ brandId, offerId, featureSlug: campaign.featureSlug, legKey: campaign.legKey });
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
        onClick={(e) => openMenu(e.currentTarget)}
        className="k-btn gap-1.5"
      >
        <StateDot running={on} label={on ? "On" : "Off"} hold={on ? null : record?.paymentHold ?? null} />
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="k-fg3">
          <path d="M2.5 4l2.5 2.5L7.5 4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && menuAt && createPortal(
        <div ref={menuRef} role="menu" style={menuAt} className="k-popover fixed z-50 w-[240px] p-1 text-left">
          {switching && (
            <p className="k-fg2 px-2 pb-1 pt-1.5 text-[12px]">
              Your plan moves here from {replaces.name ?? replaces.channelName}, which turns off.
            </p>
          )}
          <button type="button" role="menuitem" className="k-row w-full rounded-[6px] px-2 py-1.5 text-left text-[13px]" onClick={toggle}>
            {on ? "Turn off" : switching ? "Turn on instead" : "Turn on"}
          </button>
        </div>,
        document.getElementById("v2-portal") ?? document.body,
      )}
      {error && <span className="mt-1 max-w-[220px] text-[11.5px] text-[var(--data-rose)]">{error}</span>}
    </div>
  );
}
