"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getLeadConsolidatedStatus, leadDateForStatus, listLeadsPage } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { POLL_INTERVAL } from "@/lib/query-options";
import { formatCount, formatUsdAdaptive } from "@/lib/format-number";
import { v2Href } from "@/lib/v2/routes";
import { timeAgo } from "@/lib/friendly-datetime";
import { LEAD_BOARD_COLUMNS, LEAD_BOARD_PAGE_SIZE, type LeadBoardColumnKey } from "@/lib/lead-board";
import { boardColumnTotals, leadsColumnPageQuery } from "@/lib/leads-server-page";
import { MaturityBadge } from "@/components/maturity-badge";
import { CrewMark } from "@/components/v2/crew-mark";
import { useMissions, type Mission } from "@/components/v2/use-missions";
import { brandLeadScopeKey, useBrandRevenue, useStandingCounts } from "@/components/v2/data";
import { EmptyNote, Shimmer, TopBar } from "@/components/v2/ui";
import { CompanyMark, PersonAvatar, leadCompany, leadCompanyDomain, leadName, v1LeadHref } from "@/components/v2/people-bits";

/** Keel's stage dot per column. Semantic only: green is a win, rose is a stop. */
const COLUMN_DOT: Record<LeadBoardColumnKey, string> = {
  contacted: "var(--data-sky)",
  sales_interest: "var(--accent)",
  won: "var(--data-teal)",
  disqualified: "var(--fg-4)",
  opt_out: "var(--data-rose)",
  unresolved: "var(--fg-4)",
};

/**
 * Deals (beta): Keel's pipeline board, drawn from lead-service's STANDINGS — a partition,
 * so every person is in exactly one column and the column sizes are the producer's own
 * counts. Each column is its own page on the producer's activity order, the same reads
 * v1's board makes. Moving a card is a statement with a cost; it stays on v1's board,
 * which asks for it, so this board opens the person rather than writing.
 */
