"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getStaffMessageBody, getStaffOpsThreadMessages, getStaffOpsThreads } from "@/lib/api";
import { EmptyNote, SectionTitle, Shimmer } from "@/components/v2/ui";
import { Dash, Failed, Loading, OK, RED, TD, TDR, TH, THR, Table, n } from "@/components/v2/monitoring-sending";
import { entityPath, type EntityKind } from "@/lib/monitoring/sending";
import {
  THREAD_DIRECTIONS,
  THREAD_KINDS,
  THREAD_MESSAGES_LIMIT,
  THREAD_PLACEMENTS,
  THREAD_TEXT_FILTERS,
  appendThreads,
  domainOf,
  hasActiveFilters,
  servedWord,
  threadKindWord,
  threadReadingOrder,
  threadsQuery,
  type OpsThread,
  type OpsThreadMessage,
  type ThreadFilters,
} from "@/lib/monitoring/threads";

/**
 * Monitoring > Emails > Threads (staff only): every thread our sending infra sent or received, of
 * every kind, filtered at the producer (instantly-service `/ops/threads`), paged by its cursor.
 * A row opens in place: who and what, the outcome, the caller, then the thread's emails oldest
 * first, each body read on open. Ported from the admin console's cold-email Inbox page.
 *
 * NO POLL: pages accumulate behind a cursor, so a background refetch of page one would drop the
 * pages already loaded. Every figure is a served field; this file names, orders and links.
 */

const ONCE = { staleTime: 60_000, retry: false } as const;
const COLS = 6;
const AMBER = "var(--data-amber)";
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) : null;

/** A link to an entity page under Monitoring; a click on it never toggles the row. */
function EntityLink({ base, kind, id }: { base: string; kind: EntityKind; id: string }) {
  return (
    <Link href={`${base}/${entityPath(kind, id)}`} className="k-mono text-[12px] hover:underline" onClick={(e) => e.stopPropagation()}>
      {id}
    </Link>
  );
}

const PLACEMENT_WORD: Record<string, { word: string; color: string }> = {
  inbox: { word: "Inbox", color: OK },
  spam: { word: "Spam", color: RED },
  missing: { word: "Missing", color: AMBER },
};

function Placement({ placement }: { placement: string | null }) {
  const p = placement ? PLACEMENT_WORD[placement] : undefined;
  if (!placement) return <Dash />;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px]">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: p?.color ?? "var(--fg-3)" }} />
      {p?.word ?? placement}
    </span>
  );
}

// ─── Filters ───────────────────────────────────────────────────────────────

function Chips<T extends string | boolean | undefined>({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: Array<{ value: T; word: string }>;
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      <span className="k-label mr-1">{label}</span>
      {options.map((o) => (
        <button
          key={o.word}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onPick(o.value)}
          className={value === o.value ? "k-btn h-7 px-2 text-[12px]" : "k-btn-ghost h-7 px-2 text-[12px]"}
        >
          {o.word}
        </button>
      ))}
    </div>
  );
}

type TextKey = (typeof THREAD_TEXT_FILTERS)[number]["key"] | "since" | "until";

function Filters({ applied, onApply }: { applied: ThreadFilters; onApply: (f: ThreadFilters) => void }) {
  // Text fields apply on Enter / Apply (a request per keystroke on a 70k-row list is what this avoids);
  // the chips apply at once.
  const [draft, setDraft] = useState<ThreadFilters>(applied);
  useEffect(() => setDraft(applied), [applied]);
  const pick = (patch: Partial<ThreadFilters>) => onApply({ ...draft, ...patch });
  const field = (key: TextKey, label: string, placeholder?: string, type = "text") => (
    <label key={key} className="flex min-w-0 flex-col gap-1">
      <span className="k-label">{label}</span>
      <input
        type={type}
        className="k-input w-full"
        style={{ font: "inherit" }}
        value={draft[key] ?? ""}
        placeholder={placeholder}
        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
      />
    </label>
  );
  return (
    <div className="k-card space-y-3 p-4">
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Chips
          label="Kind"
          value={draft.kind}
          onPick={(kind) => pick({ kind })}
          options={[{ value: undefined, word: "All" }, ...THREAD_KINDS.map((k) => ({ value: k as string | undefined, word: threadKindWord(k) }))]}
        />
        <Chips
          label="Reply"
          value={draft.hasInbound}
          onPick={(hasInbound) => pick({ hasInbound })}
          options={[
            { value: undefined, word: "Any" },
            { value: true as boolean | undefined, word: "Replied" },
            { value: false as boolean | undefined, word: "No reply" },
          ]}
        />
        <Chips
          label="Direction"
          value={draft.direction}
          onPick={(direction) => pick({ direction })}
          options={[{ value: undefined, word: "Any" }, ...THREAD_DIRECTIONS.map((d) => ({ value: d as string | undefined, word: d === "in" ? "Inbound" : "Outbound" }))]}
        />
        <Chips
          label="Placement"
          value={draft.placement}
          onPick={(placement) => pick({ placement })}
          options={[{ value: undefined, word: "Any" }, ...THREAD_PLACEMENTS.map((p) => ({ value: p as string | undefined, word: PLACEMENT_WORD[p].word }))]}
        />
      </div>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onApply(draft);
        }}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {THREAD_TEXT_FILTERS.map((f) => field(f.key, f.label, f.placeholder))}
          {field("since", "Since", undefined, "date")}
          {field("until", "Until", undefined, "date")}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className="k-btn-strong">
            Apply
          </button>
          <button type="button" className="k-btn-ghost" onClick={() => onApply({})}>
            Clear
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── One thread, opened in place ───────────────────────────────────────────

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="k-label shrink-0">{label}</dt>
      <dd className="min-w-0 break-all text-right text-[12px]">{children ?? <Dash />}</dd>
    </div>
  );
}

