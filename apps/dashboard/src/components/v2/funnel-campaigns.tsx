"use client";

import { useEffect, useMemo, useState } from "react";
import { LightningIcon } from "@phosphor-icons/react/dist/csr/Lightning";
import { CalendarBlankIcon } from "@phosphor-icons/react/dist/csr/CalendarBlank";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import {
  ApiError,
  getSalesFunnelCaps,
  listFunnelCampaignRows,
  listFunnelCampaignCopies,
  listSalesFunnelCampaigns,
  saveSalesFunnelCaps,
  setSalesFunnelCampaignStatus,
} from "@/lib/api";
import {
  CAP_PERIOD_LABEL,
  CAP_PERIODS,
  capUnavailableSentence,
  capWindowWords,
  asCapPeriod,
  centsToUsd,
  formatCapUsd,
  funnelCampaignFaceSrc,
  isOngoingFunnelCampaign as isFunnelCampaignOn,
  capWords,
  funnelTypeOf,
  fundingLimit,
  funnelFunded,
  statedBudget,
  statedVolume,
  volumeFundingLabel,
  volumeUnitWords,
  parseWholeAmount,
  type CapPeriod,
  type MaxBudget,
  type MaxVolume,
  type SalesFunnelCampaign,
  type SalesFunnelCaps,
  type SalesFunnelUnit,
  type FunnelCampaignRow,
  type FunnelCampaignCopy,
  type FunnelPathItem,
  missingChannelGaps,
  orderPipesByFunnel,
  funnelRoiShown,
  funnelRowSettled,
  unpricedWords,
} from "@/lib/sales-funnel-campaigns";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { paymentHoldKind } from "@/lib/payment-declined";
import { channelWriteErrorMessage } from "@/lib/channel-start";
import { invalidateCampaignMoney } from "@/lib/write-invalidation";
import { formatCount, formatUsdAdaptive } from "@/lib/format-number";
import { useStatBasis } from "@/lib/use-stat-basis";
import { useRoutePrefetch } from "@/lib/use-route-prefetch";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { legFor } from "@/lib/legs";
import { v2CampaignHref, v2Href, type V2CampaignTab } from "@/lib/v2/routes";
import { isColdEmailChannel } from "@/lib/offer-levers-home";
import { isProactiveFrom } from "@/lib/outbound-leg-key";
import { useCampaigns, type V2Campaign } from "@/components/v2/use-campaigns";
import { CampaignResultCells } from "@/components/v2/offer-campaigns";
import { ChannelChip } from "@/components/v2/offer-sales-paths";
import { V2Page, type V2Tab } from "@/components/v2/setup-pages";
import { CampaignHoldNote, useCampaignHolds } from "@/components/v2/campaign-hold";
import { holdOutlivesLimitChange } from "@/lib/campaign-hold";
import { PipeSections } from "@/components/v2/pipe-sections";
import { SpendChartsBlock, spendChartState, useFunnelCampaignSpendCharts } from "@/components/v2/spend-charts";
import { PeoplePage } from "@/components/v2/people-page";
import { V2AudiencesTable } from "@/components/v2/audiences-table";
import { EmptyNote, Figure, HoverScroll, MarkLines, Meter, SectionTitle, Shimmer, StateDot } from "@/components/v2/ui";
import { RoiLabel, RoiValue } from "@/components/v2/roi-label";
import { roiToShow } from "@/lib/expected-return";
import { useStaffMode } from "@/lib/use-staff-mode";
import { CAMPAIGN_LAYOUT_PARAM, isCampaignLayoutPreview } from "@/lib/v2/campaign-layout-preview";
import { FunnelCampaignPageNext } from "@/components/v2/campaign-page-next";
import { FactoryPlanSection } from "@/components/v2/factory-plan-card";

/**
 * CAMPAIGNS THAT ARE SALES FUNNELS (owner 2026-10-10). A campaign has a name and a face, ONE
 * status for the whole of it (campaign-service), a MAX BUDGET and a MAX VOLUME each stated per
 * day / week / month or in total (billing), and its results. The customer never reads funnel,
 * pipe or leg, and no leg arrows (owner 2026-10-10): a part reads as what it brings in and
 * the channel doing it ("Website visit [Cold email]").
 * Every figure is served (billing's consumption, features-service's per-campaign results).
 */

const DASH = <span className="k-fg4">—</span>;

/** The offer's campaigns (or the brand's, offerId null), newest first. One key for every reader. */
export function useFunnelCampaigns(brandId: string, offerId: string | null, { enabled = true }: { enabled?: boolean } = {}) {
  return useAuthQuery(
    ["salesFunnelCampaigns", brandId, offerId ?? "all"],
    () => listSalesFunnelCampaigns(brandId, offerId),
    { enabled: enabled && !!brandId, ...pollOptions },
  );
}

function useFunnelCaps(c: Pick<SalesFunnelCampaign, "brandId" | "offerId" | "salesFunnelId">) {
  return useAuthQuery(
    ["salesFunnelCaps", c.brandId, c.offerId, c.salesFunnelId],
    () => getSalesFunnelCaps(c.brandId, c.offerId, c.salesFunnelId),
    pollOptions,
  );
}

/** The campaign's face, drawn by features-service from its name. */
export function FunnelFace({ name, size }: { name: string; size: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={funnelCampaignFaceSrc(name)}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full bg-[var(--bg-inset)] shadow-[inset_0_0_0_1px_var(--line)]"
      style={{ width: size, height: size }}
    />
  );
}

