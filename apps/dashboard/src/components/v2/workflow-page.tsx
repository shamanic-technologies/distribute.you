"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuthQuery } from "@/lib/use-auth-query";
import { POLL_INTERVAL, pollOptions } from "@/lib/query-options";
import {
  ApiError,
  editWorkflowPrompt,
  getBrand,
  getFleetWorkflowActualCostHistory,
  getFleetWorkflowReturnHistory,
  getPlatformPrompt,
  listAudiences,
  listBrandRunLedger,
  listBrandRunLedgerVendor,
  listRunEmails,
  type Email,
  type RunRow,
} from "@/lib/api";
import { GrainMark } from "@/components/marks/grain-mark";
import { AudienceAvatar } from "@/components/audiences/audience-avatar";
import { CrewMark } from "@/components/v2/crew-mark";
import { ResearchModelChip, ResearchTemplateChip } from "@/components/v2/research-template-link";
import { EmptyNote, Initials, SectionTitle, Shimmer, TopBar } from "@/components/v2/ui";
import { CompanyMark } from "@/components/v2/people-bits";
import { useMissions } from "@/components/v2/use-missions";
import { crewParam, useBrandMissionSpecs, useMissionWorkflowRanking, type MissionSpec } from "@/components/v2/workflows-data";
import { formatCentsAsUsdAdaptive, formatUsdAdaptive } from "@/lib/format-number";
import { formatRoi } from "@/lib/format-roi";
import { friendlyDateTime } from "@/lib/friendly-datetime";
import {
  audienceRowsFor,
  grainFigures,
  scopeLadderRows,
  type WorkflowGrain,
  type WorkflowGrainBlock,
  type WorkflowLadderRowShape,
} from "@/lib/workflow-grains";
import { workflowOutcomeCost, workflowOutcomeCount, workflowRoi } from "@/lib/campaign-workflow-rows";
import { useStatBasis } from "@/lib/use-stat-basis";
import { StatBasisSwitch } from "@/components/v2/stat-basis-switch";
import { workflowModelMark } from "@/lib/workflow-model-marks";
import { workflowTemplateLabel } from "@/lib/workflow-template-label";
import { useStaffMode } from "@/lib/use-staff-mode";
import { useCostBasis } from "@/lib/v2/use-cost-basis";
import { ActualCostNote, CostBasisSwitch } from "@/components/v2/cost-basis-switch";
import { v2Href, v2WorkflowHref } from "@/lib/v2/routes";
import { sameLegKey } from "@/lib/outbound-leg-key";

/** How many of a dynasty's most recent versions the run history reads. */
const RUN_VERSIONS = 4;
/** How many runs a version contributes, and how many the list can show. */
const RUNS_PER_VERSION = 25;
const RUNS_READ = 30;
/** Runs shown before the footer offers the rest. */
const RUNS_SHOWN = 10;

const TH = "k-label px-3 py-2.5 text-left font-medium first:pl-4 last:pr-4";

const fmtUsd = (v: number | null | undefined) => (v == null ? "—" : formatUsdAdaptive(v));
const fmtCount = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("en-US"));
/** "Positive reply" -> "Positive replies", "Website visit" -> "Website visits". */
const plural = (noun: string) => (/[^aeiou]y$/i.test(noun) ? `${noun.slice(0, -1)}ies` : `${noun}s`);
/** Audiences listed before the card offers the rest. */
const AUDIENCES_SHOWN = 6;

/**
 * ONE workflow dynasty, priced for one mission, beta.
 *
 * Laid out as a v2 record: identity and chips on top, the figures in one strip, why it
 * ranks where it does and how it was priced in the main column, then cost, value and
 * return over time and every run it made for this brand. The aside holds the facts, the
 * prompt it writes with and the audiences it ran for. Every figure is served.
 */
