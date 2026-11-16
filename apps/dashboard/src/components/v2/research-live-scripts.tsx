"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RecentRuns, ResearchDrawer } from "@/components/v2/research-template-outputs";
import { TacticTags, TacticsBlock } from "@/components/v2/tactic-tags";
import { Arrow } from "@/components/v2/research-bits";
import { EmptyNote, Shimmer } from "@/components/v2/ui";
import { RecordsTabs } from "@/components/v2/records";
import { measureCatalog, researchCatalogHref, type ResearchCatalog, type ResearchMeasure } from "@/lib/research/research";
import { useLiveScripts } from "@/lib/research/research-source";
import { orderReasonWords, type LiveScripts } from "@/lib/research/live-scripts";
import { lastRunText, servedCost, type WorkflowFigures } from "@/lib/live-workflow-rows";
import { formatUsdAdaptive } from "@/lib/format-number";
import { formatRatePct } from "@/lib/brand-conversion-rates";
import { LIVE_TH } from "@/components/v2/live-workflow-cells";
import { CostValue } from "@/components/v2/roi-label";
import { CatalogueName, CatalogueObjectMark } from "@/components/v2/catalogue-name";
import { StatusWord, ScriptStatusCells, isWorkflowDynasty, scriptStatus, useScriptWords, useWorkflowDeprecation } from "@/components/v2/research-status";
import { expectedReasonWords } from "@/lib/expected-return";

/**
 * A measure's scripts as the FLEET ranks them right now (features-service live-scripts, RESEARCH-BY-ENGINE-1113): every
 * client we run a script for, pooled. Research names no org, brand, offer, campaign or audience (owner rule 2026-09-30),
 * so this reads features-service's fleet ranking and nothing scoped to the viewer. Rows read in the ranking's served
 * order; nothing divided or re-sorted here. No return: a script sits below a campaign's Target (owner 2026-11-03,
 * ROI-CONSISTENCY-1103).
 *
 * Columns (owner 2026-10-22): mark + name (a link to its page), description, tactics, cost per outcome, conversion,
 * spent, last run, status. A click anywhere else on the row opens its drawer. Every figure, the tactics and the last
 * run are the ranking row's own (`figures` on net pricing): the script page reads the same `figures`, so the list,
 * the drawer and the page print one figure. No summary banner above the table: the owner does not want to read which
 * script writes the next email.
 */

/** One served live row, named as the table reads it. */
export type LiveScriptRow = LiveScripts["rows"][number];