const Chevron = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="k-fg3">
    <path d="M2.5 4l2.5 2.5L7.5 4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── Status + limits: one button, one modal (owner 2026-10-11) ──────────────────────────

/**
 * The campaign's status as every campaign status reads: the dot and word in a button with a
 * chevron. A click opens the campaign's ONE modal (on/off, max budget, max volume, one Save).
 * Every part moves with the status (campaign-service, one transaction).
 */
export function FunnelCampaignStatus({
  campaign,
  onLabel,
}: {
  campaign: SalesFunnelCampaign;
  /**
   * Campaigns table (owner 2026-10-11): an ON campaign's button is GREEN and reads its budget
   * ("$50/week", "Up to $50/week"); OFF reads "Off". Absent = the plain On / Off dot and word.
   */
  onLabel?: string | null;
}) {
  const caps = useFunnelCaps(campaign);
  const capsSettled = caps.data !== undefined || caps.isFetchedAfterMount;
  const [open, setOpen] = useState(false);
  const on = isFunnelCampaignOn(campaign);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        // The modal opens on billing's stated limits, never on an empty form that would overwrite them.
        disabled={!capsSettled}
        onClick={() => setOpen(true)}
        className="k-btn gap-1.5 tabular-nums"
        // keel.css is unlayered: the green tint rides inline, never a bg-* utility on a k-btn.
        style={
          onLabel !== undefined && on
            ? { background: "color-mix(in oklab, var(--run) 14%, var(--bg-raised))", color: "var(--fg-1)", boxShadow: "inset 0 0 0 1px color-mix(in oklab, var(--run) 45%, transparent)" }
            : undefined
        }
      >
        <StateDot running={on} label={on ? (onLabel ?? "On") : "Off"} hold={on ? null : paymentHoldKind(campaign)} />
        <Chevron />
      </button>
      {open && <FunnelCampaignModal campaign={campaign} caps={caps.data ?? null} onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * The limits as a button in the campaign type's words ("Max $50/week" Proactive, "Up to $50/week"
 * Reactive), opening the same modal. "Set a budget" when none.
 */
export function FunnelLimitsButton({ campaign, caps }: { campaign: SalesFunnelCampaign; caps: SalesFunnelCaps | null }) {
  const [open, setOpen] = useState(false);
  // A volume-only funnel shows its max volume, never a $ amount (owner 2026-10-11).
  const limit = fundingLimit(caps);
  const type = funnelTypeOf(caps);
  return (
    <>
      <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)} className="k-btn gap-1.5 tabular-nums">
        <span className={limit ? "" : "k-fg3"}>
          {limit?.kind === "budget" ? statedBudget(type, limit.budget) : limit?.kind === "volume" ? volumeFundingLabel(type, limit.volume) : "Set a budget"}
        </span>
        <Chevron />
      </button>
      {open && <FunnelCampaignModal campaign={campaign} caps={caps} onClose={() => setOpen(false)} />}
    </>
  );
}

const PERIOD_SHORT: Record<CapPeriod, string> = { daily: "Day", weekly: "Week", monthly: "Month", one_off: "Total" };

/** The period as ONE segmented control beside its amount (Day | Week | Month | Total). */
function PeriodPicker({ value, onChange, label }: { value: CapPeriod; onChange: (p: CapPeriod) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="ml-auto inline-flex shrink-0 rounded-[8px] bg-[var(--bg-inset)] p-0.5">
      {CAP_PERIODS.map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={value === p}
          title={CAP_PERIOD_LABEL[p]}
          onClick={() => onChange(p)}
          className={`h-6 rounded-[6px] px-2.5 text-[12px] transition-colors ${value === p ? "font-medium" : "k-fg2 hover:text-[var(--fg-1)]"}`}
          style={value === p ? { background: "var(--bg-raised)", boxShadow: "0 0 0 1px var(--line), 0 1px 2px rgb(0 0 0 / 0.06)" } : undefined}
        >
          {PERIOD_SHORT[p]}
        </button>
      ))}
    </div>
  );
}

/** Whole number of people typed in the field, or null (empty or not a whole number). */
function parseWholeCount(v: string): number | null {
  const t = v.trim().replace(/,/g, "");
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n > 0 ? n : null;
}