export function V2WorkflowPage() {
  const { orgId, brandId, workflowSlug } = useParams<{ orgId: string; brandId: string; workflowSlug: string }>();
  const dynasty = decodeURIComponent(workflowSlug);
  const search = useSearchParams();
  const crewRaw = search.get("crew") ?? "";
  const missionRaw = search.get("mission");
  const [featureSlug, legKey] = crewRaw.split("|");
  const router = useRouter();
  const { specs, settled, missionByCampaignId } = useBrandMissionSpecs(orgId, brandId);
  const { actual } = useCostBasis();
  const { basis } = useStatBasis();

  // The mission the ranking is asked through. A link naming it wins; an older link naming
  // only the crew resolves when the brand runs a single mission for that crew.
  const crewSpecs = specs.filter((s) => s.featureSlug === featureSlug && sameLegKey(s.legKey, legKey));
  const linked = missionRaw ? missionByCampaignId.get(missionRaw) ?? null : null;
  const spec: MissionSpec | null = linked
    ? (specs.find((s) => s.campaignId === linked.row.campaign.id) ?? null)
    : !missionRaw && crewSpecs.length === 1
      ? crewSpecs[0]
      : null;

  const ranking = useMissionWorkflowRanking(brandId, spec, true);
  const ranked = ranking.ranked.find((r) => r.row.workflowDynastySlug === dynasty) ?? null;
  const name = ranked?.row.workflowDynastyName ?? dynasty;

  const brandQ = useAuthQuery(["brand", brandId], () => getBrand(brandId), pollOptions);
  const audiencesQ = useAuthQuery(["audiences", brandId], () => listAudiences(brandId), pollOptions);
  const audienceById = useMemo(() => {
    const m = new Map<string, { name: string; avatarUrl: string | null }>();
    for (const a of audiencesQ.data?.audiences ?? []) m.set(a.id, { name: a.name, avatarUrl: a.avatarUrl ?? null });
    return m;
  }, [audiencesQ.data]);

  const ladderRow =
    scopeLadderRows(ranking.allLadderRows, null).find((r) => r.workflow.workflowDynastySlug === dynasty) ?? null;
  const missionLabel = spec ? `${spec.crew.name}${spec.mission.offerName ? ` · ${spec.mission.offerName}` : ""}` : null;

  let body: React.ReactNode;
  if (!featureSlug || !legKey) {
    body = <Notice>This link names no crew, so there is no outcome to price this workflow on.</Notice>;
  } else if (!settled) {
    body = <PageSkeleton />;
  } else if (!spec && crewSpecs.length > 1 && !missionRaw) {
    body = (
      <div className="k-card mt-6 overflow-hidden">
        <p className="k-fg2 px-4 pb-2 pt-4 text-[13px]">This crew works several offers. Pick the mission to price this workflow for.</p>
        <ul>
          {crewSpecs.map((s) => (
            <li key={s.campaignId}>
              <Link href={v2WorkflowHref(orgId, brandId, dynasty, crewRaw, s.campaignId)} className="k-row k-hover flex h-10 items-center gap-2 px-4">
                <CrewMark color={s.crew.color} glyph={s.crew.glyph} size={18} />
                <span className="font-medium">{s.crew.name}</span>
                <span className="k-fg2 truncate">· {s.mission.offerName ?? "Offer"}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  } else if (!spec) {
    body = <Notice>This link names no mission this brand runs for that crew.</Notice>;
  } else if (ranking.pending) {
    body = <PageSkeleton />;
  } else if (!ranked) {
    body = <Notice>This crew does not offer this workflow.</Notice>;
  } else {
    const model = workflowModelMark(ranked.row.contentModel);
    const template = workflowTemplateLabel(ranked.row.contentPromptType);
    const row = ranked.row;
    const noun = ranking.outcomeNoun;
    const count = workflowOutcomeCount(row);
    // What THIS mission measured, as the MATURE half of the served pair (Learning where
    // the producer says so); the projected half beside it is the served ranking.
    const cost = workflowOutcomeCost(row, basis);
    const roi = workflowRoi(row, basis);
    body = (
      <>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <CrewMark color={spec.crew.color} glyph={spec.crew.glyph} size={40} />
            <div className="min-w-0">
              <h1 className="truncate text-[24px] font-medium leading-[30px] tracking-[-0.02em]">{name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="k-chip tabular-nums">{ranked.rank == null ? "Not ranked" : `#${ranked.rank} for this mission`}</span>
                {model && (
                  <ResearchModelChip
                    orgId={orgId}
                    brandId={brandId}
                    channel={spec.featureSlug}
                    step={spec.mission.leg?.toKey ?? null}
                    dynasty={dynasty}
                    label={model.label}
                  />
                )}
                {template && (
                  <ResearchTemplateChip
                    orgId={orgId}
                    brandId={brandId}
                    channel={spec.featureSlug}
                    step={spec.mission.leg?.toKey ?? null}
                    templateKey={ranked.row.contentPromptType}
                    label={template.label}
                  />
                )}
              </div>
            </div>
          </div>
          <Link href={spec.mission.href} className="k-btn">
            Open mission
          </Link>
        </div>

        {/* Keel's Commit / Best case: what this mission MEASURED leads, what the
            ranking PROJECTS sits under it, each named, so the two are never read as
            one figure. Both are served (grouped revenue and the ranking ladder). */}
        <div className="k-card mt-5 grid grid-cols-1 divide-y divide-[var(--line-subtle)] md:grid-cols-3 md:divide-x md:divide-y-0">
          <DualKpi
            label="Return, this mission"
            measured={roi.learning ? <span className="k-chip">Learning</span> : formatRoi(roi.value, "—")}
            projected={ranked.estLearning ? <span className="k-chip">Learning</span> : formatRoi(ranked.ladder?.roiMultiple ?? null, "—")}
          />
          <DualKpi
            label={`Cost / ${noun.toLowerCase()}`}
            measured={cost.learning ? <span className="k-chip">Learning</span> : cost.value == null ? "—" : formatCentsAsUsdAdaptive(cost.value)}
            projected={ranked.estLearning ? <span className="k-chip">Learning</span> : fmtUsd(ranked.estCostPerOutcomeUsd)}
          />
          <Kpi label={`${plural(noun)}, this mission`} value={fmtCount(count)} />
        </div>
        <p className="k-fg3 mt-2 text-[12px]">
          Measured is what this mission actually produced for what it spent. Projected is what the ranking expects, from your
          conversion rates and your customer value.
        </p>
        {actual && <ActualCostNote unpricedUsd={ranking.ladder?.unpricedBilledCostUsd} />}

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <div className="k-card p-4">
              <p className="k-label">Why it ranks here</p>
              <p className="mt-2 text-[13px]">{ranked.why}</p>
            </div>
            <Priced
              ladder={ranked.ladder}
              ladderRow={ladderRow}
              noun={noun}
              brandDomain={brandQ.data?.brand.domain ?? null}
              brandLogoUrl={brandQ.data?.brand.logoUrl ?? null}
            />
            <OverTime featureSlug={spec.featureSlug} legKey={spec.legKey} dynasty={dynasty} />
            <RunsCard orgId={orgId} brandId={brandId} dynasty={dynasty} versions={ranking.versionsByDynasty.get(dynasty) ?? []} />
          </div>
          <div className="min-w-0 space-y-4">
            <aside className="k-card h-fit p-4">
              <p className="k-label">Details</p>
              <dl className="mt-3 space-y-2.5 text-[13px]">
                <Row
                  k="Crew"
                  v={
                    <span className="inline-flex items-center gap-1.5">
                      <CrewMark color={spec.crew.color} glyph={spec.crew.glyph} />
                      {spec.crew.name}
                    </span>
                  }
                />
                <Row k="Offer" v={spec.mission.offerName} />
                <Row k="Objective" v={spec.mission.leg?.label ?? null} />
                <Row k="Model" v={model ? <span className="k-mono text-[12px]">{model.alias}</span> : null} />
                <Row k="Invested" v={row.committedCostUsd == null ? null : formatUsdAdaptive(row.committedCostUsd)} />
                <Row k="Leads emailed" v={row.outreach == null ? null : fmtCount(row.outreach)} />
              </dl>
            </aside>
            <PromptCard
              promptType={row.contentPromptType}
              dynasty={dynasty}
              workflowName={name}
              featureSlug={spec.featureSlug}
              onForked={(slug) => router.push(v2WorkflowHref(orgId, brandId, slug, crewParam(spec), spec.campaignId))}
            />
            <AudiencesCard rows={audienceRowsFor(ranking.allLadderRows, dynasty, basis)} audienceById={audienceById} noun={noun} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar
        crumbs={[
          { label: "Workflows", href: v2Href(orgId, brandId, "workflows") },
          ...(missionLabel ? [{ label: missionLabel }] : []),
          { label: name },
        ]}
        actions={
          <>
            <CostBasisSwitch />
            <StatBasisSwitch />
          </>
        }
      />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">{body}</div>
    </>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="k-card mt-6">
      <EmptyNote>{children}</EmptyNote>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="mt-2 space-y-4">
      <div className="flex items-center gap-3">
        <Shimmer className="h-10 w-10 rounded-[10px]" />
        <Shimmer className="h-7 w-64" />
      </div>
      <div className="k-card grid grid-cols-2 gap-4 p-4 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Shimmer key={i} className="h-10 w-full" />
        ))}
      </div>
      <div className="k-card overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="k-row flex h-10 items-center px-4">
            <Shimmer className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <p className="k-label truncate">{label}</p>
      <div className="mt-1 text-[22px] font-medium leading-7 tracking-[-0.02em] tabular-nums">{value}</div>
    </div>
  );
}

/** One figure read two ways: measured (filled dot, leads) and projected (outline dot). */
function DualKpi({ label, measured, projected }: { label: string; measured: React.ReactNode; projected: React.ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <p className="k-label truncate">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="h-2 w-2 shrink-0 translate-y-[-3px] rounded-full bg-[var(--fg-2)]" aria-hidden="true" />
        <span className="text-[22px] font-medium leading-7 tracking-[-0.02em] tabular-nums">{measured}</span>
        <span className="k-fg3 text-[12px]">measured</span>
      </div>
      <div className="mt-0.5 flex items-baseline gap-2 text-[12px]">
        <span className="h-2 w-2 shrink-0 rounded-full border border-[var(--fg-3)]" aria-hidden="true" />
        <span className="k-fg2 tabular-nums">{projected}</span>
        <span className="k-fg3">projected</span>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="k-fg3 shrink-0">{k}</dt>
      <dd className="min-w-0 truncate text-right">{v ?? <span className="k-fg4">{"—"}</span>}</dd>
    </div>
  );
}

// ─── How it was priced ─────────────────────────────────────────────────────

const GRAINS: { key: WorkflowGrain; label: string }[] = [
  { key: "campaign", label: "This mission" },
  { key: "brand", label: "This brand" },
  { key: "crossOrg", label: "Every client" },
];

/**
 * The cascade the producer priced this workflow through, one cell per grain. The grain
 * the NUMBERS came from is the finest one with spend (the producer's own rule), which is
 * decoupled from `resolved.grain` (a label for the finest grain that OBSERVED the outcome).
 */
function Priced({
  ladder,
  ladderRow,
  noun,
  brandDomain,
  brandLogoUrl,
}: {
  ladder: { measured: boolean } | null;
  ladderRow: WorkflowLadderRowShape | null;
  noun: string;
  brandDomain: string | null;
  brandLogoUrl: string | null;
}) {
  const g = ladderRow?.estimatesByGrain;
  const used: WorkflowGrain | "audience" | null = g
    ? g.audience
      ? "audience"
      : g.campaign
        ? "campaign"
        : g.brand
          ? "brand"
          : g.crossOrg
            ? "crossOrg"
            : null
    : null;
  return (
    <section>
      <SectionTitle right={<span>Closest evidence first: this mission, this brand, then every client</span>}>How we priced it</SectionTitle>
      {!ladder ? (
        <Notice>We have no estimate for this workflow yet, so there is nothing to break down.</Notice>
      ) : !ladder.measured ? (
        <Notice>Nothing has been spent on it yet. The estimate is the price of one outreach, set so it can earn a first try.</Notice>
      ) : (
        <div className="k-card grid grid-cols-1 divide-y divide-[var(--line-subtle)] md:grid-cols-3 md:divide-x md:divide-y-0">
          {GRAINS.map((grain) => (
            <GrainCell
              key={grain.key}
              grain={grain.key}
              label={grain.label}
              block={g?.[grain.key]}
              used={used === grain.key}
              noun={noun}
              brandDomain={brandDomain}
              brandLogoUrl={brandLogoUrl}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function GrainCell({
  grain,
  label,
  block,
  used,
  noun,
  brandDomain,
  brandLogoUrl,
}: {
  grain: WorkflowGrain;
  label: string;
  block: WorkflowGrainBlock | undefined;
  used: boolean;
  noun: string;
  brandDomain: string | null;
  brandLogoUrl: string | null;
}) {
  // The served half of THIS grain's maturity pair, and the grain's own Learning verdict.
  const { basis } = useStatBasis();
  const f = grainFigures(block, basis);
  return (
    <div className="min-w-0 p-4">
      <div className="flex items-center gap-2">
        <GrainMark grain={grain} brandDomain={brandDomain} brandLogoUrl={brandLogoUrl} size={16} />
        <span className="text-[13px] font-medium">{label}</span>
        {used && <span className="k-chip ml-auto">Used</span>}
      </div>
      {!block ? (
        <p className="k-fg3 mt-2 text-[12px]">Nothing spent here yet, so it is not used.</p>
      ) : (
        <>
          {block.costBasis && (
            <p className="k-fg3 mt-1 text-[12px]">{block.costBasis === "charged" ? "What you paid" : "What it costs us, refunds included"}</p>
          )}
          <dl className="mt-3 space-y-1.5 text-[13px]">
            <Row
              k={`Cost / ${noun.toLowerCase()}`}
              v={f?.learning ? <span className="k-chip">Learning</span> : f?.costPerOutcomeUsd == null ? null : formatUsdAdaptive(f.costPerOutcomeUsd)}
            />
            <Row
              k={f && !f.outcomeObserved ? `${plural(noun)} (expected)` : plural(noun)}
              v={f?.outcomeCount == null ? null : fmtCount(Math.round(f.outcomeCount))}
            />
            <Row k="Spent" v={f?.spentUsd == null ? null : fmtUsd(f.spentUsd)} />
            <Row k="People reached" v={f?.contacted == null ? null : fmtCount(f.contacted)} />
          </dl>
        </>
      )}
    </div>
  );
}

/** Every audience this workflow ran for on this mission, cheapest first. */
function AudiencesCard({
  rows,
  audienceById,
  noun,
}: {
  rows: ReturnType<typeof audienceRowsFor>;
  audienceById: Map<string, { name: string; avatarUrl: string | null }>;
  noun: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (rows.length === 0) return null;
  const shown = expanded ? rows : rows.slice(0, AUDIENCES_SHOWN);
  return (
    <div className="k-card overflow-hidden">
      <p className="k-label px-4 pb-2 pt-4">Audiences, cheapest first</p>
      <ul>
        {shown.map((r) => {
          const meta = audienceById.get(r.audienceId);
          const name = meta?.name ?? "An audience we could not name";
          return (
            <li key={r.audienceId} className="flex items-center gap-2.5 border-t border-[var(--line-subtle)] px-4 py-2">
              <AudienceAvatar name={name} avatarUrl={meta?.avatarUrl} size={24} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px]">{name}</p>
                <p className="k-fg3 truncate text-[12px] tabular-nums">
                  {fmtUsd(r.figures?.spentUsd ?? null)} spent
                  {r.figures != null &&
                    `, ${fmtCount(r.figures.outcomeCount == null ? null : Math.round(r.figures.outcomeCount))} ${(r.figures.outcomeCount === 1 ? noun : plural(noun)).toLowerCase()}`}
                </p>
              </div>
              <span className="shrink-0 text-[13px] font-medium tabular-nums">
                {r.figures?.learning ? (
                  <span className="k-chip">Learning</span>
                ) : r.figures?.costPerOutcomeUsd == null ? (
                  <span className="k-fg4">—</span>
                ) : (
                  formatUsdAdaptive(r.figures.costPerOutcomeUsd)
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {rows.length > AUDIENCES_SHOWN && (
        <div className="k-fg3 flex items-center border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px] tabular-nums">
          <span>
            {shown.length} of {rows.length}
          </span>
          <button type="button" onClick={() => setExpanded((v) => !v)} className="k-btn-ghost ml-auto h-6 shrink-0 whitespace-nowrap px-1.5 text-[12px]">
            {expanded ? "Show fewer" : `Show ${rows.length - AUDIENCES_SHOWN} more`}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Cost, value and return over time ──────────────────────────────────────

/**
 * Three curves over time for this workflow across ALL client orgs (the fleet), on THIS
 * crew's leg only: cumulative cost, cumulative pipeline value, and their ratio, each as
 * features-service states it. The leg narrows both spend and value to the campaigns that
 * perform it, so a reply-led crew never shows a visit-led campaign's value (prod
 * 2026-09-27: $1,080 of maelstrom's $1,089 came from a start_to_website_visit campaign
 * while the page was open on start_to_conversation).
 * The fleet is the grain where a workflow has a history (on one brand it is 0 to 2 days),
 * and it is the grain the table's Global column speaks. No org is named. Nothing is
 * divided here; a day the producer states no figure for is left out of that chart.
 *
 * USER COST (default, everyone on the beta list) is what clients were billed, net.
 * ACTUAL COST (STAFF only) is the same curve costed at what the vendors charged us before
 * our markup. It reveals our margin, so the switch is offered to the staff list alone and
 * the gateway refuses anyone else. The value curve is the same on both bases.
 */
function OverTime({ featureSlug, legKey, dynasty }: { featureSlug: string; legKey: string; dynasty: string }) {
  // The basis is the page's (the switch in the top bar), shared with every cost page.
  const { actual } = useCostBasis();
  const q = useAuthQuery(
    ["fleetWorkflowReturn", featureSlug, dynasty, legKey],
    () => getFleetWorkflowReturnHistory(featureSlug, dynasty, legKey),
    pollOptions,
  );
  const actualQ = useAuthQuery(
    ["fleetWorkflowActualCost", featureSlug, dynasty, legKey],
    () => getFleetWorkflowActualCostHistory(featureSlug, dynasty, legKey),
    { ...pollOptions, enabled: actual, retry: false },
  );
  const src = actual ? actualQ : q;
  // Answered once stays answered: a failed poll must not repaint a skeleton.
  const pending = src.data === undefined && !src.isFetchedAfterMount;
  const failed = src.data === undefined && src.isFetchedAfterMount;
  const daily: { date: string; cumulativeSpendUsd: number | null; cumulativePipelineUsd: number; roiMultiple: number | null }[] =
    actual ? (actualQ.data?.daily ?? []) : (q.data ?? []);
  // A real time axis: the producer omits days with no spend and no outcome, so a category
  // axis squeezed a quiet month into one step.
  const points = daily.map((d) => ({
    t: Date.parse(`${d.date}T00:00:00Z`),
    date: d.date,
    spend: d.cumulativeSpendUsd,
    value: d.cumulativePipelineUsd,
    roi: d.roiMultiple,
  }));
  const spendPoints = points.filter((p) => p.spend != null);
  const roiPoints = points.filter((p) => p.roi != null);
  const unpriced = actual ? actualQ.data?.unpricedBilledCostUsd ?? 0 : 0;
  const unpricedFrom = actual ? actualQ.data?.unpricedFromDate ?? null : null;
  const unreadable = actual
    ? actualQ.isFetchedAfterMount && !actualQ.isError && actualQ.data === null
    : q.isFetchedAfterMount && !q.isError && q.data === null;

  return (
    <section>
      <SectionTitle right={actual ? <span>Actual cost</span> : undefined}>
        Over time <span className="k-fg3 font-normal">· all clients on this crew</span>
      </SectionTitle>
      {unreadable && (
        <p className="k-fg3 mb-2 text-[12px]">We could not read the {actual ? "actual cost" : "billed cost"} for this workflow just now.</p>
      )}
      {unpriced > 0 && (
        <p className="k-fg3 mb-2 text-[12px]">
          {formatUsdAdaptive(unpriced)} of billed spend
          {unpricedFrom ? ` from ${unpricedFrom}` : ""} has no known vendor cost, so the actual cost and return stop there.
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        <ChartCard
          title="Cost to run it"
          note={actual ? "What the vendors charged us, before our margin, to date." : "What all clients were billed for it, to date."}
          pending={pending}
          failed={failed}
          data={spendPoints}
          dataKey="spend"
          format={formatUsdAdaptive}
        />
        <ChartCard
          title="Value generated"
          note="The pipeline value its outcomes are worth, to date."
          pending={pending}
          failed={failed}
          data={points}
          dataKey="value"
          format={formatUsdAdaptive}
        />
        <ChartCard
          title="Return on spend"
          note={actual ? "Value divided by what it actually cost us." : "Value divided by what was billed."}
          pending={pending}
          failed={failed}
          data={roiPoints}
          dataKey="roi"
          format={(v) => formatRoi(v, "—")}
        />
      </div>
    </section>
  );
}

function ChartCard({
  title,
  note,
  pending,
  failed,
  data,
  dataKey,
  format,
}: {
  title: string;
  note: string;
  pending: boolean;
  failed: boolean;
  data: { t: number; date: string; spend: number | null; value: number; roi: number | null }[];
  dataKey: "spend" | "value" | "roi";
  format: (v: number) => string;
}) {
  const last = data.length ? data[data.length - 1][dataKey] : null;
  return (
    <div className="k-card flex min-w-0 flex-col px-4 pb-3 pt-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="k-label truncate">{title}</span>
      </div>
      <div className="mt-2 text-[22px] font-medium leading-7 tracking-[-0.02em] tabular-nums">
        {pending ? <Shimmer className="h-7 w-20" /> : last == null ? <span className="k-fg4">—</span> : format(last)}
      </div>
      <p className="k-fg3 mt-0.5 text-[12px]">{note}</p>
      <div className="mt-3 h-[120px]">
        {pending ? (
          <Shimmer className="h-full w-full" />
        ) : failed ? (
          <p className="k-fg3 pt-10 text-center text-[12px]">We could not read this curve just now.</p>
        ) : data.length === 0 ? (
          <p className="k-fg3 pt-10 text-center text-[12px]">No dated history for this workflow yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tick={{ fontSize: 11, fill: "var(--fg-3)" }}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
                tickFormatter={(t: number) => new Date(t).toISOString().slice(5, 10)}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--fg-3)" }}
                tickLine={false}
                axisLine={false}
                width={44}
                tickCount={3}
                tickFormatter={(v: number) => format(v)}
              />
              <Tooltip
                cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }}
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="k-popover px-2.5 py-1.5 text-[12px]">
                      <p className="k-fg3 k-mono">{new Date(Number(label)).toISOString().slice(0, 10)}</p>
                      <p className="font-medium tabular-nums">{format(Number(payload[0].value))}</p>
                    </div>
                  ) : null
                }
              />
              <Line type="stepAfter" dataKey={dataKey} stroke="var(--accent)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ─── Layers ─────────────────────────────────────────────────────────────────

/** Portals to the shell's own layer (the sidebar drawer's transform traps `fixed`), and
 *  closes on Esc. */
function V2Layer({ onEscape, children }: { onEscape: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onEscape();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEscape]);
  const host = typeof document === "undefined" ? null : (document.getElementById("v2-portal") ?? document.body);
  return host ? createPortal(children, host) : null;
}

function CloseButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label="Close" className="k-btn-ghost h-7 w-7 justify-center px-0">
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    </button>
  );
}

// ─── Prompt ─────────────────────────────────────────────────────────────────

const UPGRADE_WARNING =
  "Every campaign on this workflow, for every brand, writes with the edited prompt from its next run. The current prompt is kept as it is; the edit becomes a new template.";
const FORK_WARNING =
  "A new workflow is created that writes with the edited prompt. It joins this channel's catalogue for every brand and can be picked for any campaign. The original is untouched.";

/**
 * The prompt template the workflow writes with, read by the type its DAG names.
 *
 * Everyone on the beta list can READ it. EDITING is staff-only: a fork or an upgrade
 * changes what every brand's campaigns can send, so the control is offered only to the
 * staff list (and the gateway refuses anyone else whatever the page shows). The two
 * actions are workflow-service's (#454); a refusal is shown in its own words.
 */
function PromptCard({
  promptType,
  dynasty,
  workflowName,
  featureSlug,
  onForked,
}: {
  promptType: string | null;
  dynasty: string;
  workflowName: string;
  featureSlug: string;
  onForked: (newDynasty: string) => void;
}) {
  const { staffMode: isStaff } = useStaffMode();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"upgrade" | "fork" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const q = useAuthQuery(["platformPrompt", promptType ?? "none"], () => getPlatformPrompt(promptType as string), {
    ...pollOptions,
    enabled: open && Boolean(promptType),
    retry: false,
  });
  const original = q.data?.prompt ?? "";
  const editing = draft !== null;
  const changed = editing && draft !== original;
  const promptPending = q.data === undefined && !q.isFetchedAfterMount;
  const promptFailed = q.data === undefined && q.isFetchedAfterMount;

  const close = () => {
    if (busy) return;
    setOpen(false);
    setDraft(null);
    setConfirm(null);
    setError(null);
  };
  const onEscape = () => {
    if (busy) return;
    if (confirm) setConfirm(null);
    else close();
  };

  const run = async (action: "upgrade" | "fork") => {
    if (draft === null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await editWorkflowPrompt(dynasty, action, draft);
      await queryClient.invalidateQueries({ queryKey: ["workflows", featureSlug] });
      setConfirm(null);
      setDraft(null);
      setOpen(false);
      if (res.action === "forked") onForked(res.workflow.workflowDynastySlug);
      else setNotice(`Upgraded to version ${res.workflow.version}. It now writes with ${res.promptTemplate.type}.`);
    } catch (err) {
      console.error("[dashboard] prompt edit failed", err);
      const producer = err instanceof ApiError && typeof err.body?.error === "string" ? (err.body.error as string) : null;
      setConfirm(null);
      setError(
        err instanceof ApiError && err.status === 403
          ? "Only staff can edit a prompt."
          : (producer ?? "We could not save this edit. Nothing was changed."),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="k-card p-4">
      <p className="k-label">Prompt</p>
      <p className="k-mono k-fg2 mt-2 truncate text-[12px]">{promptType ?? "This workflow names no prompt template."}</p>
      {promptType && (
        <button type="button" onClick={() => setOpen(true)} className="k-btn mt-3">
          See the prompt
        </button>
      )}
      {notice && <p className="mt-3 text-[12px] text-[var(--run)]">{notice}</p>}
      {open && (
        <V2Layer onEscape={onEscape}>
          <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-[#1010121f] p-3 md:p-8" onMouseDown={close}>
            <div
              role="dialog"
              aria-label="Prompt"
              className="k-popover flex w-full max-w-5xl flex-col overflow-hidden"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 border-b border-[var(--line-subtle)] px-4 py-2.5">
                <div className="min-w-0">
                  <p className="k-label">Prompt</p>
                  <p className="k-mono truncate text-[13px]">{promptType}</p>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  {isStaff && !editing && q.data && (
                    <button type="button" onClick={() => setDraft(original)} className="k-btn">
                      Edit
                    </button>
                  )}
                  <CloseButton onClick={close} disabled={busy} />
                </div>
              </div>
              <div className="min-h-0 flex-1 p-4">
                {promptPending ? (
                  <Shimmer className="h-full w-full" />
                ) : promptFailed ? (
                  <EmptyNote>We could not read this prompt just now.</EmptyNote>
                ) : (
                  <textarea
                    readOnly={!editing}
                    value={editing ? draft : original}
                    onChange={(e) => setDraft(e.target.value)}
                    aria-label="Prompt text"
                    className={`k-mono h-full w-full resize-none rounded-[8px] p-4 text-[13px] leading-relaxed text-[var(--fg-1)] outline-none ${
                      editing
                        ? "bg-[var(--bg-raised)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--accent)_60%,transparent)]"
                        : "bg-[var(--bg-inset)] shadow-[inset_0_0_0_1px_var(--line-subtle)]"
                    }`}
                  />
                )}
              </div>
              {editing && (
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line-subtle)] px-4 py-2.5">
                  {error && <p className="mr-auto text-[13px] text-[var(--data-rose)]">{error}</p>}
                  <button type="button" disabled={busy} onClick={() => { setDraft(null); setError(null); }} className="k-btn">
                    Cancel
                  </button>
                  <button type="button" disabled={!changed || busy} onClick={() => setConfirm("fork")} className="k-btn disabled:opacity-40">
                    Fork
                  </button>
                  <button type="button" disabled={!changed || busy} onClick={() => setConfirm("upgrade")} className="k-btn-accent disabled:opacity-40">
                    Upgrade
                  </button>
                </div>
              )}
            </div>
            {confirm && (
              <div
                className="fixed inset-0 z-[61] flex items-center justify-center bg-[#1010121f] p-4"
                onMouseDown={(e) => { e.stopPropagation(); if (!busy) setConfirm(null); }}
              >
                <div role="alertdialog" aria-label="Confirm" className="k-popover w-full max-w-md p-4" onMouseDown={(e) => e.stopPropagation()}>
                  <p className="text-[14px] font-medium">
                    {confirm === "upgrade" ? `Upgrade ${workflowName}?` : `Fork ${workflowName}?`}
                  </p>
                  <p className="k-fg2 mt-2 text-[13px]">{confirm === "upgrade" ? UPGRADE_WARNING : FORK_WARNING}</p>
                  <div className="mt-4 flex justify-end gap-2">
                    <button type="button" disabled={busy} onClick={() => setConfirm(null)} className="k-btn">
                      Cancel
                    </button>
                    <button type="button" disabled={busy} onClick={() => run(confirm)} className={`k-btn-accent ${busy ? "cursor-wait" : ""}`}>
                      {busy ? (confirm === "upgrade" ? "Upgrading..." : "Forking...") : confirm === "upgrade" ? "Upgrade" : "Fork"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </V2Layer>
      )}
    </div>
  );
}

// ─── Past runs ──────────────────────────────────────────────────────────────

/**
 * Every run this workflow made for the brand, newest first. runs-service files a run
 * under the VERSIONED slug, so the dynasty's history is read per version (the most
 * recent few) and merged by start time — a union of disjoint sets, not a computed figure.
 */
function RunsCard({
  orgId,
  brandId,
  dynasty,
  versions,
}: {
  orgId: string;
  brandId: string;
  dynasty: string;
  versions: string[];
}) {
  const [openRun, setOpenRun] = useState<RunRow | null>(null);
  const [expanded, setExpanded] = useState(false);
  const { actual } = useCostBasis();
  const read = versions.slice(0, RUN_VERSIONS);
  // On the Actual basis the list comes from the staff vendor twin: the same runs, each with
  // its whole subtree's cost billed and at vendor cost (runs-service #256).
  const q = useAuthQuery(
    [actual ? "workflowRunsActual" : "workflowRuns", brandId, dynasty, read.join(",")],
    async (): Promise<(RunRow & { vendorCents?: number | null })[]> => {
      const lists = await Promise.all(
        read.map(async (v) => {
          const opts = { workflowSlug: v, taskName: "execute-workflow", limit: RUNS_PER_VERSION };
          if (!actual) return listBrandRunLedger(brandId, { ...opts, subtreeCost: true });
          const runs = await listBrandRunLedgerVendor(brandId, opts);
          // A run carrying billed rows of no known vendor cost states none (null): the priced
          // part alone would read as the whole run.
          return runs.map((r) => ({ ...r, vendorCents: r.unpricedCostNames.length ? null : Number(r.vendorTotalCostInUsdCents) }));
        }),
      );
      return lists
        .flat()
        .sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0))
        .slice(0, RUNS_READ);
    },
    { ...pollOptions, enabled: read.length > 0 },
  );
  const { missionByCampaignId } = useMissions(orgId, brandId, { allOffers: true });
  const runs = q.data ?? [];
  const shown = expanded ? runs : runs.slice(0, RUNS_SHOWN);
  const pending = read.length > 0 && q.data === undefined && !q.isFetchedAfterMount;
  const failed = q.data === undefined && q.isFetchedAfterMount;

  return (
    <section>
      <SectionTitle count={q.data ? runs.length : null} right={<span>Open one to read the emails it wrote</span>}>
        Past runs
      </SectionTitle>
      <div className="k-card overflow-hidden">
        <div className="k-scroll relative overflow-x-auto">
          <table className="w-full min-w-[620px] text-[13px]">
            <thead>
              <tr className="border-b border-[var(--line-subtle)]">
                <th className={`${TH} w-44`}>Time</th>
                <th className={TH}>Lead</th>
                <th className={TH}>Mission</th>
                <th className={`${TH} w-28`}>Status</th>
                <th className={`${TH} w-20 text-right`}>Took</th>
                <th className={`${TH} w-20 text-right`}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {pending ? (
                [0, 1, 2, 3].map((i) => (
                  <tr key={i} className="k-row h-10">
                    <td colSpan={6} className="px-4">
                      <Shimmer className="h-4 w-full" />
                    </td>
                  </tr>
                ))
              ) : failed ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyNote>We could not read its runs just now.</EmptyNote>
                  </td>
                </tr>
              ) : runs.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyNote>It has not run for this brand yet.</EmptyNote>
                  </td>
                </tr>
              ) : (
                shown.map((run) => {
                  const m = run.campaignId ? missionByCampaignId.get(run.campaignId) ?? null : null;
                  // A workflow run's cost lives on the runs it spawned: its SUBTREE total, on
                  // both bases (billed on User cost, vendor on Actual cost).
                  const cost = actual ? (run.vendorCents ?? NaN) : Number(run.totalCostInUsdCents ?? NaN);
                  return (
                    <RunLine key={run.id} brandId={brandId} run={run} onOpen={() => setOpenRun(run)}>
                      <td className="k-mono k-fg2 whitespace-nowrap pl-4 pr-3 text-[12px]">{friendlyDateTime(run.startedAt)}</td>
                      <td className="max-w-0 px-3">
                        {m ? (
                          <span className="flex min-w-0 items-center gap-1.5">
                            <CrewMark color={m.crew.color} glyph={m.crew.glyph} />
                            <span className="truncate">
                              {m.crew.name}
                              <span className="k-fg2"> · {m.offerName ?? "Offer"}</span>
                            </span>
                          </span>
                        ) : (
                          <span className="k-fg4">—</span>
                        )}
                      </td>
                      <td className="px-3">
                        <RunStatus status={run.status} />
                      </td>
                      <td className="k-mono k-fg2 px-3 text-right text-[12px]">
                        {run.completedAt ? durationLabel(run.startedAt, run.completedAt) : <span className="k-fg4">—</span>}
                      </td>
                      <td className="pl-3 pr-4 text-right tabular-nums">
                        {Number.isFinite(cost) && cost > 0 ? formatCentsAsUsdAdaptive(cost) : <span className="k-fg4">—</span>}
                      </td>
                    </RunLine>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {runs.length > 0 && (
          <div className="k-fg3 flex items-center gap-3 border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px] tabular-nums">
            <span>
              {shown.length} of {runs.length} most recent runs
            </span>
            {runs.length > RUNS_SHOWN && (
              <button type="button" onClick={() => setExpanded((v) => !v)} className="k-btn-ghost ml-auto h-6 shrink-0 whitespace-nowrap px-1.5 text-[12px]">
                {expanded ? "Show fewer" : `Show ${runs.length - RUNS_SHOWN} more`}
              </button>
            )}
          </div>
        )}
      </div>
      {openRun && <RunDrawer brandId={brandId} run={openRun} onClose={() => setOpenRun(null)} />}
    </section>
  );
}

/**
 * One run's row. It reads the emails that run wrote (the SAME key the drawer reads, so
 * opening it is instant) to name who the run wrote to: the company, then the person,
 * the way a Work card names them. A run that served nobody wrote nothing, so it says so
 * and does not open onto an empty drawer.
 */
function RunLine({
  brandId,
  run,
  onOpen,
  children,
}: {
  brandId: string;
  run: RunRow;
  onOpen: () => void;
  children: React.ReactNode[];
}) {
  const q = useAuthQuery(["runEmails", brandId, run.id], () => listRunEmails(brandId, run.id), {
    // A finished run's emails never change; only a run still going is re-read.
    refetchInterval: run.status === "running" ? POLL_INTERVAL : false,
  });
  const emails = q.data ?? [];
  const pending = q.data === undefined && !q.isFetchedAfterMount;
  const wroteNothing = q.data !== undefined && emails.length === 0 && run.status !== "running";
  const first = emails[0] ?? null;
  const person = first ? [first.leadFirstName, first.leadLastName].filter(Boolean).join(" ") : "";
  const company = first?.leadCompany || null;
  const [time, ...rest] = children;
  return (
    <tr
      onClick={wroteNothing ? undefined : onOpen}
      className={`k-row h-10 ${wroteNothing ? "" : "cursor-pointer"}`}
    >
      {time}
      <td className="max-w-0 px-3">
        {pending ? (
          <Shimmer className="h-4 w-32" />
        ) : first ? (
          <span className="flex min-w-0 items-center gap-1.5">
            {company ? (
              <CompanyMark name={company} domain={first.leadOrganizationDomain ?? null} size={16} />
            ) : (
              <Initials name={person || "?"} size={16} round />
            )}
            <span className="truncate">
              <span className="font-medium">{company ?? (person || "A lead")}</span>
              {company && person && <span className="k-fg2"> · {person}</span>}
              {emails.length > 1 && <span className="k-fg3"> +{emails.length - 1}</span>}
            </span>
          </span>
        ) : wroteNothing ? (
          <span className="k-fg3">Nobody to write to</span>
        ) : (
          <span className="k-fg4">—</span>
        )}
      </td>
      {rest}
    </tr>
  );
}

function durationLabel(start: string, end: string): string {
  const s = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** A dot plus a capitalised word, in the state's colour. */
function RunStatus({ status }: { status: string }) {
  const color =
    status === "running" ? "var(--run)" : status === "completed" ? "var(--data-teal)" : status === "failed" ? "var(--data-rose)" : "var(--fg-3)";
  const word = status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown";
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--fg-2)]">
      <span
        className={`h-1.5 w-1.5 rounded-full ${status === "running" ? "k-dot-pulse" : ""}`}
        style={{ background: color, color }}
      />
      {word}
    </span>
  );
}

/** The emails ONE run wrote, in a drawer pinned to the viewport. */
function RunDrawer({ brandId, run, onClose }: { brandId: string; run: RunRow; onClose: () => void }) {
  const q = useAuthQuery(["runEmails", brandId, run.id], () => listRunEmails(brandId, run.id), pollOptions);
  const emails = q.data ?? [];
  const pending = q.data === undefined && !q.isFetchedAfterMount;
  const failed = q.data === undefined && q.isFetchedAfterMount;
  return (
    <V2Layer onEscape={onClose}>
      <div className="fixed inset-0 z-[60] bg-[#1010121f]" onMouseDown={onClose}>
        <div
          role="dialog"
          aria-label="Run"
          className="k-popover fixed inset-y-0 right-0 flex w-full flex-col overflow-hidden rounded-none md:inset-y-2 md:right-2 md:w-[36rem] md:max-w-[94vw] md:rounded-[12px]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 border-b border-[var(--line-subtle)] px-4 py-2.5">
            <div className="min-w-0">
              <p className="k-label">Run</p>
              <p className="truncate text-[13px] font-medium">{friendlyDateTime(run.startedAt)}</p>
              <p className="k-mono k-fg3 truncate text-[12px]">{run.workflowSlug}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <RunStatus status={run.status} />
              <CloseButton onClick={onClose} />
            </div>
          </div>
          <div className="k-scroll min-h-0 flex-1 space-y-3 overflow-y-auto bg-[var(--bg-surface)] p-4">
            {pending ? (
              [0, 1].map((i) => <Shimmer key={i} className="h-40 w-full rounded-[12px]" />)
            ) : failed ? (
              <EmptyNote>We could not read this run&apos;s emails just now.</EmptyNote>
            ) : emails.length === 0 ? (
              <EmptyNote>This run wrote no email.</EmptyNote>
            ) : (
              emails.map((e) => <EmailCard key={e.id} email={e} />)
            )}
          </div>
        </div>
      </div>
    </V2Layer>
  );
}

function EmailCard({ email }: { email: Email }) {
  const who = [email.leadFirstName, email.leadLastName].filter(Boolean).join(" ");
  const about = [email.leadTitle, email.leadCompany].filter(Boolean).join(" at ");
  const steps = email.sequence ?? [];
  return (
    <div className="k-card p-4">
      <p className="text-[13px] font-medium">{who || "A lead we could not name"}</p>
      {about && <p className="k-fg3 text-[12px]">{about}</p>}
      <p className="k-label mt-3">Subject</p>
      <p className="mt-0.5 text-[13px]">{email.subject || <span className="k-fg4">—</span>}</p>
      {steps.length > 0 ? (
        steps.map((s) => (
          <div key={s.step} className="mt-3">
            <p className="k-label">
              {s.step === 1 ? "Initial email" : `Follow-up ${s.step - 1}`}
              {s.step > 1 && ` · ${s.daysSinceLastStep} days later`}
            </p>
            <p className="mt-1 whitespace-pre-line text-[13px]">{s.bodyText}</p>
          </div>
        ))
      ) : (
        <p className="mt-3 whitespace-pre-line text-[13px]">{email.bodyText ?? ""}</p>
      )}
    </div>
  );
}
