"use client";

import { useState } from "react";
import { PlayIcon } from "@phosphor-icons/react/dist/csr/Play";
import { formatUsdAdaptive, formatCount } from "@/lib/format-number";
import { milestoneReasonWords } from "@/lib/factory-campaign";
import { drawRuleWords, scriptLabel, strategyStateWords, type CampaignEngine, type CampaignEngineScriptsRead, type CampaignScriptRow } from "@/lib/campaign-engine-scripts";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { reasonWords } from "@/lib/campaign-targets";
import { getFunnelCampaignEngineScripts } from "@/lib/api";
import { StepMark } from "@/components/marks/step-mark";
import { CatalogueName } from "@/components/v2/catalogue-name";
import { ExpectedLabel } from "@/components/v2/offer-sales-paths";
import { EmptyNote, SectionTitle, ShareBar, Shimmer } from "@/components/v2/ui";
import type { SalesFunnelCampaign } from "@/lib/sales-funnel-campaigns";
import { CampaignMilestoneCards } from "@/components/v2/today-targets";
import { CampaignForecast } from "@/components/v2/campaign-forecast";
import { useStaffMode } from "@/lib/use-staff-mode";

/**
 * THE GTM FACTORY CAMPAIGN PAGE, for EVERY client (FACTORY-USER-DASHBOARD-1102, owner 2026-11-02: « migre depuis
 * l'ancienne façon de faire vers la nouvelle »). The anatomy of the GTM Factory dashboard's campaign page
 * (repo gtm-factory, docs/screenshots/campaign.png), drawn with v2 primitives over what features-service serves for
 * the campaign (its factory body, recomputed every 3 hours):
 * - Milestones: each milestone, Start to its Target: # outcomes, $ per outcome, $ from Start, % conversion, needed per
 *   Target, each MEASURED on the campaign else EXPECTED from its plan, greyed (`milestones`);
 * - Plan / Strategy per Engine / Scripts per Engine: features-service's campaign read in SCRIPTS (CAMPAIGN-SCRIPTS-1113,
 *   owner 2026-11-13 « un pick = toujours un script »): from the Target down, at each Engine the scripts the brief keeps,
 *   today's share of the Rating's draws among them, the one running now, what the brief rules out in words, and this
 *   campaign's own runs of each (`engine-scripts`). The old workflow « pick of this pass » is gone with the pick itself.
 * Every figure is served; nothing is divided, summed or ranked here (the producer serves scripts in its order).
 */

const DASH = <span className="k-fg4">—</span>;

const EXPECTED_TIP = "Expected, from each step's rate on today's estimates. It sharpens as your campaign's own results come in.";
const SHARE_TIP = "How often the Engine draws this script today, among the ones your brief keeps. A script with little data gets tried now and then.";


/** The four Factory sections of a campaign page, off ONE read of its factory body (the staff card shares the key). */
export function FactoryCampaignSections({ campaign }: { campaign: SalesFunnelCampaign }) {
  const q = useCampaignEngineScripts(campaign.brandId, campaign.id);
  // Settled once a read made since mount answered (or failed): never a skeleton that blinks on each poll.
  const settled = q.data !== undefined || q.isFetchedAfterMount;
  // A client reads where the campaign is going (owner 2026-11-17); how it is made (milestone detail, the Plan's
  // draws, the brief's filters, each script's runs) is staff mode only.
  const { staffMode } = useStaffMode();
  return (
    <>
      <CampaignForecast brandId={campaign.brandId} campaignId={campaign.id} />
      {staffMode && (
        <>
          <CampaignMilestoneCards brandId={campaign.brandId} campaignId={campaign.id} />
          <FactoryPlan read={q.data ?? null} settled={settled} failed={q.isError && !q.data} />
          <FactoryStrategies read={q.data ?? null} />
          <FactoryScripts read={q.data ?? null} />
        </>
      )}
    </>
  );
}

/** The campaign's Engines in scripts (features-service `engine-scripts`), one read for the three sections. */
export function useCampaignEngineScripts(brandId: string, campaignId: string) {
  return useAuthQuery(["campaignEngineScripts", brandId, campaignId], () => getFunnelCampaignEngineScripts(brandId, campaignId), { ...pollOptions, retry: false });
}

const enginesOf = (read: CampaignEngineScriptsRead | null): CampaignEngine[] => (read?.state === "ready" ? read.data.engines : []);

// ─── Plan ─────────────────────────────────────────────────────────────────────────────────────

