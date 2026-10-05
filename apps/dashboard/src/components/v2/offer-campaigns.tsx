"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "@tanstack/react-query";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import {
  ApiError,
  getBrand,
  getOfferCampaignBudgets,
  saveOfferCampaignBudget,
  setCampaignStatus,
  type OfferCampaignBudgetItem,
} from "@/lib/api";
import { fmtDailyBudgetUsd } from "@/lib/campaign-budget";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { campaignKey, campaignTag, sortCampaigns, type OfferCampaign } from "@/lib/offer-campaigns";
import { channelWriteErrorMessage } from "@/lib/channel-start";
import { createCampaignForPair } from "@/lib/start-pair";
import { invalidateCampaignMoney } from "@/lib/write-invalidation";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { useMissions, type Mission } from "@/components/v2/use-missions";
import { EXPECTED_ROI_TIP } from "@/lib/offer-sales-paths";
import { ChannelChip, ExpectedLabel, PathAvatar } from "@/components/v2/offer-sales-paths";
import { EmptyNote, SectionTitle, Shimmer, StateDot } from "@/components/v2/ui";

/**
 * The offer's CAMPAIGNS (owner 2026-10-05): every channel x leg its sales paths use, with
 * its type, its ROI (features-service), an on/off status (campaign-service) and its budget
 * per day (billing, per offer): "$50/day" for a proactive one, "Up to $10/day" for a
 * reactive one (a max). Sorted on first, proactive first, ROI high to low; an on row reads
 * on a light green fill.
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
  const budgetsQ = useAuthQuery(["offerCampaignBudgets", brandId, offerId], () => getOfferCampaignBudgets(brandId, offerId));
  const budgetByKey = useMemo(() => {
    const m = new Map<string, OfferCampaignBudgetItem>();
    for (const i of budgetsQ.data?.items ?? []) m.set(campaignKey(i.featureSlug, i.legKey), i);
    return m;
  }, [budgetsQ.data]);

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
            <table className="w-full min-w-[880px] text-[13px]">
              <thead>
                <tr className="k-line-subtle border-b">
                  <th className="k-label px-3 py-2.5 pl-4 text-left font-normal">Campaign</th>
                  <th className="k-label px-3 py-2.5 text-left font-normal">Works</th>
                  <th className="k-label px-3 py-2.5 text-left font-normal">Type</th>
                  <th className="k-label px-3 py-2.5 text-right font-normal">
                    <ExpectedLabel tip={EXPECTED_ROI_TIP}>ROI</ExpectedLabel>
                  </th>
                  <th className="k-label w-[150px] px-3 py-2.5 text-right font-normal">Status</th>
                  <th className="k-label w-[170px] px-3 py-2.5 pr-4 text-right font-normal">Budget</th>
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
                      budget={budgetByKey.get(key) ?? null}
                      budgetPeriod={budgetsQ.data?.period ?? null}
                      budgetPending={!budgetsQ.isFetchedAfterMount && !budgetsQ.data}
                      budgetError={budgetsQ.isError && !budgetsQ.data}
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
  budget,
  budgetPeriod,
  budgetPending,
  budgetError,
}: {
  brandId: string;
  offerId: string;
  campaign: OfferCampaign;
  mission: Mission | null;
  /** The proactive campaign this one would take the plan from if turned on. */
  replaces: OfferCampaign | null;
  /** billing's row for this campaign; null when none is set. */
  budget: OfferCampaignBudgetItem | null;
  /** The org's budget period (day = prepaid / postpaid, month = plan subscriber). */
  budgetPeriod: "day" | "month" | null;
  budgetPending: boolean;
  budgetError: boolean;
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
      <td className="px-3 py-2 text-right">
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
      <td className="px-3 py-2 pr-4 text-right">
        <CampaignBudget
          brandId={brandId}
          offerId={offerId}
          campaign={campaign}
          budget={budget}
          period={budgetPeriod}
          pending={budgetPending}
          error={budgetError}
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
        onClick={(e) => openMenu(e.currentTarget)}
        className="k-btn gap-1.5"
      >
        <StateDot running={on} label={on ? "On" : "Off"} hold={on ? null : mission?.paymentHold ?? null} />
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

/**
 * The budget in the unit it was stated in: "$50/day", "$90/month", "Up to $9/month" for a
 * reactive one (a max), "Not set" when billing holds none. A subscriber's $99 plan reads
 * as "$90/month" + "Up to $9/month", never as its /30 daily pace ("$3/day").
 */
export function budgetLabel(campaign: Pick<OfferCampaign, "reactive">, cents: number | null, period: "day" | "month"): string {
  if (cents === null) return "Not set";
  const amount = `${fmtDailyBudgetUsd(cents)}/${period}`;
  return campaign.reactive ? `Up to ${amount}` : amount;
}

/**
 * The campaign's budget per day, billing's own figure. A button like the status one
 * opens a modal to change it. A plan subscriber reads it only: their budget follows the
 * plan, and changing it here would change what the plan costs.
 */
