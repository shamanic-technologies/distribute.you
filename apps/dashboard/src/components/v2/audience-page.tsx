"use client";

import { useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  getStaffAudienceSnapshot,
  getStaffHeldCompanies,
  getStaffHeldPeople,
  getStaffSourcingCompanies,
  getStaffSourcingInvestment,
  getStaffSourcingPeople,
  type InvestedMoney,
  listAudiences,
  type AudienceChannelWire,
  type AudienceWire,
  type BrandAudienceSnapshot,
  type SnapshotAudienceRef,
} from "@/lib/api";
import { formatCount, formatUsdAdaptive } from "@/lib/format-number";
import { CompanyMark } from "@/components/v2/people-bits";
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
 * spends nothing. People / companies HELD per list and the People / Companies tabs (each
 * row with the target audiences the Jev pre-pay screen accepted) are human-service's staff
 * snapshot through the gateway; every count is served, nothing is summed here.
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

type Tab = "audiences" | "people" | "companies";
const PAGE = 100;

/** The source of a snapshot audience ref, keyed on its served `list`. */
function refSource(r: SnapshotAudienceRef): { label: string; domain: string | null } | null {
  return r.list ? (SOURCE_OF_LIST[r.list] ?? { label: r.list, domain: null }) : null;
}

const dash = <span className="k-fg4">{"—"}</span>;
const n = (v: number | null | undefined) => (v == null ? dash : formatCount(v));

/** Audiences as chips, each with its source logo. Empty = the dash. */
function AudienceChips({ refs, accepted }: { refs: (SnapshotAudienceRef & { yesProbability?: number | null })[]; accepted?: boolean }) {
  if (refs.length === 0) return dash;
  return (
    <span className="flex min-w-0 flex-wrap gap-1">
      {refs.map((r) => {
        const src = refSource(r);
        const p = r.yesProbability != null ? ` · P(yes) ${r.yesProbability.toFixed(2)}` : "";
        return (
          <span
            key={r.audienceId}
            title={`${r.name ?? r.audienceId}${p}`}
            className={`k-chip max-w-[220px] gap-1 ${accepted ? "text-[var(--data-teal)]" : ""}`}
          >
            {src?.domain ? <ProviderLogo domain={src.domain} size={12} className="rounded-[3px]" /> : null}
            <span className="truncate">{r.name ?? "Unnamed"}</span>
          </span>
        );
      })}
    </span>
  );
}

function Pager({ total, offset, onOffset }: { total: number | null; offset: number; onOffset: (o: number) => void }) {
  if (total == null) return null;
  return (
    <>
      <span className="tabular-nums">
        {total === 0 ? 0 : offset + 1}-{Math.min(offset + PAGE, total)} of {formatCount(total)}
      </span>
      <button type="button" className="k-btn-ghost h-6 px-1.5" disabled={offset === 0} onClick={() => onOffset(Math.max(0, offset - PAGE))}>
        Prev
      </button>
      <button type="button" className="k-btn-ghost h-6 px-1.5" disabled={offset + PAGE >= total} onClick={() => onOffset(offset + PAGE)}>
        Next
      </button>
    </>
  );
}

function AcceptedToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 md:px-6">
      <label className="k-btn h-7 cursor-pointer text-[12px]">
        <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--accent)]" />
        Accepted by a target only
      </label>
    </div>
  );
}

/**
 * What sourcing cost, on the NET basis (what the org pays), as features-service serves it.
 * `vendor` adds what it cost us from the providers under it. A failed read is the dash;
 * an absent row is the caller's call (no spend vs not attributable).
 */
function Invested({ m, vendor, loading }: { m: InvestedMoney | null | undefined; vendor?: boolean; loading: boolean }) {
  if (loading) return <Shimmer className="ml-auto h-3.5 w-12" />;
  if (!m || m.netUsd == null) return dash;
  return (
    <span className="block">
      <span className="font-medium">{formatUsdAdaptive(m.netUsd)}</span>
      {vendor ? (
        <span className="k-fg3 block text-[12px]">{m.vendorUsd != null ? `${formatUsdAdaptive(m.vendorUsd)} vendor` : "vendor unknown"}</span>
      ) : null}
    </span>
  );
}

