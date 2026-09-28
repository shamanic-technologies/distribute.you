"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  needsConfirmation,
  rulingErrorMessage,
  topBuckets,
  type Alignment,
  type CrmContactOrigins,
  type CrmPairingCounts,
  type CrmPairingRow,
  type CrmPairings,
  type OriginBucket,
} from "@/lib/crm-pairings";
import { CrmAttributionCard } from "@/components/crm/crm-attribution-card";
import { EmptyNote, Initials, SectionTitle, Shimmer } from "@/components/v2/ui";
import { REC_TH, useRowKeys } from "@/components/v2/records";
import { Count, KpiCell, KpiShimmer, ToneDot } from "@/components/v2/integrations-crm";

/** Contacts per page of the table (the v1 page's own figure; the view pages over THEIR contacts). */
export const V2_PAIRINGS_PAGE = 100;
/** Rows the "To confirm" section reads at once. */
export const V2_TO_CONFIRM_PAGE = 50;
const TO_CONFIRM_STATES = ["paired"];

/** A pairing's state as a dot colour. Waiting-for-a-person reads amber, settled reads teal. */
const STATE_COLOR: Record<string, string> = {
  paired: "var(--data-teal)",
  unconfirmed: "var(--data-amber)",
  rejected: "var(--fg-3)",
  unpaired: "var(--fg-4)",
};

/** An alignment as a dot colour: behind is the one worth acting on, so it is rose. */
const ALIGN_COLOR: Partial<Record<Alignment, string>> = {
  behind: "var(--data-rose)",
  ahead: "var(--data-amber)",
  conflict: "var(--data-amber)",
  lost_there: "var(--data-amber)",
  aligned: "var(--data-teal)",
};

/**
 * "Merged with our leads" in the v2 frame: one row per contact of THEIR CRM, our lead
 * beside it where we emailed the same person.
 *
 * Same reads and the same query keys as the v1 page (`crmPairingCounts`, `crmPairings`,
 * `crmContactOrigins`), so the caches dedupe and a ruling's re-read refreshes both. Every
 * count is lead-service's `/crm-pairing-counts`, verbatim; the table pages over their
 * contacts and never holds the population, so its alignment filter and its order apply to
 * the page on screen and say so. Nothing here writes to their CRM: the only writes are a
 * ruling on a pairing (kept beside it, never deleted) and the per-step credit inside the
 * shared attribution card.
 */
