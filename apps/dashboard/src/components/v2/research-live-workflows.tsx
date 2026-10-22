"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getLegWorkflowRanking, legWorkflowRankingKey } from "@/lib/api";
import { RecentRuns, ResearchDrawer } from "@/components/v2/research-template-outputs";
import { Arrow } from "@/components/v2/research-bits";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { legFor } from "@/lib/legs";
import { isProactiveFrom } from "@/lib/outbound-leg-key";
import { EmptyNote, Shimmer } from "@/components/v2/ui";
import { RecordsTabs } from "@/components/v2/records";
import { PIPE_KEY, researchCatalogHref, type ResearchCatalog, type ResearchPipe } from "@/lib/research/research";
import {
  fleetWorkflowRows,
  lastRunText,
  servedCost,
  servedRoi,
  shortWorkflowName,
  tagsThatFit,
  type FollowedTactic,
  type ResearchWorkflowRow,
  type WorkflowFigures,
} from "@/lib/live-workflow-rows";
import { formatUsdAdaptive } from "@/lib/format-number";
import { formatRatePct } from "@/lib/brand-conversion-rates";
import { useFeatures } from "@/lib/features-context";
import { LIVE_TH } from "@/components/v2/live-workflow-cells";
import { CostValue, RoiLabel, RoiValue } from "@/components/v2/roi-label";
import { TopicMark } from "@/components/v2/research-bits";
import { StatusWord, WorkflowStatusCells, useDynastyStatuses, useWorkflowDeprecation } from "@/components/v2/research-status";
import { expectedReasonWords } from "@/lib/expected-return";

/**
 * A pipe's workflows as the FLEET ranks them right now, at the pipe's leg: every client we run
 * a workflow for, pooled. Research names no org, brand, offer, campaign or audience (owner rule
 * 2026-09-30), so this reads features-service's fleet ranking and nothing scoped to the viewer.
 * The order is the producer's, the same order campaign-service runs (WF-ORDER-EXPLORE-1018).
 * Nothing is ranked or divided here.
 *
 * Columns (owner 2026-10-22): mark + name (a link to its page), description, tactics, ROI, cost
 * per outcome, conversion, spent, last run, status. A click anywhere else on the row opens its drawer.
 * Every figure, the tactics and the last run are the ranking row's own (`figures` on net pricing):
 * the workflow page reads the same `figures`, so the list, the drawer and the page print one ROI. No LLM / Template column: since BEST-TPL-LLM-1022 a workflow fixes neither, each send
 * writes with the leg's best template and LLM. No summary banner above the table: the owner does
 * not want to read which workflow writes the next email.
 *
 * The brand's own version of this table (one per campaign) lives on the brand Workflows page.
 */

/** The pipe's channel name, the prefix every one of its workflow names repeats. */
export function usePipeChannelName(pipe: ResearchPipe): string | null {
  const { getFeature } = useFeatures();
  return getFeature(PIPE_KEY[pipe].channel)?.name ?? null;
}

/**
 * The pipe's leg in the fleet's own key, or null when it is not a proactive leg (the fleet ranks
 * those only) or the catalogue has not answered. Read by the pipe's leg key and judged with
 * `isProactiveFrom`: the renamed outbound legs start on Lead found, so a `fromKey === null` test
 * found none of them and the live table never showed.
 */
export function useResearchPipeLeg(pipe: ResearchPipe): string | null {
  const leg = legFor(useLegCatalogue(), PIPE_KEY[pipe].leg);
  return leg && isProactiveFrom(leg.fromKey) ? leg.legKey : null;
}

