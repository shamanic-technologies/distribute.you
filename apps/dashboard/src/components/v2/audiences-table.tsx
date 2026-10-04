"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/csr/PencilSimple";
import {
  ApiError,
  type AudienceChannelWire,
  type AudienceStatus,
  type AudienceWire,
  type FeatureAudienceStatsRow,
} from "@/lib/api";
import { formatCount } from "@/lib/format-number";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { PROVIDER_DOMAINS } from "@/lib/api-registry";
import { audienceFilterGroups } from "@/lib/audience-filter-groups";
import { companyPageSlug, linkedInSignalOf, type LinkedInSignal } from "@/lib/signal-audience";
import {
  audienceCount,
  audienceFigure,
  formatAudienceCents,
  formatAudienceUsd,
  sortAudiences,
  type AudienceColumn,
  type AudienceSortCol,
} from "@/lib/audience-table-model";
import { AudienceAvatar } from "@/components/audiences/audience-avatar";
import { ProviderLogo } from "@/components/provider-logo";
import { EditWithAIChat } from "@/components/ai-edit/edit-with-ai-chat";
import { EmptyNote, Shimmer, StateDot } from "@/components/v2/ui";
import { RecordsFooter, RecordsTabs, RecordsToolbar, REC_TH, useRowKeys } from "@/components/v2/records";
import { useAudienceTable } from "@/components/v2/use-audience-table";
import { useStatBasis } from "@/lib/use-stat-basis";
import { shownFigure, type MaturityPair, type StatBasis } from "@/lib/maturity";
import { LEG_PAIR_NOUN } from "@/lib/campaign-leg-columns";

type Tab = "active" | "suggested" | "archived";

const STATUS_WORD: Record<string, string> = { active: "Active", paused: "Paused", archived: "Archived", suggested: "Suggested" };

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 2.5l1.2 3.3L12.5 7 9.2 8.2 8 11.5 6.8 8.2 3.5 7l3.3-1.2L8 2.5ZM12.5 11l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5L10.5 13l1.5-.5.5-1.5Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
      <rect x="1" y="1" width="14" height="14" rx="3" fill="currentColor" />
      <path d="M4.5 6.5v5M4.5 4.3v.1M7.3 11.5V6.5m0 2.3c0-1.4.9-2.4 2-2.4s1.9.8 1.9 2.2v2.9" stroke="var(--bg-raised)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** A LinkedIn signal audience names its competitors where an Apollo one names nothing. */
function SignalTag({ signal }: { signal: LinkedInSignal }) {
  const slugs = signal.competitorPages.map(companyPageSlug).join(", ");
  return (
    <span className="k-chip min-w-0 shrink gap-1" title={`LinkedIn signal: ${slugs}`}>
      <LinkedInIcon />
      <span className="truncate">{slugs || "LinkedIn signal"}</span>
    </span>
  );
}

/** A price or a return withheld under the learning bar: the word takes the value's place. */
function Withheld({ paused }: { paused: boolean }) {
  return <span className="k-chip">{paused ? "Paused" : "Learning"}</span>;
}

/** The mission's own cost per outcome, the served mature figure (Learning where it is not). */
function MissionPrice({
  leg,
  noun,
  basis,
  paused,
}: {
  leg: MaturityPair<{ costPerOutcomeUsd: number | null }> | null;
  noun: string;
  basis: StatBasis;
  paused: boolean;
}) {
  const price = shownFigure(leg, (h) => h.costPerOutcomeUsd, basis);
  return (
    <p className="k-fg2 mb-3 flex items-center gap-2 text-[13px]">
      <span className="k-label">This mission</span>
      {price.learning ? (
        <Withheld paused={paused} />
      ) : (
        price.value == null ? (
          <span className="k-fg4">—</span>
        ) : (
          <span className="k-fg tabular-nums">{`${formatAudienceUsd(price.value)} per ${noun}`}</span>
        )
      )}
    </p>
  );
}

/**
 * One cell of the audience table. Every ratio is the half of the row's served maturity
 * pair the reader is shown (lib/maturity.ts); a missing one is `—`, one the producer
 * says is not mature reads Learning (or Paused while the campaign that would produce it
 * is stopped). Totals and counts are served verbatim.
 */
