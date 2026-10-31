"use client";

import { Fragment } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getFunnelCampaignFactoryShadow, getSalesFunnelCampaignPlanChanges } from "@/lib/api";
import {
  confidenceWords,
  isLowConfidence,
  pickSourceWords,
  pricedRunning,
  runningUnavailable,
  unavailableWords,
  type FactoryPlanLine,
  type FactoryShadowPick,
  type FactoryShadowPlan,
} from "@/lib/factory-shadow";
import type { SalesFunnelCampaign } from "@/lib/sales-funnel-campaigns";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { formatUsdAdaptive } from "@/lib/format-number";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { legFor, stepLabel, type LegCatalogue } from "@/lib/legs";
import { featureLegId } from "@/lib/outbound-leg-key";
import { useStaffMode } from "@/lib/use-staff-mode";
import { ServedPipeMark } from "@/components/v2/served-pipe-mark";
import { RoiLabel } from "@/components/v2/roi-label";
import { ExpectedLabel } from "@/components/v2/offer-sales-paths";
import { EmptyNote, SectionTitle, Shimmer } from "@/components/v2/ui";
import { DRAINING_WORDS, followsPlanWords, isDraining, planStateWords, type PlanChange } from "@/lib/plan-following";
import { useStaffCatalogueObject } from "@/components/v2/staff-catalogue-data";
import { BriefField } from "@/components/v2/campaign-brief-field";

/**
 * GTM FACTORY STEP 1 on the campaign page, STAFF MODE ONLY (owner 2026-10-28, FACTORY-P1-DASH): what the campaign
 * AIMS at (its Target, campaign-service), its STRATEGY in the owner's words (its brief, editable here), and whether
 * the factory would run it differently (features-service's stored shadow pass: per pipe the play running vs the play
 * Jev picks from the brief, the running line vs the best line to the Target now, each with its expected $ per Target
 * and ROI). The owner's check before switching a client campaign to follow its plan. Nothing here changes what runs,
 * and every figure is served: no cost, ROI or "differs" is worked out in the browser.
 */

const DASH = <span className="k-fg4">—</span>;
const ROSE = "var(--data-rose)";
const COST_PER_TARGET_TIP =
  "What one Target costs on this line: each pipe's own cost per outcome times the outcomes it needs per Target. Expected, from each step's rate.";

export function useFactoryShadow(brandId: string, campaignId: string, enabled: boolean) {
  return useAuthQuery(["factoryShadowPlan", brandId, campaignId], () => getFunnelCampaignFactoryShadow(brandId, campaignId), {
    ...pollOptions,
    enabled,
    retry: false,
  });
}

const utcTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });

/** Staff mode only; a customer session renders (and reads) nothing. */
export function FactoryPlanSection({ campaign, type }: { campaign: SalesFunnelCampaign; type: React.ReactNode }) {
  const { staffMode } = useStaffMode();
  if (!staffMode) return null;
  return <FactoryPlanBody campaign={campaign} type={type} />;
}

/** `type` = the page's own Type tag (📅 Daily / ⚡ <trigger>, the Campaigns table's words), drawn under the Target. */
function FactoryPlanBody({ campaign, type }: { campaign: SalesFunnelCampaign; type: React.ReactNode }) {
  const catalogue = useLegCatalogue();
  const shadowQ = useFactoryShadow(campaign.brandId, campaign.id, true);
  const shadow = shadowQ.data ?? null;
  const settled = shadowQ.data !== undefined || shadowQ.isFetchedAfterMount;
  // campaign-service's Target; the factory falls back on the funnel's last step while none is stated.
  const targetKey = campaign.target ?? shadow?.plan?.target ?? null;
  const targetLabel = stepLabel(catalogue, targetKey);
  return (
    <section>
      <SectionTitle right={shadow ? <span>Computed {utcTime(shadow.computedAt)} UTC · every 3 h</span> : undefined}>Target, brief and plan</SectionTitle>
      <div className="k-card divide-y divide-[var(--line-subtle)]">
        <div className="grid gap-4 px-4 py-3.5 md:grid-cols-[240px_minmax(0,1fr)]">
          <div className="min-w-0">
            <p className="k-label">Target</p>
            <p className="mt-1.5 text-[14px] font-medium">
              {targetLabel ?? (targetKey ? <span className="k-mono k-fg2 text-[12px]">{targetKey}</span> : DASH)}
            </p>
            {!campaign.target && shadow?.plan?.targetSource === "funnel_last_step" && <p className="k-fg3 mt-0.5 text-[12px]">None stated: the funnel&apos;s last step</p>}
            <div className="mt-2">{type}</div>
          </div>
          <div className="min-w-0">
            <p className="k-label">Brief</p>
            <div className="mt-1">
              <BriefField
                campaign={campaign}
                placeholder="The strategy in your words: who to reach, how, what to avoid."
                emptyText="No brief yet: every pipe runs its default play."
                updatedNote={(at) => `Updated ${utcTime(at)} UTC. Jev reads it on the next pass.`}
              />
            </div>
          </div>
        </div>
        {campaign.followsPlan != null && <PlanSwitchRow campaign={campaign} />}
        <PlanChangesRow campaignId={campaign.id} />
        {!settled ? (
          <div className="space-y-2 px-4 py-3.5">
            <Shimmer className="h-5 w-2/3" />
            <Shimmer className="h-10 w-full" />
            <Shimmer className="h-10 w-full" />
          </div>
        ) : shadowQ.isError && !shadow ? (
          <EmptyNote>Could not read the plan. Retrying.</EmptyNote>
        ) : !shadow ? (
          <EmptyNote>No plan yet: the factory covers this campaign on its next pass, every 3 hours.</EmptyNote>
        ) : (
          <PlanBlock shadow={shadow} catalogue={catalogue} targetLabel={targetLabel ?? targetKey ?? "the Target"} />
        )}
      </div>
      {shadow && shadow.picks.length > 0 && <PicksTable picks={shadow.picks} />}
    </section>
  );
}

