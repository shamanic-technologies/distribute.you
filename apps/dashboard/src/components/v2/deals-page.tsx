"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getLeadConsolidatedStatus, leadDateForStatus, listLeadsPage } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { POLL_INTERVAL } from "@/lib/query-options";
import { formatCount } from "@/lib/format-number";
import { timeAgo } from "@/lib/friendly-datetime";
import { LEAD_BOARD_COLUMNS, LEAD_BOARD_PAGE_SIZE, type LeadBoardColumnKey } from "@/lib/lead-board";
import { boardColumnTotals, leadsColumnPageQuery } from "@/lib/leads-server-page";
import { MaturityBadge } from "@/components/maturity-badge";
import { CrewMark } from "@/components/v2/crew-mark";
import { useMissions, type Mission } from "@/components/v2/use-missions";
import { brandLeadScopeKey, useStandingCounts } from "@/components/v2/data";
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
  const { missionByCampaignId } = useMissions(orgId, brandId);
  const columns = LEAD_BOARD_COLUMNS.filter(
    (c) => !(c.hideWhenEmpty && (totals?.[c.key] ?? 0) === 0),
  );
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
      <div className="flex min-h-0 flex-col px-4 pb-10 pt-5 md:px-6">
        <h1 className="text-[20px] font-medium tracking-[-0.01em]">Deals</h1>
        <p className="k-fg2 mt-1 text-[13px]">Where each person stands. One card per person, in one column.</p>
        <div className="k-scroll mt-4 flex gap-3 overflow-x-auto pb-2">
          {columns.map((c) => (
            <DealColumn
              key={c.key}
              brandId={brandId}
              orgId={orgId}
              column={c.key}
              label={c.label}
              total={totals?.[c.key] ?? null}
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
  missionFor,
}: {
  brandId: string;
  orgId: string;
  column: LeadBoardColumnKey;
  label: string;
  total: number | null;
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
  const leads = total === 0 ? [] : (q.data?.leads ?? null);
  return (
    <section className="k-surface flex w-[272px] min-w-[240px] shrink-0 flex-col rounded-[12px] p-2 shadow-[inset_0_0_0_1px_var(--line-subtle)] md:flex-1 md:basis-0">
      <header className="flex items-center gap-2 px-1.5 pb-2 pt-1">
        <span className="h-2 w-2 rounded-full" style={{ background: COLUMN_DOT[column] }} />
        <span className="text-[13px] font-medium">{label}</span>
        <span className="k-fg3 ml-auto text-[12px] tabular-nums">{total == null ? "" : formatCount(total)}</span>
      </header>
      <div className="flex flex-col gap-1.5">
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
              <Link key={lead.id} href={v1LeadHref(orgId, brandId, lead)} className="k-card k-hover block p-2.5">
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