export function FactoryPlan({ read, settled, failed }: { read: CampaignEngineScriptsRead | null; settled: boolean; failed: boolean }) {
  const engines = enginesOf(read);
  return (
    <section>
      <SectionTitle right={read?.state === "ready" ? <span>Draws refreshed every 15 minutes</span> : undefined}>Plan</SectionTitle>
      <div className="k-card px-4 py-3.5">
        {!settled ? (
          <div className="space-y-2">
            <Shimmer className="h-8 w-full" />
            <Shimmer className="h-8 w-5/6" />
            <Shimmer className="h-8 w-4/6" />
          </div>
        ) : failed ? (
          <EmptyNote>Could not read your campaign&apos;s plan. Retrying.</EmptyNote>
        ) : read?.state === "building" ? (
          <EmptyNote>Your campaign&apos;s plan is being refreshed. It shows here in a few minutes.</EmptyNote>
        ) : engines.length === 0 ? (
          <EmptyNote>No outcome of this campaign runs on a script yet.</EmptyNote>
        ) : (
          <>
            <p className="k-fg2 mb-3 text-[13px]">From your Target down: at each outcome, its Engine draws one of the scripts your brief keeps, on what each one&apos;s runs led to.</p>
            <ol className="space-y-1.5">
              {engines.map((e, depth) => (
                <PlanEngineRow key={e.outcome} engine={e} depth={depth} />
              ))}
            </ol>
          </>
        )}
      </div>
    </section>
  );
}