// ─── The plan switch (campaign-service #808), read only ───

/**
 * Whether this campaign follows its plan (staff switch, off by default: a fixed funnel), the plan follower's last
 * check in words, and every part whose pipe left the plan ("Finishing its follow-ups": it answers the people it already
 * owes, takes no new people). Read only: the switch is turned on by staff outside this page.
 */
function PlanSwitchRow({ campaign }: { campaign: SalesFunnelCampaign }) {
  const follows = campaign.followsPlan === true;
  const check = campaign.planCheck ?? null;
  const state = check ? planStateWords(check.state) : null;
  const draining = campaign.units.filter(isDraining);
  return (
    <div className="grid gap-4 px-4 py-3.5 md:grid-cols-[240px_minmax(0,1fr)]">
      <div className="min-w-0">
        <p className="k-label">Runs</p>
        <p className="mt-1.5 inline-flex items-center gap-1.5 text-[14px] font-medium">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: follows ? "var(--run)" : "var(--fg-4)" }} aria-hidden="true" />
          {followsPlanWords(follows)}
        </p>
        <p className="k-fg3 mt-0.5 text-[12px]">{follows ? "This campaign runs its plan and follows each change." : "This campaign keeps its funnel. The plan is shadow only."}</p>
      </div>
      <div className="min-w-0 space-y-1.5">
        <p className="k-label">Last plan check</p>
        {check && state ? (
          <p className="text-[13px]">
            <span style={state.red ? { color: ROSE } : undefined}>{state.words}</span>
            <span className="k-mono k-fg2 ml-2 text-[12px]">{utcTime(check.checkedAt)} UTC</span>
            {check.detail && <span className="k-fg3 block text-[12px]">{check.detail}</span>}
          </p>
        ) : (
          <p className="k-fg3 text-[13px]">Never checked</p>
        )}
        {draining.length > 0 && (
          <ul className="space-y-1 pt-1">
            {draining.map((u) => (
              <li key={u.campaignId} className="flex flex-wrap items-center gap-2 text-[13px]">
                <ServedPipeMark pipeId={u.pipeId} size={16} />
                <span>{u.name}</span>
                <span className="k-chip" style={{ color: "var(--data-amber)" }}>
                  {DRAINING_WORDS}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Plan changes (campaign-service #808 via api-service #1411), read only ───

/** Shown only once the read answers with at least one change: no row while loading, failed or empty. */
function PlanChangesRow({ campaignId }: { campaignId: string }) {
  const q = useAuthQuery(["salesFunnelPlanChanges", campaignId], () => getSalesFunnelCampaignPlanChanges(campaignId), { ...pollOptions, retry: false });
  const changes = q.data?.changes ?? [];
  if (changes.length === 0) return null;
  return (
    <div className="grid gap-4 px-4 py-3.5 md:grid-cols-[240px_minmax(0,1fr)]">
      <div className="min-w-0">
        <p className="k-label">Plan changes</p>
        <p className="mt-1.5 text-[14px] font-medium tabular-nums">{changes.length}</p>
      </div>
      <ul className="min-w-0 space-y-2">
        {changes.map((c) => (
          <PlanChangeLine key={c.id} change={c} />
        ))}
      </ul>
    </div>
  );
}

function PlanChangeLine({ change }: { change: PlanChange }) {
  return (
    <li className="grid grid-cols-[120px_minmax(0,1fr)] items-start gap-x-2 text-[12px]">
      <span className="k-mono k-fg2 pt-0.5">{utcTime(change.appliedAt)} UTC</span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <FunnelPipes salesFunnelId={change.fromSalesFunnelId} />
        <span className="k-fg3" aria-label="to">
          →
        </span>
        <FunnelPipes salesFunnelId={change.toSalesFunnelId} />
      </span>
    </li>
  );
}

/** A sales funnel as its pipes, each by its served mark and name (features-service catalogue). */
function FunnelPipes({ salesFunnelId }: { salesFunnelId: string }) {
  const q = useStaffCatalogueObject("sales-funnels", salesFunnelId);
  const funnel = q.data;
  if (!funnel) {
    if (q.isError) return <span className="k-mono k-fg3 text-[11px]">{salesFunnelId}</span>;
    return <Shimmer className="h-5 w-40" />;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {funnel.legs.map((l, i) =>
        l.pipe ? (
          <span key={`${l.legKey}-${i}`} className="k-chip inline-flex items-center gap-1">
            <ServedPipeMark pipeId={l.pipe.id} size={14} />
            {l.pipe.name ?? <span className="k-mono">{l.pipe.id}</span>}
          </span>
        ) : (
          <span key={`${l.legKey}-${i}`} className="k-chip k-fg3 k-mono">
            {l.legKey}
          </span>
        ),
      )}
    </span>
  );
}

// ─── Plan: one sentence, then Running vs Best now ───

/** "Lead Sourcing (Lead follow-up due) → AI Follow-up Email → …": the line's pipes by their served names. */
function pipeNames(line: FactoryPlanLine): string {
  return line.legs.map((l) => (l.channelName ?? l.legKey) + (l.strategyName ? ` (${l.strategyName})` : "")).join(", then ");
}

function planSentence(shadow: FactoryShadowPlan, targetLabel: string): { text: string; red: boolean } {
  const plan = shadow.plan;
  if (!plan) return { text: `No plan: ${unavailableWords(shadow.failure) ?? "the campaign could not be read"}.`, red: true };
  const changing = shadow.picks.filter((p) => p.differs === true).map((p) => p.channelName);
  if (plan.planDiffers === true && plan.shadow) {
    return { text: `If this campaign followed its plan, it would run ${pipeNames(plan.shadow)} instead.`, red: false };
  }
  if (plan.planDiffers === false) {
    return changing.length
      ? { text: `It runs the best line to ${targetLabel}. Following its brief would change the play on ${changing.join(", ")}.`, red: false }
      : { text: `It already runs the best line to ${targetLabel}, with the plays its brief asks for.`, red: false };
  }
  const why = unavailableWords(plan.shadowUnavailableReason) ?? unavailableWords(runningUnavailable(plan.running)) ?? unavailableWords(shadow.failure);
  return { text: `No comparison yet: ${why ?? "one of the two lines is missing"}.`, red: shadow.status !== "ok" };
}

function PlanBlock({ shadow, catalogue, targetLabel }: { shadow: FactoryShadowPlan; catalogue: LegCatalogue; targetLabel: string }) {
  const plan = shadow.plan;
  const sentence = planSentence(shadow, targetLabel);
  const running = pricedRunning(plan?.running ?? null);
  const best = plan?.shadow ?? null;
  return (
    <>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3">
        <p className="min-w-0 flex-1 text-[14px] font-medium leading-5" style={sentence.red ? { color: ROSE } : undefined}>
          {sentence.text}
        </p>
        {plan?.planDiffers === true && (
          <span className="k-chip shrink-0" style={{ color: "var(--data-amber)" }}>
            Differs
          </span>
        )}
      </div>
      {plan && (
        <div className="k-scroll overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="k-line-subtle border-y">
                <th className="k-label w-[110px] px-3 py-2.5 text-left font-medium first:pl-4" />
                <th className="k-label px-3 py-2.5 text-left font-medium">Pipes</th>
                <th className="k-label w-[130px] px-3 py-2.5 text-right font-medium">
                  <span className="inline-flex justify-end">
                    <ExpectedLabel tip={COST_PER_TARGET_TIP}>$ / Target</ExpectedLabel>
                  </span>
                </th>
                <th className="k-label w-[110px] px-3 py-2.5 pr-4 text-right font-medium">
                  <span className="inline-flex justify-end">
                    <RoiLabel />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              <LineRow
                label="Running"
                line={running}
                missing={unavailableWords(runningUnavailable(plan.running)) ?? (plan.running ? null : "not read")}
                catalogue={catalogue}
                startStep={plan.startStep}
              />
              <LineRow label="Best now" line={best} missing={unavailableWords(plan.shadowUnavailableReason)} catalogue={catalogue} startStep={plan.startStep} />
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function LineRow({
  label,
  line,
  missing,
  catalogue,
  startStep,
}: {
  label: string;
  line: FactoryPlanLine | null;
  missing: string | null;
  catalogue: LegCatalogue;
  startStep: string | null;
}) {
  const f = line?.figures ?? null;
  const why = f ? unavailableWords(f.unavailableReason) : null;
  return (
    <tr className="k-line-subtle border-b last:border-b-0">
      <td className="k-label px-3 py-2.5 pl-4 align-top">{label}</td>
      <td className="px-3 py-2 align-top">
        {line ? <PipeLine line={line} catalogue={catalogue} startStep={startStep} /> : <span className="k-fg3 text-[12px]">{missing ?? "—"}</span>}
      </td>
      <td className="px-3 py-2.5 text-right align-top tabular-nums">
        {f?.costPerTargetUsd != null ? formatUsdAdaptive(f.costPerTargetUsd) : f ? <span className="k-fg3 text-[12px]">{why ?? "—"}</span> : DASH}
        {f?.basis && <p className="k-fg3 text-[11px]">{f.basis} rates</p>}
      </td>
      <td className="px-3 py-2.5 pr-4 text-right align-top tabular-nums">
        {f?.roi != null ? <span className={roiIsGood(f.roi) ? "text-[var(--run)]" : ""}>{formatRoi(f.roi)}</span> : f && f.costPerTargetUsd != null && why ? <span className="k-fg3 text-[12px]">{why}</span> : DASH}
      </td>
    </tr>
  );
}

/** Start step → [pipe mark + served name, its play as a tag] → step → … → Target, each step named by the catalogue. */
function PipeLine({ line, catalogue, startStep }: { line: FactoryPlanLine; catalogue: LegCatalogue; startStep: string | null }) {
  const first = line.legs[0] ? legFor(catalogue, line.legs[0].legKey) : null;
  const start = first?.fromLabel ?? stepLabel(catalogue, startStep) ?? (startStep ? startStep : "Start");
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]">
      <span className="k-fg2">{start}</span>
      {line.legs.map((l, i) => {
        const leg = legFor(catalogue, l.legKey);
        const pipeId = l.channelSlug ? featureLegId(l.channelSlug, l.legKey) : l.pipeId;
        return (
          <Fragment key={`${l.legKey}-${i}`}>
            <span className="k-fg3">→</span>
            <span className="k-chip inline-flex items-center gap-1">
              <ServedPipeMark pipeId={pipeId} size={14} />
              {l.channelName ?? l.legKey}
            </span>
            {l.strategyName && <span className="k-fg3 text-[11px]">{l.strategyName}</span>}
            <span className="k-fg3">→</span>
            <span className="k-fg2">{leg?.toLabel ?? <span className="k-mono">{l.legKey}</span>}</span>
          </Fragment>
        );
      })}
    </span>
  );
}

// ─── Per pipe: the play running vs Jev's pick from the brief ───

function PicksTable({ picks }: { picks: FactoryShadowPick[] }) {
  return (
    <div className="mt-6">
    <SectionTitle count={picks.length}>Play per pipe</SectionTitle>
    <div className="k-card overflow-hidden">
      <div className="k-scroll overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead>
            <tr className="k-line-subtle border-b">
              <th className="k-label px-3 py-2.5 pl-4 text-left font-medium">Pipe</th>
              <th className="k-label px-3 py-2.5 text-left font-medium">Play running</th>
              <th className="k-label px-3 py-2.5 text-left font-medium">Jev&apos;s pick from the brief</th>
              <th className="k-label w-[150px] px-3 py-2.5 pr-4 text-right font-medium">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {picks.map((p) => (
              <tr key={p.basePipeId} className="k-row k-line-subtle border-b last:border-b-0">
                <td className="px-3 py-2 pl-4">
                  <span className="inline-flex items-center gap-2">
                    <ServedPipeMark pipeId={p.basePipeId} size={16} />
                    <span className="truncate">{p.channelName}</span>
                    {!p.inRunningFunnel && <span className="k-fg3 text-[11px]">on a candidate line only</span>}
                  </span>
                </td>
                <td className="px-3 py-2">{p.runningPlayName ?? DASH}</td>
                <td className="px-3 py-2">
                  {p.pickedPlayName ? (
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      {p.pickedPlayName}
                      {p.differs === true && (
                        <span className="k-chip" style={{ color: "var(--data-amber)" }}>
                          Differs
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-[12px]" style={{ color: ROSE }}>
                      {p.failure ? `Jev failed: ${p.failure}` : "No pick"}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 pr-4 text-right tabular-nums">
                  {confidenceWords(p.confidence) ? (
                    <span style={isLowConfidence(p.confidence) ? { color: ROSE } : undefined}>{confidenceWords(p.confidence)}</span>
                  ) : (
                    <span className="k-fg3 text-[12px]">{pickSourceWords(p.source) ?? "—"}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}