function AudienceCell({
  column,
  audience,
  stats,
  statsLoading,
  basis,
  paused,
}: {
  column: AudienceColumn;
  audience: AudienceWire;
  stats: FeatureAudienceStatsRow | undefined;
  statsLoading: boolean;
  basis: StatBasis;
  paused: boolean;
}) {
  if (column.fromStats && statsLoading) return <Shimmer className="ml-auto h-3.5 w-10" />;
  const dash = <span className="k-fg4">—</span>;
  const figure = audienceFigure(column.col, stats, basis);
  switch (column.kind) {
    case "roi": {
      if (figure.learning) return <Withheld paused={paused} />;
      const v = figure.value;
      if (v == null) return dash;
      return <span className={`font-medium ${roiIsGood(v) ? "text-[var(--run)]" : ""}`}>{formatRoi(v)}</span>;
    }
    case "pct": {
      if (figure.learning) return <Withheld paused={paused} />;
      return figure.value == null ? dash : <>{Math.round(figure.value)}%</>;
    }
    case "usd": {
      if (figure.learning) return <Withheld paused={paused} />;
      return figure.value == null ? dash : <>{formatAudienceUsd(figure.value)}</>;
    }
    case "cents":
      return stats ? <>{formatAudienceCents(stats.evidence.totalCostInUsdCents)}</> : dash;
    case "cost": {
      if (figure.learning) return <Withheld paused={paused} />;
      return figure.value == null ? dash : <>{formatAudienceCents(figure.value)}</>;
    }
    case "count": {
      if (column.col === "size") return audience.sizeCount != null ? <>{formatCount(audience.sizeCount)}</> : dash;
      const v = stats ? audienceCount(column.col, stats) : null;
      return v == null ? dash : <>{formatCount(v)}</>;
    }
    case "remaining": {
      const pct = audience.availableToContactPct;
      if (pct == null) return dash;
      return (
        <span className={pct < 5 ? "text-[var(--data-rose)]" : ""}>
          {pct}%
          {audience.availableToContactCount != null && (
            <span className="k-fg3 ml-1">({formatCount(audience.availableToContactCount)})</span>
          )}
        </span>
      );
    }
  }
}

/**
 * The audiences of an offer (or of one mission of it), in Keel's records anatomy:
 * underline tabs with counts, a "/" search, a 13px table whose headers sort, J/K/Enter,
 * and a drawer for one audience. Reads and writes are v1's own (`useAudienceTable`), so
 * the two versions share one cache and cannot state one audience two ways.
 */