export function ResearchLiveScripts({
  base,
  measure,
  catalog,
  outcomeUnit,
}: {
  base: string;
  measure: ResearchMeasure;
  catalog: ResearchCatalog | null;
  outcomeUnit: string;
  /** Unused since every cell is its own link; kept so the catalogue page passes one shape. */
  nav?: (href: string) => void;
}) {
  const { rankingQ, rows } = useMeasureScriptRows(measure);
  // What each script does, in its producer's words (the Description cell and the drawer).
  const words = useScriptWords();
  // Two tabs on the served status (owner 2026-10-22): Active first, then Deprecated, each in the served order.
  const [tab, setTab] = useState<StatusTab>("active");
  const byTab = useMemo(() => {
    const out: Record<StatusTab, LiveScriptRow[]> = { active: [], deprecated: [] };
    for (const r of rows) out[r.executable === false ? "deprecated" : "active"].push(r);
    return out;
  }, [rows]);
  const shown = byTab[tab];
  // The Research catalogue's own pages: a script Research studied has one.
  const researched = useMemo(() => new Set((catalog ? measureCatalog(catalog, measure).scripts : []).map((w) => w.key)), [catalog, measure]);
  const nameOf = (r: LiveScriptRow) => r.scriptDynastyName ?? r.scriptDynastySlug;
  // The row whose drawer is open (owner 2026-10-22: a click on the row opens the detail on the right).
  const [open, setOpen] = useState<string | null>(null);
  const openRow = open ? (rows.find((r) => r.scriptDynastySlug === open) ?? null) : null;
  const hrefOf = (slug: string) => (researched.has(slug) ? researchCatalogHref(base, measure, "scripts", slug) : null);

  const answered = rankingQ.data !== undefined || rankingQ.isFetchedAfterMount;
  const failed = rankingQ.data === undefined && rankingQ.isFetchedAfterMount;
  const notBuilt = rankingQ.data !== undefined && rankingQ.data.computedAt === null;
  const orderNote = orderReasonWords(rankingQ.data?.orderUnavailableReason);

  return (
    <div className="k-card overflow-hidden">
      <RecordsTabs
        tabs={STATUS_TABS.map((t) => ({ key: t.key, label: t.label, count: answered ? byTab[t.key].length : null }))}
        active={tab}
        onPick={(k) => setTab(k as StatusTab)}
      />
      <div className="k-scroll relative overflow-x-auto">
        <table className="w-full min-w-[1340px] table-fixed text-[13px]">
          <thead>
            <tr className="border-b border-[var(--line-subtle)]">
              <th className={`${LIVE_TH} w-72`}>Script</th>
              <th className={LIVE_TH}>Description</th>
              <th className={`${LIVE_TH} w-28`}>Tactics</th>
              <th className={`${LIVE_TH} w-[132px] text-right`}>{`$ ${outcomeUnit}`}</th>
              <th className={`${LIVE_TH} w-[132px] text-right`}>% Conversion</th>
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
                  <EmptyNote>{rows.length === 0 ? "No script makes this outcome yet." : tab === "deprecated" ? "No deprecated script here." : "No active script here."}</EmptyNote>
                </td>
              </tr>
            ) : (
              shown.map((r) => (
                <ScriptRow
                  key={r.scriptDynastySlug}
                  row={r}
                  href={hrefOf(r.scriptDynastySlug)}
                  name={nameOf(r)}
                  words={words}
                  selected={open === r.scriptDynastySlug}
                  onOpen={() => setOpen(r.scriptDynastySlug)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="k-fg3 border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px]">
        Every client pooled, in the served order.{orderNote ? ` ${orderNote}` : ""} Click a row for its detail; its name opens its page.
      </div>
      {openRow && (
        <ScriptDrawer
          row={openRow}
          href={hrefOf(openRow.scriptDynastySlug)}
          name={nameOf(openRow)}
          words={words}
          outcomeUnit={outcomeUnit}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

/**
 * The scripts assigned to this measure (the producer's `assignment`), in the served order. The page title's
 * count reads the same rows (one query key), so it is Active + Deprecated.
 */
export function useMeasureScriptRows(measure: ResearchMeasure) {
  const rankingQ = useLiveScripts(measure);
  // Served order, never re-sorted: ranks repeat when several sources are ranked apart (`orderUnavailableReason`).
  const rows = useMemo(() => (rankingQ.data?.rows ?? []).filter((r) => r.assignment === "active"), [rankingQ.data]);
  return { rankingQ, rows };
}

/** The table's column count (empty and loading rows span it). */
const COLS = 9;

type StatusTab = "active" | "deprecated";
const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "deprecated", label: "Deprecated" },
];

const DASH = <span className="k-fg4">—</span>;

/** A served % conversion, marked expected when it is the Engine's (the same small word as an expected ROI). */
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

function ScriptRow({
  row: r,
  href,
  name,
  words,
  selected,
  onOpen,
}: {
  row: LiveScriptRow;
  href: string | null;
  name: string;
  words: ReturnType<typeof useScriptWords>;
  selected: boolean;
  onOpen: () => void;
}) {
  const { description, line } = useScriptDescription(r.scriptDynastySlug, words, r.executable === false);
  const lastRun = lastRunText({ lastRunAt: r.lastRunAt ?? null, lastRunUnavailableReason: r.lastRunUnavailableReason ?? null });
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const label = <CatalogueName kind="workflow" name={r.scriptDynastyName ?? r.scriptDynastySlug} label={name} icon={r.icon} color={r.color} className="font-medium" />;
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
        {href ? (
          <Link
            href={href}
            onClick={stop}
            title={`Open ${name}`}
            className={`k-btn-ghost -mx-1.5 inline-flex h-8 max-w-full items-center gap-2 px-1.5 hover:text-[var(--accent)] ${r.selectable ? "" : "k-fg3"}`}
          >
            {label}
          </Link>
        ) : (
          <span className={`inline-flex h-8 max-w-full items-center gap-2 ${r.selectable ? "" : "k-fg3"}`}>{label}</span>
        )}
      </td>
      <td className="max-w-0 px-3 py-2">
        {/* What sets it apart (owner 2026-10-23); the full description on hover and in the drawer. */}
        {line || description ? (
          <p className="k-fg2 truncate text-[12px] leading-[18px]" title={description ?? undefined}>
            {line ?? description}
          </p>
        ) : (
          DASH
        )}
      </td>
      <td className="max-w-0 px-3 py-2">
        <TacticTags tactics={r.tactics ?? null} reason={r.tacticsUnavailableReason ?? null} />
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
      <ScriptStatusCells slug={r.scriptDynastySlug} label={name} served={scriptStatus(r.executable)} />
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
 * A script's description in its producer's words, and the one line that sets it apart from its siblings (WF-SHORT-LINE-1023,
 * its single line: a script has no leg). A deprecated workflow dynasty reads its newest version's (the read its Status cell makes for why).
 */
function useScriptDescription(slug: string, words: ReturnType<typeof useScriptWords>, deprecated: boolean) {
  const newest = useWorkflowDeprecation(slug, deprecated && isWorkflowDynasty(slug));
  const description = (deprecated ? newest.description : null) ?? words.descriptionOf(slug);
  const line = (deprecated ? newest.siblings?.siblingLine : words.siblingsOf(slug)?.siblingLine) ?? null;
  return { description, line };
}

/**
 * The row's detail sliding in from the right (owner 2026-10-22): mark, name, full description,
 * tactics, the figures (the row's own), its recent runs, and its page.
 */
function ScriptDrawer({
  row: r,
  href,
  name,
  words,
  outcomeUnit,
  onClose,
}: {
  row: LiveScriptRow;
  href: string | null;
  name: string;
  words: ReturnType<typeof useScriptWords>;
  outcomeUnit: string;
  onClose: () => void;
}) {
  const deprecated = r.executable === false;
  const { description } = useScriptDescription(r.scriptDynastySlug, words, deprecated);
  const why = useWorkflowDeprecation(r.scriptDynastySlug, deprecated && isWorkflowDynasty(r.scriptDynastySlug));
  const lastRun = lastRunText({ lastRunAt: r.lastRunAt ?? null, lastRunUnavailableReason: r.lastRunUnavailableReason ?? null });
  return (
    <ResearchDrawer
      label={name}
      onClose={onClose}
      head={
        <div className="flex min-w-0 items-center gap-2.5">
          <CatalogueObjectMark kind="workflow" name={r.scriptDynastyName ?? r.scriptDynastySlug} icon={r.icon} color={r.color} size={36} />
          <div className="min-w-0">
            <p className="k-label">Script</p>
            <p className="truncate text-[14px] font-medium" title={r.scriptDynastyName ?? r.scriptDynastySlug}>
              {name}
            </p>
          </div>
        </div>
      }
      right={<StatusWord status={scriptStatus(r.executable)} deprecation={why.deprecation} />}
      footer={
        href ? (
          <Link href={href} onClick={onClose} className="k-btn inline-flex items-center gap-1.5">
            Open script page
            <Arrow />
          </Link>
        ) : null
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
        <TacticsBlock tactics={r.tactics ?? null} reason={r.tacticsUnavailableReason ?? null} />
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-[var(--line-subtle)] pt-3 text-[12px]">
          <Fig k={`$ ${outcomeUnit}`} v={<CostValue cost={servedCost(r.figures.costPerOutcomeUsd)} />} />
          <Fig k="% Conversion" v={<RateValue f={r.figures.conversionRatePct} />} />
          <Fig k="$ Spent" v={<SpentValue f={r.figures.spentUsd} />} />
          <Fig k="Outcomes" v={Math.round(r.figures.outcomes).toLocaleString("en-US")} />
          <Fig k="Last run" v={lastRun ?? DASH} />
        </dl>
      </div>
      <p className="k-label border-t border-[var(--line-subtle)] px-4 pt-3">Recent runs</p>
      <RecentRuns slug={r.scriptDynastySlug} limit={10} />
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
