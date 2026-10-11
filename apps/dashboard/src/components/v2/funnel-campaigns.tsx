"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LightningIcon } from "@phosphor-icons/react/dist/csr/Lightning";
import { CalendarBlankIcon } from "@phosphor-icons/react/dist/csr/CalendarBlank";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import {
  ApiError,
  getSalesFunnelCaps,
  listFunnelCampaignRows,
  listSalesFunnelCampaigns,
  saveSalesFunnelCaps,
  setSalesFunnelCampaignStatus,
} from "@/lib/api";
import {
  CAP_PERIOD_LABEL,
  capUnavailableSentence,
  capWindowWords,
  asCapPeriod,
  centsToUsd,
  formatCapUsd,
  funnelCampaignFaceSrc,
  isOngoingFunnelCampaign as isFunnelCampaignOn,
  capWords,
  funnelTypeOf,
  statedBudget,
  statedVolume,
  volumeUnitWords,
  parseWholeAmount,
  type CapPeriod,
  type MaxBudget,
  type MaxVolume,
  type SalesFunnelCampaign,
  type SalesFunnelCaps,
  type SalesFunnelUnit,
  type FunnelCampaignRow,
  type FunnelPathItem,
  maxBudgetLabel,
  roiMissingReason,
  funnelRoiShown,
  unpricedWords,
} from "@/lib/sales-funnel-campaigns";
import { InfoTooltip } from "@/components/visibility/metric-info";
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
import { v2CampaignHref, v2Href } from "@/lib/v2/routes";
import { useMissions, type Mission } from "@/components/v2/use-missions";
import { CampaignResultCells } from "@/components/v2/offer-campaigns";
import { ChannelChip } from "@/components/v2/offer-sales-paths";
import { V2Page } from "@/components/v2/setup-pages";
import { EmptyNote, Figure, MarkLines, Meter, SectionTitle, Shimmer, StateDot } from "@/components/v2/ui";

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

// ─── Status: one control for the whole campaign ─────────────────────────────────────────

/**
 * On / Off as every campaign status reads: the dot and word in a button with a chevron, a
 * one-item menu with the other state. Every part moves with it (campaign-service, one
 * transaction). A refused start shows campaign-service's own sentence (payment hold).
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
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pressed, setPressed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuAt, setMenuAt] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const served = isFunnelCampaignOn(campaign);
  useEffect(() => setPressed(null), [served]);
  const on = pressed ?? served;
  const { mutate, isPending } = useMutation({
    mutationFn: (next: "activate" | "stop") => setSalesFunnelCampaignStatus(campaign.id, next, campaign.brandId),
    onSuccess: async () => {
      invalidateCampaignMoney(qc);
    },
    onError: (err, next) => {
      console.error("[funnel-campaigns] status change failed", { campaignId: campaign.id, next, err });
      setPressed(null);
      setError(channelWriteErrorMessage(err, next === "activate" ? "start" : "pause"));
    },
  });
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    const dismiss = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("scroll", dismiss, { capture: true, passive: true });
    window.addEventListener("resize", dismiss);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("scroll", dismiss, { capture: true });
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const openMenu = (button: HTMLButtonElement) => {
    if (open) return setOpen(false);
    const r = button.getBoundingClientRect();
    const right = window.innerWidth - r.right;
    setMenuAt(window.innerHeight - r.bottom < 140 ? { bottom: window.innerHeight - r.top + 4, right } : { top: r.bottom + 4, right });
    setOpen(true);
  };
  const toggle = () => {
    setOpen(false);
    setError(null);
    setPressed(!on);
    mutate(on ? "stop" : "activate");
  };
  return (
    <div ref={ref} className="relative inline-flex flex-col items-end">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={isPending}
        onClick={(e) => openMenu(e.currentTarget)}
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
      {open &&
        menuAt &&
        createPortal(
          <div ref={menuRef} role="menu" style={menuAt} className="k-popover fixed z-50 w-[220px] p-1 text-left">
            <button type="button" role="menuitem" className="k-row w-full rounded-[6px] px-2 py-1.5 text-left text-[13px]" onClick={toggle}>
              {on ? "Turn off" : "Turn on"}
            </button>
          </div>,
          document.getElementById("v2-portal") ?? document.body,
        )}
      {error && <span className="mt-1 max-w-[240px] text-right text-[11.5px] text-[var(--data-rose)]">{error}</span>}
    </div>
  );
}

// ─── Limits: max budget + max volume (billing) ──────────────────────────────────────────

/**
 * The limits as a button in the campaign type's words ("Max $50/week" Proactive, "Up to $50/week"
 * Reactive), opening the editor. "Set a budget" when none.
 */
