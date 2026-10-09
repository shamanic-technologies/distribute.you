"use client";

import { useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  getAudienceSnapshot,
  getSourcingOrigins,
  getHeldCompanies,
  getHeldPeople,
  getSourcingCompanies,
  getSourcingInvestment,
  getSourcingPeople,
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
import { useStaffMode } from "@/lib/use-staff-mode";
import { audienceFilterGroups } from "@/lib/audience-filter-groups";
import { linkedInSignalOf } from "@/lib/signal-audience";
import { heldByProfile, originOf, profileOf, signalLabelOf } from "@/lib/profile-lists";
import { AudienceAvatar } from "@/components/audiences/audience-avatar";
import { ProviderLogo } from "@/components/provider-logo";
import { RecordsFooter, RecordsTabs, RecordsToolbar, REC_TH, useRowKeys } from "@/components/v2/records";
import { EmptyNote, Shimmer, StateDot } from "@/components/v2/ui";

/**
 * The brand's audiences as human-service holds them: the LISTS we source people from
 * (Apollo cold filters, buying signals, LinkedIn engagers, CRM uploads), across every offer
 * of the brand. Read-only: it shows where we stand, it spends nothing. People / companies
 * HELD per list and the People / Companies tabs (each row with the target audiences the
 * Jev pre-pay screen accepted) are human-service's snapshot through the gateway; every
 * count is served, nothing is summed here.
 *
 * Lives as the Lists tab of the offer's Targeting page (owner 2026-10-07; was the brand
 * Audience page). Every list reads as PROFILE x SOURCE (owner 2026-10-09, human-service
 * v0.50.0): the client profile it was built for (`profileAudienceId`; a profile's own cold
 * list is the profile) and the source it belongs to (features-service `/public/sourcing-origins`
 * by list kind). A list paused because its profile is says so. Archived lists sit behind a
 * toggle: an old whole-target list is not a live one. GA (owner 2026-10-05). A customer reads its own org's routes; staff mode reads the staff
 * routes. What sourcing cost US (vendor $) stays staff mode only: a customer sees the net $
 * it pays. Every source carries its provider's logo (owner 2026-10-09), off the served
 * `origins[].provider.domain`.
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

/** Active = campaigns can still add people from it (paid on the campaign's budget); paused / archived add no one. */
const isActive = (a: AudienceWire) => a.status === "active";
const statusWord = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Tab = "audiences" | "people" | "companies";
const PAGE = 100;

/** The source of a snapshot audience ref, keyed on its served `list`. */
function refSource(r: SnapshotAudienceRef): { label: string; domain: string | null } | null {
  return r.list ? (SOURCE_OF_LIST[r.list] ?? { label: r.list, domain: null }) : null;
}

const dash = <span className="k-fg4">{"—"}</span>;
const n = (v: number | null | undefined) => (v == null ? dash : formatCount(v));

/** Audiences as chips, each with its source logo. Empty = the dash. */
function AudienceChips({ refs, accepted, staff }: { refs: (SnapshotAudienceRef & { yesProbability?: number | null })[]; accepted?: boolean; staff: boolean }) {
  if (refs.length === 0) return dash;
  return (
    <span className="flex min-w-0 flex-wrap gap-1">
      {refs.map((r) => {
        const src = staff ? refSource(r) : null;
        const p = staff && r.yesProbability != null ? ` · P(yes) ${r.yesProbability.toFixed(2)}` : "";
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

export function AudienceLists() {
  const { brandId } = useParams<{ brandId: string }>();
  const { staffMode: staff } = useStaffMode();
  const [tab, setTab] = useState<Tab>("audiences");
  const snapshot = useAuthQuery(["staffAudienceSnapshot", brandId, staff], () => getAudienceSnapshot(brandId, staff));
  const totals = snapshot.data?.totals ?? null;
  const investment = useAuthQuery(["staffSourcingInvestment", brandId, staff], () => getSourcingInvestment(brandId, staff));
  const totalNet = investment.data?.total.netUsd;
  return (
    <>
      <RecordsTabs
        tabs={[
          {
            key: "audiences",
            label: "Lists",
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
          staff={staff}
          snapshot={snapshot.data ?? null}
          snapshotError={snapshot.data === undefined ? snapshot.error : null}
          invested={investment.data ? new Map(investment.data.audiences.map((a) => [a.audienceId, a.invested])) : null}
          investedLoading={!(investment.isFetchedAfterMount || investment.data !== undefined)}
          investedError={investment.data === undefined ? investment.error : null}
        />
      ) : tab === "people" ? (
        <PeopleTab brandId={brandId} staff={staff} />
      ) : (
        <CompaniesTab brandId={brandId} staff={staff} />
      )}
    </>
  );
}

function AudiencesTab({
  brandId,
  staff,
  snapshot,
  snapshotError,
  invested,
  investedLoading,
  investedError,
}: {
  brandId: string;
  staff: boolean;
  snapshot: BrandAudienceSnapshot | null;
  snapshotError: Error | null;
  /** features-service lists only audiences WITH sourcing spend: absent from a settled map = $0. */
  invested: Map<string, InvestedMoney> | null;
  investedLoading: boolean;
  investedError: Error | null;
}) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(-1);
  const [showArchived, setShowArchived] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const origins = useAuthQuery(["sourcingOrigins"], () => getSourcingOrigins());
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
        .sort((a, b) => Number(isActive(b)) - Number(isActive(a)) || b.createdAt.localeCompare(a.createdAt)),
    [active.data, paused.data, archived.data],
  );
  const truncated = reads.some((r) => r.data && r.data.total > r.data.audiences.length);
  const byId = useMemo(() => new Map(all.map((a) => [a.id, a])), [all]);
  const originList = origins.data ?? [];
  const sourceOfList = (a: AudienceWire) => originOf(a, originList);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const shown = showArchived ? all : all.filter((a) => a.status !== "archived");
    if (!needle) return shown;
    return shown.filter((a) =>
      [a.name, originOf(a, origins.data ?? [])?.name, profileOf(a, byId)?.name, typeOf(a), detailsOf(a)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [all, q, showArchived, origins.data, byId]);
  const countOf = (s: string) => all.filter((a) => a.status === s).length;

  useRowKeys({ count: rows.length, cursor, setCursor, onOpen: () => {}, searchRef });
  const cols = 8;

  return (
    <>
      {all.length > 0 && (
        <p className="k-fg3 px-4 pt-3 text-[12px] md:px-6">
          {countOf("active")} active · {countOf("paused")} paused · {countOf("archived")} archived
        </p>
      )}
      <RecordsToolbar
        search={q}
        onSearch={setQ}
        placeholder="Search lists"
        inputRef={searchRef}
        right={
          countOf("archived") > 0 ? (
            <label className="k-btn h-7 cursor-pointer text-[12px]">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--accent)]"
              />
              Show archived ({countOf("archived")})
            </label>
          ) : null
        }
      />
      <div className="k-scroll overflow-x-auto">
        <table className="w-full min-w-[900px] text-[13px]">
          <thead>
            <tr>
              <th className={`${REC_TH} pl-4 md:pl-6`}>List</th>
              <th className={REC_TH}>Profile</th>
              <th className={REC_TH}>Source</th>
              <th className={`${REC_TH} text-right`}>People</th>
              <th className={`${REC_TH} text-right`}>Companies</th>
              <th className={`${REC_TH} text-right`}>Accepted</th>
              <th className={`${REC_TH} text-right`}>$ invested</th>
              <th className={`${REC_TH} pr-4 md:pr-6`}>Status</th>
            </tr>
          </thead>
          <tbody>
            {failed ? (
              <tr><td colSpan={cols}><EmptyNote>Audiences could not be loaded: {failed.message}</EmptyNote></td></tr>
            ) : !settled ? (
              Array.from({ length: 8 }, (_, i) => (
                <tr key={i} className="k-row h-10"><td colSpan={cols} className="px-4 md:px-6"><Shimmer className="h-4 w-full" /></td></tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={cols}><EmptyNote>{q ? "No list matches." : "No list yet."}</EmptyNote></td></tr>
            ) : (
              rows.map((a, i) => {
                const origin = sourceOfList(a);
                const source = origin?.name ?? null;
                const signal = signalLabelOf(a);
                const details = detailsOf(a);
                const profile = profileOf(a, byId);
                const heldBy = heldByProfile(a, profile);
                const h = held.get(a.id);
                return (
                  <tr key={a.id} onMouseEnter={() => setCursor(i)} className={`k-row h-12 ${i === cursor ? "k-selected" : ""}`}>
                    <td className="max-w-[420px] py-1.5 pl-4 pr-3 md:pl-6">
                      <span className="block max-w-[360px] truncate font-medium" title={a.name}>{a.name}</span>
                      {details ? (
                        <span className="k-fg3 block max-w-[360px] truncate text-[12px]" title={details}>{details}</span>
                      ) : null}
                    </td>
                    <td className="max-w-[220px] px-3">
                      {profile ? (
                        <span className="flex min-w-0 items-center gap-2">
                          <AudienceAvatar name={profile.name} avatarUrl={profile.avatarUrl} size={18} />
                          <span className="truncate">{profile.name}</span>
                        </span>
                      ) : (
                        dash
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3">
                      {source ? (
                        <span className="block">
                          <span className="flex items-center gap-2">
                            {origin?.provider ? <ProviderLogo domain={origin.provider.domain} size={14} className="rounded-[3px]" /> : null}
                            {source}
                          </span>
                          {signal ? <span className="k-fg3 block text-[12px]">{signal}</span> : null}
                        </span>
                      ) : origins.data === undefined && !origins.isError ? (
                        <Shimmer className="h-3.5 w-24" />
                      ) : (
                        typeOf(a) ?? dash
                      )}
                    </td>
                    <td className="px-3 text-right tabular-nums">{snapshotError ? dash : n(h ? h.people.held : snapshot ? 0 : null)}</td>
                    <td className="px-3 text-right tabular-nums">{snapshotError ? dash : n(h ? h.companies.held : snapshot ? 0 : null)}</td>
                    <td className="px-3 text-right tabular-nums">{snapshotError ? dash : n(h ? h.people.accepted : snapshot ? 0 : null)}</td>
                    <td className="px-3 text-right tabular-nums">
                      {investedError ? dash : (
                        <Invested
                          loading={investedLoading}
                          vendor={staff}
                          m={invested ? (invested.get(a.id) ?? { billedUsd: 0, netUsd: 0, vendorUsd: 0, unpricedBilledUsd: 0 }) : null}
                        />
                      )}
                    </td>
                    <td className="min-w-[120px] whitespace-nowrap pr-4 md:pr-6">
                      <StateDot running={isActive(a)} label={statusWord(a.status)} />
                      {heldBy ? <span className="k-fg3 block text-[12px]">Profile {profile?.status}</span> : null}
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
              ? `${rows.length} of ${all.length} lists${truncated ? " · first 200 per status shown" : ""} · People = held (revealed, screened or queued), Accepted = matched its target · Costs are counted in campaign spend`
              : "Loading audiences"
        }
      />
    </>
  );
}

function PeopleTab({ brandId, staff }: { brandId: string; staff: boolean }) {
  const [offset, setOffset] = useState(0);
  const [acceptedOnly, setAcceptedOnly] = useState(false);
  const q = useAuthQuery(["staffHeldPeople", brandId, staff, offset, acceptedOnly], () =>
    getHeldPeople(brandId, staff, { limit: PAGE, offset, acceptedOnly }),
  );
  const settled = q.isFetchedAfterMount || q.data !== undefined;
  const rows = q.data?.people ?? [];
  const ids = rows.flatMap((p) => (p.revealed && p.providerPersonId ? [p.providerPersonId] : []));
  const cost = useAuthQuery(["staffSourcingPeople", brandId, staff, ids], () => getSourcingPeople(brandId, staff, ids), { enabled: q.data !== undefined });
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
                  <td className="max-w-[280px] px-3"><AudienceChips refs={p.sources} staff={staff} /></td>
                  <td className="max-w-[320px] px-3"><AudienceChips refs={p.acceptedBy} accepted staff={staff} /></td>
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
      <RecordsFooter left="Targeting = target audiences the person matched" right={<Pager total={q.data?.total ?? null} offset={offset} onOffset={setOffset} />} />
    </>
  );
}

function CompaniesTab({ brandId, staff }: { brandId: string; staff: boolean }) {
  const [offset, setOffset] = useState(0);
  const [acceptedOnly, setAcceptedOnly] = useState(false);
  const q = useAuthQuery(["staffHeldCompanies", brandId, staff, offset, acceptedOnly], () =>
    getHeldCompanies(brandId, staff, { limit: PAGE, offset, acceptedOnly }),
  );
  const settled = q.isFetchedAfterMount || q.data !== undefined;
  const rows = q.data?.companies ?? [];
  const keys = rows.map((c) => c.companyKey);
  const cost = useAuthQuery(["staffSourcingCompanies", brandId, staff, keys], () => getSourcingCompanies(brandId, staff, keys), {
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
                  <td className="max-w-[260px] px-3"><AudienceChips refs={c.sources} staff={staff} /></td>
                  <td className="max-w-[320px] px-3"><AudienceChips refs={c.acceptedBy} accepted staff={staff} /></td>
                  <td className="pr-4 text-right tabular-nums md:pr-6">
                    {cost.error ? dash : <Invested loading={costLoading} m={cost.data?.get(c.companyKey)} />}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <RecordsFooter left="Targeting = target audiences at least one person here matched" right={<Pager total={q.data?.total ?? null} offset={offset} onOffset={setOffset} />} />
    </>
  );
}
