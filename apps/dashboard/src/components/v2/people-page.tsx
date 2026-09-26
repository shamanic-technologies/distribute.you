"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getLeadConsolidatedStatus, leadDateForStatus, listLeadsPage } from "@/lib/api";
import { leadStatusLabel } from "@/lib/lead-status";
import { useAuthQuery } from "@/lib/use-auth-query";
import { POLL_INTERVAL } from "@/lib/query-options";
import { formatCount } from "@/lib/format-number";
import { friendlyDateTime } from "@/lib/friendly-datetime";
import { leadsSearchParam, leadsSearchProblem, LEADS_PAGE_SIZE, type LeadBucket } from "@/lib/leads-server-page";
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
  v1LeadHref,
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

const TH = "k-label px-3 py-2.5 text-left font-medium";

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
  useEffect(() => {
    const t = setTimeout(() => setSearch(draft), 300);
    return () => clearTimeout(t);
  }, [draft]);
  useEffect(() => setPage(0), [tab.key, search]);

  const problem = leadsSearchProblem(search);
  const wire = problem ? "" : (leadsSearchParam(search) ?? "");
  const counts = useBucketCounts(brandId).data;
  const { missionByCampaignId } = useMissions(orgId, brandId);
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

  return (
    <>
      <TopBar crumbs={[{ label: "Records" }, { label: "People" }]} actions={<MaturityBadge level="beta" />} />
      <div className="px-4 pb-16 pt-5 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[20px] font-medium tracking-[-0.01em]">
            People
            {counts ? <span className="k-fg3 ml-2 font-normal tabular-nums">{formatCount(counts.counts.contacted)}</span> : null}
          </h1>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search people or companies"
            className="k-input w-full max-w-[320px]"
            aria-label="Search people"
          />
        </div>
        {problem ? <p className="mt-2 text-[12px] text-[var(--data-rose)]">{problem}</p> : null}

        <nav className="k-scroll mt-4 flex gap-1 overflow-x-auto border-b border-[var(--line-subtle)]">
          {PEOPLE_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => go(t.key)}
              aria-current={t.key === tab.key ? "page" : undefined}
              className="k-tab shrink-0"
            >
              {t.label}
              {counts ? <span className="k-fg3 ml-1.5 tabular-nums">{formatCount(counts.counts[t.bucket])}</span> : null}
            </button>
          ))}
        </nav>

        <div className="k-card mt-4 overflow-hidden">
          <div className="k-scroll overflow-x-auto">
            <table className="w-full min-w-[820px] text-[13px]">
              <thead>
                <tr className="border-b border-[var(--line-subtle)]">
                  <th className={`${TH} pl-4`}>Name</th>
                  <th className={TH}>Company</th>
                  <th className={TH}>Crew</th>
                  <th className={TH}>Status</th>
                  <th className={`${TH} pr-4 text-right`}>Last activity</th>
                </tr>
              </thead>
              <tbody>
                {rows === null ? (
                  pageQ.isError ? (
                    <tr><td colSpan={5}><EmptyNote>We could not load these people. Retrying.</EmptyNote></td></tr>
                  ) : (
                    Array.from({ length: 8 }, (_, i) => (
                      <tr key={i} className="k-row"><td colSpan={5} className="px-4 py-2.5"><Shimmer className="h-6 w-full" /></td></tr>
                    ))
                  )
                ) : rows.length === 0 ? (
                  <tr><td colSpan={5}><EmptyNote>Nobody here yet.</EmptyNote></td></tr>
                ) : (
                  rows.map((lead) => {
                    const status = getLeadConsolidatedStatus(lead);
                    const at = leadDateForStatus(lead, status);
                    const m = missionByCampaignId.get(lead.campaignId) ?? null;
                    const company = leadCompany(lead);
                    const title = leadTitle(lead);
                    return (
                      <tr key={lead.id} className="k-row">
                        <td className="py-2 pl-4 pr-3">
                          <Link href={v1LeadHref(orgId, brandId, lead)} className="flex min-w-0 items-center gap-2.5">
                            <PersonAvatar lead={lead} size={24} />
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{leadName(lead)}</span>
                              {title ? <span className="k-fg3 block max-w-[280px] truncate text-[12px]">{title}</span> : null}
                            </span>
                          </Link>
                        </td>
                        <td className="px-3">
                          {company ? (
                            <Link
                              href={`${v2Href(orgId, brandId, "people")}?q=${encodeURIComponent(company)}`}
                              className="inline-flex max-w-[220px] items-center gap-1.5 hover:underline"
                            >
                              <CompanyMark name={company} domain={leadCompanyDomain(lead)} size={16} />
                              <span className="truncate">{company}</span>
                            </Link>
                          ) : (
                            <span className="k-fg4">{"—"}</span>
                          )}
                        </td>
                        <td className="px-3">
                          {m ? (
                            <span className="inline-flex items-center gap-1.5">
                              <CrewMark color={m.crew.color} glyph={m.crew.glyph} /> {m.crew.name}
                            </span>
                          ) : (
                            <span className="k-fg4">{"—"}</span>
                          )}
                        </td>
                        <td className="px-3"><span className="k-chip">{leadStatusLabel(status)}</span></td>
                        <td className="k-fg2 whitespace-nowrap px-3 pr-4 text-right tabular-nums">
                          {at ? friendlyDateTime(at) : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px]">
            <span className="k-fg3 tabular-nums">
              {total != null ? `${formatCount(total)} ${total === 1 ? "person" : "people"}` : " "}
            </span>
            <span className="flex items-center gap-2">
              <button type="button" className="k-btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <span className="k-fg3 tabular-nums">{page + 1} / {pages}</span>
              <button type="button" className="k-btn" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
