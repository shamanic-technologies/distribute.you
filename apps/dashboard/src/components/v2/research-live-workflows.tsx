"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getWorkflowRankLadder, listChannelWorkflows } from "@/lib/api";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { legKeyForSteps } from "@/lib/legs";
import { useCostBasis } from "@/lib/v2/use-cost-basis";
import { formatUsdAdaptive } from "@/lib/format-number";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { useBrandMissionSpecs } from "@/components/v2/workflows-data";
import { EmptyNote, Shimmer } from "@/components/v2/ui";
import { CREW_KEY, researchCatalogHref, type ResearchCatalog, type ResearchCrew } from "@/lib/research/research";
import { liveWorkflowRows, type LiveLadderRow } from "@/lib/research/live-workflows";

/**
 * A crew's workflows as the producer ranks them RIGHT NOW, at the crew's leg: the order
 * campaign-service picks from, the price per outcome, whether each row is mature, and its return.
 *
 * The ladder is asked with this brand's mission on that leg when it runs one (so the order is
 * exactly the one its campaign picks from), else with no campaign. The query key is byte-equal
 * to the v2 Workflows pages', so the two dedupe. Nothing is ranked or divided here.
 */

const TH = "k-label px-3 py-2.5 text-left font-medium first:pl-4 last:pr-4";

/** The crew's leg in the fleet's own key, or null when the crew's step starts no entry leg. */
export function useResearchCrewLeg(crew: ResearchCrew): string | null {
  const catalogue = useLegCatalogue();
  return legKeyForSteps(catalogue, null, CREW_KEY[crew].step);
}