function Skeleton({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 8 }, (_, i) => (
        <tr key={i} className="k-row h-10"><td colSpan={cols} className="px-4 md:px-6"><Shimmer className="h-4 w-full" /></td></tr>
      ))}
    </>
  );
}

export function AudiencePage() {
  const { brandId } = useParams<{ brandId: string }>();
  const [tab, setTab] = useState<Tab>("audiences");
  const snapshot = useAuthQuery(["staffAudienceSnapshot", brandId], () => getStaffAudienceSnapshot(brandId));
  const totals = snapshot.data?.totals ?? null;
  const investment = useAuthQuery(["staffSourcingInvestment", brandId], () => getStaffSourcingInvestment(brandId));
  const totalNet = investment.data?.total.netUsd;
  return (
    <>
      <TopBar crumbs={[{ label: "Setup" }, { label: "Audience" }]} />
      <RecordsTabs
        tabs={[
          {
            key: "audiences",
            label: "Audiences",
            // The lists the table shows: suggested (never activated) ones are not lists yet.
            count: snapshot.data ? snapshot.data.audiences.filter((a) => a.status !== "suggested").length : null,
          },
          { key: "people", label: "People", count: totals?.people.held ?? null },
          { key: "companies", label: "Companies", count: totals?.companies.held ?? null },
        ]}
        active={tab}
        onPick={(k) => setTab(k as Tab)}
        right={
          totals ? (
            <span className="tabular-nums">
              {formatCount(totals.people.accepted)} people accepted by a target · {formatCount(totals.companies.accepted)} companies
              {totalNet != null ? ` · ${formatUsdAdaptive(totalNet)} invested` : ""}
            </span>
          ) : null
        }
      />
      {tab === "audiences" ? (
        <AudiencesTab
          brandId={brandId}
          snapshot={snapshot.data ?? null}
          snapshotError={snapshot.data === undefined ? snapshot.error : null}
          invested={investment.data ? new Map(investment.data.audiences.map((a) => [a.audienceId, a.invested])) : null}
          investedLoading={!(investment.isFetchedAfterMount || investment.data !== undefined)}
          investedError={investment.data === undefined ? investment.error : null}
        />
      ) : tab === "people" ? (
        <PeopleTab brandId={brandId} />
      ) : (
        <CompaniesTab brandId={brandId} />
      )}
    </>
  );
}

