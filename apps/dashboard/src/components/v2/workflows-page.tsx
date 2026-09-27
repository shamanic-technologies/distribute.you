"use client";

import { useParams, useRouter } from "next/navigation";
import { MaturityBadge } from "@/components/maturity-badge";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { WorkflowStackLine } from "@/components/workflows/workflow-cells";
import { GrainMark } from "@/components/marks/grain-mark";
import { CrewMark } from "@/components/v2/crew-mark";
import { V2Page } from "@/components/v2/setup-pages";
import { EmptyNote, Shimmer } from "@/components/v2/ui";
import { formatUsdAdaptive } from "@/lib/format-number";
import { grainFigures, scopeLadderRows } from "@/lib/workflow-grains";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { v2WorkflowHref } from "@/lib/v2/routes";
import { crewParam, useBrandCrewSpecs, useCrewWorkflowRanking, type CrewSpec } from "@/components/v2/workflows-data";

const GLOBAL_TIP =
  "What this workflow costs per outcome across every client we run it for. The benchmark the ranking falls back on when your own evidence is thin.";
const BRAND_TIP =
  "What this workflow has cost per outcome for this brand, across every campaign it ran for. A dash means it has not spent anything here.";
const RANK_TIP =
  "The order we would put this crew's campaigns on next, read as the ranking serves it. It is scored over every figure the workflow has, audiences included, so it does not always follow the two columns shown here.";
const CREW_TIP =
  "The crew this row is priced for. A crew is a channel plus the step it lands on, and a cost per outcome only means something once the outcome is named, so one workflow gets one row per crew.";

/**
 * Every workflow the brand's crews can run, side by side at BRAND grain, beta.
 *
 * One table, one group of rows per crew: Global (the fleet) then Brand. There is no
 * campaign or audience column at this level — those live on a mission's own Workflows
 * tab. A row opens the workflow's own page.
 */
export function V2WorkflowsPage() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const isBeta = useIsBetaUser();
  const { specs, settled } = useBrandCrewSpecs(orgId, brandId);

  return (
    <V2Page
      crumbs={[{ label: "Workflows" }]}
      title={
        <span className="flex items-center gap-2">
          Workflows <MaturityBadge level="beta" />
        </span>
      }
      sub="Every workflow your crews can run, priced across every client and for this brand."
      width="max-w-none"
    >
      {!isBeta ? (
        <div className="k-card">
          <EmptyNote>This page is still in beta and is not open on your account yet.</EmptyNote>
        </div>
      ) : !settled ? (
        <Shimmer className="h-64 w-full rounded-xl" />
      ) : specs.length === 0 ? (
        <div className="k-card">
          <EmptyNote>No mission is set up yet, so no crew has workflows to compare.</EmptyNote>
        </div>
      ) : (
        <div className="k-card overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="k-fg3 text-left text-[12px]">
                <th className="px-4 py-2.5 font-normal">
                  <span className="inline-flex items-center gap-1">Workflow <InfoTooltip tip={RANK_TIP} placement="top" /></span>
                </th>
                <th className="px-4 py-2.5 font-normal">
                  <span className="inline-flex items-center gap-1">Crew <InfoTooltip tip={CREW_TIP} placement="top" /></span>
                </th>
                <th className="px-4 py-2.5 text-right font-normal">
                  <span className="inline-flex items-center gap-1.5">
                    <GrainMark grain="crossOrg" size={14} /> Global <InfoTooltip tip={GLOBAL_TIP} placement="top" />
                  </span>
                </th>
                <th className="px-4 py-2.5 text-right font-normal">
                  <span className="inline-flex items-center gap-1.5">
                    <GrainMark grain="brand" size={14} /> Brand <InfoTooltip tip={BRAND_TIP} placement="top" />
                  </span>
                </th>
              </tr>
            </thead>
            {specs.map((spec) => (
              <CrewRows key={crewParam(spec)} spec={spec} orgId={orgId} brandId={brandId} />
            ))}
          </table>
        </div>
      )}
    </V2Page>
  );
}

/** One crew's rows. A component of its own because each crew is its own ranking read. */
function CrewRows({ spec, orgId, brandId }: { spec: CrewSpec; orgId: string; brandId: string }) {
  const router = useRouter();
  const r = useCrewWorkflowRanking(brandId, spec, true);
  const brandRows = scopeLadderRows(r.allLadderRows, null);
  const bySlug = new Map(brandRows.map((row) => [row.workflow.workflowDynastySlug, row]));
  const noun = r.outcomeNoun.toLowerCase();

  if (r.pending) {
    return (
      <tbody>
        <tr className="k-line-subtle border-t">
          <td colSpan={4} className="px-4 py-3">
            <Shimmer className="h-6 w-full" />
          </td>
        </tr>
      </tbody>
    );
  }

  return (
    <tbody>
      {r.ladderError && (
        <tr className="k-line-subtle border-t">
          <td colSpan={4} className="k-fg3 px-4 py-2 text-[12px]">
            We could not read {spec.crew.name}&apos;s ranking just now, so its workflows are listed unordered.
          </td>
        </tr>
      )}
      {r.ranked.map((w) => {
        const ladder = bySlug.get(w.row.workflowDynastySlug) ?? null;
        const global = grainFigures(ladder?.estimatesByGrain.crossOrg);
        const brand = grainFigures(ladder?.estimatesByGrain.brand);
        const href = v2WorkflowHref(orgId, brandId, w.row.workflowDynastySlug, crewParam(spec));
        return (
          <tr
            key={w.row.workflowDynastySlug}
            role="button"
            tabIndex={0}
            onClick={() => router.push(href)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                router.push(href);
              }
            }}
            onMouseEnter={() => router.prefetch(href)}
            className="k-line-subtle cursor-pointer border-t hover:bg-[var(--bg-hover)]"
          >
            <td className="px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="k-fg2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--bg-selected)] px-1.5 text-[11px] tabular-nums">
                  {w.rank ?? "—"}
                </span>
                <span className="truncate font-medium">{w.row.workflowDynastyName}</span>
              </div>
              <WorkflowStackLine contentModel={w.row.contentModel ?? null} contentPromptType={w.row.contentPromptType ?? null} />
            </td>
            <td className="px-4 py-2.5">
              <span className="inline-flex items-center gap-2">
                <CrewMark color={spec.crew.color} glyph={spec.crew.glyph} size={16} />
                {spec.crew.name}
              </span>
            </td>
            <CostCell value={global?.costPerOutcomeUsd ?? null} noun={noun} />
            <CostCell value={brand?.costPerOutcomeUsd ?? null} noun={noun} />
          </tr>
        );
      })}
    </tbody>
  );
}

function CostCell({ value, noun }: { value: number | null; noun: string }) {
  return (
    <td className="px-4 py-2.5 text-right tabular-nums">
      {value == null ? (
        <span className="k-fg3">—</span>
      ) : (
        <>
          <span className="font-medium">{formatUsdAdaptive(value)}</span>
          <span className="k-fg3 text-[11px]"> / {noun}</span>
        </>
      )}
    </td>
  );
}
