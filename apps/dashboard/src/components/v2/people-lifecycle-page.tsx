"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { fetchLeadsCsv, listUniboxLeads } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { POLL_INTERVAL } from "@/lib/query-options";
import { formatCount } from "@/lib/format-number";
import { timeAgo } from "@/lib/friendly-datetime";
import { leadsExportQuery, LEADS_PAGE_SIZE } from "@/lib/leads-server-page";
import { filtersKey, uniboxLeadName, uniboxRowId, uniboxRowKey, uniboxValueTag, type UniboxDimension, type UniboxFilters } from "@/lib/unibox-leads";
import { DEALS_FILTER_DIMENSIONS, dealCardChips, dealsBoardRungs, peopleLegacyTab } from "@/lib/deals-board";
import { v2Href } from "@/lib/v2/routes";
import { ExportButton, RecordsFooter, RecordsTabs, RecordsToolbar, REC_TH, useRowKeys } from "@/components/v2/records";
import { FunnelFace } from "@/components/v2/funnel-campaigns";
import { useDealsLifecycleCounts, useLeadScope } from "@/components/v2/data";
import { useSelectedOffer } from "@/components/v2/selected-offer";
import { TagChip } from "@/components/v2/tag-chip";
import { UniboxFilterBar } from "@/components/v2/unibox-lead-card";
import { EmptyNote, Initials, Shimmer, TopBar } from "@/components/v2/ui";
import { CompanyMark } from "@/components/v2/people-bits";

/**
 * People (owner 2026-10-21, DEALS-LIFECYCLE-1021): the Deals board as a table. One tab per rung of
 * THE lifecycle ladder (Contacted, Engaged, Signed up, Meeting booked, Meeting attended, Paid
 * client), the same served per-rung counts and the same lead-service Unibox rows as the board, so
 * a tab and its column always agree. Interest, fit and reachability are chips and filters. The
 * search, the filters and the paging all run on lead-service. A row opens the person in the Unibox.
 */
