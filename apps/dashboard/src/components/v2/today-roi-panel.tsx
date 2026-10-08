"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import {
  getBrandConversionRates,
  stateBrandLegRates,
  type ColdPipelineLead,
  type EffectiveLegRate,
  type OfferLadderStep,
  type OfferPipeline,
  type PipelineLead,
  type StepValueExplanation,
} from "@/lib/api";
import { invalidateConversionRates } from "@/lib/write-invalidation";
import { legRateFor } from "@/lib/offer-channel-settings";
import { formatCount, formatUsdAdaptive } from "@/lib/format-number";
import { friendlyDate } from "@/lib/friendly-datetime";
import { InlineRate } from "@/components/v2/offer-channels-page";
import { CompanyMark } from "@/components/v2/people-bits";
import { EmptyNote, Initials, Shimmer } from "@/components/v2/ui";

/** What the Today panel shows: one step of the pipeline, or one lead. */
export type TodayPanelTarget =
  | { kind: "step"; stepKey: string }
  | { kind: "lead"; lead: PipelineLead | ColdPipelineLead; group: "hot" | "lost" };

const pct = (v: number) => `${v < 10 ? v.toFixed(1) : Math.round(v)}%`;

/** Where a served leg rate comes from, in the customer's words. */
function sourceWords(leg: StepValueExplanation["legs"][number]): string {
  if (leg.source === "measured") {
    const { measured: m } = leg;
    const where = m?.basis === "crm" ? "in your CRM" : "on our leads";
    return m && m.fromReached != null && m.toReached != null
      ? `Measured ${where}: ${formatCount(m.toReached)} of ${formatCount(m.fromReached)}`
      : `Measured ${where}`;
  }
  if (leg.source === "manual") return "Set by you";
  if (leg.source === "median") return "Median of our clients";
  if (leg.source === "default") return "Industry average";
  return "Source unknown";
}

const isCold = (l: PipelineLead | ColdPipelineLead): l is ColdPipelineLead => "coldAtStep" in l;
const leadName = (l: PipelineLead) => [l.firstName, l.lastName].filter(Boolean).join(" ") || l.orgName || "Unknown";

/**
 * The Today right panel (owner 2026-10-08): click a step or a lead, read why it is worth
 * what it is worth, change the rates behind it at brand level, and see the people. Every
 * figure is features-service's; the rates are the brand's effective rates, edited with
 * the same inline control and the same write as the Outbound page.
 */
export function TodayPanel({
  brandId,
  pipeline,
  target,
  onClose,
}: {
  brandId: string;
  pipeline: OfferPipeline | null;
  target: TodayPanelTarget;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  // Read after mount: the shell's #v2-portal is not committed on a first paint.
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.getElementById("v2-portal")), []);
  if (!host) return null;

  const stepKey = target.kind === "step" ? target.stepKey : target.lead.step.key;
  const step = pipeline?.ladder.find((s) => s.step.key === stepKey) ?? null;

  return createPortal(
    <aside
      role="dialog"
      aria-label={target.kind === "step" ? `${step?.step.label ?? "Step"} details` : `${leadName(target.lead)} details`}
      className="k-popover fixed inset-y-2 right-2 z-[80] flex w-[min(480px,calc(100vw-16px))] flex-col overflow-hidden"
    >
      <div className="k-line-subtle flex h-11 shrink-0 items-center justify-between border-b px-4">
        <span className="k-label">{target.kind === "step" ? "Step" : target.group === "hot" ? "Hot lead" : "Lost lead"}</span>
        <button type="button" onClick={onClose} aria-label="Close" className="k-btn-ghost h-7 w-7 justify-center px-0">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="k-scroll min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
        {target.kind === "step" ? (
          <StepBody step={step} brandId={brandId} />
        ) : (
          <LeadBody lead={target.lead} step={step} brandId={brandId} />
        )}
      </div>
    </aside>,
    host,
  );
}

function StepBody({ step, brandId }: { step: OfferLadderStep | null; brandId: string }) {
  if (!step) return <EmptyNote>This step is not readable right now.</EmptyNote>;
  const cold = step.wentCold;
  return (
    <>
      <div>
        <h2 className="text-[20px] font-medium leading-7 tracking-[-0.01em]">{step.step.label}</h2>
        <p className="k-fg2 mt-1 text-[13px] tabular-nums">
          {step.pricedRecipientsReached != null ? `${formatCount(step.pricedRecipientsReached)} thanks to us` : "\u00a0"}
        </p>
      </div>
      <div className="k-card grid grid-cols-2 divide-x divide-[var(--line-subtle)]">
        <div className="p-3">
          <p className="k-label">Worth each</p>
          <p className="mt-1 text-[20px] font-medium tabular-nums">{step.valuePerOutcomeUsd != null ? formatUsdAdaptive(step.valuePerOutcomeUsd) : "—"}</p>
        </div>
        <div className="p-3">
          <p className="k-label">Pipeline</p>
          <p className="mt-1 text-[20px] font-medium tabular-nums">{step.pricedValueUsd != null ? formatUsdAdaptive(step.pricedValueUsd) : "—"}</p>
        </div>
      </div>
      <WhySection why={step.valueExplanation} brandId={brandId} />
      {cold && cold.count > 0 && (
        <section>
          <p className="k-label mb-2">Considered lost</p>
          <p className="k-fg2 text-[13px]">
            {formatCount(cold.count)} reached this step thanks to us, then went quiet for too long
            {cold.valueUsd != null ? `. Worth ${formatUsdAdaptive(cold.valueUsd)} now.` : "."}
          </p>
        </section>
      )}
    </>
  );
}

