"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  getCrmContactOrigins,
  getCrmPairingCounts,
  listCrmPairings,
  setCrmPairingRuling,
  withdrawCrmPairingRuling,
} from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { MaturityBadge } from "@/components/maturity-badge";
import { DashboardPage } from "@/components/dashboard-page";
import { formatCount } from "@/lib/format-number";
import { friendlyDateTime } from "@/lib/friendly-datetime";
import {
  ALIGNMENT_LABEL,
  ATTENTION_ORDER,
  DECIDED_BY_LABEL,
  MATCH_METHOD_LABEL,
  OUR_STATE_LABEL,
  PAIRING_STATE_LABEL,
  STATE_FILTERS,
  THEIR_STATE_LABEL,
  alignmentFor,
  contactProvenance,
  crmContactLabel,
  filterAndSortRows,
  judgmentPosition,
  labelOf,
  rulingErrorMessage,
  topBuckets,
  type Alignment,
  type CrmContactOrigins,
  type OriginBucket,
  type CrmPairingCounts,
  type CrmPairingRow,
  type CrmPairings,
} from "@/lib/crm-pairings";

/** Contacts per page of the table. The view pages over THEIR contacts. */
export const PAIRINGS_PAGE = 100;

/**
 * Their CRM and our leads, one row per contact of THEIR CRM.
 *
 * BETA, a debug surface for staff: it answers where our record of a person is
 * behind what their CRM already knows, and lets a person confirm or deny a
 * pairing we proposed. Every count is lead-service's `/crm-pairing-counts`,
 * verbatim. The table pages over their contacts and never holds the population,
 * so its filters and its order apply to the page on screen and say so.
 *
 * Nothing here writes to their CRM. The only write is a ruling on a pairing,
 * which lead-service stores beside the pairing and never deletes.
 */
