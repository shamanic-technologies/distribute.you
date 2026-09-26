"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { fetchLeadsCsv, getLeadConsolidatedStatus, leadDateForStatus, listLeadsPage } from "@/lib/api";
import { leadStatusLabel } from "@/lib/lead-status";
import { useAuthQuery } from "@/lib/use-auth-query";
import { POLL_INTERVAL } from "@/lib/query-options";
import { formatCount } from "@/lib/format-number";
import { timeAgo } from "@/lib/friendly-datetime";
import { leadsExportQuery, leadsSearchParam, leadsSearchProblem, LEADS_PAGE_SIZE, type LeadBucket } from "@/lib/leads-server-page";
import { ExportButton, RecordsFooter, RecordsTabs, RecordsToolbar, REC_TH, useRowKeys } from "@/components/v2/records";
import { v2Href } from "@/lib/v2/routes";
import { MaturityBadge } from "@/components/maturity-badge";
import { CrewMark } from "@/components/v2/crew-mark";
import { useMissions } from "@/components/v2/use-missions";
import { brandLeadScopeKey, useBucketCounts } from "@/components/v2/data";
import { EmptyNote, Shimmer, TopBar } from "@/components/v2/ui";
import {
  CompanyMark,
  PersonAvatar,
  leadCompany,
  leadCompanyDomain,
  leadName,
  leadTitle,
  personHref,
} from "@/components/v2/people-bits";

/** The tabs People offers, each one of lead-service's own engagement buckets. */
export const PEOPLE_TABS: { key: string; label: string; bucket: LeadBucket }[] = [
  { key: "contacted", label: "Contacted", bucket: "contacted" },
  { key: "website-visits", label: "Website visits", bucket: "website_visit" },
  { key: "positive-replies", label: "Positive replies", bucket: "positive_reply" },
  { key: "meetings", label: "Meeting booked", bucket: "meeting_booked" },
  { key: "signups", label: "Signups", bucket: "signup" },
  { key: "sales", label: "Close won", bucket: "sale" },
];

/**
 * People (beta): Keel's people table over lead-service's own pages. The tab is a bucket,
 * the order is lead-service's activity order, the search runs on the producer over the
 * whole population, and every count is served. A row opens the person in v1's lead
 * panel, which carries the conversation and every statement v2 does not rebuild.
 */
