"use client";

import { PlayIcon } from "@phosphor-icons/react/dist/csr/Play";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { stepLabel, type LegCatalogue } from "@/lib/legs";
import { formatUsdAdaptive, formatCount } from "@/lib/format-number";
import { formatRatePct } from "@/lib/brand-conversion-rates";
import {
  type EngineCandidateRow,
  type EnginePlaceFull,
  type FactoryShadowPlan,
  type PipeVerdict,
} from "@/lib/factory-shadow";
import { milestoneReasonWords, planLegsFromTarget, strategyOfPlace, type MilestoneValue, type PlanNode } from "@/lib/factory-campaign";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getFunnelCampaignMilestones, getFunnelCampaignPeopleJourneys } from "@/lib/api";
import { StepMark } from "@/components/marks/step-mark";
import { ServedPipeMark } from "@/components/v2/served-pipe-mark";
import { CatalogueName } from "@/components/v2/catalogue-name";
import { ExpectedLabel } from "@/components/v2/offer-sales-paths";
import { EmptyNote, SectionTitle, ShareBar, Shimmer } from "@/components/v2/ui";
import { useFactoryShadow } from "@/components/v2/factory-plan-card";
import type { SalesFunnelCampaign } from "@/lib/sales-funnel-campaigns";

/**
 * THE GTM FACTORY CAMPAIGN PAGE, for EVERY client (FACTORY-USER-DASHBOARD-1102, owner 2026-11-02: « migre depuis
 * l'ancienne façon de faire vers la nouvelle »). The anatomy of the GTM Factory dashboard's campaign page
 * (repo gtm-factory, docs/screenshots/campaign.png), drawn with v2 primitives over what features-service serves for
 * the campaign (its factory body, recomputed every 3 hours):
 * - What its people went through: per step to step, how many people, the share each script made (`people-journeys`);
 * - Milestones: each milestone, Start to its Target: # outcomes, $ per outcome, $ from Start, % conversion, needed per
 *   Target, each MEASURED on the campaign else EXPECTED from its plan, greyed (`milestones`);
 * - Plan: the tree from the Target down, each outcome's Engine with every script competing there, its share of the
 *   Engine's picks, the pick of this pass highlighted;
 * - Strategy per Engine: which ways the brief keeps at each Engine and which it rules out (the brief judge);
 * - Scripts per Engine: each script's share of picks, rate to the next milestone and cost per decision.
 * Every figure is served; nothing is divided, summed or ranked here (the producer serves candidates in its order).
 */

const DASH = <span className="k-fg4">—</span>;

const EXPECTED_TIP = "Expected, from each step's rate on today's estimates. It sharpens as your campaign's own results come in.";
const SHARE_TIP = "How often the Engine picks this script when it draws from what it believes about each one. A script with little data gets tried now and then.";


/** The four Factory sections of a campaign page, off ONE read of its factory body (the staff card shares the key). */
export function FactoryCampaignSections({ campaign }: { campaign: SalesFunnelCampaign }) {
  const q = useFactoryShadow(campaign.brandId, campaign.id, true);
  const shadow = q.data ?? null;
  // Settled once a read made since mount answered (or failed): never a skeleton that blinks on each poll.
  const settled = q.data !== undefined || q.isFetchedAfterMount;
  return (
    <>
      <FactoryJourneys brandId={campaign.brandId} campaignId={campaign.id} />
      <FactoryMilestones brandId={campaign.brandId} campaignId={campaign.id} />
      <FactoryPlan shadow={shadow} settled={settled} />
      <FactoryStrategies shadow={shadow} />
      <FactoryScripts shadow={shadow} />
    </>
  );
}

// ─── What its people went through ──────────────────────────────────────────────────────────────