/** The on/off switch: green while running (`--run`), never the accent. */
function RunSwitch({ on, onChange }: { on: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Campaign on"
      onClick={() => onChange(!on)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-[var(--run)]" : "bg-[var(--data-track)]"}`}
    >
      <span className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-[18px]" : "translate-x-0.5"}`} />
    </button>
  );
}

/**
 * The campaign's ONE modal (owner 2026-10-11): on/off, then each limit on one line (amount,
 * period), one Save writing what changed (billing's limits first, then campaign-service's status,
 * so a campaign turned on with its first budget starts funded). The one sanctioned Save in v2.
 */
export function FunnelCampaignModal({
  campaign,
  caps,
  onClose,
}: {
  campaign: SalesFunnelCampaign;
  caps: SalesFunnelCaps | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  // Proactive: "Max budget" / "Max volume". Reactive: "Budget" / "Volume" read "Up to" (owner 2026-10-10).
  const type = funnelTypeOf(caps);
  const words = capWords(type);
  const upTo = type === "reactive";
  const servedOn = isFunnelCampaignOn(campaign);
  const stated = caps?.maxBudget ?? null;
  const statedUsd = centsToUsd(stated?.amountCents);
  const initial = {
    budget: statedUsd !== null ? String(Math.round(statedUsd)) : "",
    budgetPer: stated ? asCapPeriod(stated.period) : ("weekly" as CapPeriod),
    volume: caps?.maxVolume ? String(caps.maxVolume.count) : "",
    volumePer: caps?.maxVolume ? asCapPeriod(caps.maxVolume.period) : ("monthly" as CapPeriod),
  };
  const [on, setOn] = useState(servedOn);
  const [budget, setBudget] = useState(initial.budget);
  const [budgetPer, setBudgetPer] = useState<CapPeriod>(initial.budgetPer);
  const [volume, setVolume] = useState(initial.volume);
  const [volumePer, setVolumePer] = useState<CapPeriod>(initial.volumePer);
  const [failure, setFailure] = useState<string | null>(null);

  const usd = parseWholeAmount(budget);
  const people = volume.trim() === "" ? null : parseWholeCount(volume);
  const limitsDirty = budget !== initial.budget || budgetPer !== initial.budgetPer || volume !== initial.volume || volumePer !== initial.volumePer;
  const statusDirty = on !== servedOn;
  // A campaign needs a max budget AND/OR a max volume (owner 2026-10-11); neither = nothing to save.
  const budgetProblem =
    budget.trim() !== "" && usd === null
      ? "Type a whole number of dollars."
      : limitsDirty && budget.trim() === "" && volume.trim() === ""
        ? "Set a budget or a volume."
        : null;
  const volumeProblem = volume.trim() !== "" && people === null ? "Type a whole number of people." : null;
  const submittable = (limitsDirty || statusDirty) && !budgetProblem && !volumeProblem;

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (limitsDirty) {
        try {
          const data = await saveSalesFunnelCaps(campaign.brandId, campaign.offerId, campaign.salesFunnelId, {
            maxBudget: usd === null ? null : { amountCents: usd * 100, period: budgetPer },
            maxVolume: people === null ? null : { count: people, period: volumePer },
          });
          qc.setQueryData(["salesFunnelCaps", campaign.brandId, campaign.offerId, campaign.salesFunnelId], data);
        } catch (err) {
          console.error("[funnel-campaigns] limits save failed", { campaignId: campaign.id, err });
          throw new Error(err instanceof ApiError && err.status === 400 ? "These limits are not allowed." : "We could not save your limits. Try again in a moment.");
        }
      }
      if (statusDirty) {
        try {
          await setSalesFunnelCampaignStatus(campaign.id, on ? "activate" : "stop", campaign.brandId);
        } catch (err) {
          console.error("[funnel-campaigns] status change failed", { campaignId: campaign.id, next: on ? "activate" : "stop", err });
          throw new Error(channelWriteErrorMessage(err, on ? "start" : "pause"));
        }
      }
    },
    onSuccess: async () => {
      invalidateCampaignMoney(qc);
      // The list re-read settles before the modal closes, so the row never shows the old status.
      await qc.refetchQueries({ queryKey: ["salesFunnelCampaigns", campaign.brandId] });
      onClose();
    },
    onError: (err) => setFailure(err.message),
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, isPending]);

  // What the stated budget spent this period (billing), shown while the period is the stated one.
  const spent = stated && stated.consumedCents !== null && budgetPer === asCapPeriod(stated.period) ? `${formatCapUsd(stated.consumedCents)} spent ${capWindowWords(stated.period)}` : null;

  if (typeof document === "undefined") return null;
  const host = document.getElementById("v2-portal") ?? document.body;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-[#1010121f] px-3 pt-[12vh]" onMouseDown={() => !isPending && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="v2-funnel-campaign-title"
        className="k-popover flex w-full max-w-[480px] flex-col overflow-hidden text-left"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-[var(--line-subtle)] px-4">
          <FunnelFace name={campaign.salesFunnelName} size={24} />
          <span id="v2-funnel-campaign-title" className="truncate text-[14px] font-medium">
            {campaign.salesFunnelName}
          </span>
          <button type="button" aria-label="Close" className="k-btn-ghost ml-auto h-7 w-7 justify-center p-0" onClick={onClose} disabled={isPending}>
            ×
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (submittable && !isPending) {
              setFailure(null);
              mutate();
            }
          }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-[var(--line-subtle)] px-4 py-3.5">
            <StateDot running={on} label={on ? "On" : "Off"} />
            <RunSwitch on={on} onChange={setOn} />
          </div>

          <div className="space-y-5 px-4 py-4">
            <div>
              <label htmlFor="v2-funnel-budget" className="k-label block">
                {words.budget}
              </label>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="k-fg2 shrink-0">{upTo ? "Up to $" : "$"}</span>
                <input
                  id="v2-funnel-budget"
                  autoFocus
                  inputMode="numeric"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="50"
                  aria-invalid={budgetProblem !== null}
                  className={`k-input w-[100px] px-2.5 tabular-nums ${budgetProblem ? "shadow-[inset_0_0_0_1px_var(--data-rose)]" : ""}`}
                />
                <PeriodPicker value={budgetPer} onChange={setBudgetPer} label={`${words.budget} period`} />
              </div>
              {(budgetProblem || spent) && (
                <p className={`mt-1.5 text-[12px] leading-[18px] tabular-nums ${budgetProblem ? "text-[var(--data-rose)]" : "k-fg3"}`}>{budgetProblem ?? spent}</p>
              )}
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="v2-funnel-volume" className="k-label block">
                  {words.volume}
                </label>
                <span className="k-fg4 text-[12px]">Optional</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {upTo && <span className="k-fg2 shrink-0">Up to</span>}
                <input
                  id="v2-funnel-volume"
                  inputMode="numeric"
                  value={volume}
                  onChange={(e) => setVolume(e.target.value)}
                  placeholder="No limit"
                  aria-invalid={volumeProblem !== null}
                  className={`k-input w-[100px] px-2.5 tabular-nums ${volumeProblem ? "shadow-[inset_0_0_0_1px_var(--data-rose)]" : ""}`}
                />
                <span className="k-fg2 shrink-0">{volumeUnitWords(caps?.maxVolume?.unit ?? null, type, 2)}</span>
                <PeriodPicker value={volumePer} onChange={setVolumePer} label={`${words.volume} period`} />
              </div>
              {volumeProblem && <p className="mt-1.5 text-[12px] leading-[18px] text-[var(--data-rose)]">{volumeProblem}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-[var(--line-subtle)] px-4 py-3">
            {failure && (
              <p role="alert" className="min-w-0 flex-1 text-[12.5px] leading-[18px] text-[var(--data-rose)]">
                {failure}
              </p>
            )}
            <button type="button" onClick={onClose} disabled={isPending} className="k-btn-ghost ml-auto">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!submittable || isPending}
              className={`k-btn-accent ${isPending ? "cursor-wait" : "disabled:cursor-not-allowed disabled:opacity-40"}`}
            >
              {isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    host,
  );
}

