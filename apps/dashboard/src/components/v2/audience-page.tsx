"use client";

import { useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { listAudiences, type AudienceChannelWire, type AudienceWire } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { audienceFilterGroups } from "@/lib/audience-filter-groups";
import { linkedInSignalOf } from "@/lib/signal-audience";
import { ProviderLogo } from "@/components/provider-logo";
import { RecordsFooter, RecordsTabs, RecordsToolbar, REC_TH, useRowKeys } from "@/components/v2/records";
import { EmptyNote, Shimmer, StateDot, TopBar } from "@/components/v2/ui";

/**
 * Staff snapshot of the brand's audiences as human-service holds them: the LISTS we
 * source people from (Apollo cold filters, buying signals, LinkedIn engagers, CRM
 * uploads), across every offer of the brand. Read-only: it shows where we stand, it
 * spends nothing. People and companies stored per list, the People / Companies tabs and
 * "$ invested" are served by human-service and features-service; they land here as soon
 * as those reads are live in prod.
 */

/** Where a list's people come from, keyed on the served `channels[].list`. Display lookup only. */
const SOURCE_OF_LIST: Record<string, { label: string; domain: string | null }> = {
  apollo_search: { label: "Apollo", domain: "apollo.io" },
  apollo_buying_signal: { label: "Apollo", domain: "apollo.io" },
  apify_search: { label: "Apify", domain: "apify.com" },
  linkedin_engagement: { label: "LinkedIn", domain: "linkedin.com" },
  crm_contacts: { label: "CRM upload", domain: null },
};

/** A buying signal's served `type`, in words. Unknown types print as served. */
const SIGNAL_WORD: Record<string, string> = {
  hiring: "Hiring signal",
  job_change: "Job change signal",
  funding: "Funding signal",
  linkedin_engagement: "LinkedIn engagement",
};

const TYPE_OF_LIST: Record<string, string> = {
  apollo_search: "Cold filters",
  apify_search: "Cold filters",
  linkedin_engagement: "LinkedIn engagement",
  crm_contacts: "CRM contacts",
};

function listOf(a: AudienceWire): AudienceChannelWire | null {
  return a.channels?.[0] ?? null;
}

function sourceOf(a: AudienceWire): { label: string; domain: string | null } | null {
  const list = listOf(a);
  if (list) return SOURCE_OF_LIST[list.list] ?? { label: list.list, domain: null };
  return a.provider ? { label: a.provider, domain: null } : null;
}

function typeOf(a: AudienceWire): string | null {
  const list = listOf(a);
  if (!list) return null;
  if (list.signal) return SIGNAL_WORD[list.signal.type] ?? list.signal.type;
  return TYPE_OF_LIST[list.list] ?? list.list;
}

/** The ICP filters, without the signal criterion (it is stated on its own). */
function filterValues(filters: Record<string, unknown> | null): string[] {
  if (!filters) return [];
  const { buying_signal: _signal, ...icp } = filters;
  return audienceFilterGroups(icp).flatMap((g) => g.values);
}

/** The filter set (or the signal) that builds the list, as one line of plain values. */
function detailsOf(a: AudienceWire): string | null {
  const signal = listOf(a)?.signal;
  const linkedIn = linkedInSignalOf(a.filters);
  const parts = [
    signal?.windowDays != null ? `Last ${signal.windowDays} days` : null,
    ...(linkedIn?.competitorPages.map((u) => u.replace(/\/+$/, "").split("/").pop() ?? u) ?? []),
    ...filterValues(a.filters),
  ].filter((v): v is string => Boolean(v));
  return parts.length ? parts.join(" · ") : null;
}

/** Proactive = we keep paying to grow the list (active); Stale = it holds what it has. */
const isProactive = (a: AudienceWire) => a.status === "active";

export function AudiencePage() {
  const { brandId } = useParams<{ brandId: string }>();
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(-1);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const active = useAuthQuery(["audiences", brandId, "active", "brand", 200], () => listAudiences(brandId, { status: "active", limit: 200 }));
  const paused = useAuthQuery(["audiences", brandId, "paused", "brand", 200], () => listAudiences(brandId, { status: "paused", limit: 200 }));
  const archived = useAuthQuery(["audiences", brandId, "archived", "brand", 200], () => listAudiences(brandId, { status: "archived", limit: 200 }));
  const reads = [active, paused, archived];
  const settled = reads.every((r) => r.isFetchedAfterMount || r.data !== undefined);
  const failed = reads.find((r) => r.error && r.data === undefined)?.error ?? null;

  const all = useMemo(
    () =>
      [active.data, paused.data, archived.data]
        .flatMap((d) => d?.audiences ?? [])
        .sort((a, b) => Number(isProactive(b)) - Number(isProactive(a)) || b.createdAt.localeCompare(a.createdAt)),
    [active.data, paused.data, archived.data],
  );
  const truncated = reads.some((r) => r.data && r.data.total > r.data.audiences.length);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((a) =>
      [a.name, sourceOf(a)?.label, typeOf(a), detailsOf(a)].filter(Boolean).join(" ").toLowerCase().includes(needle),
    );
  }, [all, q]);
  const proactive = all.filter(isProactive).length;

  useRowKeys({ count: rows.length, cursor, setCursor, onOpen: () => {}, searchRef });

  return (
    <>
      <TopBar crumbs={[{ label: "Setup" }, { label: "Audience" }]} />
      <RecordsTabs
        tabs={[{ key: "audiences", label: "Audiences", count: settled ? all.length : null }]}
        active="audiences"
        onPick={() => {}}
        right={
          settled ? (
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${proactive ? "k-dot-pulse bg-[var(--run)] text-[var(--run)]" : "bg-[var(--fg-4)]"}`} />
              {proactive} proactive · {all.length - proactive} stale
            </span>
          ) : null
        }
      />
      <RecordsToolbar search={q} onSearch={setQ} placeholder="Search audiences" inputRef={searchRef} />
      <div className="k-scroll overflow-x-auto">
        <table className="w-full min-w-[900px] text-[13px]">
          <thead>
            <tr>
              <th className={`${REC_TH} pl-4 md:pl-6`}>Source</th>
              <th className={REC_TH}>Type</th>
              <th className={REC_TH}>Details</th>
              <th className={`${REC_TH} pr-4 md:pr-6`}>Status</th>
            </tr>
          </thead>
          <tbody>
            {failed ? (
              <tr><td colSpan={4}><EmptyNote>Audiences could not be loaded: {failed.message}</EmptyNote></td></tr>
            ) : !settled ? (
              Array.from({ length: 8 }, (_, i) => (
                <tr key={i} className="k-row h-10"><td colSpan={4} className="px-4 md:px-6"><Shimmer className="h-4 w-full" /></td></tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={4}><EmptyNote>{q ? "No audience matches." : "This brand has no audience yet."}</EmptyNote></td></tr>
            ) : (
              rows.map((a, i) => {
                const source = sourceOf(a);
                const type = typeOf(a);
                const details = detailsOf(a);
                return (
                  <tr key={a.id} onMouseEnter={() => setCursor(i)} className={`k-row h-12 ${i === cursor ? "k-selected" : ""}`}>
                    <td className="whitespace-nowrap pl-4 md:pl-6">
                      {source ? (
                        <span className="flex items-center gap-2">
                          <ProviderLogo domain={source.domain} size={16} className="rounded-[4px]" />
                          {source.label}
                        </span>
                      ) : <span className="k-fg4">{"—"}</span>}
                    </td>
                    <td className="whitespace-nowrap px-3">{type ?? <span className="k-fg4">{"—"}</span>}</td>
                    <td className="max-w-[560px] px-3 py-1.5">
                      <span className="block truncate font-medium" title={a.name}>{a.name}</span>
                      {details ? (
                        <span className="k-fg3 block truncate text-[12px]" title={details}>{details}</span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap pr-4 md:pr-6">
                      <StateDot running={isProactive(a)} label={isProactive(a) ? "Proactive" : "Stale"} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <RecordsFooter
        left={
          settled
            ? `${rows.length} of ${all.length} audiences${truncated ? " · first 200 per status shown" : ""}`
            : "Loading audiences"
        }
      />
    </>
  );
}