const mono = (v: string | null) => (v ? <span className="k-mono text-[12px]">{v}</span> : null);

function MessageBody({ id }: { id: string }) {
  // Same key as the Monitoring emails table, so a body read there is not read twice.
  const q = useAuthQuery(["staffMessageBody", id], () => getStaffMessageBody(id), ONCE);
  if (q.isError) return <p className="k-fg3 mt-2 text-[12px]">Could not read this email&apos;s body.</p>;
  if (!q.data) return <Shimmer className="mt-2 h-12 w-full" />;
  const body = q.data.text ?? q.data.html;
  // HTML is shown as text, never rendered: third-party markup on a staff surface.
  if (body == null) return <p className="k-fg3 mt-2 text-[12px]">No body kept for this email ({q.data.source}).</p>;
  return <pre className="k-fg2 mt-2 max-h-[320px] overflow-auto whitespace-pre-wrap break-words font-sans text-[12px] leading-[18px]">{body}</pre>;
}

const AUTH = (label: string, pass: boolean | null) =>
  pass == null ? null : (
    <span key={label} style={{ color: pass ? OK : RED }}>
      {label} {pass ? "pass" : "fail"}
    </span>
  );

function ThreadMessage({ base, m }: { base: string; m: OpsThreadMessage }) {
  const [open, setOpen] = useState(false);
  const ours = m.accountEmail ? <EntityLink base={base} kind="account" id={m.accountEmail} /> : (mono(m.mailboxLogin) ?? <Dash />);
  const them = mono(m.counterparty) ?? <Dash />;
  const auth = [AUTH("SPF", m.spfPass), AUTH("DKIM", m.dkimPass), AUTH("DMARC", m.dmarcPass)].filter(Boolean);
  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12px]">
        <span className="font-medium">{threadKindWord(m.kind)}</span>
        <span className="k-fg3">{m.direction === "in" ? "Inbound" : "Outbound"}</span>
        {m.step != null && <span className="k-fg3 tabular-nums">Step {n(m.step)}</span>}
        {m.transport && <span className="k-chip">{m.transport}</span>}
        {m.placement && <Placement placement={m.placement} />}
        {m.outcome && <span className="k-fg3">{servedWord(m.outcome)}</span>}
        <span className="k-mono k-fg2 ml-auto">{when(m.occurredAt)}</span>
      </div>
      <p className="mt-1 text-[13px]">{m.subject ?? <span className="k-fg3">No subject</span>}</p>
      <p className="k-fg3 mt-0.5 flex flex-wrap items-baseline gap-1.5 text-[12px]">
        {m.direction === "in" ? them : ours}
        <span>to</span>
        {m.direction === "in" ? ours : them}
      </p>
      {(auth.length > 0 || m.contextRef) && (
        <p className="k-fg3 mt-0.5 flex flex-wrap gap-3 text-[11px]">
          {auth}
          {m.contextRef && <span className="k-mono">{m.contextRef}</span>}
        </p>
      )}
      <button type="button" className="k-btn-ghost mt-1 h-6 px-2 text-[12px]" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? "Hide body" : "Read body"}
      </button>
      {open && <MessageBody id={m.id} />}
    </li>
  );
}