export function V2AudiencesTable({
  campaignId,
  offerId,
  plain = false,
}: {
  campaignId?: string;
  offerId?: string;
  /** The offer's own Targeting: who each audience is, in its served sentence, and no
   *  channel figures (owner 2026-10-04). A channel's Targeting keeps the figures table.
   *  It also lists the audiences suggested at onboarding and never activated, and leaves
   *  out LinkedIn signal audiences: those are a way to FIND people (who engaged with a
   *  competitor's post), not a description of who the offer is sold to. */
  plain?: boolean;
}) {
  const t = useAudienceTable({ campaignId, offerId, includeSuggested: plain });
  const columns = plain ? [] : t.columns;
  const { basis } = useStatBasis();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("active");
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(-1);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("audienceId"));
  const [aiOpen, setAiOpen] = useState(false);
  const [autoPrompt, setAutoPrompt] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<AudienceSortCol>(plain ? "audience" : t.defaultSortCol);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(plain ? "asc" : t.defaultSortDir);
  // A plain list has no figure to sort on: it stays alphabetical.
  const [userSorted, setUserSorted] = useState(plain);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // The default sort follows the grain until the reader picks a column.
  useEffect(() => {
    if (userSorted) return;
    setSortCol(t.defaultSortCol);
    setSortDir(t.defaultSortDir);
  }, [t.defaultSortCol, t.defaultSortDir, userSorted]);

  const onSort = (col: AudienceSortCol) => {
    setUserSorted(true);
    if (col === sortCol) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  // Ties on an outcome price break on the cheapest website visit, as in v1.
  const tieBreakCol: AudienceSortCol | null =
    (t.showSignupCols && sortCol === "cps") ||
    (t.showFormSubmissionCols && sortCol === "cpfs") ||
    (t.showSaleCols && sortCol === "cpsale")
      ? "cpc"
      : null;

  // A handful of rows, re-sorted each render so a poll's fresh stats reorder them.
  const needle = q.trim().toLowerCase();
  const listed = plain ? t.audiences.filter((a) => !linkedInSignalOf(a.filters)) : t.audiences;
  const inTab = listed.filter((a) =>
    tab === "archived" ? a.status === "archived" : tab === "suggested" ? a.status === "suggested" : a.status === "active" || a.status === "paused",
  );
  const tabCount = (k: Tab) =>
    listed.filter((a) =>
      k === "archived" ? a.status === "archived" : k === "suggested" ? a.status === "suggested" : a.status === "active" || a.status === "paused",
    ).length;
  const rows = sortAudiences(
    needle
      ? inTab.filter((a) => `${a.name ?? ""} ${a.targetText ?? ""} ${a.description ?? ""}`.toLowerCase().includes(needle))
      : inTab,
    { sortCol, sortDir, tieBreakCol, statsFor: t.statsFor, basis },
  );

  const selected = selectedId ? t.audiences.find((a) => a.id === selectedId) ?? null : null;
  // A deep-linked id is kept until the lists land, then dropped if it names nothing.
  useEffect(() => {
    if (!t.listsPending && selectedId && !selected) setSelectedId(null);
  }, [t.listsPending, selectedId, selected]);
  useEffect(() => setCursor(-1), [tab, q]);

  useRowKeys({
    count: rows.length,
    cursor,
    setCursor,
    onOpen: (i) => rows[i] && setSelectedId(rows[i].id),
    searchRef,
  });

  const tabLoading =
    tab === "archived" ? t.archivedTabLoading : tab === "suggested" ? t.suggestedTabLoading : t.activeTabLoading;
  const colCount = columns.length + 2;
  const sortable: { col: AudienceSortCol; label: string }[] = [
    { col: "audience", label: "Audience" },
    ...columns.map((c) => ({ col: c.col, label: c.label })),
  ];
  const sortLabel = sortable.find((s) => s.col === sortCol)?.label ?? "Audience";
  const docked = aiOpen && Boolean(selected);

  if (!t.revenueOk) {
    return (
      <div className="k-card">
        <EmptyNote>This view is not available yet.</EmptyNote>
      </div>
    );
  }

  return (
    <>
      {!plain && (
      <p className="k-fg2 mb-3 text-[13px]">
        {t.campaignScoped
          ? "The figures count this mission only. The audiences belong to the offer, so pausing or archiving one here changes it for every mission."
          : "ROI, % CAC and $ CAC are projected from your conversion rates and lifetime revenue; $ Invested is what each audience has cost so far."}{" "}
        A price counts only outreach sent long enough ago for its answers to have arrived, and reads Learning until that outreach has produced enough outcomes.
      </p>
      )}
      {/* THE MISSION'S OWN PRICE, off the envelope's scope maturity: the same served figure
          its Overview states, so this page and that one print one price for one mission. */}
      {t.campaignScoped && t.scopeLeg && t.legPair && <MissionPrice leg={t.scopeLeg} noun={LEG_PAIR_NOUN[t.legPair]} basis={basis} paused={t.withheldPaused} />}
      <div className="k-card overflow-hidden">
        <RecordsTabs
          tabs={[
            { key: "active", label: "Active", count: t.activeTabLoading && t.activeTabRows === 0 ? null : tabCount("active") },
            ...(plain
              ? [
                  {
                    key: "suggested",
                    label: "Suggested",
                    count: t.suggestedTabLoading && t.suggestedTabRows === 0 ? null : tabCount("suggested"),
                  },
                ]
              : []),
            { key: "archived", label: "Archived", count: t.archivedTabLoading && t.archivedTabRows === 0 ? null : tabCount("archived") },
          ]}
          active={tab}
          onPick={(k) => setTab(k as Tab)}
          right={<span>Create or change audiences by chatting with the AI</span>}
        />
        <RecordsToolbar
          search={q}
          onSearch={setQ}
          placeholder="Search audiences"
          inputRef={searchRef}
          right={
            <>
              {!plain && (
              <>
              <label className="k-btn relative h-7 pr-2 text-[12px]">
                <span className="k-fg2">Sort</span>
                <span>{sortLabel}</span>
                <select
                  aria-label="Sort"
                  value={sortCol}
                  onChange={(e) => {
                    setUserSorted(true);
                    setSortCol(e.target.value as AudienceSortCol);
                  }}
                  className="absolute inset-0 cursor-pointer opacity-0"
                >
                  {sortable.map((s) => (
                    <option key={s.col} value={s.col}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  setUserSorted(true);
                  setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                }}
                aria-label={sortDir === "asc" ? "Sorted ascending, switch to descending" : "Sorted descending, switch to ascending"}
                className="k-btn h-7 w-7 justify-center px-0"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={sortDir === "desc" ? "rotate-180" : ""}>
                  <path d="M6 9.5v-7M3 5l3-3 3 3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              </>
              )}
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  setAiOpen(true);
                }}
                className="k-btn-strong"
              >
                <SparkleIcon />
                Edit with AI
              </button>
            </>
          }
        />
        {plain ? (
          <PlainAudienceList
            rows={rows}
            loading={tabLoading}
            emptyText={
              q
                ? "No audience matches."
                : tab === "archived"
                  ? "No archived audiences."
                  : tab === "suggested"
                    ? "No suggested audiences."
                    : "No audiences yet."
            }
            cursor={cursor}
            selectedId={selectedId}
            onHover={setCursor}
            onOpen={setSelectedId}
          />
        ) : (
        <div className="k-scroll overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr>
                <SortTh col="audience" label="Audience" sortCol={sortCol} sortDir={sortDir} onSort={onSort} align="left" first />
                <th className={REC_TH}>Status</th>
                {columns.map((c) => (
                  <SortTh key={c.col} col={c.col} label={c.label} sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && tabLoading ? (
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={i} className="k-row h-10">
                    <td colSpan={colCount} className="px-4">
                      <Shimmer className="h-4 w-full" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={colCount}>
                    <EmptyNote>
                      {q ? "No audience matches." : tab === "archived" ? "No archived audiences." : "No audiences yet."}
                    </EmptyNote>
                  </td>
                </tr>
              ) : (
                rows.map((a, i) => {
                  const stats = t.statsFor(a.id);
                  const name = a.name || "Untitled";
                  const signal = linkedInSignalOf(a.filters);
                  return (
                    <tr
                      key={a.id}
                      onClick={() => setSelectedId(a.id)}
                      onMouseEnter={() => setCursor(i)}
                      aria-label={`Open ${name}`}
                      className={`group k-row h-10 cursor-pointer ${i === cursor || a.id === selectedId ? "k-selected" : ""}`}
                    >
                      <td className={`${signal ? "max-w-[420px]" : "max-w-[280px]"} pl-4 pr-3`}>
                        <span className="flex min-w-0 items-center gap-2">
                          <AudienceAvatar name={name} avatarUrl={a.avatarUrl} size={20} />
                          <span className="truncate font-medium">{name}</span>
                          {signal && <SignalTag signal={signal} />}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3">
                        <StateDot running={a.status === "active"} label={STATUS_WORD[a.status] ?? a.status} />
                      </td>
                      {columns.map((c) => (
                        <td key={c.col} className="whitespace-nowrap px-3 text-right tabular-nums last:pr-4">
                          <AudienceCell
                            column={c}
                            audience={a}
                            stats={stats}
                            statsLoading={t.statsLoading}
                            basis={basis}
                            paused={t.withheldPaused}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        )}
        <RecordsFooter
          left={`${formatCount(rows.length)} ${rows.length === 1 ? "audience" : "audiences"} · sorted by ${sortLabel}`}
          right={
            <span className="k-keys hidden items-center gap-1 md:inline-flex">
              <span className="k-kbd">/</span> search
            </span>
          }
        />
      </div>

      {selected && (
        <AudienceDrawer
          audience={selected}
          columns={columns}
          stats={t.statsFor(selected.id)}
          statsLoading={t.statsLoading}
          basis={basis}
          paused={t.withheldPaused}
          plain={plain}
          docked={docked}
          onClose={() => {
            setSelectedId(null);
            setAiOpen(false);
          }}
          onFindSimilar={() => {
            setAutoPrompt(`Find audiences similar to "${selected.name || "this audience"}" and create them.`);
            setAiOpen(true);
          }}
          onRegenerateAvatar={() => t.avatarMut.mutate(selected.id)}
          avatarPending={t.avatarMut.isPending && t.avatarMut.variables === selected.id}
          onRename={(name) => t.renameMut.mutateAsync({ id: selected.id, name })}
          onSetStatus={(status) => t.statusMut.mutate({ id: selected.id, status })}
          pendingStatus={
            t.statusMut.isPending && t.statusMut.variables?.id === selected.id ? t.statusMut.variables.status : null
          }
        />
      )}

      <EditWithAIChat
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        title="Edit audiences with AI"
        intro="Hi, I can create a new audience from a description, rename one, pause, resume or archive it, refresh its counts, or regenerate its avatar. What would you like to do?"
        suggestions={[
          "Create an audience of heads of marketing at Series A SaaS",
          "Pause the lowest-performing audience",
          "Refresh counts on all audiences",
        ]}
        configKey="audience-editor"
        brandId={t.brandId}
        // The chat files what it creates under the offer it is told; without it an
        // audience asked for here would be brand-wide and invisible on this page.
        context={{
          ...(t.offerId ? { offerId: t.offerId } : {}),
          ...(selected ? { audienceId: selected.id } : {}),
        }}
        sessionVersion={selected?.id}
        invalidateKeys={[["audiences", t.brandId]]}
        autoSendMessage={autoPrompt ?? undefined}
        onAutoSendComplete={() => setAutoPrompt(null)}
        showBackdrop={!docked}
        panelClassName="k-popover fixed inset-y-2 right-2 z-[95] flex w-[min(28rem,calc(100vw-16px))] flex-col overflow-hidden"
      />
    </>
  );
}

const MISSING_TEXT: Record<string, string> = {
  not_written_yet: "Being written.",
  no_customer_text: "No description yet.",
};

/** The audience's own text, the one Jev judges every lead against; never `description`. */
function TargetText({ audience }: { audience: AudienceWire }) {
  if (audience.targetText) return <>{audience.targetText}</>;
  const why = audience.targetTextMissingReason ? MISSING_TEXT[audience.targetTextMissingReason] : null;
  return <span className="k-fg4">{why ?? "—"}</span>;
}

const CHANNEL_WORD: Record<string, string> = { cold_email: "Cold email" };
const LIST_WORD: Record<string, string> = {
  apollo_search: "People search",
  apollo_buying_signal: "Buying signal",
  linkedin_engagement: "LinkedIn engagement",
  crm_contacts: "Your contacts",
  apify_search: "LinkedIn search",
};
const SIZE_UNKNOWN_WORD: Record<string, string> = {
  not_built_yet: "Not built yet",
  unknown_until_walked: "Counted as it runs",
  not_counted: "Not counted",
};

/** One list a channel built from the audience's text, with that list's own size. */
function ChannelLine({ c }: { c: AudienceChannelWire }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span className="min-w-0 truncate">
        {CHANNEL_WORD[c.channel] ?? c.channel}
        <span className="k-fg3"> · {LIST_WORD[c.list] ?? c.list}</span>
      </span>
      <span className="k-fg2 shrink-0 tabular-nums">
        {c.size != null ? (
          `${formatCount(c.size)} people`
        ) : (
          <span className="k-fg4">{(c.sizeUnknownReason && SIZE_UNKNOWN_WORD[c.sizeUnknownReason]) ?? "—"}</span>
        )}
      </span>
    </div>
  );
}

/**
 * The offer's audiences in plain words: each one's name, status and the one sentence
 * human-service serves for who it targets (`targetText`, what Jev judges). No channel figure here.
 */
function PlainAudienceList({
  rows,
  loading,
  emptyText,
  cursor,
  selectedId,
  onHover,
  onOpen,
}: {
  rows: AudienceWire[];
  loading: boolean;
  emptyText: string;
  cursor: number;
  selectedId: string | null;
  onHover: (i: number) => void;
  onOpen: (id: string) => void;
}) {
  if (rows.length === 0 && loading) {
    return (
      <ul>
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="k-line-subtle border-b px-4 py-3 last:border-b-0">
            <Shimmer className="h-4 w-48" />
            <Shimmer className="mt-2 h-3.5 w-full" />
          </li>
        ))}
      </ul>
    );
  }
  if (rows.length === 0) return <EmptyNote>{emptyText}</EmptyNote>;
  return (
    <ul>
      {rows.map((a, i) => {
        const name = a.name || "Untitled";
        return (
          <li key={a.id} className="k-line-subtle border-b last:border-b-0">
            <button
              type="button"
              onClick={() => onOpen(a.id)}
              onMouseEnter={() => onHover(i)}
              aria-label={`Open ${name}`}
              className={`k-row flex w-full items-start gap-3 px-4 py-3 text-left ${i === cursor || a.id === selectedId ? "k-selected" : ""}`}
            >
              <AudienceAvatar name={name} avatarUrl={a.avatarUrl} size={28} />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center justify-between gap-3">
                  <span className="truncate text-[13px] font-medium">{name}</span>
                  <StateDot running={a.status === "active"} label={STATUS_WORD[a.status] ?? a.status} />
                </span>
                <span className="k-fg2 mt-0.5 block text-[13px] leading-5">
                  <TargetText audience={a} />
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SortTh({
  col,
  label,
  sortCol,
  sortDir,
  onSort,
  align = "right",
  first = false,
}: {
  col: AudienceSortCol;
  label: string;
  sortCol: AudienceSortCol;
  sortDir: "asc" | "desc";
  onSort: (c: AudienceSortCol) => void;
  align?: "left" | "right";
  first?: boolean;
}) {
  const active = sortCol === col;
  return (
    <th
      className={`${REC_TH} whitespace-nowrap ${align === "right" ? "text-right last:pr-4" : ""} ${first ? "pl-4" : ""}`}
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
    >
      <button
        type="button"
        onClick={() => onSort(col)}
        aria-label={`Sort by ${label}`}
        className={`inline-flex items-center gap-1 uppercase hover:text-[var(--fg-1)] ${active ? "text-[var(--fg-1)]" : ""}`}
      >
        {label}
        <span className="w-2 text-[9px] leading-none">{active ? (sortDir === "asc" ? "▲" : "▼") : ""}</span>
      </button>
    </th>
  );
}

/** The name's box, identical reading and editing, so nothing moves on click. */
const AUDIENCE_NAME_BOX = "-mx-2 flex w-fit min-w-0 max-w-[calc(100%+16px)] items-center gap-2 rounded-[8px] border px-2 text-[16px] font-medium leading-6";

/**
 * The audience's NAME, edited where it is read (the offer title's pattern): a hover
 * shows the pencil, a click turns the text into its field in the same box, blur/Enter
 * saves, Esc drops it. The typed value stays on screen while it saves; a refusal
 * reopens the field with the text kept. human-service owns uniqueness (per offer,
 * case-insensitive) and answers a clash with a 409, which is the line shown.
 */
function AudienceNameTitle({ name, onRename }: { name: string; onRename: (name: string) => Promise<unknown> }) {
  const [text, setText] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const commit = () => {
    if (text === null) return;
    const trimmed = text.trim();
    setText(null);
    setError(null);
    if (trimmed.length === 0 || trimmed === name) return;
    setPending(trimmed);
    onRename(trimmed).then(
      () => setPending(null),
      (err: unknown) => {
        console.error("[dashboard] audience rename failed", err);
        setPending(null);
        setText(trimmed);
        setError(
          err instanceof ApiError && err.status === 409
            ? "Another audience already has this name."
            : "Could not rename this audience. Try again.",
        );
      },
    );
  };

  return (
    <div className="min-w-0">
      {/* Both states sit in the heading, so the field takes the title's own font. */}
      <h2 className="flex min-w-0">
        {text !== null ? (
          <span className={`${AUDIENCE_NAME_BOX} border-[var(--accent)]`}>
            <span className="inline-grid min-w-0">
              <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-pre">
                {text || " "}{" "}
              </span>
              <input
                autoFocus
                size={1}
                aria-label="Audience name"
                value={text}
                placeholder="Audience name"
                onChange={(e) => {
                  setText(e.target.value);
                  setError(null);
                }}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") {
                    // The drawer closes on Esc too: this Esc only drops the edit.
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation();
                    setText(null);
                    setError(null);
                  }
                }}
                className="col-start-1 row-start-1 w-full min-w-0 bg-transparent p-0 outline-none [font:inherit] [letter-spacing:inherit]"
              />
            </span>
            <PencilSimpleIcon aria-hidden className="invisible h-4 w-4 shrink-0" />
          </span>
        ) : (
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => setText(name)}
            title="Rename"
            className={`${AUDIENCE_NAME_BOX} k-hover group border-transparent text-left hover:border-[var(--line)]`}
          >
            <span className="truncate">{pending ?? (name || "Untitled")}</span>
            <PencilSimpleIcon className="k-fg3 h-4 w-4 shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100" />
          </button>
        )}
      </h2>
      {error && <p className="mt-0.5 text-[12px] text-[var(--data-rose)]">{error}</p>}
    </div>
  );
}

/**
 * One audience, as a Keel drawer: portalled to the shell's layer (the sidebar drawer's
 * transform would trap `fixed`), Esc closes it, and the header is a label plus ×. It
 * carries everything v1's panel did: the lifecycle actions, the image, the targeting,
 * the details, and the AI hand-off; plus this audience's own row of figures.
 */
function AudienceDrawer({
  audience,
  columns,
  stats,
  statsLoading,
  basis,
  paused,
  plain,
  docked,
  onClose,
  onFindSimilar,
  onRegenerateAvatar,
  avatarPending,
  onRename,
  onSetStatus,
  pendingStatus,
}: {
  audience: AudienceWire;
  columns: AudienceColumn[];
  stats: FeatureAudienceStatsRow | undefined;
  statsLoading: boolean;
  basis: StatBasis;
  paused: boolean;
  /** The offer's Targeting: the audience is its text, plus the channels working it. */
  plain: boolean;
  docked: boolean;
  onClose: () => void;
  onFindSimilar: () => void;
  onRegenerateAvatar: () => void;
  avatarPending: boolean;
  onRename: (name: string) => Promise<unknown>;
  onSetStatus: (s: AudienceStatus) => void;
  pendingStatus: AudienceStatus | null;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  // The host is read AFTER mount: on a deep-linked first paint (`?audienceId=`) the
  // shell's `#v2-portal` is not committed yet, and a render-time lookup would fall back
  // to `body`, outside `.v2-root`, where no Keel token applies.
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.getElementById("v2-portal")), []);
  if (!host) return null;

  const name = audience.name || "Untitled";
  const count = audience.apolloCount ?? audience.apifyCount;
  const providerDomain = audience.provider ? PROVIDER_DOMAINS[audience.provider.toLowerCase()] ?? null : null;
  const signal = linkedInSignalOf(audience.filters);
  // A signal audience's filters hold its criterion, not Apollo filters: it gets its own section.
  const groups = audience.filters && !signal && !plain ? audienceFilterGroups(audience.filters) : [];
  const busy = (s: AudienceStatus) => pendingStatus === s;
  const StatusBtn = ({ label, to }: { label: string; to: AudienceStatus }) => (
    <button type="button" onClick={() => onSetStatus(to)} disabled={pendingStatus != null} className="k-btn disabled:opacity-60">
      {busy(to) ? `${label}...` : label}
    </button>
  );

  return createPortal(
    <aside
      role="dialog"
      aria-label={`${name} audience`}
      className={`k-popover fixed inset-y-2 right-2 z-[80] flex w-[min(440px,calc(100vw-16px))] flex-col overflow-hidden ${
        docked ? "md:right-[calc(28rem+16px)]" : ""
      }`}
    >
      <div className="k-line-subtle flex h-11 shrink-0 items-center justify-between border-b px-4">
        <span className="k-label">Audience</span>
        <button type="button" onClick={onClose} aria-label="Close" className="k-btn-ghost h-7 w-7 justify-center px-0">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="k-scroll min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onRegenerateAvatar}
            disabled={avatarPending}
            aria-label={audience.avatarUrl ? "Regenerate the audience image" : "Generate an audience image"}
            title={audience.avatarUrl ? "Regenerate image" : "Generate image"}
            className="group relative h-10 w-10 shrink-0 overflow-hidden rounded-full disabled:cursor-wait"
          >
            <AudienceAvatar name={name} avatarUrl={audience.avatarUrl} size={40} />
            <span
              className={`absolute inset-0 flex items-center justify-center bg-black/50 text-white transition-opacity duration-150 ${
                avatarPending ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
              }`}
            >
              {avatarPending ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <SparkleIcon />
              )}
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <AudienceNameTitle key={audience.id} name={audience.name} onRename={onRename} />
            <StateDot running={audience.status === "active"} label={STATUS_WORD[audience.status] ?? audience.status} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {audience.status === "active" && <StatusBtn label="Pause" to="paused" />}
          {audience.status === "paused" && <StatusBtn label="Resume" to="active" />}
          {audience.status === "suggested" && <StatusBtn label="Activate" to="active" />}
          {audience.status === "archived" ? <StatusBtn label="Restore" to="active" /> : <StatusBtn label="Archive" to="archived" />}
          <button type="button" onClick={onFindSimilar} className="k-btn">
            <SparkleIcon />
            Expand and split with similar audience
          </button>
        </div>

        {columns.length > 0 && (
          <div className="k-inset grid grid-cols-2 overflow-hidden rounded-[10px]">
            {columns.map((c) => (
              <div key={c.col} className="px-3 py-2.5">
                <p className="k-label truncate">{c.label}</p>
                <p className="mt-1 text-[15px] font-medium tabular-nums">
                  <AudienceCell
                    column={c}
                    audience={audience}
                    stats={stats}
                    statsLoading={statsLoading}
                    basis={basis}
                    paused={paused}
                  />
                </p>
              </div>
            ))}
          </div>
        )}

        {plain && (
          <section>
            <p className="k-label mb-2">Who</p>
            <p className="text-[13px] leading-5">
              <TargetText audience={audience} />
            </p>
          </section>
        )}

        {plain && (
          <section>
            <p className="k-label mb-2">Used by</p>
            {audience.channels && audience.channels.length > 0 ? (
              <div className="space-y-1.5">
                {audience.channels.map((c) => (
                  <ChannelLine key={`${c.channel}-${c.list}-${c.audienceId}`} c={c} />
                ))}
              </div>
            ) : (
              <p className="k-fg4 text-[13px]">No channel yet.</p>
            )}
          </section>
        )}

        {signal && !plain && (
          <section>
            <p className="k-label mb-2">Targeting</p>
            <dl className="space-y-2">
              <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-2">
                <dt className="k-fg3 pt-0.5 text-[12px]">LinkedIn signal</dt>
                <dd className="text-[13px]">
                  Liked or commented on these pages&apos; posts
                  {signal.windowDays != null ? ` in the last ${signal.windowDays} days` : ""}
                </dd>
              </div>
              <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-2">
                <dt className="k-fg3 pt-0.5 text-[12px]">Competitors</dt>
                <dd className="flex min-w-0 flex-wrap gap-1">
                  {signal.competitorPages.map((page) => (
                    <a
                      key={page}
                      href={page}
                      target="_blank"
                      rel="noreferrer"
                      className="k-chip h-auto min-h-5 whitespace-normal break-words py-0.5 hover:text-[var(--accent)]"
                    >
                      {companyPageSlug(page)}
                    </a>
                  ))}
                </dd>
              </div>
              {audience.nlPrompt && (
                <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-2">
                  <dt className="k-fg3 pt-0.5 text-[12px]">Who to write to</dt>
                  <dd className="text-[13px]">{audience.nlPrompt}</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        {groups.length > 0 && (
          <section>
            <p className="k-label mb-2">Targeting</p>
            <dl className="space-y-2">
              {groups.map((g) => (
                <div key={g.label} className="grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-2">
                  <dt className="k-fg3 pt-0.5 text-[12px]">{g.label}</dt>
                  <dd className="flex min-w-0 flex-wrap gap-1">
                    {g.values.map((v, j) => (
                      <span key={j} className="k-chip h-auto min-h-5 whitespace-normal break-words py-0.5">
                        {v}
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {!plain && (
        <section>
          <p className="k-label mb-2">Details</p>
          <dl className="space-y-2 text-[13px]">
            {audience.description && (
              <div>
                <dt className="k-fg3 text-[12px]">Described as</dt>
                <dd className="mt-0.5">{audience.description}</dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <dt className="k-fg3 text-[12px]">Provider</dt>
              <dd className="inline-flex items-center gap-1.5">
                {audience.provider ? (
                  <>
                    <ProviderLogo domain={providerDomain} size={14} />
                    <span className="capitalize">{audience.provider}</span>
                  </>
                ) : (
                  <span className="k-fg4">—</span>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="k-fg3 text-[12px]">Approx. matches</dt>
              <dd className="tabular-nums">{count != null ? formatCount(count) : <span className="k-fg4">—</span>}</dd>
            </div>
          </dl>
        </section>
        )}
      </div>
    </aside>,
    host,
  );
}