function LeadBody({ lead, step, brandId }: { lead: PipelineLead | ColdPipelineLead; step: OfferLadderStep | null; brandId: string }) {
  const cold = isCold(lead);
  return (
    <>
      <LeadCard lead={lead} size="hero" />
      {cold && (
        <section>
          <p className="k-label mb-2">Why we consider it lost</p>
          <p className="k-fg2 text-[13px]">
            Reached {lead.step.label.toLowerCase()} on {friendlyDate(lead.stalledSince)}. No {lead.coldAtStep.label.toLowerCase()} since, so it
            counts as lost from {friendlyDate(lead.coldSince)}.
          </p>
        </section>
      )}
      <WhySection why={step?.valueExplanation ?? null} brandId={brandId} />
    </>
  );
}

/**
 * The lead's card. `hero` = reached it thanks to us and still alive (the most spacious),
 * `lost` = ours but gone quiet, `compact` = not from us.
 */
export function LeadCard({ lead, size }: { lead: PipelineLead | ColdPipelineLead; size: "hero" | "lost" | "compact" }) {
  const mark = size === "hero" ? 40 : size === "lost" ? 28 : 20;
  const sub = [lead.title, lead.orgName].filter(Boolean).join(" · ");
  return (
    <div className={`k-card flex min-w-0 items-center gap-3 ${size === "hero" ? "p-5" : size === "lost" ? "p-4" : "px-3 py-2.5"}`}>
      {lead.orgName ? <CompanyMark name={lead.orgName} domain={lead.orgDomain} size={mark} /> : <Initials name={leadName(lead)} size={mark} round />}
      <div className="min-w-0 flex-1">
        <p className={`truncate font-medium ${size === "hero" ? "text-[16px]" : "text-[13px]"}`}>{leadName(lead)}</p>
        {sub && <p className="k-fg2 truncate text-[12px]">{sub}</p>}
        <p className="k-fg3 truncate text-[12px]">Reached {lead.step.label.toLowerCase()}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`font-medium tabular-nums ${size === "hero" ? "text-[20px]" : "text-[13px]"}`}>
          {lead.valueUsd != null ? formatUsdAdaptive(lead.valueUsd) : "—"}
        </p>
        {lead.probabilityPct != null && <p className="k-fg3 text-[12px] tabular-nums">{pct(lead.probabilityPct)} chance</p>}
      </div>
    </div>
  );
}

/**
 * How a step is worth what it is worth: lifetime revenue x the chance, and each leg rate
 * that chance multiplies, with where it comes from and an inline edit at brand level.
 */
function WhySection({ why, brandId }: { why: StepValueExplanation | null; brandId: string }) {
  const qc = useQueryClient();
  const rates = useAuthQuery(["brandConversionRates", brandId], () => getBrandConversionRates(brandId), {
    ...pollOptions,
    enabled: !!brandId,
  });
  if (!why) return null;
  const save = async (rate: EffectiveLegRate, ratePct: number | null) => {
    if (rate.manualRatePct === ratePct) return;
    await stateBrandLegRates(brandId, [{ fromStep: rate.fromStep, toStep: rate.toStep, ratePct }]);
    // A rate prices every money figure, Today's pipeline included: re-read them all.
    invalidateConversionRates(qc);
    await qc.refetchQueries({ queryKey: ["brandConversionRates", brandId] });
  };
  return (
    <section>
      <p className="k-label mb-2">How we price it</p>
      <p className="text-[13px] tabular-nums">
        {formatUsdAdaptive(why.lifetimeRevenueUsd)} per client × {pct(why.probabilityPct)} chance to become one
      </p>
      {why.legs.length > 0 && (
        <ul className="k-card mt-3 divide-y divide-[var(--line-subtle)]">
          {why.legs.map((l) => {
            const rate = legRateFor(rates.data?.legs ?? [], l.legKey);
            return (
              <li key={l.legKey} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px]">
                    {l.fromStep.label} <span className="k-fg3">→</span> {l.toStep.label}
                  </p>
                  <p className="k-fg3 mt-0.5 text-[12px]">{sourceWords(l)}</p>
                </div>
                {/* Click the rate to change it: the brand's own rate, saved on leaving the field. */}
                <div className="shrink-0 text-[13px] font-medium">
                  {rates.data === undefined && !rates.isError ? (
                    <Shimmer className="h-5 w-12 rounded-[6px]" />
                  ) : rate ? (
                    <InlineRate key={`${rate.fromStep}|${rate.toStep}`} rate={rate} onSave={(v) => save(rate, v)} bare />
                  ) : (
                    <span className="tabular-nums">{pct(l.ratePct)}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="k-fg3 mt-2 text-[12px]">A rate you set applies to every offer of this brand.</p>
    </section>
  );
}