export function DealsPage() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const totals = boardColumnTotals(useStandingCounts(brandId).data);
  const { missionByCampaignId, crews } = useMissions(orgId, brandId);
  const revenue = useBrandRevenue(brandId);
  const [crewFilter, setCrewFilter] = useState<string | null>(null);
  const columns = LEAD_BOARD_COLUMNS.filter(
    (c) => !(c.hideWhenEmpty && (totals?.[c.key] ?? 0) === 0),
  );
  const interested = totals?.sales_interest ?? null;
  const won = totals?.won ?? null;
  const pipeline = revenue.data?.totalPipelineUsd ?? null;
  const biggest = Math.max(1, ...columns.map((c) => totals?.[c.key] ?? 0));
  return (
    <>
      <TopBar
        crumbs={[{ label: "Records" }, { label: "Deals" }]}
        actions={
          <>
            <Link href={`/orgs/${encodeURIComponent(orgId)}/brands/${encodeURIComponent(brandId)}/leads`} className="k-btn hidden sm:inline-flex">
              Move cards in v1
            </Link>
            <MaturityBadge level="beta" />
          </>
        }
      />
      <div className="flex min-h-0 flex-col px-4 pb-10 pt-6 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em]">
              {pipeline != null && interested != null
                ? `${formatUsdAdaptive(pipeline)} expected across ${formatCount(interested)} interested`
                : "Deals"}
            </h1>
            <p className="k-fg2 mt-1 text-[14px]">
              {won != null ? (
                <>
                  <span className="inline-block h-2 w-2 rounded-[2px] bg-[var(--data-teal)] align-middle" />{" "}
                  <span className="k-fg font-medium tabular-nums">{formatCount(won)}</span> won so far. One card per person, in the column where they stand.
                </>
              ) : (
                " "
              )}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {crews.map((c) => {
            const on = crewFilter === c.crew.key;
            return (
              <button
                key={c.crew.key}
                type="button"
                aria-pressed={on}
                title={c.crew.name}
                onClick={() => setCrewFilter(on ? null : c.crew.key)}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${on ? "bg-[var(--bg-selected)] shadow-[inset_0_0_0_1px_var(--line-strong)]" : "k-hover"}`}
              >
                <CrewMark color={c.crew.color} glyph={c.crew.glyph} size={18} />
              </button>
            );
          })}
          {columns.map((c) => (
            <span key={c.key} className="k-btn pointer-events-none h-7 text-[12px]">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: COLUMN_DOT[c.key] }} />
              {c.label}
              <span className="k-fg3 tabular-nums">{totals?.[c.key] != null ? formatCount(totals[c.key] ?? 0) : ""}</span>
            </span>
          ))}
          <span className="k-inset ml-auto inline-flex rounded-[9px] p-0.5 shadow-[inset_0_0_0_1px_var(--line-subtle)]">
            <span className="k-btn h-6 px-2 text-[12px]">Board</span>
            <Link href={v2Href(orgId, brandId, "people")} className="k-btn-ghost h-6 px-2 text-[12px]">Table</Link>
          </span>
        </div>

        <div className="k-scroll mt-5 flex gap-4 overflow-x-auto pb-2">
          {columns.map((c) => (
            <DealColumn
              key={c.key}
              brandId={brandId}
              orgId={orgId}
              column={c.key}
              label={c.label}
              total={totals?.[c.key] ?? null}
              share={(totals?.[c.key] ?? 0) / biggest}
              crewFilter={crewFilter}
              missionFor={(id) => missionByCampaignId.get(id) ?? null}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function DealColumn({
  brandId,
  orgId,
  column,
  label,
  total,
  share,
  crewFilter,
  missionFor,
}: {
  brandId: string;
  orgId: string;
  column: LeadBoardColumnKey;
  label: string;
  total: number | null;
  share: number;
  crewFilter: string | null;
  missionFor: (campaignId: string) => Mission | null;
}) {
  const [shown, setShown] = useState(LEAD_BOARD_PAGE_SIZE);
  const q = useAuthQuery(
    ["leadsPage", brandLeadScopeKey(brandId), "v2-deals", column, shown],
    () =>
      listLeadsPage({ brandId }, leadsColumnPageQuery({ column, search: "", shown }), undefined, {
        includeCampaigns: false,
      }),
    { refetchInterval: POLL_INTERVAL, enabled: total === null || total > 0 },
  );
  const all = total === 0 ? [] : (q.data?.leads ?? null);
  const leads = all && crewFilter ? all.filter((l) => missionFor(l.campaignId)?.crew.key === crewFilter) : all;
  return (
    <section className="flex w-[272px] min-w-[240px] shrink-0 flex-col md:flex-1 md:basis-0">
      <header className="flex h-7 items-center gap-2 px-0.5">
        <span className="h-2 w-2 rounded-[2px]" style={{ background: COLUMN_DOT[column] }} />
        <span className="text-[13px] font-medium">{label}</span>
        <span className="k-fg3 text-[13px] tabular-nums">{total == null ? "" : formatCount(total)}</span>
      </header>
      <div className="mb-3 mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--data-track)]">
        <div className="h-full rounded-full" style={{ width: `${Math.round(share * 100)}%`, background: COLUMN_DOT[column] }} />
      </div>
      <div className="flex flex-col gap-2">
        {leads === null ? (
          [0, 1, 2].map((i) => <Shimmer key={i} className="h-[74px] rounded-[10px]" />)
        ) : leads.length === 0 ? (
          <EmptyNote>Nobody here.</EmptyNote>
        ) : (
          leads.map((lead) => {
            const company = leadCompany(lead);
            const m = missionFor(lead.campaignId);
            const at = leadDateForStatus(lead, getLeadConsolidatedStatus(lead));
            return (
              <Link key={lead.id} href={v1LeadHref(orgId, brandId, lead)} className="k-card block p-3">
                <div className="flex items-center gap-2">
                  {company ? (
                    <CompanyMark name={company} domain={leadCompanyDomain(lead)} size={18} />
                  ) : (
                    <PersonAvatar lead={lead} size={18} />
                  )}
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{company ?? leadName(lead)}</span>
                </div>
                {company ? (
                  <div className="k-fg2 mt-1.5 flex items-center gap-1.5 text-[12px]">
                    <PersonAvatar lead={lead} size={14} />
                    <span className="truncate">{leadName(lead)}</span>
                  </div>
                ) : null}
                <div className="k-fg3 mt-1.5 flex items-center gap-1.5 text-[11px]">
                  {m ? (
                    <span className="inline-flex min-w-0 items-center gap-1 truncate">
                      <CrewMark color={m.crew.color} glyph={m.crew.glyph} size={12} /> {m.crew.name}
                    </span>
                  ) : null}
                  <span className="ml-auto shrink-0 tabular-nums">{at ? timeAgo(at) : ""}</span>
                </div>
              </Link>
            );
          })
        )}
        {leads && total != null && leads.length < total ? (
          <button type="button" className="k-btn-ghost k-btn mt-1 justify-center" onClick={() => setShown((s) => s + LEAD_BOARD_PAGE_SIZE)}>
            Show more
          </button>
        ) : null}
      </div>
    </section>
  );
}
