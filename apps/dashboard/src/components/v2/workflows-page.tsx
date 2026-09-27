"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CrewMark } from "@/components/v2/crew-mark";
import { EmptyNote, KeyHint, SectionTitle, Shimmer, StateDot, TopBar } from "@/components/v2/ui";
import { useRowKeys } from "@/components/v2/records";
import { formatUsdAdaptive } from "@/lib/format-number";
import { grainFigures, scopeLadderRows } from "@/lib/workflow-grains";
import { workflowModelMark } from "@/lib/workflow-model-marks";
import { workflowTemplateLabel } from "@/lib/workflow-template-label";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { useRoutePrefetch } from "@/lib/use-route-prefetch";
import { v2WorkflowHref } from "@/lib/v2/routes";
import {
  crewParam,
  useBrandMissionSpecs,
  useMissionWorkflowRanking,
  type MissionSpec,
} from "@/components/v2/workflows-data";

/** Rows a section shows before its footer offers the rest. */
const ROWS_SHOWN = 10;
const TH = "k-label px-3 py-2.5 text-left font-medium first:pl-4 last:pr-4";

/**
 * Every workflow the brand's missions can run, beta. One section per MISSION, because
 * the ranking is the producer's per mission: it is asked with the mission's campaign id
 * (a brand selling several offers cannot be ranked without one) and read in the order
 * served. Two columns per row: Global (what it costs across every client we run it for)
 * and Brand (what it has cost this brand). A row opens the workflow's own page.
 */
export function V2WorkflowsPage() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const isBeta = useIsBetaUser();
  const router = useRouter();
  const { specs, settled } = useBrandMissionSpecs(orgId, brandId);

  // Each section reports the rows it drew, so J/K walk the page top to bottom.
  const [rowsByMission, setRowsByMission] = useState<Record<string, string[]>>({});
  const [totalByMission, setTotalByMission] = useState<Record<string, number>>({});
  const onRows = useCallback((campaignId: string, hrefs: string[], total: number) => {
    setRowsByMission((prev) => {
      const old = prev[campaignId];
      if (old && old.length === hrefs.length && old.every((h, i) => h === hrefs[i])) return prev;
      return { ...prev, [campaignId]: hrefs };
    });
    setTotalByMission((prev) => (prev[campaignId] === total ? prev : { ...prev, [campaignId]: total }));
  }, []);
  const flat = useMemo(() => specs.flatMap((s) => rowsByMission[s.campaignId] ?? []), [specs, rowsByMission]);
  const [cursor, setCursor] = useState(-1);
  const searchRef = useRef<HTMLInputElement | null>(null);
  useRowKeys({
    count: flat.length,
    cursor,
    setCursor,
    onOpen: (i) => {
      const href = flat[i];
      if (href) router.push(href);
    },
    searchRef,
  });
  const cursorHref = cursor >= 0 ? (flat[cursor] ?? null) : null;

  const running = specs.filter((s) => s.mission.running).length;
  const ranked = specs.every((s) => totalByMission[s.campaignId] !== undefined);
  const workflowTotal = specs.reduce((n, s) => n + (totalByMission[s.campaignId] ?? 0), 0);

  return (
    <>
      <TopBar crumbs={[{ label: "Workflows" }]} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em]">
              {isBeta && settled && specs.length > 0
                ? `${specs.length} ${specs.length === 1 ? "mission" : "missions"}, ${
                    ranked ? `${workflowTotal} workflows ranked` : "ranking their workflows"
                  }`
                : "Workflows"}
            </h1>
            <p className="k-fg2 mt-1 text-[14px]">
              Each mission ranks the workflows it can run, the one we would put it on next first. Global is every client we run a
              workflow for, Brand is this brand alone.
            </p>
          </div>
          {isBeta && settled && specs.length > 0 && (
            <span className="k-fg2 inline-flex items-center gap-2 text-[13px]">
              <span className={`h-1.5 w-1.5 rounded-full ${running ? "k-dot-pulse bg-[var(--run)] text-[var(--run)]" : "bg-[var(--fg-4)]"}`} />
              {running} {running === 1 ? "mission" : "missions"} running now
            </span>
          )}
        </div>

        {!isBeta ? (
          <div className="k-card mt-6">
            <EmptyNote>This page is still in beta and is not open on your account yet.</EmptyNote>
          </div>
        ) : !settled ? (
          <div className="mt-6">
            <SectionSkeleton />
          </div>
        ) : specs.length === 0 ? (
          <div className="k-card mt-6">
            <EmptyNote>No mission is set up yet, so no crew has workflows to compare.</EmptyNote>
          </div>
        ) : (
          <>
            {specs.map((spec) => (
              <MissionSection
                key={spec.campaignId}
                spec={spec}
                orgId={orgId}
                brandId={brandId}
                cursorHref={cursorHref}
                onRows={onRows}
              />
            ))}
            <div className="mt-4 flex justify-end gap-3">
              <KeyHint keys={["J", "K"]} label="move" />
              <KeyHint keys={["↵"]} label="open" />
            </div>
          </>
        )}
      </div>
    </>
  );
}