export function ResearchLiveWorkflows({
  base,
  crew,
  legKey,
  catalog,
  outcomeUnit,
  nav,
}: {
  base: string;
  crew: ResearchCrew;
  legKey: string;
  catalog: ResearchCatalog;
  outcomeUnit: string;
  nav: (href: string) => void;
}) {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const featureSlug = CREW_KEY[crew].channel;
  const { specs, settled } = useBrandMissionSpecs(orgId, brandId);
  // A brand selling several offers must name a campaign (the producer 409s `several_offers`
  // otherwise). This leg's own mission first; else any mission on the same channel, which
  // names the offer: the ranking of a leg it does not run is the fleet's, priced the same way.
  const campaignId = useMemo(
    () =>
      (specs.find((s) => s.featureSlug === featureSlug && s.legKey === legKey) ??
        specs.find((s) => s.featureSlug === featureSlug))?.campaignId ?? null,
    [specs, featureSlug, legKey],
  );
  const { actual } = useCostBasis();
  const ready = Boolean(brandId) && settled;

  const ladderQ = useAuthQuery(
    [actual ? "workflowRankLadderActual" : "workflowRankLadder", brandId, legKey, campaignId ?? "none"],
    () => getWorkflowRankLadder({ featureSlug, brandId, leg: legKey, campaignId, actual }),
    { ...pollOptions, enabled: ready, retry: false },
  );
  const catalogueQ = useAuthQuery(["workflows", featureSlug], () => listChannelWorkflows(featureSlug), {
    ...pollOptions,
    enabled: ready,
  });

  const rows = useMemo(
    () => liveWorkflowRows((ladderQ.data?.rows ?? []) as unknown as LiveLadderRow[]),
    [ladderQ.data],
  );
  // The model and template each workflow writes with: its newest version's, from the catalogue.
  const stack = useMemo(() => {
    const m = new Map<string, { version: number; model: string | null; template: string | null }>();
    for (const w of catalogueQ.data ?? []) {
      const prev = m.get(w.workflowDynastySlug);
      if (!prev || w.version > prev.version) {
        m.set(w.workflowDynastySlug, { version: w.version, model: w.contentModel ?? null, template: w.contentPromptType ?? null });
      }
    }
    return m;
  }, [catalogueQ.data]);
  const researched = useMemo(() => new Set(catalog[crew].workflows.map((w) => w.key)), [catalog, crew]);

  const answered = ladderQ.data !== undefined || ladderQ.isFetchedAfterMount;
  const failed = ladderQ.data === undefined && ladderQ.isFetchedAfterMount;
  const firstRow = rows.find((r) => r.first);
  const cashRow = rows.find((r) => r.cash);

  return (
    <div className="k-card overflow-hidden">
      <div className="k-fg2 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--line-subtle)] px-4 py-2.5 text-[12px]">
        <span className="inline-flex items-center gap-1.5">
          <span className="k-dot-pulse h-1.5 w-1.5 rounded-full bg-[var(--run)] text-[var(--run)]" />
          Live ranking
        </span>
        {firstRow && (
          <span>
            Goes first: <span className="k-fg font-medium">{firstRow.name ?? firstRow.slug}</span>
          </span>
        )}
        <span>
          Money goes to:{" "}
          {cashRow ? (
            <span className="k-fg font-medium">{cashRow.name ?? cashRow.slug}</span>
          ) : (
            <span className="k-fg3">no mature workflow yet</span>
          )}
        </span>
      </div>
      <div className="k-scroll relative overflow-x-auto">
        <table className="w-full min-w-[1180px] text-[13px]">
          <thead>
            <tr className="border-b border-[var(--line-subtle)]">
              <th className={`${TH} w-12`}>#</th>
              <th className={TH}>Workflow</th>
              <th className={`${TH} w-40`}>LLM</th>
              <th className={`${TH} w-44`}>Template</th>
              <th className={`${TH} w-36 text-right`}>Cost {outcomeUnit.replace("/ ", "per ")}</th>
              <th className={`${TH} w-28`}>Status</th>
              <th className={`${TH} w-24 text-right`}>ROI</th>
              <th className={`${TH} w-24 text-right`}>Rate</th>
              <th className={`${TH} w-24 text-right`}>Outcomes</th>
              <th className={`${TH} w-24 text-right`}>Invested</th>
            </tr>
          </thead>
          <tbody>
            {!answered ? (
              [0, 1, 2, 3, 4].map((i) => (
                <tr key={i} className="k-row h-10">
                  <td colSpan={10} className="px-4">
                    <Shimmer className="h-4 w-full" />
                  </td>
                </tr>
              ))
            ) : failed ? (
              <tr>
                <td colSpan={10}>
                  <EmptyNote>
                    {campaignId
                      ? "We could not read the live ranking just now. It retries on its own."
                      : "This brand sells several offers and runs no mission on this channel, so the ranking cannot tell which offer to price."}
                  </EmptyNote>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={10}>
                  <EmptyNote>No workflow is on this leg yet.</EmptyNote>
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const s = stack.get(r.slug);
                const href = researched.has(r.slug) ? researchCatalogHref(base, crew, "workflows", r.slug) : null;
                return (
                  <tr
                    key={r.slug}
                    onClick={href ? () => nav(href) : undefined}
                    className={`k-row h-10 ${href ? "cursor-pointer" : ""} ${r.cash ? "k-selected" : ""}`}
                  >
                    <td className="k-mono k-fg3 pl-4 pr-3 text-[12px] tabular-nums">{r.rank ?? "—"}</td>
                    <td className="max-w-0 px-3">
                      <div className="flex min-w-0 items-center gap-2">
                        {href ? (
                          <Link href={href} className="min-w-0 truncate font-medium" title={r.name ?? r.slug}>
                            {r.name ?? r.slug}
                          </Link>
                        ) : (
                          <span className="min-w-0 truncate font-medium" title={r.name ?? r.slug}>
                            {r.name ?? r.slug}
                          </span>
                        )}
                        {r.first && <span className="k-chip shrink-0">Goes first</span>}
                        {r.cash && <span className="k-chip shrink-0 text-[var(--run)]">Money goes here</span>}
                        {r.assignment === "deprecated" && <span className="k-chip k-fg3 shrink-0">Deprecated on this leg</span>}
                      </div>
                    </td>
                    <td className="k-fg2 max-w-0 truncate px-3">{s?.model ?? <span className="k-fg4">—</span>}</td>
                    <td className="k-fg2 max-w-0 truncate px-3">{s?.template ?? <span className="k-fg4">—</span>}</td>
                    <td className="px-3 text-right tabular-nums">
                      {r.costPerOutcomeUsd == null ? (
                        <span className="k-fg4">—</span>
                      ) : (
                        <>
                          {r.measured ? "" : "from "}
                          {formatUsdAdaptive(r.costPerOutcomeUsd)}
                        </>
                      )}
                    </td>
                    <td className="px-3">
                      {!r.measured ? (
                        <span className="k-fg3 text-[12px]">Never ran</span>
                      ) : r.mature === true ? (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--data-teal)]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--data-teal)]" />
                          Mature
                        </span>
                      ) : r.mature === false ? (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--data-amber)]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--data-amber)]" />
                          Learning
                        </span>
                      ) : (
                        <span className="k-fg4">—</span>
                      )}
                    </td>
                    <td className={`px-3 text-right tabular-nums ${roiIsGood(r.roiMultiple) ? "text-[var(--data-teal)]" : ""}`}>
                      {formatRoi(r.roiMultiple)}
                    </td>
                    <td className="px-3 text-right tabular-nums">
                      {r.conversionRatePct == null ? <span className="k-fg4">—</span> : `${r.conversionRatePct.toFixed(2)}%`}
                    </td>
                    <td className="px-3 text-right tabular-nums">
                      {r.outcomes == null ? <span className="k-fg4">—</span> : Math.round(r.outcomes).toLocaleString("en-US")}
                    </td>
                    <td className="px-3 pr-4 text-right tabular-nums">
                      {r.spentUsd == null ? <span className="k-fg4">—</span> : formatUsdAdaptive(r.spentUsd)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="k-fg3 border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px]">
        Ordered by the rank the campaign picks from. The cost column is beside it so a mismatch shows. A price starting with
        &quot;from&quot; belongs to a workflow that never ran; it is the price of one outreach.
      </div>
    </div>
  );
}