function AudiencesTab({
  brandId,
  snapshot,
  snapshotError,
  invested,
  investedLoading,
  investedError,
}: {
  brandId: string;
  snapshot: BrandAudienceSnapshot | null;
  snapshotError: Error | null;
  /** features-service lists only audiences WITH sourcing spend: absent from a settled map = $0. */
  invested: Map<string, InvestedMoney> | null;
  investedLoading: boolean;
  investedError: Error | null;
}) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(-1);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const held = useMemo(() => new Map((snapshot?.audiences ?? []).map((a) => [a.audienceId, a])), [snapshot]);
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
      {all.length > 0 && (
        <p className="k-fg3 px-4 pt-3 text-[12px] md:px-6">
          {proactive} proactive · {all.length - proactive} stale
        </p>
      )}
      <RecordsToolbar search={q} onSearch={setQ} placeholder="Search audiences" inputRef={searchRef} />
      <div className="k-scroll overflow-x-auto">
        <table className="w-full min-w-[900px] text-[13px]">
          <thead>
            <tr>
              <th className={`${REC_TH} pl-4 md:pl-6`}>Source</th>
              <th className={REC_TH}>Type</th>
              <th className={REC_TH}>Details</th>
              <th className={`${REC_TH} text-right`}>People</th>
              <th className={`${REC_TH} text-right`}>Companies</th>
              <th className={`${REC_TH} text-right`}>Accepted</th>
              <th className={`${REC_TH} text-right`}>$ invested</th>
              <th className={`${REC_TH} pr-4 md:pr-6`}>Status</th>
            </tr>
          </thead>
          <tbody>
            {failed ? (
              <tr><td colSpan={8}><EmptyNote>Audiences could not be loaded: {failed.message}</EmptyNote></td></tr>
            ) : !settled ? (
              Array.from({ length: 8 }, (_, i) => (
                <tr key={i} className="k-row h-10"><td colSpan={8} className="px-4 md:px-6"><Shimmer className="h-4 w-full" /></td></tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={8}><EmptyNote>{q ? "No audience matches." : "This brand has no audience yet."}</EmptyNote></td></tr>
            ) : (
              rows.map((a, i) => {
                const source = sourceOf(a);
                const type = typeOf(a);
                const details = detailsOf(a);
                const h = held.get(a.id);
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
                    <td className="px-3 text-right tabular-nums">{snapshotError ? dash : n(h ? h.people.held : snapshot ? 0 : null)}</td>
                    <td className="px-3 text-right tabular-nums">{snapshotError ? dash : n(h ? h.companies.held : snapshot ? 0 : null)}</td>
                    <td className="px-3 text-right tabular-nums">{snapshotError ? dash : n(h ? h.people.accepted : snapshot ? 0 : null)}</td>
                    <td className="px-3 text-right tabular-nums">
                      {investedError ? dash : (
                        <Invested
                          loading={investedLoading}
                          vendor
                          m={invested ? (invested.get(a.id) ?? { billedUsd: 0, netUsd: 0, vendorUsd: 0, unpricedBilledUsd: 0 }) : null}
                        />
                      )}
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
          snapshotError
            ? `Held counts could not be loaded: ${snapshotError.message}`
            : settled
              ? `${rows.length} of ${all.length} audiences${truncated ? " · first 200 per status shown" : ""} · People = held (revealed, screened or queued), Accepted = passed its target's Jev screen`
              : "Loading audiences"
        }
      />
    </>
  );
}

function PeopleTab({ brandId }: { brandId: string }) {
  const [offset, setOffset] = useState(0);
  const [acceptedOnly, setAcceptedOnly] = useState(false);
  const q = useAuthQuery(["staffHeldPeople", brandId, offset, acceptedOnly], () =>
    getStaffHeldPeople(brandId, { limit: PAGE, offset, acceptedOnly }),
  );
  const settled = q.isFetchedAfterMount || q.data !== undefined;
  const rows = q.data?.people ?? [];
  const ids = rows.flatMap((p) => (p.revealed && p.providerPersonId ? [p.providerPersonId] : []));
  const cost = useAuthQuery(["staffSourcingPeople", brandId, ids], () => getStaffSourcingPeople(brandId, ids), { enabled: q.data !== undefined });
  const costLoading = !(cost.isFetchedAfterMount || cost.data !== undefined);
  return (
    <>
      <AcceptedToggle on={acceptedOnly} onChange={(v) => { setAcceptedOnly(v); setOffset(0); }} />
      <div className="k-scroll overflow-x-auto">
        <table className="w-full min-w-[960px] text-[13px]">
          <thead>
            <tr>
              <th className={`${REC_TH} pl-4 md:pl-6`}>Person</th>
              <th className={REC_TH}>Company</th>
              <th className={REC_TH}>Source</th>
              <th className={REC_TH}>Targeting</th>
              <th className={`${REC_TH} pr-4 text-right md:pr-6`}>$ invested</th>
            </tr>
          </thead>
          <tbody>
            {q.error && q.data === undefined ? (
              <tr><td colSpan={5}><EmptyNote>People could not be loaded: {q.error.message}</EmptyNote></td></tr>
            ) : !settled ? (
              <Skeleton cols={5} />
            ) : rows.length === 0 ? (
              <tr><td colSpan={5}><EmptyNote>{acceptedOnly ? "No person accepted by a target yet." : "This brand holds no person yet."}</EmptyNote></td></tr>
            ) : (
              rows.map((p) => (
                <tr key={p.personKey} className="k-row h-12">
                  <td className="max-w-[260px] py-1.5 pl-4 md:pl-6">
                    <span className="block truncate font-medium">{p.name ?? "Unnamed"}</span>
                    <span className="k-fg3 block truncate text-[12px]">
                      {[p.title, p.revealed ? "Revealed" : "Not revealed"].filter(Boolean).join(" · ")}
                    </span>
                  </td>
                  <td className="max-w-[220px] px-3">
                    {p.company ? (
                      <span className="flex min-w-0 items-center gap-2">
                        <CompanyMark name={p.company.name ?? p.company.domain ?? "?"} domain={p.company.domain} size={18} />
                        <span className="truncate">{p.company.name ?? p.company.domain}</span>
                      </span>
                    ) : dash}
                  </td>
                  <td className="max-w-[280px] px-3"><AudienceChips refs={p.sources} /></td>
                  <td className="max-w-[320px] px-3"><AudienceChips refs={p.acceptedBy} accepted /></td>
                  <td className="pr-4 text-right tabular-nums md:pr-6">
                    {/* Only a revealed person was paid for; a teaser cost nothing on its own. */}
                    {!p.revealed || !p.providerPersonId || cost.error ? dash : (
                      <Invested loading={costLoading} m={cost.data?.get(p.providerPersonId)} />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <RecordsFooter left="Targeting = target audiences whose Jev screen accepted the person" right={<Pager total={q.data?.total ?? null} offset={offset} onOffset={setOffset} />} />
    </>
  );
}

function CompaniesTab({ brandId }: { brandId: string }) {
  const [offset, setOffset] = useState(0);
  const [acceptedOnly, setAcceptedOnly] = useState(false);
  const q = useAuthQuery(["staffHeldCompanies", brandId, offset, acceptedOnly], () =>
    getStaffHeldCompanies(brandId, { limit: PAGE, offset, acceptedOnly }),
  );
  const settled = q.isFetchedAfterMount || q.data !== undefined;
  const rows = q.data?.companies ?? [];
  const keys = rows.map((c) => c.companyKey);
  const cost = useAuthQuery(["staffSourcingCompanies", brandId, keys], () => getStaffSourcingCompanies(brandId, keys), {
    enabled: q.data !== undefined,
  });
  const costLoading = !(cost.isFetchedAfterMount || cost.data !== undefined);
  return (
    <>
      <AcceptedToggle on={acceptedOnly} onChange={(v) => { setAcceptedOnly(v); setOffset(0); }} />
      <div className="k-scroll overflow-x-auto">
        <table className="w-full min-w-[960px] text-[13px]">
          <thead>
            <tr>
              <th className={`${REC_TH} pl-4 md:pl-6`}>Company</th>
              <th className={`${REC_TH} text-right`}>People</th>
              <th className={`${REC_TH} text-right`}>Accepted</th>
              <th className={REC_TH}>Source</th>
              <th className={REC_TH}>Targeting</th>
              <th className={`${REC_TH} pr-4 text-right md:pr-6`}>$ invested</th>
            </tr>
          </thead>
          <tbody>
            {q.error && q.data === undefined ? (
              <tr><td colSpan={6}><EmptyNote>Companies could not be loaded: {q.error.message}</EmptyNote></td></tr>
            ) : !settled ? (
              <Skeleton cols={6} />
            ) : rows.length === 0 ? (
              <tr><td colSpan={6}><EmptyNote>{acceptedOnly ? "No company accepted by a target yet." : "This brand holds no company yet."}</EmptyNote></td></tr>
            ) : (
              rows.map((c) => (
                <tr key={c.companyKey} className="k-row h-10">
                  <td className="max-w-[280px] pl-4 md:pl-6">
                    <span className="flex min-w-0 items-center gap-2">
                      <CompanyMark name={c.name ?? c.domain ?? "?"} domain={c.domain} size={18} />
                      <span className="truncate font-medium">{c.name ?? c.domain}</span>
                      {c.name && c.domain ? <span className="k-fg3 truncate text-[12px]">{c.domain}</span> : null}
                    </span>
                  </td>
                  <td className="px-3 text-right tabular-nums">{formatCount(c.people.held)}</td>
                  <td className="px-3 text-right tabular-nums">{formatCount(c.people.accepted)}</td>
                  <td className="max-w-[260px] px-3"><AudienceChips refs={c.sources} /></td>
                  <td className="max-w-[320px] px-3"><AudienceChips refs={c.acceptedBy} accepted /></td>
                  <td className="pr-4 text-right tabular-nums md:pr-6">
                    {cost.error ? dash : <Invested loading={costLoading} m={cost.data?.get(c.companyKey)} />}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <RecordsFooter left="Targeting = target audiences that accepted at least one person here" right={<Pager total={q.data?.total ?? null} offset={offset} onOffset={setOffset} />} />
    </>
  );
}