/** What the max budget consumed this period, billing's figures: "$12 this week" or a reason. */
function SpentCell({ budget }: { budget: MaxBudget }) {
  if (budget.consumedCents === null) return <span className="k-fg3 text-[12px]">{capUnavailableSentence(budget.consumedUnavailableReason)}</span>;
  return (
    <span className="tabular-nums">
      {formatCapUsd(budget.consumedCents)} <span className="k-fg3 text-[12px]">{capWindowWords(budget.period)}</span>
    </span>
  );
}

function ContactedCell({ volume, type }: { volume: MaxVolume; type: ReturnType<typeof funnelTypeOf> }) {
  if (volume.consumed === null) return <span className="k-fg3 text-[12px]">{capUnavailableSentence(volume.consumedUnavailableReason)}</span>;
  return (
    <span className="tabular-nums">
      {formatCount(volume.consumed)}{" "}
      <span className="k-fg3 text-[12px]">
        {volumeUnitWords(volume.unit, type, volume.consumed)} {capWindowWords(volume.period)}
      </span>
    </span>
  );
}

// ─── Campaigns > Overview: the offer's campaigns (owner spec 2026-10-11) ─────────────────

/**
 * The campaign's path on one line, as features-service serves it: every step label with the channel
 * (or channels: several sources on Start → Lead found) between each two of them, ours or the client's
 * own team ("Start → [Apollo] [LinkedIn] → Lead found → [Sales Cold Email Outreach] → Positive reply →
 * [Your team: closing calls] → Paid client"). The chip is the staff pipe rows' own (`ChannelChip`);
 * nothing is parsed or skipped.
 */
