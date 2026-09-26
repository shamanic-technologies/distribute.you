"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getContactedValue, getDealsValue, getLeadConsolidatedStatus, leadDateForStatus, listLeadsPage } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { POLL_INTERVAL } from "@/lib/query-options";
import { formatCount, formatUsdAdaptive } from "@/lib/format-number";
import { v2Href } from "@/lib/v2/routes";
import { timeAgo } from "@/lib/friendly-datetime";
import { leadStatusLabel } from "@/lib/lead-status";
import { STANDINGS_BY_COLUMN, LEAD_BOARD_COLUMNS, LEAD_BOARD_PAGE_SIZE, type LeadBoardColumnKey } from "@/lib/lead-board";
import { boardColumnTotals, leadsColumnPageQuery } from "@/lib/leads-server-page";
import { CrewMark } from "@/components/v2/crew-mark";
import { useMissions, type Mission } from "@/components/v2/use-missions";
import { brandLeadScopeKey, useBrandRevenue, useNeedsYourCall, useStandingCounts } from "@/components/v2/data";
import { EmptyNote, Shimmer, TopBar } from "@/components/v2/ui";
import { CompanyMark, PersonAvatar, leadCompany, leadCompanyDomain, leadName, personHref } from "@/components/v2/people-bits";

/**
 * v2 names the `sales_interest` column for what it holds. v1's board calls it
 * "Positive reply", but the standing also holds everyone who only VISITED the website
 * (86 of 87 on the brand that surfaced this), so the word overstated replies.
 */
