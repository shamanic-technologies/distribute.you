"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatCount, formatUsdAdaptive } from "@/lib/format-number";
import { friendlyDate } from "@/lib/friendly-datetime";
import { v2Href } from "@/lib/v2/routes";
import { MaturityBadge } from "@/components/maturity-badge";
import { useBrandRevenue } from "@/components/v2/data";
import { CompanyMark } from "@/components/v2/people-bits";
import { EmptyNote, Initials, Shimmer, TopBar } from "@/components/v2/ui";

const TH = "k-label px-3 py-2.5 text-left font-medium";

/**
 * features-service's own path tags (`revenue-engine.ts`), in the customer's words. Opens
 * are a dead metric fleet-wide, so `opened` is never drawn; a tag this map does not know
 * reads verbatim rather than vanishing.
 */
const TAG_LABEL: Record<string, string> = {
  contacted: "Contacted",
  sent: "Sent",
  delivered: "Delivered",
  visit: "Website visit",
  reply: "Positive reply",
  meeting: "Meeting booked",
  meetingAttended: "Meeting attended",
  formSubmitted: "Form submitted",
  closeWin: "Close won",
};
const HIDDEN_TAGS = new Set(["opened"]);

/**
 * Companies (beta): Keel's company table over the organisations features-service already
 * dedupes and values on the brand's revenue read. The expected revenue is its own served
 * figure, the order is that figure, and a row opens the People page searched on the
 * company. Nothing is computed here; the local filter only narrows rows already loaded.
 */
export function CompaniesPage() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const revenue = useBrandRevenue(brandId);
  const [q, setQ] = useState("");
  const orgs = useMemo(() => {
    const all = revenue.data?.organizations ?? [];
    const needle = q.trim().toLowerCase();
    const rows = needle
      ? all.filter((o) => `${o.orgName ?? ""} ${o.orgDomain ?? ""}`.toLowerCase().includes(needle))
      : all;
    return [...rows].sort((a, b) => b.expectedRevenueUsd - a.expectedRevenueUsd);
  }, [revenue.data, q]);
  const total = revenue.data?.organizations.length ?? null;

  return (
    <>
      <TopBar crumbs={[{ label: "Records" }, { label: "Companies" }]} actions={<MaturityBadge level="beta" />} />
      <div className="px-4 pb-16 pt-5 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[20px] font-medium tracking-[-0.01em]">
            Companies
            {total != null ? <span className="k-fg3 ml-2 font-normal tabular-nums">{formatCount(total)}</span> : null}
          </h1>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter companies"
            className="k-input w-full max-w-[320px]"
            aria-label="Filter companies"
          />
        </div>
        <p className="k-fg2 mt-1 text-[13px]">Companies where someone visited your site or replied with interest.</p>

        <div className="k-card mt-4 overflow-hidden">
          <div className="k-scroll overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead>
                <tr className="border-b border-[var(--line-subtle)]">
                  <th className={`${TH} pl-4`}>Company</th>
                  <th className={TH}>Best contact</th>
                  <th className={TH}>Signals</th>
                  <th className={`${TH} text-right`}>Expected revenue</th>
                  <th className={`${TH} pr-4 text-right`}>Latest</th>
                </tr>
              </thead>
              <tbody>
                {revenue.pending ? (
                  Array.from({ length: 8 }, (_, i) => (
                    <tr key={i} className="k-row"><td colSpan={5} className="px-4 py-2.5"><Shimmer className="h-6 w-full" /></td></tr>
                  ))
                ) : !revenue.enabled || orgs.length === 0 ? (
                  <tr><td colSpan={5}><EmptyNote>{q ? "No company matches." : "No company has engaged yet."}</EmptyNote></td></tr>
                ) : (
                  orgs.map((o, i) => {
                    const name = o.orgName ?? o.orgDomain ?? "Unknown company";
                    const person = o.topPerson
                      ? `${o.topPerson.firstName ?? ""} ${o.topPerson.lastName ?? ""}`.trim()
                      : "";
                    return (
                      <tr key={o.orgId ?? `${name}-${i}`} className="k-row">
                        <td className="py-2 pl-4 pr-3">
                          <Link
                            href={`${v2Href(orgId, brandId, "people")}?q=${encodeURIComponent(o.orgName ?? o.orgDomain ?? "")}`}
                            className="flex min-w-0 items-center gap-2.5"
                          >
                            <CompanyMark name={name} domain={o.orgDomain ?? null} size={24} />
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{name}</span>
                              {o.orgDomain ? <span className="k-fg3 block truncate text-[12px]">{o.orgDomain}</span> : null}
                            </span>
                          </Link>
                        </td>
                        <td className="px-3">
                          {person ? (
                            <span className="inline-flex items-center gap-1.5">
                              {o.topPerson?.photoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={o.topPerson.photoUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
                              ) : (
                                <Initials name={person} size={20} round />
                              )}
                              {person}
                            </span>
                          ) : (
                            <span className="k-fg4">{"—"}</span>
                          )}
                        </td>
                        <td className="px-3">
                          <span className="flex flex-wrap gap-1">
                            {o.tags.filter((t) => !HIDDEN_TAGS.has(t)).map((t) => (
                              <span key={t} className="k-chip">{TAG_LABEL[t] ?? t}</span>
                            ))}
                          </span>
                        </td>
                        <td className="px-3 text-right tabular-nums">{formatUsdAdaptive(o.expectedRevenueUsd)}</td>
                        <td className="k-fg2 px-3 pr-4 text-right tabular-nums">
                          {o.mostAdvancedDate ? friendlyDate(o.mostAdvancedDate) : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