export function PeoplePage() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const tab = PEOPLE_TABS.find((t) => t.key === params.get("tab")) ?? PEOPLE_TABS[0];
  const [draft, setDraft] = useState(params.get("q") ?? "");
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [page, setPage] = useState(0);
  const [cursor, setCursor] = useState(-1);
  const searchRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setSearch(draft), 300);
    return () => clearTimeout(t);
  }, [draft]);
  useEffect(() => setPage(0), [tab.key, search]);
  useEffect(() => setCursor(-1), [tab.key, search, page]);

  const problem = leadsSearchProblem(search);
  const wire = problem ? "" : (leadsSearchParam(search) ?? "");
  const counts = useBucketCounts(brandId).data;
  const { missionByCampaignId, crews } = useMissions(orgId, brandId);
  const pageQ = useAuthQuery(
    ["leadsPage", brandLeadScopeKey(brandId), "v2-people", tab.bucket, wire, page],
    () =>
      listLeadsPage(
        { brandId },
        {
          view: "basic",
          bucket: tab.bucket,
          sort: "activity",
          limit: String(LEADS_PAGE_SIZE),
          offset: String(page * LEADS_PAGE_SIZE),
          ...(wire ? { q: wire } : {}),
        },
        undefined,
        { includeCampaigns: false },
      ),
    { refetchInterval: POLL_INTERVAL },
  );
  const rows = pageQ.data?.leads ?? null;
  const total = pageQ.data?.total ?? null;
  const pages = total == null ? 1 : Math.max(1, Math.ceil(total / LEADS_PAGE_SIZE));

  const go = (key: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("tab", key);
    router.replace(`${v2Href(orgId, brandId, "people")}?${next.toString()}`);
  };

  const openRow = (i: number) => {
    const lead = rows?.[i];
    if (lead) router.push(personHref(orgId, brandId, lead));
  };
  useRowKeys({ count: rows?.length ?? 0, cursor, setCursor, onOpen: openRow, searchRef });

  return (
    <>
      <TopBar crumbs={[{ label: "Records" }, { label: "People" }]} actions={<MaturityBadge level="beta" />} />
      <RecordsTabs
        tabs={PEOPLE_TABS.map((t) => ({ key: t.key, label: t.label, count: counts ? counts.counts[t.bucket] : null }))}
        active={tab.key}
        onPick={go}
        right={
          counts ? (
            <>
              <span className="flex items-center gap-1">
                {crews.slice(0, 5).map((c) => (
                  <CrewMark key={c.crew.key} color={c.crew.color} glyph={c.crew.glyph} size={14} />
                ))}
              </span>
              <span>
                {formatCount(counts.counts.contacted)} reached by your crew
              </span>
              <span className="k-fg4">·</span>
              <span>{formatCount(counts.counts.positive_reply)} wrote back with interest</span>
            </>
          ) : null
        }
      />
      <RecordsToolbar
        search={draft}
        onSearch={setDraft}
        placeholder="Search people or companies"
        problem={problem}
        inputRef={searchRef}
        right={
          <ExportButton
            filename={`people-${brandId}.csv`}
            csv={() => fetchLeadsCsv({ brandId }, leadsExportQuery({ search: wire }))}
            disabled={counts?.counts.contacted === 0}
          />
        }
      />
      <div className="k-scroll overflow-x-auto">
        <table className="w-full min-w-[900px] text-[13px]">
          <thead>
            <tr>
              <th className={`${REC_TH} pl-4 md:pl-6`}>Person</th>
              <th className={REC_TH}>Company</th>
              <th className={REC_TH}>Role</th>
              <th className={REC_TH}>Known by</th>
              <th className={REC_TH}>Stage</th>
              <th className={`${REC_TH} pr-4 md:pr-6`}>Last touch</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              pageQ.isError ? (
                <tr><td colSpan={6}><EmptyNote>We could not load these people. Retrying.</EmptyNote></td></tr>
              ) : (
                Array.from({ length: 12 }, (_, i) => (
                  <tr key={i} className="k-row h-10"><td colSpan={6} className="px-4 md:px-6"><Shimmer className="h-4 w-full" /></td></tr>
                ))
              )
            ) : rows.length === 0 ? (
              <tr><td colSpan={6}><EmptyNote>Nobody here yet.</EmptyNote></td></tr>
            ) : (
              rows.map((lead, i) => {
                const status = getLeadConsolidatedStatus(lead);
                const at = leadDateForStatus(lead, status);
                const m = missionByCampaignId.get(lead.campaignId) ?? null;
                const company = leadCompany(lead);
                const title = leadTitle(lead);
                return (
                  <tr
                    key={lead.id}
                    onClick={() => openRow(i)}
                    onMouseEnter={() => setCursor(i)}
                    className={`k-row h-10 cursor-pointer ${i === cursor ? "k-selected" : ""}`}
                  >
                    <td className="max-w-[240px] pl-4 pr-3 md:pl-6">
                      <Link
                        href={personHref(orgId, brandId, lead)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex min-w-0 items-center gap-2"
                      >
                        <PersonAvatar lead={lead} size={20} />
                        <span className="truncate font-medium">{leadName(lead)}</span>
                      </Link>
                    </td>
                    <td className="max-w-[220px] px-3">
                      {company ? (
                        <span className="flex min-w-0 items-center gap-2">
                          <CompanyMark name={company} domain={leadCompanyDomain(lead)} size={18} />
                          <span className="truncate">{company}</span>
                        </span>
                      ) : (
                        <span className="k-fg4">{"—"}</span>
                      )}
                    </td>
                    <td className="max-w-[220px] px-3">
                      {title ? <span className="k-fg2 block truncate">{title}</span> : <span className="k-fg4">{"—"}</span>}
                    </td>
                    <td className="px-3">
                      {m ? (
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <CrewMark color={m.crew.color} glyph={m.crew.glyph} /> {m.crew.name}
                        </span>
                      ) : (
                        <span className="k-fg4">{"—"}</span>
                      )}
                    </td>
                    <td className="px-3"><span className="k-chip">{leadStatusLabel(status)}</span></td>
                    <td className="k-fg2 whitespace-nowrap px-3 pr-4 tabular-nums md:pr-6">
                      {at ? (
                        <span className="inline-flex items-center gap-1.5">
                          <svg width="12" height="12" viewBox="0 0 16 16" className="k-fg3" aria-hidden="true">
                            <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
                            <path d="M8 4.8V8l2 1.4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                          </svg>
                          {timeAgo(at)}
                        </span>
                      ) : "—"}
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
            <button type="button" className="k-btn h-6 px-2 text-[12px]" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <button type="button" className="k-btn h-6 px-2 text-[12px]" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </span>
        }
      />
    </>
  );
}
