"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getLegWorkflowRanking, listChannelWorkflows } from "@/lib/api";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { legKeyForSteps } from "@/lib/legs";
import { EmptyNote, Shimmer } from "@/components/v2/ui";
import { CREW_KEY, researchCatalogHref, type ResearchCatalog, type ResearchCrew } from "@/lib/research/research";
import { fleetWorkflowRows, shortWorkflowName } from "@/lib/live-workflow-rows";
import { useFeatures } from "@/lib/features-context";
import {
  LIVE_TH,
  LiveRankingStrip,
  LiveWorkflowCells,
  LiveWorkflowChips,
  LiveWorkflowHeads,
} from "@/components/v2/live-workflow-cells";

/**
 * A crew's workflows as the FLEET ranks them right now, at the crew's leg: every client we run
 * a workflow for, pooled. Research names no org, brand, offer, campaign or audience (owner rule
 * 2026-09-30), so this reads features-service's fleet ranking and nothing scoped to the viewer.
 * The order and both flags are the producer's: the best mature workflow holds the money, the
 * learning ones already cheaper than it sit above it. Nothing is ranked or divided here.
 *
 * The brand's own version of this table (one per mission) lives on the brand Workflows page.
 */

/** The crew's channel name, the prefix every one of its workflow names repeats. */
export function useCrewChannelName(crew: ResearchCrew): string | null {
  const { getFeature } = useFeatures();
  return getFeature(CREW_KEY[crew].channel)?.name ?? null;
}

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
  catalog: ResearchCatalog | null;
  outcomeUnit: string;
  nav: (href: string) => void;
}) {
  const featureSlug = CREW_KEY[crew].channel;

  const rankingQ = useAuthQuery(["legWorkflowRanking", featureSlug, legKey], () => getLegWorkflowRanking(featureSlug, legKey), {
    ...pollOptions,
    retry: false,
  });
  const catalogueQ = useAuthQuery(["workflows", featureSlug], () => listChannelWorkflows(featureSlug), pollOptions);

  const rows = useMemo(() => fleetWorkflowRows(rankingQ.data?.rows ?? []), [rankingQ.data]);
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
  const researched = useMemo(() => new Set((catalog?.[crew].workflows ?? []).map((w) => w.key)), [catalog, crew]);
  const channelName = useCrewChannelName(crew);
  const nameOf = (r: { name: string | null; slug: string }) => shortWorkflowName(r.name ?? r.slug, channelName);

  const answered = rankingQ.data !== undefined || rankingQ.isFetchedAfterMount;
  const failed = rankingQ.data === undefined && rankingQ.isFetchedAfterMount;
  const notBuilt = rankingQ.data !== undefined && rankingQ.data.computedAt === null;

  return (
    <div className="k-card overflow-hidden">
      <LiveRankingStrip rows={rows} moneyNote="no mature workflow yet" nameOf={nameOf} />
      <div className="k-scroll relative overflow-x-auto">
        <table className="w-full min-w-[1180px] text-[13px]">
          <thead>
            <tr className="border-b border-[var(--line-subtle)]">
              <th className={`${LIVE_TH} w-12`}>#</th>
              <th className={LIVE_TH}>Workflow</th>
              <th className={`${LIVE_TH} w-40`}>LLM</th>
              <th className={`${LIVE_TH} w-44`}>Template</th>
              <LiveWorkflowHeads costLabel={`Cost ${outcomeUnit.replace("/ ", "per ")}`} />
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
                  <EmptyNote>We could not read the fleet ranking just now. It retries on its own.</EmptyNote>
                </td>
              </tr>
            ) : notBuilt ? (
              <tr>
                <td colSpan={10}>
                  <EmptyNote>The fleet ranking is being computed. It appears here within a few minutes.</EmptyNote>
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
                            {nameOf(r)}
                          </Link>
                        ) : (
                          <span className="min-w-0 truncate font-medium" title={r.name ?? r.slug}>
                            {nameOf(r)}
                          </span>
                        )}
                        <LiveWorkflowChips row={r} />
                        {r.assignment === "deprecated" && <span className="k-chip k-fg3 shrink-0">Deprecated on this leg</span>}
                      </div>
                    </td>
                    <td className="k-fg2 max-w-0 truncate px-3">{s?.model ?? <span className="k-fg4">—</span>}</td>
                    <td className="k-fg2 max-w-0 truncate px-3">{s?.template ?? <span className="k-fg4">—</span>}</td>
                    <LiveWorkflowCells row={r} />
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="k-fg3 border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px]">
        Every client we run a workflow for, pooled. The best mature workflow gets the money; a learning one sits above it only while its
        early price is already cheaper. A mature row is priced on its mature evidence, a learning one on everything to date.
      </div>
    </div>
  );
}