export function ResearchLiveWorkflows({
  base,
  pipe,
  legKey,
  catalog,
  outcomeUnit,
}: {
  base: string;
  pipe: ResearchPipe;
  legKey: string;
  catalog: ResearchCatalog | null;
  outcomeUnit: string;
  /** Unused since every cell is its own link; kept so the catalogue page passes one shape. */
  nav?: (href: string) => void;
}) {
  const featureSlug = PIPE_KEY[pipe].channel;

  const rankingQ = useAuthQuery(legWorkflowRankingKey(featureSlug, legKey), () => getLegWorkflowRanking(featureSlug, legKey), {
    ...pollOptions,
    retry: false,
  });
  // Only the workflows ON this pipe (the producer's `assignment`): one moved to another leg of the channel
  // (Dotterel's to Killdeer) or on none is not this pipe's, so it is not listed (owner 2026-10-22).
  const rows = useMemo(() => fleetWorkflowRows((rankingQ.data?.rows ?? []).filter((r) => r.assignment === "active")), [rankingQ.data]);
  // Each workflow's own status (workflow-service), changed from the row's ⋮ (TEMPLATE-MODEL-STATUS-1019).
  const dynastyStatuses = useDynastyStatuses(featureSlug);
  // Two tabs on that status (owner 2026-10-22): Active first, in the producer's order (learning and mature
  // lead), then Deprecated. A row moves tab the moment its status is written.
  const [tab, setTab] = useState<StatusTab>("active");
  const byTab = useMemo(() => {
    const out: Record<StatusTab, ResearchWorkflowRow[]> = { active: [], deprecated: [] };
    for (const r of rows) out[dynastyStatuses.statusOf(r.slug) === "deprecated" ? "deprecated" : "active"].push(r);
    return out;
  }, [rows, dynastyStatuses]);
  const shown = byTab[tab];
  // The Research catalogue's own pages: a workflow Research studied has one.
  const researchedWorkflows = useMemo(() => new Map((catalog?.[pipe].workflows ?? []).map((w) => [w.key, w])), [catalog, pipe]);
  // A workflow Research never studied still has its live page (`/workflows/:slug`, priced for this pipe).
  const brandBase = base.replace(/\/research$/, "");
  const pipeId = `${featureSlug}|${legKey}`;
  const channelName = usePipeChannelName(pipe);
  const nameOf = (r: { name: string | null; slug: string }) => shortWorkflowName(r.name ?? r.slug, channelName);
  // The row whose drawer is open (owner 2026-10-22: a click on the row opens the detail on the right).
  const [open, setOpen] = useState<string | null>(null);
  const openRow = open ? (rows.find((r) => r.slug === open) ?? null) : null;
  const hrefOf = (slug: string) =>
    researchedWorkflows.has(slug) ? researchCatalogHref(base, pipe, "workflows", slug) : `${brandBase}/workflows/${encodeURIComponent(slug)}?pipe=${encodeURIComponent(pipeId)}`;

  // Rows wait for the statuses too, or every row would sit in Active and jump tab when they answer.
  const answered = (rankingQ.data !== undefined || rankingQ.isFetchedAfterMount) && dynastyStatuses.answered;
  const failed = rankingQ.data === undefined && rankingQ.isFetchedAfterMount;
  const notBuilt = rankingQ.data !== undefined && rankingQ.data.computedAt === null;

  return (
    <div className="k-card overflow-hidden">
      <RecordsTabs
        tabs={STATUS_TABS.map((t) => ({ key: t.key, label: t.label, count: answered ? byTab[t.key].length : null }))}
        active={tab}
        onPick={(k) => setTab(k as StatusTab)}
      />
      <div className="k-scroll relative overflow-x-auto">
        <table className="w-full min-w-[1220px] table-fixed text-[13px]">
          <thead>
            <tr className="border-b border-[var(--line-subtle)]">
              <th className={`${LIVE_TH} w-40`}>Workflow</th>
              <th className={LIVE_TH}>Description</th>
              <th className={`${LIVE_TH} w-48`}>Tactics</th>
              <th className={`${LIVE_TH} w-24 text-right`}>
                <RoiLabel />
              </th>
              <th className={`${LIVE_TH} w-24 text-right`}>{`$ ${outcomeUnit}`}</th>
              <th className={`${LIVE_TH} w-[124px] text-right`}>% Conversion</th>
              <th className={`${LIVE_TH} w-24 text-right`}>$ Spent</th>
              <th className={`${LIVE_TH} w-24`}>Last run</th>
              <th className={`${LIVE_TH} w-28`}>Status</th>
              <th className={`${LIVE_TH} w-10`} aria-label="Status menu" />
            </tr>
          </thead>
          <tbody>
            {!answered ? (
              [0, 1, 2, 3, 4].map((i) => (
                <tr key={i} className="k-row h-10">
                  <td colSpan={COLS} className="px-4">
                    <Shimmer className="h-4 w-full" />
                  </td>
                </tr>
              ))
            ) : failed ? (
              <tr>
                <td colSpan={COLS}>
                  <EmptyNote>We could not read the fleet ranking just now. It retries on its own.</EmptyNote>
                </td>
              </tr>
            ) : notBuilt ? (
              <tr>
                <td colSpan={COLS}>
                  <EmptyNote>The fleet ranking is being computed. It appears here within a few minutes.</EmptyNote>
                </td>
              </tr>
            ) : shown.length === 0 ? (
              <tr>
                <td colSpan={COLS}>
                  <EmptyNote>{rows.length === 0 ? "No workflow is on this leg yet." : tab === "deprecated" ? "No deprecated workflow on this leg." : "No active workflow on this leg."}</EmptyNote>
                </td>
              </tr>
            ) : (
              shown.map((r) => (
                <WorkflowRow
                  key={r.slug}
                  row={r}
                  href={hrefOf(r.slug)}
                  name={nameOf(r)}
                  statuses={dynastyStatuses}
                  selected={open === r.slug}
                  onOpen={() => setOpen(r.slug)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="k-fg3 border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px]">
        Every client we run a workflow for, pooled, in the order every campaign runs. Each send writes with the pipe&apos;s best template and
        LLM. Click a row for its detail; its name opens its page.
      </div>
      {openRow && (
        <WorkflowDrawer
          row={openRow}
          href={hrefOf(openRow.slug)}
          name={nameOf(openRow)}
          statuses={dynastyStatuses}
          outcomeUnit={outcomeUnit}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

/** The table's column count (empty and loading rows span it). */
const COLS = 10;

type StatusTab = "active" | "deprecated";
const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "deprecated", label: "Deprecated" },
];

const DASH = <span className="k-fg4">—</span>;

/** A served % conversion, marked expected when it is the pipe's (the same small word as an expected ROI). */
function RateValue({ f }: { f: WorkflowFigures["conversionRatePct"] }) {
  if (f.value == null) return <span className="k-fg3 text-[12px] font-normal">{expectedReasonWords(f.unavailableReason)}</span>;
  return (
    <span className="whitespace-nowrap">
      {formatRatePct(f.value)}
      {f.basis === "expected" && <span className="k-fg3 ml-1 text-[11px] font-normal">expected</span>}
    </span>
  );
}

/** A served spend on net pricing; a dash with the producer's reason when it is not measured. */
function SpentValue({ f }: { f: WorkflowFigures["spentUsd"] }) {
  if (f.value == null) return <span title={f.unavailableReason ? expectedReasonWords(f.unavailableReason) : undefined}>{DASH}</span>;
  return <>{formatUsdAdaptive(f.value)}</>;
}

function WorkflowRow({
  row: r,
  href,
  name,
  statuses,
  selected,
  onOpen,
}: {
  row: ResearchWorkflowRow;
  href: string;
  name: string;
  statuses: ReturnType<typeof useDynastyStatuses>;
  selected: boolean;
  onOpen: () => void;
}) {
  const description = useWorkflowDescription(r.slug, statuses);
  const lastRun = lastRunText(r);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <tr
      className={`k-row cursor-pointer ${selected ? "k-selected" : ""}`}
      tabIndex={0}
      onClick={(e) => {
        if (opensDrawer(e.target, e.currentTarget)) onOpen();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) onOpen();
      }}
    >
      <td className="max-w-0 py-2 pl-4 pr-3">
        <Link
          href={href}
          onClick={stop}
          title={`Open ${r.name ?? r.slug}`}
          className={`k-btn-ghost -mx-1.5 inline-flex h-8 max-w-full items-center gap-2 px-1.5 hover:text-[var(--accent)] ${r.selectable ? "" : "k-fg3"}`}
        >
          <TopicMark topic="workflow" size={22} />
          <span className="truncate font-medium">{name}</span>
        </Link>
      </td>
      <td className="max-w-0 px-3 py-2">
        {description ? (
          <p className="k-fg2 line-clamp-2 text-[12px] leading-[18px]" title={description}>
            {description}
          </p>
        ) : (
          DASH
        )}
      </td>
      <td className="max-w-0 px-3 py-2">
        <TacticTags tactics={r.tactics} />
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        <RoiValue roi={servedRoi(r.figures.roi)} />
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        <CostValue cost={servedCost(r.figures.costPerOutcomeUsd)} />
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        <RateValue f={r.figures.conversionRatePct} />
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        <SpentValue f={r.figures.spentUsd} />
      </td>
      <td className="k-mono k-fg2 whitespace-nowrap px-3 py-2 text-[12px]" title={r.lastRunAt ?? undefined}>
        {lastRun ?? DASH}
      </td>
      <WorkflowStatusCells slug={r.slug} label={name} statuses={statuses} />
    </tr>
  );
}

/**
 * A click on the row opens its drawer, except on a control (the name link, "+N more", the status
 * menu) and except a click that only BUBBLED here through a portal (the status menu's modal, the
 * tactics popover): React carries portal events up the component tree, not the DOM one.
 */
export function opensDrawer(target: EventTarget, row: Element): boolean {
  if (!(target instanceof Element) || !row.contains(target)) return false;
  return target.closest("a,button,input,textarea,select,[role=menu],[role=dialog]") == null;
}

/**
 * A workflow's description, workflow-service's own words: a runnable one's rides the status
 * listing; a deprecated one's is its newest version's (the read its Status cell makes for why).
 */
function useWorkflowDescription(slug: string, statuses: ReturnType<typeof useDynastyStatuses>): string | null {
  const deprecated = statuses.statusOf(slug) === "deprecated";
  const newest = useWorkflowDeprecation(slug, deprecated);
  return deprecated ? newest.description : statuses.descriptionOf(slug);
}

/**
 * The first tactic tags that FIT the cell on one line, then "+N more" listing them all on hover
 * (desktop) or tap (mobile). The fit is measured off an invisible copy of every tag, re-measured
 * when the cell resizes; a lone tag too wide for the cell truncates with an ellipsis.
 */
function TacticTags({ tactics }: { tactics: readonly FollowedTactic[] | null }) {
  const box = useRef<HTMLDivElement>(null);
  const ruler = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<number | null>(null);
  const names = tactics?.map((t) => t.name).join("|") ?? "";
  useLayoutEffect(() => {
    const el = box.current;
    const rl = ruler.current;
    if (!el || !rl || !tactics?.length) return;
    const measure = () => {
      const widths = [...rl.children].map((c) => (c as HTMLElement).offsetWidth);
      setFit(tagsThatFit(widths, el.clientWidth, MORE_W, TAG_GAP));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names]);
  // Null = features-service could not read them (`tacticsUnavailableReason`), never "none".
  if (tactics == null) return DASH;
  if (tactics.length === 0) return <span className="k-fg3 text-[12px]">None</span>;
  const n = fit ?? 1;
  const rest = tactics.length - n;
  return (
    <div ref={box} className="relative flex min-w-0 flex-nowrap items-center gap-1">
      <div ref={ruler} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 flex gap-1">
        {tactics.map((t) => (
          <span key={t.id} className="k-chip whitespace-nowrap">
            {t.name}
          </span>
        ))}
      </div>
      {tactics.slice(0, n).map((t) => (
        <span key={t.id} className="k-chip min-w-0 shrink" title={t.name}>
          <span className="truncate">{t.name}</span>
        </span>
      ))}
      {rest > 0 && <MoreTactics label={`+${rest} more`} tactics={tactics} />}
    </div>
  );
}

/** Room kept for "+N more" and the gap between tags, in px. */
const MORE_W = 64;
const TAG_GAP = 4;

/** "+N more": the whole list in a portalled k-popover, opened by hover on desktop or a tap. */
function MoreTactics({ label, tactics }: { label: string; tactics: readonly FollowedTactic[] }) {
  const btn = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const show = () => {
    const r = btn.current?.getBoundingClientRect();
    if (r) setAt({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 248)) });
  };
  useEffect(() => {
    if (!at) return;
    const close = () => setAt(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [at]);
  const host = typeof document === "undefined" ? null : (document.getElementById("v2-portal") ?? document.body);
  return (
    <>
      <button
        ref={btn}
        type="button"
        className="k-btn-ghost h-6 shrink-0 whitespace-nowrap px-1.5 text-[12px]"
        aria-expanded={at != null}
        // Hover is a mouse thing: a tap also fires the enter, which would open then the click close it.
        onPointerEnter={(e) => e.pointerType === "mouse" && show()}
        onPointerLeave={(e) => e.pointerType === "mouse" && setAt(null)}
        onClick={(e) => {
          e.stopPropagation();
          if (at) setAt(null);
          else show();
        }}
      >
        {label}
      </button>
      {at &&
        host &&
        createPortal(
          <div className="k-popover fixed z-[70] w-60 p-2.5" style={{ top: at.top, left: at.left }} role="tooltip">
            <p className="k-label">Tactics</p>
            <ul className="mt-1.5 flex flex-wrap gap-1">
              {tactics.map((t) => (
                <li key={t.id} className="k-chip">
                  {t.name}
                </li>
              ))}
            </ul>
          </div>,
          host,
        )}
    </>
  );
}

/**
 * The row's detail sliding in from the right (owner 2026-10-22): mark, name, full description,
 * tactics, the figures (the row's own), its recent runs, and its page.
 */
function WorkflowDrawer({
  row: r,
  href,
  name,
  statuses,
  outcomeUnit,
  onClose,
}: {
  row: ResearchWorkflowRow;
  href: string;
  name: string;
  statuses: ReturnType<typeof useDynastyStatuses>;
  outcomeUnit: string;
  onClose: () => void;
}) {
  const description = useWorkflowDescription(r.slug, statuses);
  const deprecated = statuses.statusOf(r.slug) === "deprecated";
  const why = useWorkflowDeprecation(r.slug, deprecated);
  const tactics = r.tactics;
  const lastRun = lastRunText(r);
  return (
    <ResearchDrawer
      label={name}
      onClose={onClose}
      head={
        <div className="flex min-w-0 items-center gap-2.5">
          <TopicMark topic="workflow" size={36} />
          <div className="min-w-0">
            <p className="k-label">Workflow</p>
            <p className="truncate text-[14px] font-medium" title={r.name ?? r.slug}>
              {name}
            </p>
          </div>
        </div>
      }
      right={<StatusWord status={statuses.statusOf(r.slug)} pending={!statuses.answered} deprecation={why.deprecation} />}
      footer={
        <Link href={href} onClick={onClose} className="k-btn inline-flex items-center gap-1.5">
          Open workflow page
          <Arrow />
        </Link>
      }
    >
      <div className="space-y-4 px-4 py-3">
        <div>
          <p className="k-label">Description</p>
          {description ? (
            <p className="k-fg2 mt-1.5 whitespace-pre-wrap break-words text-[13px] leading-5">{description}</p>
          ) : (
            <p className="k-fg3 mt-1.5 text-[12px]">No description on record.</p>
          )}
        </div>
        <div>
          <p className="k-label">Tactics</p>
          {tactics == null ? (
            <p className="k-fg3 mt-1.5 text-[12px]">Not readable just now.</p>
          ) : tactics.length === 0 ? (
            <p className="k-fg3 mt-1.5 text-[12px]">Follows no tactic.</p>
          ) : (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {tactics.map((t) => (
                <span key={t.id} className="k-chip">
                  {t.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-[var(--line-subtle)] pt-3 text-[12px]">
          <Fig k={<RoiLabel />} v={<RoiValue roi={servedRoi(r.figures.roi)} />} />
          <Fig k={`$ ${outcomeUnit}`} v={<CostValue cost={servedCost(r.figures.costPerOutcomeUsd)} />} />
          <Fig k="% Conversion" v={<RateValue f={r.figures.conversionRatePct} />} />
          <Fig k="$ Spent" v={<SpentValue f={r.figures.spentUsd} />} />
          <Fig k="Outcomes" v={Math.round(r.figures.outcomes).toLocaleString("en-US")} />
          <Fig k="Last run" v={lastRun ?? DASH} />
        </dl>
      </div>
      <p className="k-label border-t border-[var(--line-subtle)] px-4 pt-3">Recent runs</p>
      <RecentRuns slug={r.slug} limit={10} />
    </ResearchDrawer>
  );
}

function Fig({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="k-label truncate">{k}</dt>
      <dd className="mt-0.5 truncate text-[15px] font-medium tabular-nums">{v}</dd>
    </div>
  );
}