export function CrmMergedPage({ brandId }: { brandId: string }) {
  const isBeta = useIsBetaUser();
  // Offsets are POSITIONS in their contact list (a filtered page skips rows), so
  // Previous walks back a stack of the offsets actually visited.
  const [offsets, setOffsets] = useState<number[]>([0]);
  const offset = offsets[offsets.length - 1];
  // Opens on the contacts in common: the rows with something to compare, and a
  // read that buys no similarity judgment.
  const [stateFilter, setStateFilter] = useState<string>("paired");
  const states = STATE_FILTERS.find((f) => f.id === stateFilter)?.states ?? null;
  const [alignFilter, setAlignFilter] = useState<Alignment | "all">("all");
  const [sort, setSort] = useState<"attention" | "name" | "state">("attention");
  const [openId, setOpenId] = useState<string | null>(null);

  const countsQ = useAuthQuery(["crmPairingCounts", brandId], () => getCrmPairingCounts(brandId), {
    enabled: isBeta,
  });
  const pageQ = useAuthQuery(
    ["crmPairings", brandId, stateFilter, offset],
    () => listCrmPairings(brandId, { limit: PAIRINGS_PAGE, offset, states }),
    { enabled: isBeta },
  );
  const originsQ = useAuthQuery(["crmContactOrigins", brandId], () => getCrmContactOrigins(brandId), {
    enabled: isBeta,
  });

  if (!isBeta) {
    return (
      <div className="p-4 md:p-8">
        <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center">
          <h1 className="text-base font-medium text-gray-900">Not available</h1>
          <p className="mt-1 text-sm text-gray-500">
            This page is still in beta and is not open on your account yet.
          </p>
        </div>
      </div>
    );
  }

  const page = pageQ.data;
  // Reveal on SETTLE: a failed read states itself instead of holding a skeleton.
  const pageLoading = pageQ.isPending && !pageQ.isError;
  // A switch of page keeps the previous page on screen (keepPreviousData); that
  // would show one page's rows under another's pager, so it skeletons instead.
  const pageStale = pageQ.isPlaceholderData;
  const rows = page ? filterAndSortRows(page.pairings, { state: "all", alignment: alignFilter, sort }) : [];
  const stateTotal = (() => {
    const c = countsQ.data?.counts;
    if (!c) return null;
    if (!states) return c.crmContacts;
    let n = 0;
    for (const st of states) {
      const v = c.byState[st as keyof typeof c.byState];
      if (v == null) return null;
      n += v;
    }
    return n;
  })();
  const open = page?.pairings.find((r) => r.crmContact.id === openId) ?? null;

  return (
    <DashboardPage width="wide">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold text-gray-900">Their CRM beside our leads</h1>
        <MaturityBadge level="beta" />
      </div>
      <p className="mb-6 text-sm text-gray-500">
        One row per contact in their CRM. Where we emailed the same person, both records sit side by side.
        Nothing here is written back to their CRM.
      </p>

      <StatsBand q={countsQ} />
      <OriginsCard q={originsQ} />

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Contacts</h2>
          <Select
            label="Show"
            value={stateFilter}
            onChange={(v) => {
              setStateFilter(v);
              setOffsets([0]);
              setOpenId(null);
            }}
            options={STATE_FILTERS.map((f) => [f.id, f.label] as [string, string])}
          />
          <Select
            label="Aligned"
            value={alignFilter}
            onChange={(v) => setAlignFilter(v as Alignment | "all")}
            options={[["all", "All"], ...ATTENTION_ORDER.map((a) => [a, ALIGNMENT_LABEL[a]] as [string, string])]}
          />
          <Select
            label="Order"
            value={sort}
            onChange={(v) => setSort(v as "attention" | "name" | "state")}
            options={[
              ["attention", "Needs attention first"],
              ["state", "In common first"],
              ["name", "Name"],
            ]}
          />
        </div>
        <p className="mb-3 text-xs text-gray-500">
          &quot;Show&quot; reads their whole CRM. &quot;Aligned&quot; and the order apply to the page on screen.
        </p>

        {pageQ.isError ? (
          <Unavailable what="the side-by-side view" />
        ) : pageLoading || pageStale || !page ? (
          <div className="h-64 animate-pulse rounded-xl border border-gray-200 bg-gray-50" />
        ) : !page.crmConnected ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
            No CRM is connected to this brand, so there is nothing to put beside our leads.
          </div>
        ) : (
          <div className="relative flex min-h-[24rem] gap-4">
            <div className="min-w-0 flex-1">
              <PairingsTable rows={rows} openId={openId} onOpen={setOpenId} />
              <Pager
                pageNumber={offsets.length}
                shown={page.pairings.length}
                hasPrev={offsets.length > 1}
                hasNext={page.nextOffset != null}
                total={stateTotal}
                onPrev={() => {
                  setOpenId(null);
                  setOffsets(offsets.slice(0, -1));
                }}
                onNext={() => {
                  if (page.nextOffset == null) return;
                  setOpenId(null);
                  setOffsets([...offsets, page.nextOffset]);
                }}
              />
            </div>
            {open ? (
              <PairingPanel
                key={open.crmContact.id}
                brandId={brandId}
                row={open}
                thresholds={page.judgmentThresholds}
                onClose={() => setOpenId(null)}
              />
            ) : null}
          </div>
        )}
      </section>
    </DashboardPage>
  );
}

// ─── Stats band ──────────────────────────────────────────────────────────────