export function V2CrmMergedView({ brandId }: { brandId: string }) {
  const isBeta = useIsBetaUser();
  const [offsets, setOffsets] = useState<number[]>([0]);
  const offset = offsets[offsets.length - 1];
  const [stateFilter, setStateFilter] = useState<string>("paired");
  const filter = STATE_FILTERS.find((f) => f.id === stateFilter);
  const states = filter?.states ?? null;
  const filterToConfirm = filter?.toConfirm === true;
  const [alignFilter, setAlignFilter] = useState<Alignment | "all">("all");
  const [sort, setSort] = useState<"attention" | "name" | "state">("attention");
  const [openId, setOpenId] = useState<string | null>(null);
  const [openFrom, setOpenFrom] = useState<"toConfirm" | "table">("table");
  const [cursor, setCursor] = useState(-1);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const countsQ = useAuthQuery(["crmPairingCounts", brandId], () => getCrmPairingCounts(brandId), { enabled: isBeta });
  const pageQ = useAuthQuery(
    ["crmPairings", brandId, stateFilter, offset],
    () => listCrmPairings(brandId, { limit: V2_PAIRINGS_PAGE, offset, states, toConfirm: filterToConfirm }),
    { enabled: isBeta },
  );
  // Same root as the table, so a ruling's re-read refreshes both.
  const toConfirmQ = useAuthQuery(
    ["crmPairings", brandId, "toConfirmSection"],
    () => listCrmPairings(brandId, { limit: V2_TO_CONFIRM_PAGE, offset: 0, states: TO_CONFIRM_STATES, toConfirm: true }),
    { enabled: isBeta },
  );
  const originsQ = useAuthQuery(["crmContactOrigins", brandId], () => getCrmContactOrigins(brandId), { enabled: isBeta });

  const page = pageQ.data;
  const rows = page ? filterAndSortRows(page.pairings, { state: "all", alignment: alignFilter, sort }) : [];
  useEffect(() => setCursor(-1), [stateFilter, offset, alignFilter, sort]);
  const openRow = (from: "toConfirm" | "table") => (id: string) => {
    setOpenFrom(from);
    setOpenId(id);
  };
  useRowKeys({
    count: openId ? 0 : rows.length,
    cursor,
    setCursor,
    onOpen: (i) => rows[i] && openRow("table")(rows[i].crmContact.id),
    searchRef,
  });

  if (!isBeta) {
    return (
      <div className="k-card">
        <EmptyNote>This page is still in beta and is not open on your account yet.</EmptyNote>
      </div>
    );
  }

  const c = countsQ.data?.counts;
  const stateTotal = (() => {
    if (!c) return null;
    if (filterToConfirm) return c.pairedToConfirm ?? null;
    if (!states) return c.crmContacts;
    let n = 0;
    for (const st of states) {
      const v = c.byState[st as keyof typeof c.byState];
      if (v == null) return null;
      n += v;
    }
    return n;
  })();
  const toConfirmRows = (toConfirmQ.data?.pairings ?? []).filter(needsConfirmation);
  const openSource = openFrom === "toConfirm" ? toConfirmRows : (page?.pairings ?? []);
  const open = openSource.find((r) => r.crmContact.id === openId) ?? null;
  const thresholds = toConfirmQ.data?.judgmentThresholds ?? page?.judgmentThresholds ?? null;
  // A switch of page keeps the previous page on screen (keepPreviousData); that would
  // show one page's rows under another's pager, so it shimmers instead.
  const pageLoading = (!pageQ.isFetchedAfterMount && !page) || pageQ.isPlaceholderData;
  const resetTo = (next: () => void) => {
    next();
    setOffsets([0]);
    setOpenId(null);
  };

  return (
    <div className="space-y-8">
      <CountsStrip q={countsQ} />

      <ToConfirmSection
        q={toConfirmQ}
        rows={toConfirmRows}
        total={c?.pairedToConfirm ?? null}
        openId={openFrom === "toConfirm" ? openId : null}
        onOpen={openRow("toConfirm")}
        onSeeAll={() => resetTo(() => setStateFilter("toConfirm"))}
      />

      <OriginsCard q={originsQ} />

      <section>
        <SectionTitle>Contacts<Count n={stateTotal} /></SectionTitle>
        <div className="k-card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line-subtle)] px-4 py-3">
            <SelectButton
              label="Show"
              value={stateFilter}
              onChange={(v) => resetTo(() => setStateFilter(v))}
              options={STATE_FILTERS.map((f) => [f.id, f.label] as [string, string])}
            />
            <SelectButton
              label="Aligned"
              value={alignFilter}
              onChange={(v) => setAlignFilter(v as Alignment | "all")}
              options={[["all", "All"], ...ATTENTION_ORDER.map((a) => [a, ALIGNMENT_LABEL[a]] as [string, string])]}
            />
            <SelectButton
              label="Order"
              value={sort}
              onChange={(v) => setSort(v as "attention" | "name" | "state")}
              options={[
                ["attention", "Needs attention first"],
                ["state", "In common first"],
                ["name", "Name"],
              ]}
            />
            <span className="k-fg3 ml-auto text-[12px]">Show reads their whole CRM. Aligned and Order apply to this page.</span>
          </div>
          {pageQ.isError && !page ? (
            <EmptyNote>We could not read the side-by-side view right now. It will retry on its own.</EmptyNote>
          ) : pageLoading || !page ? (
            Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="k-row flex h-12 items-center px-4"><Shimmer className="h-4 w-full" /></div>
            ))
          ) : !page.crmConnected ? (
            <EmptyNote>No CRM is connected to this brand, so there is nothing to put beside our leads.</EmptyNote>
          ) : (
            <>
              <PairingsTable
                rows={rows}
                openId={openFrom === "table" ? openId : null}
                cursor={cursor}
                onHover={setCursor}
                onOpen={openRow("table")}
              />
              <div className="k-fg3 flex flex-wrap items-center gap-3 border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px] tabular-nums">
                <span>
                  Page {formatCount(offsets.length)}, {formatCount(page.pairings.length)}{" "}
                  {page.pairings.length === 1 ? "contact" : "contacts"}
                  {stateTotal != null ? ` of ${formatCount(stateTotal)}` : ""}
                </span>
                <span className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    className="k-btn h-6 text-[12px] disabled:opacity-40"
                    disabled={offsets.length <= 1}
                    onClick={() => {
                      setOpenId(null);
                      setOffsets(offsets.slice(0, -1));
                    }}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="k-btn h-6 text-[12px] disabled:opacity-40"
                    disabled={page.nextOffset == null}
                    onClick={() => {
                      if (page.nextOffset == null) return;
                      setOpenId(null);
                      setOffsets([...offsets, page.nextOffset]);
                    }}
                  >
                    Next
                  </button>
                </span>
              </div>
            </>
          )}
        </div>
      </section>

      {open && thresholds ? (
        <PairingDrawer
          key={open.crmContact.id}
          brandId={brandId}
          row={open}
          thresholds={thresholds}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </div>
  );
}

