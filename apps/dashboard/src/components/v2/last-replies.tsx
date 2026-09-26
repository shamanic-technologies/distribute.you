"use client";

import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listLeadsPage } from "@/lib/api";
import { leadsPageQuery } from "@/lib/leads-server-page";
import { POLL_INTERVAL } from "@/lib/query-options";
import { timeAgo } from "@/lib/friendly-datetime";
import { CompanyLogo } from "@/components/company-logo";
import { Skeleton } from "@/components/skeleton";

const SHOWN = 5;

/**
 * The newest positive replies, Explee's "Last replies" in our grain.
 *
 * The read is the Leads page's own first page of its Positive replies tab — byte the
 * same key and the same query — so opening v1's Leads after this costs no request and
 * the two can never list different people. lead-service orders it (`sort=activity`),
 * so the top rows ARE the latest; nothing is sorted here.
 */
export function LastReplies({ orgId, brandId }: { orgId: string; brandId: string }) {
  const q = useAuthQuery(
    ["leadsPage", `brand:${brandId}`, "positive-replies", "", 0],
    () => listLeadsPage({ brandId }, leadsPageQuery({ tab: "positive-replies", search: "", page: 0 })),
    { refetchInterval: POLL_INTERVAL },
  );
  const leadsHref = `/orgs/${encodeURIComponent(orgId)}/brands/${encodeURIComponent(brandId)}/leads`;
  const rows = (q.data?.leads ?? []).slice(0, SHOWN);
  const pending = q.isPending && !q.isError;

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-medium text-gray-900">
          Last positive replies
          {q.data?.total != null && <span className="ml-1.5 text-gray-400">{q.data.total}</span>}
        </h2>
        <Link href={leadsHref} className="text-xs font-medium text-gray-500 hover:text-gray-900">
          View inbox →
        </Link>
      </div>
      {pending ? (
        <div className="space-y-2 p-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : q.isError ? (
        <p className="px-4 py-6 text-sm text-gray-500">We could not load the replies right now.</p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-500">No positive reply yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map((l) => {
            const person = l.lead;
            const name =
              [person?.firstName, person?.lastName].filter(Boolean).join(" ") || l.email;
            const org = person?.organization?.name ?? null;
            return (
              <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                <CompanyLogo domain={person?.organization?.primaryDomain ?? null} name={org ?? name} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{name}</p>
                  <p className="truncate text-xs text-gray-500">{org ?? l.email}</p>
                </div>
                {l.firstRepliedAt && (
                  <span className="shrink-0 text-xs text-gray-400" title={new Date(l.firstRepliedAt).toLocaleString()}>
                    {timeAgo(l.firstRepliedAt)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