function SectionSkeleton() {
  return (
    <div className="k-card overflow-hidden">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="k-row flex h-10 items-center px-4">
          <Shimmer className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

/** One mission's ranking. A component of its own because each mission is its own read. */
function MissionSection({
  spec,
  orgId,
  brandId,
  cursorHref,
  onRows,
}: {
  spec: MissionSpec;
  orgId: string;
  brandId: string;
  cursorHref: string | null;
  onRows: (campaignId: string, hrefs: string[], total: number) => void;
}) {
  const router = useRouter();
  const prefetch = useRoutePrefetch();
  const [expanded, setExpanded] = useState(false);
  const r = useMissionWorkflowRanking(brandId, spec, true);
  const bySlug = useMemo(
    () => new Map(scopeLadderRows(r.allLadderRows, null).map((row) => [row.workflow.workflowDynastySlug, row])),
    [r.allLadderRows],
  );
  const unit = r.pair === "visit" ? "/ visit" : "/ reply";
  const shown = expanded ? r.ranked : r.ranked.slice(0, ROWS_SHOWN);
  const hrefFor = useCallback(
    (slug: string) => v2WorkflowHref(orgId, brandId, slug, crewParam(spec), spec.campaignId),
    [orgId, brandId, spec],
  );
  const hrefs = useMemo(() => shown.map((w) => hrefFor(w.row.workflowDynastySlug)), [shown, hrefFor]);
  const pending = r.pending;
  useEffect(() => {
    if (!pending) onRows(spec.campaignId, hrefs, r.ranked.length);
  }, [pending, hrefs, onRows, spec.campaignId, r.ranked.length]);

  const m = spec.mission;
  return (
    <section className="mt-8">
      <SectionTitle
        count={pending ? null : r.ranked.length}
        right={
          <>
            <StateDot running={m.running} hold={m.paymentHold} />
            <Link href={m.href} className="k-btn-ghost h-6 px-1.5 text-[12px]">
              Open mission
            </Link>
          </>
        }
      >
        <span className="inline-flex items-center gap-2">
          <CrewMark color={spec.crew.color} glyph={spec.crew.glyph} size={18} />
          {spec.crew.name}
          {m.offerName && <span className="k-fg2 font-normal">· {m.offerName}</span>}
        </span>
      </SectionTitle>
      {pending ? (
        <SectionSkeleton />
      ) : (
        <div className="k-card overflow-hidden">
          <div className="k-scroll relative overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead>
                <tr className="border-b border-[var(--line-subtle)]">
                  <th className={`${TH} w-12`}>#</th>
                  <th className={TH}>Workflow</th>
                  <th className={`${TH} w-40 text-right`}>Global</th>
                  <th className={`${TH} w-40 text-right`}>Brand</th>
                  <th className={`${TH} w-10`} aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {r.ranked.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyNote>This crew offers no workflow yet.</EmptyNote>
                    </td>
                  </tr>
                ) : (
                  shown.map((w) => {
                    const ladder = bySlug.get(w.row.workflowDynastySlug) ?? null;
                    const global = grainFigures(ladder?.estimatesByGrain.crossOrg)?.costPerOutcomeUsd ?? null;
                    const brand = grainFigures(ladder?.estimatesByGrain.brand)?.costPerOutcomeUsd ?? null;
                    const href = hrefFor(w.row.workflowDynastySlug);
                    const model = workflowModelMark(w.row.contentModel);
                    const template = workflowTemplateLabel(w.row.contentPromptType);
                    const stack = [model?.label, template?.label].filter(Boolean).join(" · ");
                    return (
                      <tr
                        key={w.row.workflowDynastySlug}
                        onClick={() => router.push(href)}
                        onMouseEnter={() => prefetch(href)}
                        className={`k-row group h-10 cursor-pointer ${cursorHref === href ? "k-selected" : ""}`}
                      >
                        <td className="k-mono k-fg3 pl-4 pr-3 text-[12px] tabular-nums">{w.rank ?? "—"}</td>
                        <td className="max-w-0 px-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="min-w-0 truncate font-medium">{w.row.workflowDynastyName}</span>
                            {w.recommended && <span className="k-chip shrink-0">Our pick</span>}
                            {stack && <span className="k-fg3 hidden min-w-0 shrink-[2] truncate text-[12px] lg:inline">{stack}</span>}
                          </div>
                        </td>
                        <CostCell value={global} unit={unit} />
                        <CostCell value={brand} unit={unit} />
                        <td className="pl-3 pr-4 text-right">
                          <Link
                            href={href}
                            aria-label={`Open ${w.row.workflowDynastyName}`}
                            onClick={(e) => e.stopPropagation()}
                            className="k-btn-ghost h-6 w-6 justify-center px-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                          >
                            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                              <path d="M4.5 3l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="k-fg3 flex items-center gap-3 border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px] tabular-nums">
            <span className="min-w-0 truncate">
              {r.ladderError
                ? "We could not read this mission's ranking just now, so its workflows are listed unordered."
                : `${shown.length} of ${r.ranked.length} ${r.ranked.length === 1 ? "workflow" : "workflows"}, priced per ${r.outcomeNoun.toLowerCase()}`}
            </span>
            {r.ranked.length > ROWS_SHOWN && (
              <button type="button" onClick={() => setExpanded((v) => !v)} className="k-btn-ghost ml-auto h-6 shrink-0 whitespace-nowrap px-1.5 text-[12px]">
                {expanded ? "Show fewer" : `Show ${r.ranked.length - ROWS_SHOWN} more`}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function CostCell({ value, unit }: { value: number | null; unit: string }) {
  return (
    <td className="px-3 text-right tabular-nums">
      {value == null ? (
        <span className="k-fg4">—</span>
      ) : (
        <>
          {formatUsdAdaptive(value)} <span className="k-fg3 text-[12px]">{unit}</span>
        </>
      )}
    </td>
  );
}