// ─── Counts ─────────────────────────────────────────────────────────────────

function CountsStrip({ q }: { q: { data?: CrmPairingCounts; isFetchedAfterMount: boolean; isError: boolean } }) {
  if (!q.data) {
    if (q.isFetchedAfterMount || q.isError) {
      return <div className="k-card"><EmptyNote>We could not read the counts right now. It will retry on its own.</EmptyNote></div>;
    }
    return <KpiShimmer cells={8} />;
  }
  const d = q.data;
  if (!d.crmConnected) return null;
  const c = d.counts;
  const opp = c.opportunitiesByState;
  const fig = (n: number | null | undefined) => (n == null ? <span className="k-fg4">—</span> : formatCount(n));
  return (
    <div>
      <div className="k-card grid grid-cols-2 gap-px overflow-hidden bg-[var(--line-subtle)] md:grid-cols-4">
        <KpiCell label="Their contacts" value={fig(c.crmContacts)} note={`${formatCount(c.crmContactsWithEmail)} with an email`} />
        <KpiCell label={PAIRING_STATE_LABEL.paired} value={fig(c.byState.paired)} note="Emailed by us too" />
        <KpiCell
          label="To confirm"
          value={
            <span className="inline-flex items-center gap-2">
              {(c.pairedToConfirm ?? 0) > 0 && <span className="h-2 w-2 rounded-full bg-[var(--data-amber)]" />}
              {fig(c.pairedToConfirm)}
            </span>
          }
          note="Already counted as ours"
        />
        <KpiCell label={PAIRING_STATE_LABEL.rejected} value={fig(c.byState.rejected)} />
        <KpiCell label={PAIRING_STATE_LABEL.unpaired} value={fig(c.byState.unpaired)} />
        <KpiCell label="Our leads they never heard of" value={fig(d.ourLeadsNoCrmContactPointsAt)} />
        <KpiCell
          label="Their deals"
          value={fig(c.opportunities)}
          note={[
            `${formatCount(opp.open ?? 0)} open`,
            `${formatCount(opp.won ?? 0)} won`,
            `${formatCount(opp.lost ?? 0)} lost`,
            `${formatCount(opp.abandoned ?? 0)} abandoned`,
            opp.unrecognised ? `${formatCount(opp.unrecognised)} unrecognised` : null,
          ]
            .filter(Boolean)
            .join(", ")}
        />
        <KpiCell label="Deals we cannot compare" value={fig(c.opportunitiesWithUncomparableStage)} note="Their stage names are their own words" />
      </div>
      <p className="k-fg3 mt-2 text-[12px]">
        How each pairing was found:{" "}
        {Object.entries(c.byMatchMethod)
          .filter(([, n]) => (n ?? 0) > 0)
          .map(([m, n]) => `${labelOf(MATCH_METHOD_LABEL, m)} ${formatCount(n ?? 0)}`)
          .join(", ") || "none yet"}
        .
        {(c.byState.unconfirmed ?? 0) > 0
          ? ` ${formatCount(c.byState.unconfirmed ?? 0)} ${PAIRING_STATE_LABEL.unconfirmed.toLowerCase()}: the similarity model could not answer yet and is asked again on the next pass.`
          : ""}
      </p>
    </div>
  );
}