export function FunnelPathLine({ items }: { items: FunnelPathItem[] }) {
  const channels = useAcquisitionChannels();
  // Every two steps have a channel between them, the client's own team included (owner
  // 2026-10-11). A pair served without one is a producer gap: logged and drawn as an error.
  const gaps = missingChannelGaps(items);
  useEffect(() => {
    if (gaps.length > 0) console.error("[funnel-campaigns] a leg of the path is served with no channel", { gaps, items });
  }, [gaps.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <HoverScroll>
    <span className="k-fg2 flex items-center gap-1 whitespace-nowrap text-[11px]">
      {items.map((it, i) => (
        <span key={i} className="contents">
          {/* Several channels on one leg (sources on Start → Lead found) sit side by side, one group
              between its two steps: an arrow only where a step meets a channel. */}
          {i > 0 && !(it.kind === "channel" && items[i - 1].kind === "channel") && <span className="k-fg3">→</span>}
          {i > 0 && it.kind === "step" && items[i - 1].kind === "step" && (
            <>
              <span className="k-chip shrink-0 text-[var(--data-rose)]" title="This step has no channel">
                Unknown
              </span>
              <span className="k-fg3">→</span>
            </>
          )}
          {it.kind === "step" ? (
            <span className="shrink-0">{it.label}</span>
          ) : it.kind === "trigger" ? (
            // A reactive path starts with its trigger: one lightning for every trigger (owner 2026-10-11).
            <span className="k-chip inline-flex shrink-0 items-center gap-1">
              <LightningIcon size={12} weight="duotone" aria-hidden className="shrink-0" />
              {it.name}
            </span>
          ) : (
            <ChannelChip name={it.name} def={channels.find((d) => d.featureSlug === it.slug)} notRun={false} compact />
          )}
        </span>
      ))}
    </span>
    </HoverScroll>
  );
}

/** The Type tag: [calendar Daily] for a proactive campaign, [lightning <trigger>] for a reactive one, both served. */
export function TypeTag({ row }: { row: FunnelCampaignCopy }) {
  if (!row.typeLabel) {
    console.error("[funnel-campaigns] typeLabel not served", { id: row.id, reason: row.copyUnavailableReason ?? null });
    return DASH;
  }
  const Glyph = row.type === "reactive" ? LightningIcon : CalendarBlankIcon;
  return (
    <span className="k-chip inline-flex items-center gap-1 whitespace-nowrap">
      <Glyph size={13} weight="duotone" aria-hidden className="shrink-0" />
      {row.typeLabel}
    </span>
  );
}

/**
 * A funnel campaign's ROI: features-service's measured return under its maturity verdict, else
 * its served EXPECTED return with "expected" beside it (owner 2026-10-11: never blank), else the
 * served reason in words.
 */
export function FunnelRoi({ row }: { row: FunnelCampaignRow }) {
  const shown = funnelRoiShown(row);
  const roi = roiToShow(shown, row.expectedReturn);
  if (roi.value == null && roi.reason == null && shown.unpriced) {
    return <span className="k-fg3 text-[12px] font-normal">{unpricedWords(shown.unpriced)}</span>;
  }
  return <RoiValue roi={roi} learning={shown.learning} />;
}

/**
 * One sales-funnel campaign as a line of a card listing campaigns (Today): face, name, status,
 * then its max budget and what this period spent (billing). Opens the campaign.
 */
export function FunnelCampaignLine({ orgId, campaign }: { orgId: string; campaign: SalesFunnelCampaign }) {
  const caps = useFunnelCaps(campaign);
  const b = caps.data?.maxBudget ?? null;
  const limit = fundingLimit(caps.data ?? null);
  const type = funnelTypeOf(caps.data ?? null);
  const settledCaps = caps.data !== undefined || caps.isFetchedAfterMount;
  const v = limit?.kind === "volume" ? limit.volume : null;
  return (
    <Link href={v2CampaignHref(orgId, campaign.brandId, campaign.id)} className="k-hover block px-4 py-3 first:rounded-t-[12px] last:rounded-b-[12px]">
      <MarkLines gap="gap-3" mark={(px) => <FunnelFace name={campaign.salesFunnelName} size={px} />}>
        <span className="flex items-center gap-3">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{campaign.salesFunnelName}</span>
          <StateDot running={isFunnelCampaignOn(campaign)} hold={isFunnelCampaignOn(campaign) ? null : paymentHoldKind(campaign)} />
        </span>
        <span className="k-fg3 mt-1.5 flex items-center justify-between gap-2 text-[12px] tabular-nums">
          <span className="truncate">
            {!settledCaps ? " " : fundingWords(caps.data ?? null)}
          </span>
          <span className="shrink-0">
            {b && b.consumedCents !== null
              ? `${formatCapUsd(b.consumedCents)} spent ${capWindowWords(b.period)}`
              : v && v.consumed !== null
                ? `${formatCount(v.consumed)} ${volumeUnitWords(v.unit, type, v.consumed)} ${capWindowWords(v.period)}`
                : "—"}
          </span>
        </span>
      </MarkLines>
    </Link>
  );
}

// ─── The campaign page ──────────────────────────────────────────────────────────────────

/** One limit's cell: what it allows, what this period consumed, a meter, "Reached" when billing says so. */
function LimitCell({
  label,
  stated,
  consumed,
  consumedValue,
  max,
  reached,
  unavailable,
  window,
  unit,
  onSet,
}: {
  label: string;
  stated: string | null;
  /** The consumed figure as printed; null when billing could not measure it. */
  consumed: string | null;
  /** The same figure in the cap's unit, for the meter (dollars or people). */
  consumedValue: number | null;
  max: number | null;
  reached: boolean | null;
  unavailable: string | null;
  window: string | null;
  unit: string;
  onSet: () => void;
}) {
  return (
    <div className="min-w-0 px-4 pb-3.5 pt-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="k-label">{label}</span>
        {stated && <span className="k-fg3 truncate text-[12px] tabular-nums">{stated}</span>}
      </div>
      {!stated ? (
        <div className="mt-2 flex items-center gap-2">
          <span className="k-fg3 text-[22px] font-medium leading-7 tracking-[-0.02em]">Not set</span>
          <button type="button" onClick={onSet} className="k-btn-ghost ml-auto">
            Set
          </button>
        </div>
      ) : consumed === null ? (
        <>
          <div className="mt-2">
            <Figure value={DASH} />
          </div>
          <p className="k-fg3 mt-1 text-[12px]">{unavailable}</p>
        </>
      ) : (
        <>
          <div className="mt-2">
            <Figure value={consumed} unit={`${unit} ${window ?? ""}`.trim()} />
          </div>
          <Meter value={consumedValue} max={max} className="mt-2" />
          {reached && <p className="mt-1.5 text-[12px] text-[var(--data-rose)]">Reached for this period.</p>}
        </>
      )}
    </div>
  );
}

/** The parts the campaign runs, each its served results, opening its own page. */
function FunnelResults({
  orgId,
  brandId,
  units,
}: {
  orgId: string;
  brandId: string;
  units: SalesFunnelUnit[];
}) {
  const router = useRouter();
  const prefetch = useRoutePrefetch();
  const { basis } = useStatBasis();
  const channels = useAcquisitionChannels();
  const catalogue = useLegCatalogue();
  const { campaignById, settled } = useCampaigns(orgId, brandId, { allOffers: true });
  return (
    <section>
      <SectionTitle count={units.length}>Results</SectionTitle>
      <p className="k-fg2 -mt-1 mb-3 text-[13px]">What this campaign brought in, since it started.</p>
      {units.length === 0 ? (
        <div className="k-card">
          <EmptyNote>Nothing runs in this campaign yet.</EmptyNote>
        </div>
      ) : (
        <div className="k-card overflow-hidden">
          <div className="k-scroll overflow-x-auto">
            <table className="w-full min-w-[860px] text-[13px]">
              <thead>
                <tr className="k-line-subtle border-b">
                  <th className="k-label px-3 py-2.5 pl-4 text-left font-normal">Brings in</th>
                  <th className="k-label px-3 py-2.5 text-right font-normal">
                    <RoiLabel />
                  </th>
                  <th className="k-label px-3 py-2.5 text-right font-normal"># Outcomes</th>
                  <th className="k-label px-3 py-2.5 text-right font-normal">$ Value</th>
                  <th className="k-label px-3 py-2.5 text-right font-normal">$ / Outcome</th>
                  <th className="k-label px-3 py-2.5 pr-4 text-right font-normal">$ Invested</th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => {
                  const record: V2Campaign | null = campaignById.get(u.campaignId) ?? null;
                  const def = channels.find((d) => d.featureSlug === u.featureSlug);
                  // The step reads off the leg catalogue, so a part that never ran still says what it does.
                  const leg = record?.leg ?? legFor(catalogue, u.legKey);
                  if (settled && !def) console.error("[funnel-campaigns] a part's channel is not in the catalogue", { featureSlug: u.featureSlug });
                  const href = record?.href ?? null;
                  return (
                    <tr
                      key={u.campaignId}
                      className={`k-row k-line-subtle h-12 border-b last:border-b-0 ${href ? "cursor-pointer" : ""}`}
                      onClick={href ? () => router.push(href) : undefined}
                      onMouseEnter={href ? () => prefetch(href) : undefined}
                    >
                      <td className="px-3 py-2 pl-4">
                        {!settled ? (
                          <Shimmer className="h-4 w-48 rounded" />
                        ) : (
                          <span className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="font-medium">{leg?.toLabel ?? "—"}</span>
                            <ChannelChip name={def?.name ?? u.featureSlug} def={def} notRun={false} />
                          </span>
                        )}
                      </td>
                      {/* Each step runs and pauses with the campaign, so it states no status of its own. */}
                      <CampaignResultCells record={record} basis={basis} />
                    </tr>
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

/**
 * One campaign that is a sales funnel: its face and name, ONE status for the whole of it,
 * its two limits with what the current period consumed (billing), then its results (each
 * step's own served figures). Neither a max budget nor a max volume = not funded (billing's
 * `funded`): the page says so and asks for one.
 */
const FUNNEL_TABS: { key: V2CampaignTab; label: string; needsColdEmail: boolean }[] = [
  { key: "overview", label: "Overview", needsColdEmail: false },
  { key: "inbox", label: "Inbox", needsColdEmail: true },
  { key: "sent", label: "Sent", needsColdEmail: true },
  { key: "targeting", label: "Targeting", needsColdEmail: true },
];

export function FunnelCampaignPage({ campaign }: { campaign: SalesFunnelCampaign }) {
  // Staff preview of the next layout (owner 2026-10-15): staff mode AND ?layout=next, else today's page.
  const layout = useSearchParams().get(CAMPAIGN_LAYOUT_PARAM);
  const { staffMode } = useStaffMode();
  if (isCampaignLayoutPreview(staffMode, layout)) return <FunnelCampaignPageNext campaign={campaign} />;
  return <FunnelCampaignPageCurrent campaign={campaign} />;
}

function FunnelCampaignPageCurrent({ campaign }: { campaign: SalesFunnelCampaign }) {
  const { orgId } = useParams<{ orgId: string }>();
  const params = useSearchParams();
  const catalogue = useLegCatalogue();
  const { campaignById } = useCampaigns(orgId, campaign.brandId, { allOffers: true });
  const rowsQ = useAuthQuery(["funnelCampaignRows", campaign.brandId, campaign.offerId], () => listFunnelCampaignRows(campaign.brandId, campaign.offerId), pollOptions);
  const row = rowsQ.data?.find((r) => r.id === campaign.id) ?? null;
  // A campaign newer than the cached rows waits for the fresh read, never "—" (funnelRowSettled).
  const rowsSettled = funnelRowSettled(row !== null, rowsQ, campaign.createdAt);
  // Its path on the fast copy read when the cached rows predate it (owner 2026-10-13: instant).
  const copyQ = useAuthQuery(["funnelCampaignCopies", campaign.brandId, campaign.offerId], () => listFunnelCampaignCopies(campaign.brandId, campaign.offerId), pollOptions);
  const copyRow = copyQ.data?.find((r) => r.id === campaign.id) ?? null;
  const path = row?.path ?? copyRow?.path ?? null;
  const roi = row ? funnelRoiShown(row) : { learning: false, value: null, unpriced: null };
  // The part that emails people is where its people live (Inbox, Sent, Targeting read its scope).
  // The pipes in the order the funnel runs them (sourcing, then cold email, then closing).
  const units = orderPipesByFunnel(campaign.units, (u) => legFor(catalogue, u.legKey));
  const coldEmail = units.find((u) => isColdEmailChannel(u.featureSlug) && isProactiveFrom(legFor(catalogue, u.legKey)?.fromKey)) ?? null;
  const visible = FUNNEL_TABS.filter((t) => !t.needsColdEmail || coldEmail);
  const tab = visible.find((t) => t.key === params.get("tab"))?.key ?? "overview";
  const tabs: V2Tab[] = visible.map((t) => ({ label: t.label, href: v2CampaignHref(orgId, campaign.brandId, campaign.id, t.key), active: t.key === tab }));
  const caps = useFunnelCaps(campaign);
  const [editing, setEditing] = useState(false);
  const capsSettled = caps.data !== undefined || caps.isFetchedAfterMount;
  const c = caps.data ?? null;
  // billing's verdict (owner 2026-10-11): a max budget AND/OR a max volume funds it.
  const notFunded = capsSettled && funnelFunded(c) === false;
  const b = c?.maxBudget ?? null;
  const v = c?.maxVolume ?? null;
  // The campaign's type picks the words (owner 2026-10-10): Proactive "Max budget", Reactive "Up to $X".
  const type = funnelTypeOf(c);
  const words = capWords(type);
  // Why a running pipe sends nothing (campaign-service holds each PIPE): one note per reason.
  const runningPipes = units.filter((u) => campaignById.get(u.campaignId)?.running);
  const holds = useCampaignHolds(runningPipes.map((u) => u.campaignId));
  // Why each day costs what it costs, the campaign's and each pipe's (features-service, owner 2026-10-19).
  const spendQ = useFunnelCampaignSpendCharts(campaign.brandId, campaign.id);
  const pipeCharts = new Map((spendQ.data?.pipes ?? []).map((p) => [p.campaignId, p]));
  const pipeLabel = (id: string) => {
    const u = units.find((x) => x.campaignId === id);
    return (campaignById.get(id)?.leg ?? (u ? legFor(catalogue, u.legKey) : null))?.toLabel ?? null;
  };
  return (
    <V2Page
      crumbs={[{ label: "Campaigns", href: v2Href(orgId, campaign.brandId, "campaigns") }, { label: campaign.salesFunnelName }]}
      title={
        <span className="flex min-w-0 items-center gap-2.5">
          <FunnelFace name={campaign.salesFunnelName} size={32} />
          <span className="truncate">{campaign.salesFunnelName}</span>
        </span>
      }
      sub={path ? <FunnelPathLine items={path.items} /> : undefined}
      tabs={tabs}
      actions={
        <>
          {capsSettled && !(caps.isError && !c) && <FunnelLimitsButton campaign={campaign} caps={c} />}
          <FunnelCampaignStatus campaign={campaign} />
        </>
      }
      width="max-w-[1280px]"
    >
      {tab === "inbox" && coldEmail ? (
        <div className="k-card overflow-hidden">
          <PeoplePage bucket="positive_reply" campaignId={coldEmail.campaignId} />
        </div>
      ) : tab === "sent" && coldEmail ? (
        <div className="k-card overflow-hidden">
          <PeoplePage bucket="contacted" campaignId={coldEmail.campaignId} />
        </div>
      ) : tab === "targeting" && coldEmail ? (
        <V2AudiencesTable campaignId={coldEmail.campaignId} offerId={campaign.offerId} />
      ) : (
      <div className="space-y-8">
        {notFunded && (
          // keel.css is unlayered, so a bg-* utility on a k-card loses: the amber tint rides an inline style.
          <div
            className="k-card flex flex-wrap items-center gap-3 px-4 py-3"
            style={{ background: "color-mix(in oklab, var(--data-amber) 10%, var(--bg-raised))" }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium">Not funded yet</p>
              <p className="k-fg2 text-[13px]">Set a budget or a volume so this campaign can run.</p>
            </div>
            <button type="button" className="k-btn-accent" onClick={() => setEditing(true)}>
              Set a budget
            </button>
          </div>
        )}

        {/* "Not funded yet" above already says what an unfunded hold would. */}
        {holds
          .filter((g) => !(notFunded && g.hold.reason === "unfunded"))
          // A limit changed since the hold was written: the hold judged the old one.
          .filter((g) => holdOutlivesLimitChange(g.hold, c?.updatedAt))
          .map((g) => (
            <CampaignHoldNote
              key={g.hold.reason}
              hold={g.hold}
              pipes={g.campaignIds.length < runningPipes.length ? g.campaignIds.map(pipeLabel).filter(Boolean).join(", ") : null}
              onAction={() => setEditing(true)}
              billingHref={v2Href(orgId, campaign.brandId, "billing")}
            />
          ))}

        {/* GTM Factory step 1 (FACTORY-P1-DASH): staff mode only, renders nothing for a customer. */}
        <FactoryPlanSection
          campaign={campaign}
          type={(row ?? copyRow) ? <TypeTag row={(row ?? copyRow)!} /> : copyQ.isFetchedAfterMount ? DASH : <Shimmer className="h-5 w-24" />}
        />

        <section>
          <SectionTitle right={<span>Since it started</span>}>This campaign</SectionTitle>
          {/* The whole campaign: its return and what it cost (features-service's row), then its two limits (billing). */}
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <div className="k-card grid grid-cols-2 divide-x divide-[var(--line-subtle)]">
              <div className="min-w-0 px-4 pb-3.5 pt-3">
                <span className="k-label">
                  <RoiLabel />
                </span>
                <div className="mt-2">
                  {!rowsSettled ? (
                    <Shimmer className="h-7 w-16" />
                  ) : (
                    <Figure value={row ? <FunnelRoi row={row} /> : DASH} />
                  )}
                </div>
              </div>
              <div className="min-w-0 px-4 pb-3.5 pt-3">
                <span className="k-label">$ Invested</span>
                <div className="mt-2">
                  {!rowsSettled ? <Shimmer className="h-7 w-16" /> : <Figure value={row?.investedUsd != null ? formatUsdAdaptive(row.investedUsd) : DASH} />}
                </div>
              </div>
            </div>
          {!capsSettled ? (
            <Shimmer className="h-[104px] w-full rounded-[12px]" />
          ) : caps.isError && !c ? (
            <div className="k-card">
              <EmptyNote>Could not read this campaign&apos;s limits. Retrying.</EmptyNote>
            </div>
          ) : (
            <div className="k-card grid grid-cols-1 divide-y divide-[var(--line-subtle)] md:grid-cols-2 md:divide-x md:divide-y-0">
              <LimitCell
                label={words.budget}
                stated={b ? statedBudget(type, b) : null}
                consumed={b && b.consumedCents !== null ? formatCapUsd(b.consumedCents) : null}
                consumedValue={b ? centsToUsd(b.consumedCents) : null}
                max={b ? centsToUsd(b.amountCents) : null}
                reached={b?.reached ?? null}
                unavailable={b ? capUnavailableSentence(b.consumedUnavailableReason) : null}
                window={b ? capWindowWords(b.period) : null}
                unit="spent"
                onSet={() => setEditing(true)}
              />
              <LimitCell
                label={words.volume}
                stated={v ? statedVolume(type, v) : null}
                consumed={v && v.consumed !== null ? formatCount(v.consumed) : null}
                consumedValue={v?.consumed ?? null}
                max={v ? v.count : null}
                reached={v?.reached ?? null}
                unavailable={v ? capUnavailableSentence(v.consumedUnavailableReason) : null}
                window={v ? capWindowWords(v.period) : null}
                unit={volumeUnitWords(v?.unit ?? null, type, v?.consumed ?? 2)}
                onSet={() => setEditing(true)}
              />
            </div>
          )}
          </div>
        </section>

        <section>
          <SectionTitle right={<span>Since it started</span>}>Spend, day by day</SectionTitle>
          <SpendChartsBlock {...spendChartState(spendQ, (d) => d.campaign)} />
        </section>

        <PipeSections
          brandId={campaign.brandId}
          units={units}
          campaignById={campaignById}
          spendChart={(campaignId) => spendChartState(spendQ, () => pipeCharts.get(campaignId) ?? null)}
        />

        <FunnelResults orgId={orgId} brandId={campaign.brandId} units={units} />
      </div>
      )}
      {editing && <FunnelCampaignModal campaign={campaign} caps={c} onClose={() => setEditing(false)} />}
    </V2Page>
  );
}

/**
 * `/campaigns/:campaignId` serves BOTH kinds of campaign: a sales-funnel campaign when the
 * brand's list holds that id, else the campaign page as before. Waits for the list to answer
 * once, so neither page flashes "not found" for the other's id.
 */
export function useFunnelCampaignById(brandId: string, id: string) {
  const q = useFunnelCampaigns(brandId, null);
  const campaign = useMemo(() => q.data?.find((c) => c.id === id) ?? null, [q.data, id]);
  const settled = q.data !== undefined || q.isError;
  return { campaign, settled };
}

/** What a campaign may spend, as its stated caps read ("$50/week", "Up to 200 people/month"). */
function fundingWords(caps: SalesFunnelCaps | null): string {
  const b = caps?.maxBudget ?? null;
  const limit = fundingLimit(caps);
  const type = funnelTypeOf(caps);
  const v = limit?.kind === "volume" ? limit.volume : null;
  return b ? statedBudget(type, b) : v ? volumeFundingLabel(type, v) : funnelFunded(caps) === false ? "Not funded yet" : "—";
}

/**
 * A PART's money is its campaign's caps (owner 2026-10-10): a part has no budget of its own, the
 * campaign it runs in states the max budget and max volume (billing). "—" for a campaign started
 * before them, which belongs to no campaign and so has no caps; null while either read loads.
 */
export function useFunnelCapsWords(brandId: string, salesFunnelCampaignId: string | null | undefined): string | null {
  const { campaign, settled } = useFunnelCampaignById(brandId, salesFunnelCampaignId ?? "");
  // The key every caps reader polls (`useFunnelCaps`), so a page showing both costs one request.
  const caps = useAuthQuery(
    ["salesFunnelCaps", campaign?.brandId, campaign?.offerId, campaign?.salesFunnelId],
    () => getSalesFunnelCaps(campaign!.brandId, campaign!.offerId, campaign!.salesFunnelId),
    { ...pollOptions, enabled: !!campaign },
  );
  if (!salesFunnelCampaignId) return "—";
  if (!settled) return null;
  if (!campaign) return "—";
  if (caps.data === undefined && !caps.isFetchedAfterMount) return null;
  return fundingWords(caps.data ?? null);
}

/** `useFunnelCapsWords` as text, for a row. */
export function FunnelCapsWords({ brandId, salesFunnelCampaignId }: { brandId: string; salesFunnelCampaignId: string | null | undefined }) {
  const words = useFunnelCapsWords(brandId, salesFunnelCampaignId);
  return words === "—" ? DASH : <>{words ?? " "}</>;
}

/** A part's page names the campaign it belongs to, and links back to it. */
export function FunnelPartOf({ orgId, campaign }: { orgId: string; campaign: SalesFunnelCampaign | null }) {
  if (!campaign) return <Shimmer className="h-7 w-40 rounded-[8px]" />;
  return (
    <Link href={v2CampaignHref(orgId, campaign.brandId, campaign.id)} className="k-btn gap-1.5">
      <FunnelFace name={campaign.salesFunnelName} size={16} />
      Part of {campaign.salesFunnelName}
    </Link>
  );
}

