"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { fetchLeadsCsv, listUniboxLeads } from "@/lib/api";
import { TagChip } from "@/components/v2/tag-chip";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollIntervalFor } from "@/lib/query-options";
import { formatCount } from "@/lib/format-number";
import { timeAgo } from "@/lib/friendly-datetime";
import { leadsExportQuery, LEADS_PAGE_SIZE } from "@/lib/leads-server-page";
import { leadStateTag, uniboxLeadName, uniboxRowId, uniboxRowKey } from "@/lib/unibox-leads";
import { v2Href } from "@/lib/v2/routes";
import { ExportButton, RecordsFooter, RecordsToolbar, REC_TH, useRowKeys } from "@/components/v2/records";
import { FunnelFace } from "@/components/v2/funnel-campaigns";
import { useLeadScope, useReachedCounts } from "@/components/v2/data";
import { useSelectedOffer } from "@/components/v2/selected-offer";
import { EmptyNote, Initials, Shimmer } from "@/components/v2/ui";
import { CompanyMark } from "@/components/v2/people-bits";

/**
 * The people who REACHED one step, as Keel's people table, embedded under another page's tab (a
 * campaign's Inbox / Sent, an outcome's people): lead-service's Unibox rows filtered on
 * `reachedStep` (LEAD-REACHED-STEP-1106), so each row carries the one lead vocabulary
 * (`leadState`: Won / Hot / Lost and why, else its lifecycle rung). A person who went further
 * stays listed. Order, search and paging run on lead-service. A row opens the person in the Unibox.
 */
export function PeoplePage({ step, campaignId }: { step: string; campaignId?: string }) {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { offerId } = useSelectedOffer();
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
  useEffect(() => setCursors([null]), [step, search, campaignId]);
  const page = cursors.length - 1;
  useEffect(() => setCursor(-1), [step, search, page]);

  // `campaignId` set = one campaign's page: lead-service resolves it to the whole campaign.
  const scope = campaignId ? { campaignId } : { offerId };
  const reached = useReachedCounts(brandId, [step], campaignId ?? null).data;
  const brandLead = useLeadScope(brandId);
  const lead = campaignId ? { scope: { campaignId } } : brandLead;
  const pageQ = useAuthQuery(
    ["reachedRows", brandId, campaignId ? "" : (offerId ?? ""), campaignId ?? "", step, search, cursors[page] ?? ""],
    () => listUniboxLeads(brandId, {}, { ...scope, reachedStep: step, limit: LEADS_PAGE_SIZE, q: search || undefined, cursor: cursors[page] }),
    { refetchInterval: pollIntervalFor, enabled: !!brandId && (!!campaignId || !!offerId) },
  );
  const rows = pageQ.data?.rows ?? null;
  const total = pageQ.data?.total ?? null;
  const next = pageQ.data?.nextCursor ?? null;
  const pages = total == null ? 1 : Math.max(1, Math.ceil(total / LEADS_PAGE_SIZE));
  const unibox = v2Href(orgId, brandId, "unibox");
  const hrefOf = (i: number) => (rows?.[i] ? `${unibox}?lead=${encodeURIComponent(uniboxRowId(rows[i]))}` : null);

  const openRow = (i: number) => {
    const href = hrefOf(i);
    if (href) router.push(href);
  };
  useRowKeys({ count: rows?.length ?? 0, cursor, setCursor, onOpen: openRow, searchRef });

  return (
    <>
      <RecordsToolbar
        search={draft}
        onSearch={setDraft}
        placeholder="Search people by name or email"
        problem={null}
        inputRef={searchRef}
        right={
          <ExportButton
            filename={`people-${campaignId ?? brandId}.csv`}
            csv={() => fetchLeadsCsv(lead.scope, leadsExportQuery({ search }))}
            disabled={reached?.[step] === 0}
          />
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
              <th className={`${REC_TH} w-[120px] pr-4 md:pr-6`}><span className="sr-only">Actions</span></th>
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
                const tag = row.leadState ? leadStateTag(row.leadState) : null;
                const href = hrefOf(i)!;
                const email = row.emails[0] ?? null;
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
                      {tag ? <TagChip tag={tag} /> : <span className="k-fg4">{"—"}</span>}
                    </td>
                    <td className="k-fg2 whitespace-nowrap px-3 tabular-nums">
                      {row.lastActivityAt ? (
                        <span className="inline-flex items-center gap-1.5">
                          <svg width="12" height="12" viewBox="0 0 16 16" className="k-fg3" aria-hidden="true">
                            <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
                            <path d="M8 4.8V8l2 1.4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                          </svg>
                          {timeAgo(row.lastActivityAt)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="pr-4 text-right md:pr-6">
                      <span className={`inline-flex items-center gap-1 ${i === cursor ? "" : "opacity-0 group-hover:opacity-100"}`}>
                        {email ? (
                          <a
                            href={`mailto:${email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="k-btn h-6 px-2 text-[12px]"
                            aria-label={`Email ${name}`}
                          >
                            Email
                          </a>
                        ) : null}
                        <Link
                          href={href}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Open ${name}`}
                          className="k-btn-ghost h-6 w-6 justify-center px-0"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 3l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </Link>
                      </span>
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