// ─── To confirm ─────────────────────────────────────────────────────────────

/**
 * Pairings a hesitant similarity judgment decided in our favour. They already count, so
 * this sits above everything else: a wrong one inflates the customer's return until
 * somebody looks.
 */
function ToConfirmSection({
  q,
  rows,
  total,
  openId,
  onOpen,
  onSeeAll,
}: {
  q: { data?: CrmPairings; isFetchedAfterMount: boolean; isError: boolean };
  rows: CrmPairingRow[];
  total: number | null;
  openId: string | null;
  onOpen: (id: string) => void;
  onSeeAll: () => void;
}) {
  if (!q.data) {
    if (q.isFetchedAfterMount || q.isError) {
      return <div className="k-card"><EmptyNote>We could not read the pairings to confirm right now. It will retry on its own.</EmptyNote></div>;
    }
    return <Shimmer className="h-24 w-full rounded-[12px]" />;
  }
  if (!q.data.crmConnected || rows.length === 0) return null;
  return (
    <section>
      <SectionTitle>To confirm<Count n={total} /></SectionTitle>
      <p className="k-fg2 -mt-1 mb-3 text-[13px]">
        The similarity model thinks these may be the same person. They already count as ours. Open one to confirm or deny it.
      </p>
      <div className="k-card overflow-hidden">
        <PairingsTable rows={rows} openId={openId} cursor={-1} onHover={() => {}} onOpen={onOpen} />
        {total != null && total > rows.length ? (
          <div className="border-t border-[var(--line-subtle)] px-4 py-2.5">
            <button type="button" onClick={onSeeAll} className="k-btn-ghost h-6 text-[12px]">
              See all {formatCount(total)} in the table below
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PairingState({ row }: { row: CrmPairingRow }) {
  if (needsConfirmation(row)) return <ToneDot color="var(--data-amber)" label="In common, to confirm" />;
  const s = row.pairing.state;
  return <ToneDot color={STATE_COLOR[s] ?? "var(--fg-4)"} label={labelOf(PAIRING_STATE_LABEL, s)} hollow={s === "unpaired"} />;
}

function AlignmentDot({ a }: { a: Alignment }) {
  if (a === "not_in_common") return <span className="k-fg4">—</span>;
  return <ToneDot color={ALIGN_COLOR[a] ?? "var(--fg-4)"} label={ALIGNMENT_LABEL[a]} hollow={!ALIGN_COLOR[a]} />;
}

function theirDealWord(o: CrmPairingRow["theirStatus"]["opportunities"][number]): string {
  return o.state ? labelOf(THEIR_STATE_LABEL, o.state) : o.stateRaw || "Unrecognised";
}

function PairingsTable({
  rows,
  openId,
  cursor,
  onHover,
  onOpen,
}: {
  rows: CrmPairingRow[];
  openId: string | null;
  cursor: number;
  onHover: (i: number) => void;
  onOpen: (id: string) => void;
}) {
  if (rows.length === 0) return <EmptyNote>No contact on this page matches these filters.</EmptyNote>;
  return (
    <div className="k-scroll overflow-x-auto">
      <table className="w-full table-fixed text-[13px] md:min-w-[900px] md:table-auto">
        <thead>
          <tr>
            <th className={`${REC_TH} w-[60%] pl-4 md:w-auto`}>Their contact</th>
            <th className={`${REC_TH} w-[40%] md:w-auto`}>In common</th>
            <th className={`${REC_TH} hidden md:table-cell`}>Our lead</th>
            <th className={`${REC_TH} hidden md:table-cell`}>Our status</th>
            <th className={`${REC_TH} hidden md:table-cell`}>Their deals</th>
            <th className={`${REC_TH} hidden md:table-cell`}>Aligned</th>
            <th className={`${REC_TH} hidden pr-4 md:table-cell`}>Found by</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const a = alignmentFor(r);
            const active = r.crmContact.id === openId || i === cursor;
            const label = crmContactLabel(r.crmContact);
            const lead = r.pairing.lead;
            return (
              <tr
                key={r.crmContact.id}
                role="button"
                tabIndex={0}
                aria-label={`Open ${label}`}
                onClick={() => onOpen(r.crmContact.id)}
                onMouseEnter={() => onHover(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen(r.crmContact.id);
                  }
                }}
                className={`k-row cursor-pointer align-middle outline-none ${active ? "k-selected" : ""}`}
              >
                <td className="px-3 py-2 pl-4">
                  <span className="flex min-w-0 items-center gap-2">
                    <Initials name={label} size={18} round />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{label}</span>
                      <span className="k-fg3 block truncate text-[12px]">
                        {r.crmContact.company || r.crmContact.email || r.crmContact.phone || "No company"}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="px-3 py-2">
                  <PairingState row={r} />
                  {r.pairing.ruling ? <span className="k-fg3 block text-[12px]">Ruled by a person</span> : null}
                  <span className="mt-0.5 block md:hidden"><AlignmentDot a={a} /></span>
                </td>
                <td className="hidden px-3 py-2 md:table-cell">
                  {lead ? (
                    <>
                      <span className="block truncate">{lead.fullName || lead.email || "No name"}</span>
                      <span className="k-fg3 block truncate text-[12px]">{lead.company || lead.jobTitle || ""}</span>
                    </>
                  ) : (
                    <span className="k-fg4">—</span>
                  )}
                </td>
                <td className="k-fg2 hidden px-3 py-2 md:table-cell">
                  {r.ourStanding?.state ? labelOf(OUR_STATE_LABEL, r.ourStanding.state) : <span className="k-fg4">—</span>}
                </td>
                <td className="hidden px-3 py-2 md:table-cell">
                  {r.theirStatus.opportunities.length === 0 ? (
                    <span className="k-fg4">None</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {r.theirStatus.opportunities.map((o) => (
                        <span key={o.id} className="k-chip">{theirDealWord(o)}</span>
                      ))}
                    </span>
                  )}
                </td>
                <td className="hidden px-3 py-2 md:table-cell"><AlignmentDot a={a} /></td>
                <td className="hidden px-3 py-2 pr-4 md:table-cell">
                  <span className="block">{r.pairing.evidence.matchMethod ? labelOf(MATCH_METHOD_LABEL, r.pairing.evidence.matchMethod) : "—"}</span>
                  <span className="k-fg3 block text-[12px]">
                    {r.pairing.decidedBy ? labelOf(DECIDED_BY_LABEL, r.pairing.decidedBy) : "Nobody decided"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Origins ────────────────────────────────────────────────────────────────

function OriginsCard({ q }: { q: { data?: CrmContactOrigins; isFetchedAfterMount: boolean; isError: boolean } }) {
  if (!q.data) {
    if (q.isFetchedAfterMount || q.isError) {
      return <div className="k-card"><EmptyNote>We could not read where their contacts came from right now. It will retry on its own.</EmptyNote></div>;
    }
    return <Shimmer className="h-40 w-full rounded-[12px]" />;
  }
  const d = q.data;
  return (
    <section>
      <SectionTitle>Where their contacts came from<Count n={d.totalContacts} /></SectionTitle>
      <p className="k-fg2 -mt-1 mb-3 text-[13px]">
        Their CRM&apos;s own words, over every contact. A contact with no match on our side often simply came from a different channel.
      </p>
      <div className="k-card grid grid-cols-1 divide-y divide-[var(--line-subtle)] md:grid-cols-2 md:divide-x md:divide-y-0">
        <BucketList title="Lead source" buckets={d.leadSource} />
        <BucketList title="Origin" buckets={d.originMedium} />
      </div>
    </section>
  );
}

function BucketList({ title, buckets }: { title: string; buckets: OriginBucket[] }) {
  const { shown, more } = topBuckets(buckets, 6);
  return (
    <div className="min-w-0 px-4 py-3">
      <p className="k-label mb-2">{title}</p>
      <ul className="space-y-1 text-[13px]">
        {shown.map((b) => (
          <li key={b.value ?? "__none"} className="flex justify-between gap-3">
            <span className={`min-w-0 truncate ${b.value == null ? "k-fg4" : ""}`}>{b.value ?? "Not set in their CRM"}</span>
            <span className="k-fg2 shrink-0 tabular-nums">{formatCount(b.count)}</span>
          </li>
        ))}
        {shown.length === 0 ? <li className="k-fg4">None</li> : null}
      </ul>
      {more > 0 ? <p className="k-fg3 mt-1.5 text-[12px]">and {formatCount(more)} more values</p> : null}
    </div>
  );
}

// ─── Drawer ─────────────────────────────────────────────────────────────────

function PairingDrawer({
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
  const a = alignmentFor(row);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
      console.error("[v2 crm-merged] ruling write failed", err);
      setError(rulingErrorMessage(err instanceof ApiError ? err.status : null, kind === "retract" ? "retract" : "rule"));
      setPending(null);
      return;
    }
    // The write landed. Re-read before releasing the button, so the drawer never shows
    // the pre-write state under a finished action.
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["crmPairings", brandId] }),
        queryClient.refetchQueries({ queryKey: ["crmPairingCounts", brandId] }),
      ]);
    } catch (err) {
      console.error("[v2 crm-merged] re-read after ruling failed", err);
    }
    setNote("");
    setPending(null);
  };

  const host = typeof document === "undefined" ? null : (document.getElementById("v2-portal") ?? document.body);
  if (!host) return null;
  return createPortal(
    <aside
      role="dialog"
      aria-label={crmContactLabel(c)}
      className="k-popover fixed inset-y-2 right-2 z-50 flex w-[min(440px,calc(100vw-16px))] flex-col overflow-hidden"
    >
      <header className="flex items-center gap-2 border-b border-[var(--line-subtle)] px-4 py-3">
        <span className="k-label">Pairing</span>
        <button type="button" onClick={onClose} aria-label="Close" className="k-btn-ghost ml-auto h-7 w-7 justify-center px-0">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <div className="k-scroll flex-1 overflow-y-auto px-4 pb-6 pt-4">
        <div className="flex items-center gap-3">
          <Initials name={crmContactLabel(c)} size={32} round />
          <div className="min-w-0">
            <h3 className="truncate text-[16px] font-medium">{crmContactLabel(c)}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <PairingState row={row} />
              {a !== "not_in_common" ? <AlignmentDot a={a} /> : null}
            </div>
          </div>
        </div>

        <DrawerGroup title="In their CRM">
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
            <p className="k-fg3 mt-1 text-[12px]">This row carries no record of where the contact came from.</p>
          )}
        </DrawerGroup>

        <DrawerGroup title={`Their deals ${row.theirStatus.opportunities.length}`}>
          {row.theirStatus.opportunities.length === 0 ? (
            <p className="k-fg2 text-[13px]">Their CRM holds no deal for this person.</p>
          ) : (
            <ul className="k-inset divide-y divide-[var(--line-subtle)] rounded-[8px]">
              {row.theirStatus.opportunities.map((o) => (
                <li key={o.id} className="px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px]">{o.name || "Unnamed deal"}</span>
                    <span className="k-chip shrink-0">{theirDealWord(o)}</span>
                  </div>
                  <div className="k-fg3 mt-0.5 text-[12px]">
                    {[o.pipelineName, o.stageName ? `stage "${o.stageName}"` : null, o.monetaryValue != null ? formatCount(o.monetaryValue) : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="k-fg3 mt-2 text-[12px]">Only a deal&apos;s state is compared with ours. Stage names are their own words and are not comparable.</p>
        </DrawerGroup>

        <DrawerGroup title="Our lead">
          {lead ? (
            <>
              <Field label="Name" value={lead.fullName} />
              <Field label="Email" value={lead.email} />
              <Field label="Role" value={lead.jobTitle} />
              <Field label="Company" value={lead.company} />
              <Field label="Our status" value={row.ourStanding?.state ? labelOf(OUR_STATE_LABEL, row.ourStanding.state) : null} />
            </>
          ) : (
            <p className="k-fg2 text-[13px]">No lead of ours was found for this contact.</p>
          )}
        </DrawerGroup>

        {/* The ONE attribution card (shared with the Leads panel, so a person is never
            credited one way here and another way one click over), in the Keel look. */}
        {lead && p.state === "paired" ? (
          <div className="v2-embed">
            <CrmAttributionCard leadRowId={lead.leadCampaignId} brandId={brandId} />
          </div>
        ) : null}

        <DrawerGroup title="Why we paired them">
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
                  ? "Asked, no answer yet. Asked again on the next pass"
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
        </DrawerGroup>

        {lead ? (
          <div className="mt-5 border-t border-[var(--line-subtle)] pt-4">
            {needsConfirmation(row) ? (
              <p className="mb-3 text-[13px]">
                The similarity model was not sure. This pairing already counts as ours: confirm it, or deny it to take it out.
              </p>
            ) : null}
            <label className="k-label block">
              Note, optional
              <input value={note} onChange={(e) => setNote(e.target.value)} className="k-input mt-1.5 w-full normal-case tracking-normal" />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={pending != null} onClick={() => act("accepted")} className="k-btn-accent disabled:cursor-wait">
                {pending === "accepted" ? "Saving..." : "Same person"}
              </button>
              <button type="button" disabled={pending != null} onClick={() => act("rejected")} className="k-btn disabled:cursor-wait">
                {pending === "rejected" ? "Saving..." : "Not the same person"}
              </button>
              {p.ruling ? (
                <button type="button" disabled={pending != null} onClick={() => act("retract")} className="k-btn-ghost disabled:cursor-wait">
                  {pending === "retract" ? "Taking back..." : "Take my ruling back"}
                </button>
              ) : null}
            </div>
            <p className="k-fg3 mt-2 text-[12px]">
              Denying deletes nothing. Both records stay, and the pairing is kept as not the same person until somebody takes the ruling back.
            </p>
            {error ? <p className="mt-2 text-[13px] text-[var(--data-rose)]">{error}</p> : null}
          </div>
        ) : null}
      </div>
    </aside>,
    host,
  );
}

function DrawerGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <p className="k-label mb-1.5">{title}</p>
      <dl>{children}</dl>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-3 py-0.5 text-[13px]">
      <dt className="k-fg3 w-32 shrink-0">{label}</dt>
      <dd className="min-w-0 break-words">{value && value.trim() ? value : <span className="k-fg4">Not held</span>}</dd>
    </div>
  );
}

/** Keel's select control: a `k-btn` showing "Label  value", a native select over it. */
function SelectButton({
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
  const current = options.find(([v]) => v === value)?.[1] ?? value;
  return (
    <label className="k-btn relative h-7 text-[12px]">
      <span className="k-fg2">{label}</span>
      <span>{current}</span>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className="k-fg3">
        <path d="M2.5 4l2.5 2.5L7.5 4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