export function FunnelLimitsButton({ campaign, caps }: { campaign: SalesFunnelCampaign; caps: SalesFunnelCaps | null }) {
  const [open, setOpen] = useState(false);
  const budget = caps?.maxBudget ?? null;
  const type = funnelTypeOf(caps);
  return (
    <>
      <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)} className="k-btn gap-1.5 tabular-nums">
        <span className={budget ? "" : "k-fg3"}>{budget ? statedBudget(type, budget) : "Set a budget"}</span>
        <Chevron />
      </button>
      {open && <FunnelLimitsModal campaign={campaign} caps={caps} onClose={() => setOpen(false)} />}
    </>
  );
}

function PeriodPicker({ value, onChange, label }: { value: CapPeriod; onChange: (p: CapPeriod) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="mt-2 flex flex-wrap items-center gap-1">
      {(["daily", "weekly", "monthly", "one_off"] as const).map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={value === p}
          onClick={() => onChange(p)}
          className={value === p ? "k-btn-strong" : "k-btn-ghost"}
        >
          {CAP_PERIOD_LABEL[p]}
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

/**
 * The one sanctioned Save in v2 (a campaign's money, owner 2026-10-05): both limits in one
 * write, each in the period it is stated in. A max budget is required (no budget = not
 * funded); the max volume is optional (empty = no limit).
 */
export function FunnelLimitsModal({
  campaign,
  caps,
  onClose,
}: {
  campaign: SalesFunnelCampaign;
  caps: SalesFunnelCaps | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  // Proactive: "Max budget" / "Max volume". Reactive: "Up to $X" / "Up to N <unit>" (owner 2026-10-10).
  const type = funnelTypeOf(caps);
  const words = capWords(type);
  const upTo = type === "reactive";
  const statedUsd = centsToUsd(caps?.maxBudget?.amountCents);
  const [budget, setBudget] = useState(statedUsd !== null ? String(Math.round(statedUsd)) : "");
  const [budgetPer, setBudgetPer] = useState<CapPeriod>(caps?.maxBudget ? asCapPeriod(caps.maxBudget.period) : "weekly");
  const [volume, setVolume] = useState(caps?.maxVolume ? String(caps.maxVolume.count) : "");
  const [volumePer, setVolumePer] = useState<CapPeriod>(caps?.maxVolume ? asCapPeriod(caps.maxVolume.period) : "monthly");
  const { mutate, isPending, error } = useMutation({
    mutationFn: (input: { usd: number; people: number | null }) =>
      saveSalesFunnelCaps(campaign.brandId, campaign.offerId, campaign.salesFunnelId, {
        maxBudget: { amountCents: input.usd * 100, period: budgetPer },
        maxVolume: input.people === null ? null : { count: input.people, period: volumePer },
      }),
    onSuccess: (data) => {
      qc.setQueryData(["salesFunnelCaps", campaign.brandId, campaign.offerId, campaign.salesFunnelId], data);
      invalidateCampaignMoney(qc);
      onClose();
    },
    onError: (err) => console.error("[funnel-campaigns] limits save failed", { campaignId: campaign.id, err }),
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, isPending]);

  const usd = parseWholeAmount(budget);
  const people = volume.trim() === "" ? null : parseWholeCount(volume);
  const budgetProblem = budget.trim() !== "" && usd === null ? "Type a whole number of dollars." : null;
  const volumeProblem = volume.trim() !== "" && people === null ? "Type a whole number of people." : null;
  const submittable = usd !== null && !budgetProblem && !volumeProblem;
  const status = error instanceof ApiError ? error.status : null;

  if (typeof document === "undefined") return null;
  const host = document.getElementById("v2-portal") ?? document.body;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-[#1010121f] px-3 pt-[12vh]" onMouseDown={() => !isPending && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="v2-funnel-limits-title"
        className="k-popover flex w-full max-w-[440px] flex-col overflow-hidden text-left"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--line-subtle)] px-4">
          <FunnelFace name={campaign.salesFunnelName} size={20} />
          <span id="v2-funnel-limits-title" className="k-label truncate">
            {campaign.salesFunnelName}
          </span>
          <button type="button" aria-label="Close" className="k-btn-ghost ml-auto h-7 w-7 justify-center p-0" onClick={onClose} disabled={isPending}>
            ×
          </button>
        </div>
        <form
          className="px-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (submittable && usd !== null && !isPending) mutate({ usd, people });
          }}
        >
          <label htmlFor="v2-funnel-budget" className="k-label block">
            {words.budget}
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="k-fg2">{upTo ? "Up to $" : "$"}</span>
            <input
              id="v2-funnel-budget"
              autoFocus
              inputMode="numeric"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="50"
              aria-invalid={budgetProblem !== null}
              className={`k-input w-[120px] px-2.5 tabular-nums ${budgetProblem ? "shadow-[inset_0_0_0_1px_var(--data-rose)]" : ""}`}
            />
          </div>
          <PeriodPicker value={budgetPer} onChange={setBudgetPer} label={`${words.budget} period`} />
          <p className={`mt-1.5 text-[12px] leading-[18px] ${budgetProblem ? "text-[var(--data-rose)]" : "k-fg3"}`}>
            {budgetProblem ?? (upTo ? "The most this campaign spends." : "We stop reaching new people once it is spent.")}
          </p>

          <label htmlFor="v2-funnel-volume" className="k-label mt-5 block">
            {words.volume}
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            {upTo && <span className="k-fg2">Up to</span>}
            <input
              id="v2-funnel-volume"
              inputMode="numeric"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              placeholder="200"
              aria-invalid={volumeProblem !== null}
              className={`k-input w-[120px] px-2.5 tabular-nums ${volumeProblem ? "shadow-[inset_0_0_0_1px_var(--data-rose)]" : ""}`}
            />
            <span className="k-fg2">{volumeUnitWords(caps?.maxVolume?.unit ?? null, type, 2)}</span>
          </div>
          <PeriodPicker value={volumePer} onChange={setVolumePer} label={`${words.volume} period`} />
          <p className={`mt-1.5 text-[12px] leading-[18px] ${volumeProblem ? "text-[var(--data-rose)]" : "k-fg3"}`}>
            {volumeProblem ?? "Leave it empty for no limit."}
          </p>

          {!upTo && <p className="k-fg2 mt-5 text-[12px] leading-[18px]">Replies still get answered once a limit is reached.</p>}
          {error !== null && (
            <p role="alert" className="mt-3 text-[13px] text-[var(--data-rose)]">
              {status === 400 ? "These limits are not allowed." : "We could not save your limits. Try again in a moment."}
            </p>
          )}
          <div className="mt-5 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} disabled={isPending} className="k-btn-ghost">
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

/** The (i) of the Type column: the difference between the two kinds, in plain words. */
const TYPE_TIP =
  "Proactive campaigns reach new people every day, within their budget. Reactive campaigns wait for something to happen, like a positive reply, then act on it.";

/**
 * The campaign's path on one line, as features-service serves it: step labels, with the channel
 * between the two steps of each leg we run ("Lead found → [Sales Cold Email Outreach] → Positive
 * reply → Paid client"). The chip is the staff pipe rows' own (`ChannelChip`); nothing is parsed.
 */
export function FunnelPathLine({ items }: { items: FunnelPathItem[] }) {
  const channels = useAcquisitionChannels();
  return (
    <span className="k-fg2 flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap text-[11px]">
      {items.map((it, i) => (
        <span key={i} className="contents">
          {i > 0 && <span className="k-fg3">→</span>}
          {it.kind === "step" ? (
            <span className="shrink-0">{it.label}</span>
          ) : (
            <ChannelChip name={it.name} def={channels.find((d) => d.featureSlug === it.slug)} notRun={false} compact />
          )}
        </span>
      ))}
    </span>
  );
}

/** The Type tag: [calendar Daily] for a proactive campaign, [lightning <trigger>] for a reactive one, both served. */
function TypeTag({ row }: { row: FunnelCampaignRow }) {
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
 * The offer's campaigns (owner spec 2026-10-11, token for token): Campaign (face, name, path), Type
 * (i), ROI, $ Invested, Status (the on/off control, green with the budget when on). Rows are
 * campaign-service's list (fresh after a status write); columns 1-4 read features-service's row for
 * the same campaign id, the budget billing's caps.
 */
export function FunnelCampaignsSection({ orgId, brandId, offerId }: { orgId: string; brandId: string; offerId: string }) {
  const q = useFunnelCampaigns(brandId, offerId);
  const rowsQ = useAuthQuery(["funnelCampaignRows", brandId, offerId], () => listFunnelCampaignRows(brandId, offerId), pollOptions);
  const rowById = useMemo(() => new Map((rowsQ.data ?? []).map((r) => [r.id, r])), [rowsQ.data]);
  const rowsSettled = rowsQ.data !== undefined || rowsQ.isFetchedAfterMount;
  const campaigns = q.data ?? [];
  const settled = q.data !== undefined || q.isFetchedAfterMount;
  if (settled && !q.data && q.isError) {
    return <p className="mb-6 text-[13px] text-[var(--data-rose)]">Could not read this offer&apos;s campaigns.</p>;
  }
  return (
    <section className="mb-8">
      <SectionTitle count={settled ? campaigns.length : null}>Campaigns</SectionTitle>
      <p className="k-fg2 -mt-1 mb-3 text-[13px]">Each one runs within its limits.</p>
      {!settled ? (
        <div className="space-y-2">
          <Shimmer className="h-12 rounded-[10px]" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="k-card">
          <EmptyNote>No campaign yet.</EmptyNote>
        </div>
      ) : (
        <div className="k-card overflow-hidden">
          <div className="k-scroll overflow-x-auto">
            <table className="w-full min-w-[920px] text-[13px]">
              <thead>
                <tr className="k-line-subtle border-b">
                  <th className="k-label w-[48%] px-3 py-2.5 pl-4 text-left font-normal">Campaign</th>
                  <th className="k-label px-3 py-2.5 text-left font-normal">
                    <span className="inline-flex items-center gap-1">
                      Type
                      <InfoTooltip tip={TYPE_TIP} placement="bottom" />
                    </span>
                  </th>
                  <th className="k-label px-3 py-2.5 text-right font-normal">ROI</th>
                  <th className="k-label px-3 py-2.5 text-right font-normal">$ Invested</th>
                  <th className="k-label w-[190px] px-3 py-2.5 pr-4 text-right font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <FunnelCampaignRow key={c.id} orgId={orgId} campaign={c} row={rowById.get(c.id) ?? null} rowsSettled={rowsSettled} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function FunnelCampaignRow({
  orgId,
  campaign,
  row,
  rowsSettled,
}: {
  orgId: string;
  campaign: SalesFunnelCampaign;
  /** features-service's row for this campaign (path, type label, money); null when not served. */
  row: FunnelCampaignRow | null;
  rowsSettled: boolean;
}) {
  const router = useRouter();
  const prefetch = useRoutePrefetch();
  const caps = useFunnelCaps(campaign);
  const [editing, setEditing] = useState(false);
  const href = v2CampaignHref(orgId, campaign.brandId, campaign.id);
  const capsSettled = caps.data !== undefined || caps.isFetchedAfterMount;
  const c = caps.data ?? null;
  const on = isFunnelCampaignOn(campaign);
  const b = c?.maxBudget ?? null;
  const reactive = (row?.type ?? funnelTypeOf(c)) === "reactive";
  // ON + Reactive: "Up to $N/<period>"; ON + Proactive: "$N/<period>" (owner 2026-10-11).
  const onLabel = !capsSettled ? "On" : b ? `${reactive ? "Up to " : ""}${maxBudgetLabel(b)}` : "On";
  const notFunded = capsSettled && c !== null && !b;
  const roi = row ? funnelRoiShown(row) : { learning: false, value: null, unpriced: null };
  useEffect(() => {
    if (!rowsSettled) return;
    if (!row) console.error("[funnel-campaigns] features-service served no row for this campaign", { id: campaign.id });
    else if (row.roiMultiple === null && !funnelRoiShown(row).learning && !funnelRoiShown(row).unpriced) console.error("[funnel-campaigns] roiMultiple not served", { id: row.id, reason: roiMissingReason(row) });
    if (row && row.investedUsd === null) console.error("[funnel-campaigns] investedUsd not served", { id: row.id });
    if (row && !row.path) console.error("[funnel-campaigns] path not served", { id: row.id, reason: row.copyUnavailableReason ?? null });
  }, [row, rowsSettled, campaign.id]);
  // The status control and its menu / modal never open the page.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const cell = (node: React.ReactNode) => (!rowsSettled ? <Shimmer className="ml-auto h-4 w-14 rounded" /> : node);
  return (
    <tr
      className={`k-row k-line-subtle h-14 cursor-pointer border-b last:border-b-0 ${on ? "bg-[color-mix(in_oklab,var(--run)_9%,transparent)]" : ""}`}
      onClick={() => router.push(href)}
      onMouseEnter={() => prefetch(href)}
      onFocus={() => prefetch(href)}
    >
      <td className="max-w-0 px-3 py-2 pl-4">
        <MarkLines mark={(px) => <FunnelFace name={campaign.salesFunnelName} size={px} />}>
          <span className="block truncate font-semibold">{campaign.salesFunnelName}</span>
          {row?.path ? <FunnelPathLine items={row.path.items} /> : rowsSettled ? <span className="k-fg4 block text-[11px]">—</span> : <Shimmer className="h-3 w-48 rounded" />}
        </MarkLines>
      </td>
      <td className="px-3 py-2">{cell(row ? <TypeTag row={row} /> : DASH)}</td>
      <td className={`px-3 py-2 text-right font-semibold tabular-nums ${roi.value != null && roiIsGood(roi.value) ? "text-[var(--run)]" : ""}`}>
        {cell(
          roi.learning ? (
            <span className="k-chip font-normal">Learning</span>
          ) : roi.value != null ? (
            formatRoi(roi.value)
          ) : row ? (
            <span className="k-fg3 text-[12px] font-normal">{unpricedWords(roi.unpriced)}</span>
          ) : (
            DASH
          ),
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{cell(row?.investedUsd != null ? formatUsdAdaptive(row.investedUsd) : DASH)}</td>
      <td className="px-3 py-2 pr-4 text-right" onClick={stop}>
        <FunnelCampaignStatus campaign={campaign} onLabel={onLabel} />
        {on && notFunded && (
          <button type="button" onClick={() => setEditing(true)} className="mt-1 block w-full text-right text-[11.5px] text-[var(--data-amber)] hover:underline">
            Not funded yet · Set a budget
          </button>
        )}
        {editing && <FunnelLimitsModal campaign={campaign} caps={c} onClose={() => setEditing(false)} />}
      </td>
    </tr>
  );
}

/**
 * One sales-funnel campaign as a line of a card listing campaigns (Today): face, name, status,
 * then its max budget and what this period spent (billing). Opens the campaign.
 */
export function FunnelCampaignLine({ orgId, campaign }: { orgId: string; campaign: SalesFunnelCampaign }) {
  const caps = useFunnelCaps(campaign);
  const b = caps.data?.maxBudget ?? null;
  const settledCaps = caps.data !== undefined || caps.isFetchedAfterMount;
  return (
    <Link href={v2CampaignHref(orgId, campaign.brandId, campaign.id)} className="k-hover block px-4 py-3 first:rounded-t-[12px] last:rounded-b-[12px]">
      <MarkLines gap="gap-3" mark={(px) => <FunnelFace name={campaign.salesFunnelName} size={px} />}>
        <span className="flex items-center gap-3">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{campaign.salesFunnelName}</span>
          <StateDot running={isFunnelCampaignOn(campaign)} hold={isFunnelCampaignOn(campaign) ? null : paymentHoldKind(campaign)} />
        </span>
        <span className="k-fg3 mt-1.5 flex items-center justify-between gap-2 text-[12px] tabular-nums">
          <span className="truncate">{!settledCaps ? " " : b ? statedBudget(funnelTypeOf(caps.data ?? null), b) : "Not funded yet"}</span>
          <span className="shrink-0">
            {b && b.consumedCents !== null ? `${formatCapUsd(b.consumedCents)} spent ${capWindowWords(b.period)}` : "—"}
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
  const { missionByCampaignId, settled } = useMissions(orgId, brandId, { allOffers: true });
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
                  <th className="k-label px-3 py-2.5 text-right font-normal">ROI</th>
                  <th className="k-label px-3 py-2.5 text-right font-normal"># Outcomes</th>
                  <th className="k-label px-3 py-2.5 text-right font-normal">$ Value</th>
                  <th className="k-label px-3 py-2.5 text-right font-normal">$ / Outcome</th>
                  <th className="k-label px-3 py-2.5 pr-4 text-right font-normal">$ Invested</th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => {
                  const mission: Mission | null = missionByCampaignId.get(u.campaignId) ?? null;
                  const def = channels.find((d) => d.featureSlug === u.featureSlug);
                  // The step reads off the leg catalogue, so a part that never ran still says what it does.
                  const leg = mission?.leg ?? legFor(catalogue, u.legKey);
                  if (settled && !def) console.error("[funnel-campaigns] a part's channel is not in the catalogue", { featureSlug: u.featureSlug });
                  const href = mission?.href ?? null;
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
                      <CampaignResultCells mission={mission} basis={basis} />
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
 * step's own served figures). No max budget = not funded: the page says so and asks for one.
 */
export function FunnelCampaignPage({ campaign }: { campaign: SalesFunnelCampaign }) {
  const { orgId } = useParams<{ orgId: string }>();
  const caps = useFunnelCaps(campaign);
  const [editing, setEditing] = useState(false);
  const capsSettled = caps.data !== undefined || caps.isFetchedAfterMount;
  const c = caps.data ?? null;
  const notFunded = capsSettled && c !== null && c.maxBudget === null;
  const b = c?.maxBudget ?? null;
  const v = c?.maxVolume ?? null;
  // The campaign's type picks the words (owner 2026-10-10): Proactive "Max budget", Reactive "Up to $X".
  const type = funnelTypeOf(c);
  const words = capWords(type);
  return (
    <V2Page
      crumbs={[{ label: "Campaigns", href: v2Href(orgId, campaign.brandId, "campaigns") }, { label: campaign.salesFunnelName }]}
      title={
        <span className="flex min-w-0 items-center gap-2.5">
          <FunnelFace name={campaign.salesFunnelName} size={32} />
          <span className="truncate">{campaign.salesFunnelName}</span>
        </span>
      }
      actions={
        <>
          {capsSettled && !(caps.isError && !c) && <FunnelLimitsButton campaign={campaign} caps={c} />}
          <FunnelCampaignStatus campaign={campaign} />
        </>
      }
      width="max-w-[1280px]"
    >
      <div className="space-y-8">
        {notFunded && (
          // keel.css is unlayered, so a bg-* utility on a k-card loses: the amber tint rides an inline style.
          <div
            className="k-card flex flex-wrap items-center gap-3 px-4 py-3"
            style={{ background: "color-mix(in oklab, var(--data-amber) 10%, var(--bg-raised))" }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium">Not funded yet</p>
              <p className="k-fg2 text-[13px]">Set a budget so this campaign can run.</p>
            </div>
            <button type="button" className="k-btn-accent" onClick={() => setEditing(true)}>
              Set a budget
            </button>
          </div>
        )}

        <section>
          <SectionTitle>Limits</SectionTitle>
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
        </section>

        <FunnelResults orgId={orgId} brandId={campaign.brandId} units={campaign.units} />
      </div>
      {editing && <FunnelLimitsModal campaign={campaign} caps={c} onClose={() => setEditing(false)} />}
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