const V2_COLUMN_LABEL: Partial<Record<LeadBoardColumnKey, string>> = {
  // Everybody we wrote to who is still in play: the same standings v1 calls "Leads".
  contacted: "Contacted",
  sales_interest: "Interested",
};

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
 * Deals: Keel's pipeline board, drawn from lead-service's STANDINGS — a partition,
 * so every person is in exactly one column and the column sizes are the producer's own
 * counts. Each column is its own page on the producer's activity order, the same reads
 * v1's board makes. Moving a card is a statement with a cost, so a card opens the
 * person's own v2 page, where the win is stated with its cost and value.
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
  const contacted = totals?.contacted ?? null;
  const interested = totals?.sales_interest ?? null;
  const replied = useNeedsYourCall(brandId, 5).data?.total ?? null;
  const won = totals?.won ?? null;
  const pipeline = revenue.data?.totalPipelineUsd ?? null;
  const biggest = Math.max(1, ...columns.map((c) => totals?.[c.key] ?? 0));
  // What each column holds, priced by features-service (a separate figure, not in the
  // pipeline or the ROI). A column is one standing; its value and each card's value are
  // read, never summed here.
  const dealsValue = useAuthQuery(["dealsValue", brandId], () => getDealsValue(brandId), {
    refetchInterval: POLL_INTERVAL,
    enabled: !!brandId,
  });
  const servedFor = useMemo(() => {
    const byStanding = new Map((dealsValue.data?.columns ?? []).map((c) => [c.standing, c]));
    return (column: LeadBoardColumnKey): ServedColumnValue | null => {
      const standings = STANDINGS_BY_COLUMN[column];
      if (column === "contacted" || standings.length !== 1) return null;
      const c = byStanding.get(standings[0]);
      if (!c) return null;
      return {
        valueUsd: c.valueUsd,
        unvaluedReason: c.unvaluedReason,
        basis: c.basis,
        byLead: new Map(c.leads.map((l) => [l.leadId, l.valueUsd])),
      };
    };
  }, [dealsValue.data]);
  return (
    <>
      <TopBar
        crumbs={[{ label: "Records" }, { label: "Deals" }]}
        actions={
          <>
          </>
        }
      />
      <div className="flex min-h-0 flex-col px-4 pb-10 pt-6 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em]">
              {pipeline != null ? `${formatUsdAdaptive(pipeline)} in expected pipeline` : "Deals"}
            </h1>
            <p className="k-fg2 mt-1 text-[14px]">
              {won != null && interested != null ? (
                <>
                  {contacted != null ? (
                    <>
                      <span className="k-fg font-medium tabular-nums">{formatCount(contacted)}</span> contacted,{" "}
                    </>
                  ) : null}
                  <span className="k-fg font-medium tabular-nums">{formatCount(interested)}</span> interested (a website visit or a positive reply)
                  {replied != null ? (
                    <>
                      , <span className="k-fg font-medium tabular-nums">{formatCount(replied)}</span> of them replied
                    </>
                  ) : null}
                  . <span className="inline-block h-2 w-2 rounded-[2px] bg-[var(--data-teal)] align-middle" />{" "}
                  <span className="k-fg font-medium tabular-nums">{formatCount(won)}</span> won.
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
              label={V2_COLUMN_LABEL[c.key] ?? c.label}
              total={totals?.[c.key] ?? null}
              share={(totals?.[c.key] ?? 0) / biggest}
              crewFilter={crewFilter}
              missionFor={(id) => missionByCampaignId.get(id) ?? null}
              served={servedFor(c.key)}
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
  served,
}: {
  brandId: string;
  orgId: string;
  column: LeadBoardColumnKey;
  label: string;
  total: number | null;
  share: number;
  crewFilter: string | null;
  missionFor: (campaignId: string) => Mission | null;
  served: ServedColumnValue | null;
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
  // What the contacted, not-yet-engaged people are worth in expectation. features-service
  // prices them (a separate figure, not in the pipeline or the ROI); this column only
  // shows it, joined to its cards by lead id.
  const valued = column === "contacted";
  const valueIds = valued && all ? all.map((l) => l.leadId).filter((id): id is string => !!id) : [];
  const contactedValue = useAuthQuery(
    ["contactedValue", brandId, valueIds.join(",")],
    () => getContactedValue(brandId, valueIds),
    { refetchInterval: POLL_INTERVAL, enabled: valued && total !== 0 && all !== null },
  );
  const valueByLead = new Map((contactedValue.data?.leads ?? []).map((v) => [v.leadId, v.expectedValueUsd]));
  const columnValue = contactedValue.data?.totalExpectedValueUsd ?? null;
  const leads = all && crewFilter ? all.filter((l) => missionFor(l.campaignId)?.crew.key === crewFilter) : all;
  return (
    <section className="flex w-[272px] min-w-[240px] shrink-0 flex-col md:flex-1 md:basis-0">
      <header className="flex h-7 items-center gap-2 px-0.5">
        <span className="h-2 w-2 rounded-[2px]" style={{ background: COLUMN_DOT[column] }} />
        <span className="text-[13px] font-medium">{label}</span>
        <span className="k-fg3 text-[13px] tabular-nums">{total == null ? "" : formatCount(total)}</span>
        {valued && columnValue != null ? (
          <span className="k-fg2 ml-auto text-[12px] tabular-nums" title="Expected value of these leads, from your conversion rates and client value. Not counted in your pipeline.">
            {formatUsdAdaptive(columnValue)} expected
          </span>
        ) : served?.valueUsd != null ? (
          <span
            className="k-fg ml-auto text-[13px] font-medium tabular-nums"
            title={
              served.basis === "won_value"
                ? "What was won: the amount stated on each sale, else your value of a client. One company counts once."
                : "What these people are worth in expectation, the way your pipeline prices them. One company counts once."
            }
          >
            {formatUsdAdaptive(served.valueUsd)}
          </span>
        ) : null}
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
            const status = getLeadConsolidatedStatus(lead);
            const at = leadDateForStatus(lead, status);
            const value = served && lead.leadId ? served.byLead.get(lead.leadId) ?? null : null;
            return (
              <Link key={lead.id} href={personHref(orgId, brandId, lead)} className="k-card block p-3">
                <div className="flex items-center gap-2">
                  {company ? (
                    <CompanyMark name={company} domain={leadCompanyDomain(lead)} size={18} />
                  ) : (
                    <PersonAvatar lead={lead} size={18} />
                  )}
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{company ?? leadName(lead)}</span>
                  {valued && lead.leadId && valueByLead.get(lead.leadId) != null ? (
                    // Contacted, not engaged: its expected value, quieter than an engaged figure.
                    <span className="k-fg2 shrink-0 text-[12px] tabular-nums">{formatUsdAdaptive(valueByLead.get(lead.leadId) as number)}</span>
                  ) : !valued && value != null && value > 0 ? (
                    <span className="shrink-0 text-[13px] font-medium tabular-nums">{formatUsdAdaptive(value)}</span>
                  ) : null}
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
                <div className="k-fg2 mt-2 flex items-center gap-1.5 border-t border-[var(--line-subtle)] pt-2 text-[12px]">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: COLUMN_DOT[column] }} />
                  <span className="truncate">{leadStatusLabel(status)}</span>
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

/** One column's served value, and each of its cards' values by lead id. */
interface ServedColumnValue {
  valueUsd: number | null;
  unvaluedReason: string | null;
  basis: string | null;
  byLead: Map<string, number | null>;
}