function StatsBand({ q }: { q: { data?: CrmPairingCounts; isPending: boolean; isError: boolean } }) {
  if (q.isError) return <Unavailable what="the counts" />;
  if (q.isPending || !q.data) {
    return <div className="h-28 animate-pulse rounded-xl border border-gray-200 bg-gray-50" />;
  }
  const d = q.data;
  const c = d.counts;
  if (!d.crmConnected) return null;
  const opp = c.opportunitiesByState;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Their contacts" value={c.crmContacts} sub={`${formatCount(c.crmContactsWithEmail)} of them with an email`} />
        <Stat label={PAIRING_STATE_LABEL.paired} value={c.byState.paired ?? null} tone="good" />
        <Stat label={PAIRING_STATE_LABEL.unconfirmed} value={c.byState.unconfirmed ?? null} tone="warn" sub="A candidate exists, nobody has ruled" />
        <Stat label={PAIRING_STATE_LABEL.rejected} value={c.byState.rejected ?? null} />
        <Stat label={PAIRING_STATE_LABEL.unpaired} value={c.byState.unpaired ?? null} />
        <Stat label="Our leads their CRM never heard of" value={d.ourLeadsNoCrmContactPointsAt} />
        <Stat
          label="Their deals"
          value={c.opportunities}
          sub={[
            `${formatCount(opp.open ?? 0)} open`,
            `${formatCount(opp.won ?? 0)} won`,
            `${formatCount(opp.lost ?? 0)} lost`,
            `${formatCount(opp.abandoned ?? 0)} abandoned`,
            opp.unrecognised ? `${formatCount(opp.unrecognised)} unrecognised` : null,
          ]
            .filter(Boolean)
            .join(", ")}
        />
        <Stat
          label="Deals whose stage we cannot compare"
          value={c.opportunitiesWithUncomparableStage}
          sub="Their stage names are their own words"
        />
      </div>
      <p className="text-xs text-gray-500">
        How each pairing was found:{" "}
        {Object.entries(c.byMatchMethod)
          .filter(([, n]) => (n ?? 0) > 0)
          .map(([m, n]) => `${labelOf(MATCH_METHOD_LABEL, m)} ${formatCount(n ?? 0)}`)
          .join(", ") || "none yet"}
        .
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number | null;
  sub?: string;
  tone?: "good" | "warn";
}) {
  const valueTone = tone === "good" ? "text-green-700" : tone === "warn" ? "text-amber-700" : "text-gray-900";
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${valueTone}`}>{value == null ? "-" : formatCount(value)}</div>
      {sub ? <div className="mt-1 text-xs text-gray-500">{sub}</div> : null}
    </div>
  );
}

// ─── Table ───────────────────────────────────────────────────────────────────

const STATE_TONE: Record<string, string> = {
  paired: "bg-green-50 text-green-700 border-green-200",
  unconfirmed: "bg-amber-50 text-amber-700 border-amber-200",
  rejected: "bg-gray-100 text-gray-600 border-gray-200",
  unpaired: "bg-gray-50 text-gray-500 border-gray-200",
};

const ALIGN_TONE: Partial<Record<Alignment, string>> = {
  behind: "bg-red-50 text-red-700 border-red-200",
  ahead: "bg-amber-50 text-amber-700 border-amber-200",
  conflict: "bg-amber-50 text-amber-700 border-amber-200",
  lost_there: "bg-amber-50 text-amber-700 border-amber-200",
  aligned: "bg-green-50 text-green-700 border-green-200",
};

function Pill({ text, tone }: { text: string; tone?: string }) {
  return (
    <span
      className={`inline-flex max-w-full items-center truncate rounded-full border px-2 py-0.5 text-xs ${tone ?? "border-gray-200 bg-gray-50 text-gray-600"}`}
    >
      {text}
    </span>
  );
}

function PairingsTable({
  rows,
  openId,
  onOpen,
}: {
  rows: CrmPairingRow[];
  openId: string | null;
  onOpen: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
        No contact on this page matches these filters.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full table-fixed text-sm md:min-w-[860px] md:table-auto">
        <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs text-gray-500">
          <tr>
            <th className="w-[60%] px-3 py-2 font-medium md:w-auto">Their contact</th>
            <th className="w-[40%] px-3 py-2 font-medium md:w-auto">In common</th>
            <th className="hidden px-3 py-2 font-medium md:table-cell">Our lead</th>
            <th className="hidden px-3 py-2 font-medium md:table-cell">Our status</th>
            <th className="hidden px-3 py-2 font-medium md:table-cell">Their deals</th>
            <th className="hidden px-3 py-2 font-medium md:table-cell">Aligned</th>
            <th className="hidden px-3 py-2 font-medium md:table-cell">Found by</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => {
            const a = alignmentFor(r);
            const active = r.crmContact.id === openId;
            return (
              <tr
                key={r.crmContact.id}
                role="button"
                tabIndex={0}
                aria-label={`Open ${crmContactLabel(r.crmContact)}`}
                onClick={() => onOpen(r.crmContact.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen(r.crmContact.id);
                  }
                }}
                className={`cursor-pointer align-top outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${active ? "bg-brand-50" : "hover:bg-gray-50"}`}
              >
                <td className="px-3 py-2">
                  <div className="truncate font-medium text-gray-900">{crmContactLabel(r.crmContact)}</div>
                  <div className="truncate text-xs text-gray-500">
                    {r.crmContact.company || r.crmContact.email || r.crmContact.phone || "No company"}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <Pill text={labelOf(PAIRING_STATE_LABEL, r.pairing.state)} tone={STATE_TONE[r.pairing.state]} />
                  {r.pairing.ruling ? <div className="mt-1 text-xs text-gray-500">Ruled by a person</div> : null}
                  <div className="mt-1 md:hidden">
                    {a !== "not_in_common" ? <Pill text={ALIGNMENT_LABEL[a]} tone={ALIGN_TONE[a]} /> : null}
                  </div>
                </td>
                <td className="hidden px-3 py-2 md:table-cell">
                  {r.pairing.lead ? (
                    <>
                      <div className="truncate text-gray-800">{r.pairing.lead.fullName || r.pairing.lead.email || "No name"}</div>
                      <div className="truncate text-xs text-gray-500">{r.pairing.lead.company || r.pairing.lead.jobTitle || ""}</div>
                    </>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="hidden px-3 py-2 md:table-cell">
                  {r.ourStanding?.state ? labelOf(OUR_STATE_LABEL, r.ourStanding.state) : <span className="text-gray-400">-</span>}
                </td>
                <td className="hidden px-3 py-2 md:table-cell">
                  {r.theirStatus.opportunities.length === 0 ? (
                    <span className="text-gray-400">None</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {r.theirStatus.opportunities.map((o) => (
                        <Pill key={o.id} text={o.state ? labelOf(THEIR_STATE_LABEL, o.state) : o.stateRaw || "Unrecognised"} />
                      ))}
                    </div>
                  )}
                </td>
                <td className="hidden px-3 py-2 md:table-cell">
                  {a === "not_in_common" ? (
                    <span className="text-gray-400">-</span>
                  ) : (
                    <Pill text={ALIGNMENT_LABEL[a]} tone={ALIGN_TONE[a]} />
                  )}
                </td>
                <td className="hidden px-3 py-2 text-gray-700 md:table-cell">
                  <div>{r.pairing.evidence.matchMethod ? labelOf(MATCH_METHOD_LABEL, r.pairing.evidence.matchMethod) : "-"}</div>
                  <div className="text-xs text-gray-500">
                    {r.pairing.decidedBy ? labelOf(DECIDED_BY_LABEL, r.pairing.decidedBy) : "Nobody decided"}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Pager({
  pageNumber,
  shown,
  hasPrev,
  hasNext,
  total,
  onPrev,
  onNext,
}: {
  pageNumber: number;
  shown: number;
  hasPrev: boolean;
  hasNext: boolean;
  total: number | null;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pr-20 text-sm text-gray-600">
      <span>
        Page {formatCount(pageNumber)}, {formatCount(shown)} {shown === 1 ? "contact" : "contacts"}
        {total != null ? ` of ${formatCount(total)}` : ""}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={!hasPrev}
          className="rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          className="rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// ─── Where their contacts came from ──────────────────────────────────────────

function OriginsCard({ q }: { q: { data?: CrmContactOrigins; isPending: boolean; isError: boolean } }) {
  if (q.isError) return <div className="mt-3"><Unavailable what="where their contacts came from" /></div>;
  if (q.isPending || !q.data) {
    return <div className="mt-3 h-40 animate-pulse rounded-xl border border-gray-200 bg-gray-50" />;
  }
  const d = q.data;
  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-900">Where their contacts came from</h3>
      <p className="mt-1 text-xs text-gray-500">
        Their CRM&apos;s own words, over all {formatCount(d.totalContacts)} contacts. A contact with no match on our
        side often simply came from a different channel.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
        <BucketList title="Lead source" buckets={d.leadSource} />
        <BucketList title="Origin" buckets={d.originMedium} />
      </div>
    </div>
  );
}

function BucketList({ title, buckets }: { title: string; buckets: OriginBucket[] }) {
  const { shown, more } = topBuckets(buckets, 6);
  return (
    <div className="min-w-0">
      <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{title}</h4>
      <ul className="space-y-0.5 text-sm">
        {shown.map((b) => (
          <li key={b.value ?? "__none"} className="flex justify-between gap-3">
            <span className={`min-w-0 truncate ${b.value == null ? "text-gray-400" : "text-gray-800"}`}>
              {b.value ?? "Not set in their CRM"}
            </span>
            <span className="shrink-0 tabular-nums text-gray-600">{formatCount(b.count)}</span>
          </li>
        ))}
      </ul>
      {more > 0 ? <p className="mt-1 text-xs text-gray-500">and {formatCount(more)} more values</p> : null}
    </div>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────────

function PairingPanel({
  brandId,
  row,
  thresholds,
  onClose,
}: {
  brandId: string;
  row: CrmPairingRow;
  thresholds: CrmPairings["judgmentThresholds"];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<"accepted" | "rejected" | "retract" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const c = row.crmContact;
  const p = row.pairing;
  const lead = p.lead ?? null;
  const prov = contactProvenance(c);
  const position = judgmentPosition(p.judgment.samePersonProbability, thresholds);

  const act = async (kind: "accepted" | "rejected" | "retract") => {
    if (!lead) return;
    setPending(kind);
    setError(null);
    try {
      if (kind === "retract") {
        await withdrawCrmPairingRuling({ brandId, crmContactId: c.id, leadId: lead.leadId });
      } else {
        await setCrmPairingRuling({
          brandId,
          crmContactId: c.id,
          leadId: lead.leadId,
          ruling: kind,
          note: note.trim() ? note.trim() : null,
        });
      }
    } catch (err) {
      console.error("[crm-merged] ruling write failed", err);
      setError(rulingErrorMessage(err instanceof ApiError ? err.status : null, kind === "retract" ? "retract" : "rule"));
      setPending(null);
      return;
    }
    // The write landed. Re-read before releasing the button, so the panel never
    // shows the pre-write state under a finished action.
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["crmPairings", brandId] }),
        queryClient.refetchQueries({ queryKey: ["crmPairingCounts", brandId] }),
      ]);
    } catch (err) {
      console.error("[crm-merged] re-read after ruling failed", err);
    }
    setNote("");
    setPending(null);
  };

  return (
    <aside className="absolute inset-0 z-20 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 pb-24 md:static md:w-[400px] md:shrink-0">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-gray-900">{crmContactLabel(c)}</h3>
          <div className="mt-1 flex flex-wrap gap-1">
            <Pill text={labelOf(PAIRING_STATE_LABEL, p.state)} tone={STATE_TONE[p.state]} />
            {alignmentFor(row) !== "not_in_common" ? (
              <Pill text={ALIGNMENT_LABEL[alignmentFor(row)]} tone={ALIGN_TONE[alignmentFor(row)]} />
            ) : null}
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100" aria-label="Close">
          Close
        </button>
      </div>

      <PanelGroup title="In their CRM">
        <Field label="Email" value={c.email} />
        <Field label="Phone" value={c.phone} />
        <Field label="Company" value={c.company} />
        <Field label="Unsubscribed there" value={c.unsubscribed ? "Yes" : "No"} />
        {prov ? (
          <>
            <Field label="Lead source" value={prov.leadSource} />
            <Field label="Origin" value={prov.origin?.medium} />
            <Field label="Type" value={prov.type} />
            <Field label="Tags" value={prov.tags?.length ? prov.tags.join(", ") : null} />
            <Field label="Added to their CRM" value={prov.createdAt ? friendlyDateTime(prov.createdAt) : null} />
          </>
        ) : (
          <p className="mt-1 text-xs text-gray-500">This row carries no record of where the contact came from.</p>
        )}
      </PanelGroup>

      <PanelGroup title={`Their deals (${row.theirStatus.opportunities.length})`}>
        {row.theirStatus.opportunities.length === 0 ? (
          <p className="text-sm text-gray-500">Their CRM holds no deal for this person.</p>
        ) : (
          <ul className="space-y-2">
            {row.theirStatus.opportunities.map((o) => (
              <li key={o.id} className="rounded-lg border border-gray-200 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-gray-800">{o.name || "Unnamed deal"}</span>
                  <Pill text={o.state ? labelOf(THEIR_STATE_LABEL, o.state) : o.stateRaw || "Unrecognised"} />
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {[o.pipelineName, o.stageName ? `stage "${o.stageName}"` : null, o.monetaryValue != null ? formatCount(o.monetaryValue) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-gray-500">
          Only a deal&apos;s state is compared with ours. Stage names are their own words and are not comparable.
        </p>
      </PanelGroup>

      <PanelGroup title="Our lead">
        {lead ? (
          <>
            <Field label="Name" value={lead.fullName} />
            <Field label="Email" value={lead.email} />
            <Field label="Role" value={lead.jobTitle} />
            <Field label="Company" value={lead.company} />
            <Field label="Our status" value={row.ourStanding?.state ? labelOf(OUR_STATE_LABEL, row.ourStanding.state) : null} />
          </>
        ) : (
          <p className="text-sm text-gray-500">No lead of ours was found for this contact.</p>
        )}
      </PanelGroup>

      <PanelGroup title="Why we paired them">
        <Field label="Found by" value={p.evidence.matchMethod ? labelOf(MATCH_METHOD_LABEL, p.evidence.matchMethod) : "Nothing matched"} />
        <Field label="Strength" value={p.evidence.matchConfidence} />
        <Field label="Candidates" value={String(p.evidence.candidateCount)} />
        <Field label="Decided by" value={p.decidedBy ? labelOf(DECIDED_BY_LABEL, p.decidedBy) : "Nobody yet"} />
        <Field
          label="Similarity model"
          value={
            p.judgment.samePersonProbability != null
              ? `${Math.round(p.judgment.samePersonProbability * 100)}% same person (pairs at ${Math.round(thresholds.pairAt * 100)}%, rejects at ${Math.round(thresholds.rejectAt * 100)}%)${position === "between" ? ", between the two" : ""}`
              : p.judgment.status === "unavailable"
                ? "Asked, no answer"
                : p.judgment.status === "not_needed"
                  ? "Not needed"
                  : "Not asked"
          }
        />
        {p.ruling ? (
          <Field
            label="Ruling"
            value={`${p.ruling.ruling === "accepted" ? "Confirmed" : "Denied"} ${friendlyDateTime(p.ruling.statedAt)}${p.ruling.note ? `: ${p.ruling.note}` : ""}`}
          />
        ) : null}
      </PanelGroup>

      {lead ? (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <label className="block text-xs text-gray-500">
            Note (optional)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending != null}
              onClick={() => act("accepted")}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-wait"
            >
              {pending === "accepted" ? "Saving..." : "Same person"}
            </button>
            <button
              type="button"
              disabled={pending != null}
              onClick={() => act("rejected")}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-wait"
            >
              {pending === "rejected" ? "Saving..." : "Not the same person"}
            </button>
            {p.ruling ? (
              <button
                type="button"
                disabled={pending != null}
                onClick={() => act("retract")}
                className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:cursor-wait"
              >
                {pending === "retract" ? "Taking back..." : "Take my ruling back"}
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Denying deletes nothing. Both records stay, and the pairing is kept as not the same person until
            somebody takes the ruling back.
          </p>
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        </div>
      ) : null}
    </aside>
  );
}

function PanelGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{title}</h4>
      <div>{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-3 py-0.5 text-sm">
      <span className="w-32 shrink-0 text-gray-500">{label}</span>
      <span className="min-w-0 break-words text-gray-800">{value && value.trim() ? value : <span className="text-gray-400">Not held</span>}</span>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="text-xs text-gray-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="ml-2 rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-300"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function Unavailable({ what }: { what: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
      We could not read {what} right now. It will retry on its own.
    </div>
  );
}