function PlanEngineRow({ engine, depth }: { engine: CampaignEngine; depth: number }) {
  const competing = engine.scripts.length;
  return (
    <li style={{ paddingLeft: depth * 16 }}>
      <div className="k-inset rounded-[10px] px-3 py-2">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
          <StepMark stepKey={engine.outcome} size="xs" />
          <span className="font-medium">{engine.label}</span>
          {engine.isTarget && <span className="k-chip">Target</span>}
          <span className="k-fg3 text-[12px]">{competing === 0 ? drawRuleWords(engine.drawRule) : `${competing} ${competing === 1 ? "script" : "scripts compete"}`}</span>
        </p>
        {competing > 0 && (
          <ul className="mt-1.5 space-y-1">
            {engine.scripts.map((sc) => (
              <ScriptLine key={sc.script} sc={sc} runsNow={engine.runsNow === sc.script} />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

/** A script's label (its served short name, else its description) on ONE line; the description whole on hover. */
function ScriptName({ sc }: { sc: CampaignScriptRow }) {
  return (
    <span className="min-w-0 truncate" title={sc.description ?? scriptLabel(sc)}>
      {scriptLabel(sc)}
    </span>
  );
}

function ScriptLine({ sc, runsNow }: { sc: CampaignScriptRow; runsNow: boolean }) {
  const share = sc.shareOfDrawsPct;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_120px_auto] items-center gap-3 text-[12px]">
      <span className="flex min-w-0 items-center gap-1.5">
        <ScriptName sc={sc} />
        {runsNow && (
          <span className="k-chip shrink-0" style={{ color: "var(--run)" }}>
            Running now
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

/** A share of draws as served: whole above 1%, one decimal below (a served 0.4% is never "0%"). */
function formatShare(pct: number): string {
  return pct > 0 && pct < 1 ? pct.toFixed(1) : String(Math.round(pct));
}

/** Dollars as the dashboard prints them; a real amount under one cent never reads as $0.00. */
const usd = (v: number) => (v > 0 && v < 0.005 ? "<$0.01" : formatUsdAdaptive(v));

// ─── Strategy per Engine ───────────────────────────────────────────────────────────────────────

export function FactoryStrategies({ read }: { read: CampaignEngineScriptsRead | null }) {
  const engines = enginesOf(read);
  if (engines.length === 0) return null;
  return (
    <section>
      <SectionTitle count={engines.length} right={<span>Read from your brief</span>}>
        Strategy per Engine
      </SectionTitle>
      <div className="grid gap-3 md:grid-cols-2">
        {engines.map((e) => {
          const keeps = e.rules.filter((r) => r.kind === "requires");
          const excludes = e.rules.filter((r) => r.kind === "excludes");
          return (
            <div key={e.outcome} className="k-card px-4 py-3">
              <p className="flex items-center gap-2 text-[14px] font-medium">
                <StepMark stepKey={e.outcome} size="xs" />
                {e.label}
              </p>
              <p className="k-fg3 text-[12px]">{e.strategy ? e.strategy.name : strategyStateWords(e.strategyState)}</p>
              {e.strategy && <p className="k-fg2 mt-2 text-[13px]">{e.strategy.description}</p>}
              <p className="k-label mt-3">Keeps</p>
              <p className="mt-1 text-[13px]">{keeps.length > 0 ? keeps.map((r) => r.clientLine ?? r.name).join(", ") : "Every script that makes it"}</p>
              {excludes.length > 0 && (
                <>
                  <p className="k-label mt-2.5">Rules out</p>
                  <p className="k-fg2 mt-1 text-[13px]">{excludes.map((r) => r.clientLine ?? r.name).join(", ")}</p>
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

export function FactoryScripts({ read }: { read: CampaignEngineScriptsRead | null }) {
  const engines = enginesOf(read);
  if (engines.length === 0) return null;
  return (
    <section className="space-y-4">
      <SectionTitle count={engines.length}>Scripts per Engine</SectionTitle>
      {engines.map((e) => (
        <ScriptsTable key={e.outcome} engine={e} />
      ))}
    </section>
  );
}

function ScriptsTable({ engine }: { engine: CampaignEngine }) {
  // Competing scripts first; the ones the brief rules out and the ones no longer running fold behind one toggle.
  const [open, setOpen] = useState(false);
  const folded = engine.ruledOut.length + engine.past.length;
  const rows = [...engine.scripts, ...(open ? [...engine.ruledOut, ...engine.past] : [])];
  return (
    <div className="k-card overflow-hidden">
      <div className="k-line-subtle flex flex-wrap items-center gap-x-2 border-b px-4 py-2.5">
        <StepMark stepKey={engine.outcome} size="xs" />
        <span className="text-[14px] font-medium">{engine.label}</span>
        <span className="k-fg3 text-[12px]">
          {engine.scripts.length} {engine.scripts.length === 1 ? "script" : "scripts"} competing · {drawRuleWords(engine.drawRule)}
        </span>
      </div>
      {rows.length === 0 && folded === 0 ? (
        <EmptyNote>No script makes this outcome for your campaign yet.</EmptyNote>
      ) : (
        <div className="k-scroll overflow-x-auto">
          <table className="w-full min-w-[720px] table-fixed text-[13px]">
            <thead>
              <tr className="k-line-subtle border-b">
                <th className="k-label px-3 py-2.5 pl-4 text-left font-normal">Script</th>
                <th className="k-label w-[130px] px-3 py-2.5 text-right font-normal">
                  <span className="inline-flex justify-end">
                    <ExpectedLabel tip={SHARE_TIP}>Share of draws</ExpectedLabel>
                  </span>
                </th>
                <th className="k-label w-[170px] px-3 py-2.5 text-left font-normal">Reached</th>
                <th className="k-label w-[100px] px-3 py-2.5 text-right font-normal">Cost per run</th>
                <th className="k-label w-[96px] px-3 py-2.5 pr-4 text-right font-normal">Your runs</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((sc) => {
                const reached = sc.campaign.reached.filter((r) => r.outcome != null);
                const competing = sc.shareOfDrawsPct != null;
                return (
                  <tr key={sc.script} className="k-line-subtle border-b last:border-b-0">
                    <td className="px-3 py-2 pl-4">
                      <span className={`flex min-w-0 items-center gap-1.5 ${competing ? "" : "k-fg3"}`}>
                        <ScriptName sc={sc} />
                        {engine.runsNow === sc.script && (
                          <span className="k-chip shrink-0" style={{ color: "var(--run)" }}>
                            Running now
                          </span>
                        )}
                        {sc.llms.map((l, i) => {
                          const name = l.model ?? l.provider;
                          return name ? <CatalogueName key={i} kind="llm" name={name} vendorId={l.provider} variant="chip" className="shrink-0" /> : null;
                        })}
                      </span>
                      {sc.ruledOutReason && <span className="k-fg3 mt-0.5 block truncate text-[12px]" title={sc.ruledOutReason}>Ruled out: {sc.ruledOutReason}</span>}
                      {sc.version == null && <span className="k-fg3 mt-0.5 block text-[12px]">No longer runs</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span className="inline-flex items-center justify-end gap-2.5">
                        {competing && <ShareBar value={sc.shareOfDrawsPct} max={100} color={sc.drawnMost ? "var(--run)" : "var(--accent)"} className="hidden w-14 md:block" />}
                        {competing ? `${formatShare(sc.shareOfDrawsPct!)}%` : DASH}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {reached.length ? (
                        <span className="flex min-w-0 flex-wrap gap-1">
                          {reached.slice(0, 2).map((r) => (
                            <span key={r.outcome} className="k-chip max-w-full truncate tabular-nums">
                              {r.label ?? r.outcome} {formatCount(r.runs)}
                            </span>
                          ))}
                          {reached.length > 2 && <span className="k-fg3 text-[12px]">+{reached.length - 2} more</span>}
                        </span>
                      ) : (
                        DASH
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{sc.campaign.costPerRunUsd != null ? usd(sc.campaign.costPerRunUsd) : DASH}</td>
                    <td className="px-3 py-2 pr-4 text-right tabular-nums">{formatCount(sc.campaign.runs)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {folded > 0 && (
            <div className="k-fg3 k-line-subtle border-t px-4 py-2.5 text-[12px]">
              <button type="button" className="k-btn-ghost h-6 px-2" onClick={() => setOpen((v) => !v)}>
                {open ? "Hide the others" : `${folded} not competing`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