function CampaignBudget({
  brandId,
  offerId,
  campaign,
  budget,
  period,
  pending,
  error,
}: {
  brandId: string;
  offerId: string;
  campaign: OfferCampaign;
  budget: OfferCampaignBudgetItem | null;
  period: "day" | "month" | null;
  pending: boolean;
  error: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (pending) return <Shimmer className="ml-auto h-4 w-20 rounded" />;
  if (error || period === null) return <span className="k-fg3 text-[12px]">Could not load</span>;
  if (campaign.managed === false) return <span className="k-fg4">—</span>;

  // billing serves a row only for a campaign whose budget is set, in the period it was stated in.
  const unit = budget?.period ?? period;
  const label = budgetLabel(campaign, budget?.budgetCents ?? null, unit);
  const cents = budget?.budgetCents ?? null;
  if (period !== "day" || (budget && !budget.budgetable)) {
    return <span className="tabular-nums">{label}</span>;
  }
  return (
    <>
      <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)} className="k-btn gap-1.5 tabular-nums">
        <span className={cents === null ? "k-fg3" : ""}>{label}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="k-fg3">
          <path d="M2.5 4l2.5 2.5L7.5 4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <BudgetModal brandId={brandId} offerId={offerId} campaign={campaign} budget={budget} unit={unit} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Whole dollars typed in the field, or null when it is not a whole positive number. */
function parseWholeUsd(v: string): number | null {
  const t = v.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n > 0 ? n : null;
}

function BudgetModal({
  brandId,
  offerId,
  campaign,
  budget,
  unit,
  onClose,
}: {
  brandId: string;
  offerId: string;
  campaign: OfferCampaign;
  budget: OfferCampaignBudgetItem | null;
  unit: "day" | "month";
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [value, setValue] = useState(budget?.budgetCents ? String(Math.round(budget.budgetCents / 100)) : "");
  // A prepaid / postpaid org states a budget per day or per month (owner 2026-10-05:
  // "$90/month", burnt like a daily one, no pacing). Opens on the row's own period.
  const [per, setPer] = useState<"day" | "month">(unit);
  const { mutate, isPending, error } = useMutation({
    mutationFn: (usd: number) =>
      saveOfferCampaignBudget(brandId, offerId, { featureSlug: campaign.featureSlug, legKey: campaign.legKey, budgetCents: usd * 100 }, per),
    onSuccess: (data) => {
      qc.setQueryData(["offerCampaignBudgets", brandId, offerId], data);
      invalidateCampaignMoney(qc);
      onClose();
    },
    onError: (err) => console.error("[offer-campaigns] budget save failed", { campaign, err }),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, isPending]);

  const usd = parseWholeUsd(value);
  // A campaign with no budget yet has no row, so no floor or cap here: billing judges the write.
  // The row's floor and cap are in ITS period; in the other one billing judges too.
  const samePeriod = per === unit;
  const minUsd = samePeriod && budget?.minimumCents ? Math.ceil(budget.minimumCents / 100) : null;
  const maxUsd = samePeriod && budget?.capCents ? Math.floor(budget.capCents / 100) : null;
  const problem =
    value.trim() === ""
      ? null
      : usd === null
        ? "Type a whole number of dollars."
        : minUsd !== null && usd < minUsd
          ? `This channel needs at least $${minUsd.toLocaleString("en-US")} a ${per}.`
          : maxUsd !== null && usd > maxUsd
            ? `The most you can set here is $${maxUsd.toLocaleString("en-US")} a ${per}.`
            : null;
  const submittable = usd !== null && problem === null;
  const status = error instanceof ApiError ? error.status : null;
  const title = per === "month" ? (campaign.reactive ? "Monthly max" : "Monthly budget") : campaign.reactive ? "Daily max" : "Daily budget";

  if (typeof document === "undefined") return null;
  const host = document.getElementById("v2-portal") ?? document.body;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-[#1010121f] px-3 pt-[12vh]" onMouseDown={() => !isPending && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="v2-campaign-budget-title"
        className="k-popover flex w-full max-w-[400px] flex-col overflow-hidden text-left"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--line-subtle)] px-4">
          {campaign.name && <PathAvatar name={campaign.name} size={20} />}
          <span id="v2-campaign-budget-title" className="k-label">
            {campaign.name ?? campaign.channelName}
          </span>
          <button type="button" aria-label="Close" className="k-btn-ghost ml-auto h-7 w-7 justify-center p-0" onClick={onClose} disabled={isPending}>
            ×
          </button>
        </div>
        <form
          className="px-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (submittable && !isPending) mutate(usd);
          }}
        >
          <label htmlFor="v2-campaign-budget-input" className="k-label block">
            {title}
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="k-fg2">{campaign.reactive ? "Up to $" : "$"}</span>
            <input
              id="v2-campaign-budget-input"
              autoFocus
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="50"
              aria-invalid={problem !== null}
              className={`k-input w-[120px] px-2.5 tabular-nums ${problem ? "shadow-[inset_0_0_0_1px_var(--data-rose)]" : ""}`}
            />
            <div role="radiogroup" aria-label="Budget period" className="flex items-center gap-1">
              {(["day", "month"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={per === p}
                  onClick={() => setPer(p)}
                  className={per === p ? "k-btn-strong" : "k-btn-ghost"}
                >
                  / {p}
                </button>
              ))}
            </div>
          </div>
          <p className={`mt-1.5 text-[12px] leading-[18px] ${problem ? "text-[var(--data-rose)]" : "k-fg3"}`}>
            {problem ?? (campaign.reactive ? `We spend this much a ${per} at most, only when leads reach this step.` : `We spend up to this much a ${per} on this campaign.`)}
          </p>
          {error !== null && (
            <p role="alert" className="mt-3 text-[13px] text-[var(--data-rose)]">
              {status === 400 ? "This amount is not allowed for this channel." : "We could not save this budget. Try again in a moment."}
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