function ThreadDetail({ base, t }: { base: string; t: OpsThread }) {
  const q = useAuthQuery(["staffOpsThreadMessages", t.threadId], () => getStaffOpsThreadMessages(t.threadId), ONCE);
  const ordered = useMemo(() => (q.data ? threadReadingOrder(q.data.messages) : []), [q.data]);
  const domain = domainOf(t.accountEmail);
  return (
    <tr>
      <td colSpan={COLS} className="k-inset px-4 py-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-3">
          <dl>
            <p className="k-fg2 mb-1 text-[12px] font-medium">Who and what</p>
            <Fact label="Sending address">{t.accountEmail && <EntityLink base={base} kind="account" id={t.accountEmail} />}</Fact>
            <Fact label="Mailbox">{t.mailboxLogin && <EntityLink base={base} kind="mailbox" id={t.mailboxLogin} />}</Fact>
            <Fact label="Domain">{domain && <EntityLink base={base} kind="domain" id={domain} />}</Fact>
            <Fact label="Transport">{t.transport}</Fact>
            <Fact label="Counterparty">{mono(t.counterparty)}</Fact>
            <Fact label="Lead">{mono(t.leadEmail)}</Fact>
          </dl>
          <dl>
            <p className="k-fg2 mb-1 text-[12px] font-medium">Outcome</p>
            <Fact label="Delivery">{servedWord(t.deliveryStatus)}</Fact>
            <Fact label="Reply classification">{servedWord(t.replyClassification)}</Fact>
            <Fact label="Reply kind">{servedWord(t.replyKind)}</Fact>
            <Fact label="Placement">{t.placement && <Placement placement={t.placement} />}</Fact>
            <Fact label="Messages">
              <span className="tabular-nums">
                {n(t.messageCount)} <span className="k-fg3">({n(t.outboundCount)} out, {n(t.inboundCount)} in)</span>
              </span>
            </Fact>
            <Fact label="First activity">{when(t.firstAt) && <span className="k-mono k-fg2">{when(t.firstAt)}</span>}</Fact>
            <Fact label="Last activity">{when(t.lastAt) && <span className="k-mono k-fg2">{when(t.lastAt)}</span>}</Fact>
          </dl>
          <dl>
            <p className="k-fg2 mb-1 text-[12px] font-medium">Caller</p>
            <Fact label="Sequence">{mono(t.instantlyCampaignId)}</Fact>
            <Fact label="Org">{mono(t.orgId)}</Fact>
            <Fact label="Campaign">{mono(t.campaignId)}</Fact>
            <Fact label="Brands">{t.brandIds?.length ? mono(t.brandIds.join(", ")) : null}</Fact>
          </dl>
        </div>
        <div className="k-line-subtle mt-4 border-t pt-3">
          <p className="k-fg2 text-[12px] font-medium">
            Emails{q.data && <span className="k-fg3 ml-1.5 font-normal tabular-nums">{n(ordered.length)}</span>}
            <span className="k-fg3 ml-2 font-normal">oldest first</span>
          </p>
          {q.isError ? (
            <p className="k-fg3 mt-2 text-[12px]">Could not read this thread&apos;s emails.</p>
          ) : !q.data ? (
            <div className="mt-2 space-y-2">
              {[0, 1, 2].map((i) => (
                <Shimmer key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : ordered.length === 0 ? (
            <p className="k-fg3 mt-2 text-[12px]">No email rows for this thread.</p>
          ) : (
            <>
              <ol className="divide-y divide-[var(--line-subtle)]">
                {ordered.map((m) => (
                  <ThreadMessage key={m.id} base={base} m={m} />
                ))}
              </ol>
              {q.data.nextCursor && <p className="k-fg3 mt-1 text-[12px]">The first {n(THREAD_MESSAGES_LIMIT)} emails of a longer thread.</p>}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── The list ──────────────────────────────────────────────────────────────

function ThreadRow({ base, t, open, onToggle }: { base: string; t: OpsThread; open: boolean; onToggle: () => void }) {
  const reply = [servedWord(t.replyClassification), servedWord(t.replyKind)].filter(Boolean).join(" · ");
  return (
    <>
      <tr className={`k-row cursor-pointer align-top ${open ? "k-selected" : ""}`} onClick={onToggle} aria-expanded={open}>
        <td className={`${TD} max-w-[360px]`}>
          <span className="k-fg3 block text-[11px]">
            {threadKindWord(t.kind)}
            {t.transport ? ` · ${t.transport}` : ""}
          </span>
          <span className="block truncate" title={t.subject ?? undefined}>
            {t.subject ?? <span className="k-fg3">No subject</span>}
          </span>
        </td>
        <td className={TD}>
          {t.accountEmail ? <EntityLink base={base} kind="account" id={t.accountEmail} /> : (mono(t.mailboxLogin) ?? <Dash />)}
          {t.mailboxLogin && t.accountEmail && t.mailboxLogin !== t.accountEmail && <span className="k-fg3 block text-[11px]">via {t.mailboxLogin}</span>}
        </td>
        <td className={`${TD} k-mono max-w-[240px] truncate text-[12px]`} title={t.counterparty ?? undefined}>
          {t.counterparty ?? <Dash />}
        </td>
        <td className={TD}>
          <span className="block text-[12px]">{servedWord(t.deliveryStatus) ?? <Dash />}</span>
          {reply && <span className="k-fg3 block text-[11px]">{reply}</span>}
          {t.placement && <Placement placement={t.placement} />}
        </td>
        <td className={TDR}>
          {n(t.messageCount)}
          <span className="k-fg3 block text-[11px]">
            {n(t.outboundCount)} out · {n(t.inboundCount)} in
          </span>
        </td>
        <td className={`${TDR} k-mono k-fg2 whitespace-nowrap text-[12px]`}>{when(t.lastAt) ?? <Dash />}</td>
      </tr>
      {open && <ThreadDetail base={base} t={t} />}
    </>
  );
}

export function ThreadsPage({ base }: { base: string }) {
  const [applied, setApplied] = useState<ThreadFilters>({});
  const [cursor, setCursor] = useState<string | null>(null);
  const [rows, setRows] = useState<OpsThread[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const query = useMemo(() => threadsQuery(applied, cursor), [applied, cursor]);
  const q = useAuthQuery(["staffOpsThreads", query], () => getStaffOpsThreads(query), ONCE);

  // Page one REPLACES the list (a new filter set); a later page appends, de-duplicated. A
  // placeholder (the previous key's answer, kept by the global keepPreviousData) is never taken.
  useEffect(() => {
    if (!q.data || q.isPlaceholderData) return;
    const page = q.data.threads;
    setRows((prev) => (cursor === null ? page.slice() : appendThreads(prev, page)));
  }, [q.data, q.isPlaceholderData, cursor]);

  const apply = (next: ThreadFilters) => {
    setApplied(next);
    setCursor(null);
    setRows([]);
    setOpen(null);
  };
  const settled = !!q.data && !q.isPlaceholderData;
  const nextCursor = settled ? q.data!.nextCursor : null;
  const firstPagePending = rows.length === 0 && !settled && !q.isError;

  return (
    <div className="space-y-6">
      <section>
        <Filters applied={applied} onApply={apply} />
      </section>
      <section>
        <SectionTitle count={rows.length || null} right={<span>{hasActiveFilters(applied) ? "Filtered" : "Everything"}, newest activity first</span>}>
          Threads
        </SectionTitle>
        {q.isError && rows.length === 0 ? (
          <Failed what="the threads" />
        ) : firstPagePending ? (
          <Loading />
        ) : rows.length === 0 ? (
          <div className="k-card">
            <EmptyNote>No thread matches these filters.</EmptyNote>
          </div>
        ) : (
          <>
            <Table
              head={
                <>
                  <th className={TH}>Thread</th>
                  <th className={TH}>Sending address</th>
                  <th className={TH}>Counterparty</th>
                  <th className={TH}>Outcome</th>
                  <th className={THR}>Emails</th>
                  <th className={THR}>Last activity</th>
                </>
              }
            >
              {rows.map((t) => (
                <ThreadRow key={t.threadId} base={base} t={t} open={open === t.threadId} onToggle={() => setOpen(open === t.threadId ? null : t.threadId)} />
              ))}
            </Table>
            <div className="k-fg3 flex items-center justify-between px-1 pt-2 text-[12px] tabular-nums">
              <span>
                {n(rows.length)} thread{rows.length === 1 ? "" : "s"} loaded
                {settled && !nextCursor ? ", end of the list" : ""}
              </span>
              {q.isError ? (
                <span>Could not read the next page.</span>
              ) : (
                nextCursor && (
                  <button type="button" className="k-btn-ghost h-6 px-2 text-[12px]" onClick={() => setCursor(nextCursor)}>
                    Show more
                  </button>
                )
              )}
              {!settled && rows.length > 0 && !q.isError && <span>Loading more</span>}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