export function FactoryJourneys({ brandId, campaignId }: { brandId: string; campaignId: string }) {
  const q = useAuthQuery(["funnelCampaignPeopleJourneys", brandId, campaignId], () => getFunnelCampaignPeopleJourneys(brandId, campaignId), pollOptions);
  const settled = q.data !== undefined || q.isFetchedAfterMount;
  const rows = q.data?.transitions ?? [];
  // The busiest step scales each row's people bar (display only, served counts).
  const peopleMax = Math.max(0, ...rows.map((t) => t.people));
  return (
    <section>
      <SectionTitle right={<span>Since it started, share by what each script spent</span>}>What its people went through</SectionTitle>
      <div className="k-card divide-y divide-[var(--line-subtle)]">
        {!settled ? (
          <div className="space-y-2 p-4">
            <Shimmer className="h-6 w-full" />
            <Shimmer className="h-6 w-full" />
          </div>
        ) : q.isError && !q.data ? (
          <EmptyNote>Could not read what your people went through. Retrying.</EmptyNote>
        ) : rows.length === 0 ? (
          <EmptyNote>Nobody has moved through this campaign yet.</EmptyNote>
        ) : (
          rows.map((t) => (
            <div key={t.pipeId} className="grid items-center gap-x-4 gap-y-1.5 px-4 py-3 text-[13px] md:grid-cols-[minmax(0,280px)_96px_120px_minmax(0,1fr)]">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="k-fg2 truncate">{t.fromLabel}</span>
                <span className="k-fg3">→</span>
                <span className="truncate font-medium">{t.toLabel}</span>
              </span>
              <span className="tabular-nums md:text-right">
                {formatCount(t.people)} {t.people === 1 ? "person" : "people"}
              </span>
              <ShareBar value={t.people} max={peopleMax} className="hidden w-full md:block" />
              <span className="k-fg2 min-w-0 space-y-1.5 text-[12px]">
                {t.scripts.length > 1 && <ScriptSplit shares={t.scripts.map((sc) => sc.sharePct)} />}
                {t.scripts.length > 0
                  ? t.scripts.map((sc, i) => (
                      <span key={sc.workflowDynastySlug}>
                        {i > 0 && ", "}
                        <span className="k-fg tabular-nums">{formatShare(sc.sharePct)}%</span> by{" "}
                        <CatalogueName kind="workflow" name={sc.workflowName} icon={sc.icon} color={sc.color} className="align-middle" />
                      </span>
                    ))
                  : (milestoneReasonWords(t.scriptsUnavailableReason) ?? DASH)}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

/** A step's scripts as one stacked bar of their served shares, the biggest first and full colour. */
function ScriptSplit({ shares }: { shares: Array<number | null> }) {
  return (
    <span className="flex h-1.5 w-full max-w-[280px] overflow-hidden rounded-full bg-[var(--data-track)]" aria-hidden="true">
      {shares.map((v, i) => (
        <span key={i} className="h-full border-r border-[var(--bg)] last:border-0" style={{ width: `${Math.max(0, v ?? 0)}%`, background: "var(--accent)", opacity: Math.max(0.25, 1 - i * 0.25) }} />
      ))}
    </span>
  );
}

// ─── Milestones ───────────────────────────────────────────────────────────────────────────────

/** A milestone figure: measured in the ordinary colour, expected greyed with its word, none = its reason or "—". */
function MilestoneCell({ v, format }: { v: MilestoneValue; format: (n: number) => string }) {
  if (v.value === null) return DASH;
  if (v.basis === "expected") return <span className="k-fg3" title="Expected, from the plan">{format(v.value)}<span className="ml-1 text-[11px]">exp.</span></span>;
  return <>{format(v.value)}</>;
}

export function FactoryMilestones({ brandId, campaignId }: { brandId: string; campaignId: string }) {
  const q = useAuthQuery(["funnelCampaignMilestones", brandId, campaignId], () => getFunnelCampaignMilestones(brandId, campaignId), pollOptions);
  const settled = q.data !== undefined || q.isFetchedAfterMount;
  const rows = q.data?.milestones ?? [];
  const target = rows.find((r) => r.isTarget)?.label ?? "Target";
  // The widest milestone scales the outcome bars: the funnel narrowing, drawn (display only).
  const outcomesMax = Math.max(0, ...rows.map((r) => r.outcomes ?? 0));
  return (
    <section>
      <SectionTitle count={rows.length > 0 ? rows.length : null} right={<span>Measured since it started, else expected</span>}>
        Milestones
      </SectionTitle>
      <div className="k-card overflow-hidden">
        {!settled ? (
          <div className="space-y-2 p-4">
            <Shimmer className="h-6 w-full" />
            <Shimmer className="h-6 w-full" />
            <Shimmer className="h-6 w-full" />
          </div>
        ) : q.isError && !q.data ? (
          <EmptyNote>Could not read this campaign&apos;s milestones. Retrying.</EmptyNote>
        ) : rows.length === 0 ? (
          <EmptyNote>{milestoneReasonWords(q.data?.milestonesUnavailableReason ?? null) ?? "No milestone to show yet."}</EmptyNote>
        ) : (
          <div className="k-scroll overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead>
                <tr className="k-line-subtle border-b">
                  <th className="k-label px-3 py-2.5 pl-4 text-left font-normal">Milestone</th>
                  <th className="k-label px-3 py-2.5 text-right font-normal"># Outcomes</th>
                  <th className="k-label px-3 py-2.5 text-right font-normal">
                    <span className="inline-flex justify-end">
                      <ExpectedLabel tip={EXPECTED_TIP}>$ / Outcome</ExpectedLabel>
                    </span>
                  </th>
                  <th className="k-label px-3 py-2.5 text-right font-normal">$ From Start</th>
                  <th className="k-label px-3 py-2.5 text-right font-normal">% Conversion</th>
                  <th className="k-label px-3 py-2.5 pr-4 text-right font-normal">Needed per {target}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.step} className="k-line-subtle border-b last:border-b-0">
                    <td className="px-3 py-2 pl-4">
                      <span className={`inline-flex items-center gap-2 ${r.step === "start" ? "" : "font-medium"}`}>
                        {r.step === "start" ? <PlayIcon size={14} weight="duotone" className="k-fg3" aria-hidden /> : <StepMark stepKey={r.step} size="xs" />}
                        {r.label}
                        {r.isTarget && <span className="k-chip">Target</span>}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span className="inline-flex items-center justify-end gap-2.5">
                        {r.outcomes !== null && <ShareBar value={r.outcomes} max={outcomesMax} color="var(--data-teal)" className="hidden w-16 md:block" />}
                        {r.outcomes !== null ? formatCount(r.outcomes) : DASH}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <MilestoneCell v={r.costPerOutcomeUsd} format={formatUsdAdaptive} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <MilestoneCell v={r.costFromStartUsd} format={formatUsdAdaptive} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span className="inline-flex items-center justify-end gap-2.5">
                        {r.conversionFromAbovePct.value !== null && (
                          <ShareBar value={r.conversionFromAbovePct.value} max={100} color={r.conversionFromAbovePct.basis === "expected" ? "var(--fg-4)" : "var(--accent)"} className="hidden w-12 md:block" />
                        )}
                        <MilestoneCell v={r.conversionFromAbovePct} format={formatRatePct} />
                      </span>
                    </td>
                    <td className="px-3 py-2 pr-4 text-right tabular-nums">
                      <MilestoneCell v={r.attemptsPerTarget} format={formatAbout} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="k-fg3 k-line-subtle border-t px-4 py-2.5 text-[12px]">
          Measured on your campaign&apos;s own people and spend; a greyed figure is expected from its plan until the campaign measures it.
        </p>
      </div>
    </section>
  );
}

// ─── Plan ─────────────────────────────────────────────────────────────────────────────────────

export function FactoryPlan({ shadow, settled }: { shadow: FactoryShadowPlan | null; settled: boolean }) {
  const catalogue = useLegCatalogue();
  const nodes = shadow ? planLegsFromTarget(shadow) : [];
  return (
    <section>
      <SectionTitle right={shadow?.engine ? <span>Recomputed every 3 hours</span> : undefined}>Plan</SectionTitle>
      <div className="k-card px-4 py-3.5">
        {!settled ? (
          <div className="space-y-2">
            <Shimmer className="h-8 w-full" />
            <Shimmer className="h-8 w-5/6" />
            <Shimmer className="h-8 w-4/6" />
          </div>
        ) : nodes.length === 0 ? (
          <EmptyNote>Your campaign&apos;s plan is computed every 3 hours. It shows here after the next pass.</EmptyNote>
        ) : (
          <>
            <p className="k-fg2 mb-3 text-[13px]">
              From your Target down: at each outcome, its Engine picks the script with the best expected value per dollar among those your brief keeps.
            </p>
            <ol className="space-y-1.5">
              {nodes.map((n, depth) => (
                <PlanNodeRow key={`${n.outcome}-${depth}`} node={n} depth={depth} catalogue={catalogue} />
              ))}
              <li className="k-fg3 flex items-center gap-2 text-[12px]" style={{ paddingLeft: nodes.length * 16 }}>
                <PlayIcon size={13} weight="duotone" aria-hidden />
                Everything starts from {stepLabel(catalogue, shadow?.plan?.startStep) ?? "Start"}.
              </li>
            </ol>
          </>
        )}
      </div>
    </section>
  );
}

function PlanNodeRow({ node, depth, catalogue }: { node: PlanNode; depth: number; catalogue: LegCatalogue }) {
  const label = stepLabel(catalogue, node.outcome) ?? node.outcomeName;
  const competing = node.place?.candidates.length ?? 0;
  return (
    <li style={{ paddingLeft: depth * 16 }}>
      <div className="k-inset rounded-[10px] px-3 py-2">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
          <StepMark stepKey={node.outcome} size="xs" />
          <span className="font-medium">{label}</span>
          {depth === 0 && <span className="k-chip">Target</span>}
          {node.place ? (
            <span className="k-fg3 text-[12px]">
              {competing} {competing === 1 ? "script" : "scripts compete"}
            </span>
          ) : node.performedBy ? (
            <span className="k-fg3 text-[12px]">{node.performedBy}</span>
          ) : null}
        </p>
        {node.place ? (
          <ul className="mt-1.5 space-y-1">
            {node.place.candidates.map((c) => (
              <CandidateLine key={c.candidateId} c={c} />
            ))}
          </ul>
        ) : node.channelName ? (
          <p className="mt-1 inline-flex items-center gap-1.5 text-[12px]">
            {node.pipeId && <ServedPipeMark pipeId={node.pipeId} size={14} />}
            {node.channelName}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function CandidateLine({ c }: { c: EngineCandidateRow }) {
  const share = c.pickSharePct;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_120px_auto] items-center gap-3 text-[12px]">
      <span className="flex min-w-0 items-center gap-1.5">
        <CatalogueName kind="workflow" name={c.workflowDynastyName ?? c.channelName} icon={c.icon} color={c.color} />
        {c.isEnginePick && (
          <span className="k-chip" style={{ color: "var(--run)" }}>
            Pick of this pass
          </span>
        )}
      </span>
      <span className="flex items-center gap-2">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--line)]">
          <span className="block h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(0, Math.min(100, share ?? 0))}%` }} />
        </span>
      </span>
      <span className="k-fg2 w-12 text-right tabular-nums">{share != null ? `${formatShare(share)}%` : "—"}</span>
    </li>
  );
}

/** A served count that can be fractional (weighted by age, or expected): one decimal under 10, whole above. */
function formatAbout(n: number): string {
  return n < 10 ? String(Math.round(n * 10) / 10) : formatCount(Math.round(n));
}

/** A share of picks as served: whole above 1%, one decimal below (a served 0.4% is never "0%"). */
function formatShare(pct: number): string {
  return pct > 0 && pct < 1 ? pct.toFixed(1) : String(Math.round(pct));
}

// ─── Strategy per Engine ───────────────────────────────────────────────────────────────────────

export function FactoryStrategies({ shadow }: { shadow: FactoryShadowPlan | null }) {
  const catalogue = useLegCatalogue();
  const places = shadow?.engine?.places ?? [];
  const verdicts: PipeVerdict[] = shadow?.pipeVerdicts ?? [];
  if (!shadow || places.length === 0) return null;
  return (
    <section>
      <SectionTitle count={places.length} right={<span>Read from your brief</span>}>
        Strategy per Engine
      </SectionTitle>
      <div className="grid gap-3 md:grid-cols-2">
        {places.map((p) => {
          const s = strategyOfPlace(p, verdicts);
          return (
            <div key={`${p.outcome}-${p.consumer}`} className="k-card px-4 py-3">
              <p className="flex items-center gap-2 text-[14px] font-medium">
                <StepMark stepKey={p.outcome} size="xs" />
                {stepLabel(catalogue, p.outcome) ?? p.outcomeName}
              </p>
              <p className="k-fg3 text-[12px]">For {stepLabel(catalogue, p.consumer) ?? p.consumerName}</p>
              <p className="k-label mt-3">Keeps</p>
              <p className="mt-1 text-[13px]">{s.kept.length > 0 ? s.kept.join(", ") : "Every way that makes it"}</p>
              {s.ruledOut.length > 0 && (
                <>
                  <p className="k-label mt-2.5">Rules out</p>
                  <p className="k-fg2 mt-1 text-[13px]">{s.ruledOut.join(", ")}</p>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Scripts per Engine ────────────────────────────────────────────────────────────────────────

export function FactoryScripts({ shadow }: { shadow: FactoryShadowPlan | null }) {
  const catalogue = useLegCatalogue();
  const places = shadow?.engine?.places ?? [];
  if (!shadow || places.length === 0) return null;
  return (
    <section className="space-y-4">
      <SectionTitle count={places.length}>Scripts per Engine</SectionTitle>
      {places.map((p) => (
        <ScriptsTable key={`${p.outcome}-${p.consumer}`} place={p} stepKey={p.outcome} label={stepLabel(catalogue, p.outcome) ?? p.outcomeName} next={stepLabel(catalogue, p.consumer) ?? p.consumerName} />
      ))}
    </section>
  );
}

function ScriptsTable({ place, stepKey, label, next }: { place: EnginePlaceFull; stepKey: string; label: string; next: string }) {
  return (
    <div className="k-card overflow-hidden">
      <div className="k-line-subtle flex flex-wrap items-center gap-x-2 border-b px-4 py-2.5">
        <StepMark stepKey={stepKey} size="xs" />
        <span className="text-[14px] font-medium">{label}</span>
        <span className="k-fg3 text-[12px]">
          {place.candidates.length} {place.candidates.length === 1 ? "script" : "scripts"} · for {next}
        </span>
      </div>
      {place.candidates.length === 0 ? (
        <EmptyNote>No script makes this outcome for your campaign yet.</EmptyNote>
      ) : (
        <div className="k-scroll overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="k-line-subtle border-b">
                <th className="k-label px-3 py-2.5 pl-4 text-left font-normal">Script</th>
                <th className="k-label px-3 py-2.5 text-right font-normal">
                  <span className="inline-flex justify-end">
                    <ExpectedLabel tip={SHARE_TIP}>Share of picks</ExpectedLabel>
                  </span>
                </th>
                <th className="k-label px-3 py-2.5 text-right font-normal">% Reach {next}</th>
                <th className="k-label px-3 py-2.5 text-right font-normal">$ / Decision</th>
                <th className="k-label px-3 py-2.5 pr-4 text-right font-normal">Your runs</th>
              </tr>
            </thead>
            <tbody>
              {place.candidates.map((c) => (
                <tr key={c.candidateId} className="k-line-subtle border-b last:border-b-0">
                  <td className="px-3 py-2 pl-4">
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <CatalogueName kind="workflow" name={c.workflowDynastyName ?? c.channelName} icon={c.icon} color={c.color} />
                      <span className="k-fg3 text-[12px]">{c.channelName}</span>
                      {c.isEnginePick && (
                        <span className="k-chip" style={{ color: "var(--run)" }}>
                          Pick of this pass
                        </span>
                      )}
                      {c.isToday && !c.isEnginePick && <span className="k-chip">Running now</span>}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className="inline-flex items-center justify-end gap-2.5">
                      {c.pickSharePct != null && <ShareBar value={c.pickSharePct} max={100} color={c.isEnginePick ? "var(--run)" : "var(--accent)"} className="hidden w-14 md:block" />}
                      {c.pickSharePct != null ? `${formatShare(c.pickSharePct)}%` : DASH}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.rateMeanPct != null ? formatRatePct(c.rateMeanPct) : DASH}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.costPerDecisionMeanUsd != null ? formatUsdAdaptive(c.costPerDecisionMeanUsd) : DASH}</td>
                  <td className="px-3 py-2 pr-4 text-right tabular-nums">
                    {c.clientDecisions != null ? formatAbout(c.clientDecisions) : DASH}
                    {c.clientOutcomes != null && <span className="k-fg3 text-[12px]"> · {formatAbout(c.clientOutcomes)} reached</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