export function PeopleLifecyclePage() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { offerId } = useSelectedOffer();
  // Links written before the ladder (Today's tiles, the bell) name a bucket tab: open its rung.
  const legacy = peopleLegacyTab(params.get("tab"));
  const [filters, setFilters] = useState<UniboxFilters>(legacy?.filters ?? {});
  const counts = useDealsLifecycleCounts(brandId, null, filters);
  const ladder = counts.data?.lifecycleLadder ?? null;
  const rungs = ladder ? dealsBoardRungs(ladder) : null;
  const wanted = legacy?.rung ?? params.get("tab");
  const tab = rungs?.find((r) => r.key === wanted) ?? rungs?.[0] ?? null;
  const [draft, setDraft] = useState(params.get("q") ?? "");
  const [search, setSearch] = useState(params.get("q") ?? "");
  // lead-service pages by cursor: the cursors of the pages already passed, to step back.
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [cursor, setCursor] = useState(-1);
  const searchRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setSearch(draft.trim()), 300);
    return () => clearTimeout(t);
  }, [draft]);
  const fKey = filtersKey(filters);
  useEffect(() => setCursors([null]), [tab?.key, search, fKey]);
  const page = cursors.length - 1;
  useEffect(() => setCursor(-1), [tab?.key, search, fKey, page]);

  const pageQ = useAuthQuery(
    ["dealsLifecycleRows", brandId, offerId ?? "", "people", fKey, tab?.key ?? "", search, cursors[page] ?? ""],
    () => listUniboxLeads(brandId, { ...filters, lifecycle: [tab!.key] }, { limit: LEADS_PAGE_SIZE, offerId, q: search || undefined, cursor: cursors[page] }),
    { refetchInterval: POLL_INTERVAL, enabled: !!brandId && !!offerId && !!tab },
  );
  const rows = pageQ.data?.rows ?? null;
  const total = pageQ.data?.total ?? null;
  const next = pageQ.data?.nextCursor ?? null;
  const pages = total == null ? 1 : Math.max(1, Math.ceil(total / LEADS_PAGE_SIZE));
  const lead = useLeadScope(brandId);
  const unibox = v2Href(orgId, brandId, "unibox");
  const hrefOf = (i: number) => (rows?.[i] ? `${unibox}?lead=${encodeURIComponent(uniboxRowId(rows[i]))}` : null);

  const go = (key: string) => {
    const nextParams = new URLSearchParams(params.toString());
    nextParams.set("tab", key);
    router.replace(`${v2Href(orgId, brandId, "people")}?${nextParams.toString()}`);
  };
  const openRow = (i: number) => {
    const href = hrefOf(i);
    if (href) router.push(href);
  };
  useRowKeys({ count: rows?.length ?? 0, cursor, setCursor, onOpen: openRow, searchRef });

  return (
    <>
      <TopBar crumbs={[{ label: "Records" }, { label: "People" }]} />
      <RecordsTabs
        tabs={(rungs ?? []).map((r) => ({ key: r.key, label: r.label, count: counts.data ? (counts.data.byLifecycle[r.key] ?? 0) : null }))}
        active={tab?.key ?? ""}
        onPick={go}
      />
      <RecordsToolbar
        search={draft}
        onSearch={setDraft}
        placeholder="Search people by name or email"
        problem={null}
        inputRef={searchRef}
        right={
          <span className="flex items-center gap-1.5">
            <UniboxFilterBar
              filters={filters}
              ladder={ladder ?? []}
              dims={DEALS_FILTER_DIMENSIONS}
              onPick={(dim: UniboxDimension, values: string[]) => setFilters((f) => ({ ...f, [dim]: values }))}
            />
            <ExportButton
              filename={`people-${brandId}.csv`}
              csv={() => fetchLeadsCsv(lead.scope, leadsExportQuery({ search: "" }))}
              disabled={counts.data?.total === 0}
            />
          </span>
        }
      />
      <div className="k-scroll overflow-x-auto">
        <table className="w-full min-w-[1000px] text-[13px]">
          <thead>
            <tr>
              <th className={`${REC_TH} pl-4 md:pl-6`}>Person</th>
              <th className={REC_TH}>Company</th>
              <th className={REC_TH}>Role</th>
              <th className={REC_TH}>Campaign</th>
              <th className={REC_TH}>Stage</th>
              <th className={REC_TH}>Last touch</th>
              <th className={`${REC_TH} w-[60px] pr-4 md:pr-6`}><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              pageQ.isError ? (
                <tr><td colSpan={7}><EmptyNote>We could not load these people. Retrying.</EmptyNote></td></tr>
              ) : (
                Array.from({ length: 12 }, (_, i) => (
                  <tr key={i} className="k-row h-10"><td colSpan={7} className="px-4 md:px-6"><Shimmer className="h-4 w-full" /></td></tr>
                ))
              )
            ) : rows.length === 0 ? (
              <tr><td colSpan={7}><EmptyNote>Nobody here yet.</EmptyNote></td></tr>
            ) : (
              rows.map((row, i) => {
                const name = uniboxLeadName(row);
                const company = row.company?.name || row.company?.domain || null;
                // The campaign that reached them most recently, as lead-service names it on the row.
                const campaign = row.campaigns?.[0] ?? null;
                const href = hrefOf(i)!;
                return (
                  <tr
                    key={uniboxRowKey(row)}
                    onClick={() => openRow(i)}
                    onMouseEnter={() => setCursor(i)}
                    className={`group k-row h-10 cursor-pointer ${i === cursor ? "k-selected" : ""}`}
                  >
                    <td className="max-w-[240px] pl-4 pr-3 md:pl-6">
                      <Link href={href} onClick={(e) => e.stopPropagation()} className="flex min-w-0 items-center gap-2">
                        <Initials name={name} size={20} round />
                        <span className="truncate font-medium">{name}</span>
                      </Link>
                    </td>
                    <td className="max-w-[220px] px-3">
                      {company ? (
                        <span className="flex min-w-0 items-center gap-2">
                          <CompanyMark name={company} domain={row.company?.domain ?? null} size={18} />
                          <span className="truncate">{company}</span>
                        </span>
                      ) : (
                        <span className="k-fg4">{"—"}</span>
                      )}
                    </td>
                    <td className="max-w-[220px] px-3">
                      {row.title ? <span className="k-fg2 block truncate">{row.title}</span> : <span className="k-fg4">{"—"}</span>}
                    </td>
                    <td className="px-3">
                      {campaign ? (
                        <span className="inline-flex min-w-0 max-w-[220px] items-center gap-1.5 font-medium">
                          <FunnelFace name={campaign.name} size={16} />
                          <span className="truncate">{campaign.name}</span>
                        </span>
                      ) : (
                        <span className="k-fg4">{"—"}</span>
                      )}
                    </td>
                    <td className="px-3">
                      <span className="inline-flex items-center gap-1.5">
                        {row.lifecycle ? <TagChip tag={uniboxValueTag("lifecycle", row.lifecycle.key, row.lifecycle.label)} /> : null}
                        {dealCardChips(row).map((t) => (
                          <TagChip key={t.label} tag={t} />
                        ))}
                      </span>
                    </td>
                    <td className="k-fg2 whitespace-nowrap px-3 tabular-nums">{row.lastActivityAt ? timeAgo(row.lastActivityAt) : "—"}</td>
                    <td className="pr-4 text-right md:pr-6">
                      <Link
                        href={href}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Open ${name}`}
                        className={`k-btn-ghost h-6 w-6 justify-center px-0 ${i === cursor ? "" : "opacity-0 group-hover:opacity-100"}`}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 3l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <RecordsFooter
        left={total != null ? `${formatCount(total)} ${total === 1 ? "person" : "people"} · page ${page + 1} of ${pages}` : " "}
        right={
          <span className="flex items-center gap-1.5">
            <button type="button" className="k-btn h-6 px-2 text-[12px]" disabled={page === 0} onClick={() => setCursors((c) => c.slice(0, -1))}>Previous</button>
            <button type="button" className="k-btn h-6 px-2 text-[12px]" disabled={!next} onClick={() => next && setCursors((c) => [...c, next])}>Next</button>
          </span>
        }
      />
    </>
  );
}
