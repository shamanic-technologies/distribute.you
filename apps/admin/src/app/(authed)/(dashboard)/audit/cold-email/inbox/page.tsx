"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getOpsMessageBody,
  getOpsMessages,
  getOpsThreads,
  type OpsMessage,
  type OpsMessageBody,
  type OpsMessages,
  type OpsThread,
  type OpsThreads,
} from "@/lib/api";
import { Skeleton } from "@/components/skeleton";
import {
  PageHeader,
  PanelGroup,
  PanelRow,
  Section,
  num,
  utc,
} from "@/components/cold-email/primitives";
import {
  appendPage,
  buildMessagesQuery,
  buildThreadsQuery,
  hasActiveFilters,
  INBOX_DIRECTIONS,
  INBOX_PAGE_SIZE,
  messageKindLabel,
  threadReadingOrder,
  type InboxFilters,
} from "@/lib/instantly-ops";

/**
 * Cold email — Inbox.
 *
 * Every email of every typology the estate sent or received: outreach, manual
 * replies, warmup, warmup replies, seed tests, replies, auto-replies, bounces.
 *
 * ⚠️ NO POLL. The unfiltered thread set is ~70k rows server-side and this page
 * accumulates pages behind a cursor, so a background refetch of page 1 would
 * throw away every page the reader has loaded. It refetches when the filters
 * change and on window focus, which is what a browsing surface wants.
 *
 * ⚠️ `limit` is REQUIRED downstream. `buildThreadsQuery` always sets it; there is
 * no shape here that asks for "all".
 */

const THREAD_KINDS = ["outreach", "warmup_reply", "warmup", "seed"] as const;
const MESSAGE_PLACEMENTS = ["inbox", "spam", "missing"] as const;

function KindPill({ kind }: { kind: string }) {
  const tint =
    kind === "outreach"
      ? "bg-indigo-100 text-indigo-800"
      : kind === "bounce"
        ? "bg-red-100 text-red-800"
        : kind === "reply" || kind === "manual_reply"
          ? "bg-emerald-100 text-emerald-800"
          : kind === "auto_reply"
            ? "bg-gray-200 text-gray-700"
            : kind === "seed"
              ? "bg-sky-100 text-sky-800"
              : "bg-amber-100 text-amber-800";
  return (
    <span className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${tint}`}>
      {messageKindLabel(kind)}
    </span>
  );
}

function DirectionMark({ direction }: { direction: string }) {
  const out = direction === "out";
  return (
    <span
      title={out ? "Outbound" : "Inbound"}
      className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
        out ? "bg-gray-100 text-gray-600" : "bg-emerald-100 text-emerald-800"
      }`}
    >
      {out ? "out" : "in"}
    </span>
  );
}

/**
 * One message's body, fetched only when the reader opens it.
 *
 * Warmup and seed bodies are NOT stored, so both halves come back null and the
 * producer names the table it looked in. That is stated rather than rendered as
 * an empty box — "we do not keep this" and "this message was empty" are
 * different facts.
 */
function MessageBody({ id }: { id: string }) {
  const { data, isPending, isError, error } = useAuthQuery<OpsMessageBody>(
    ["opsMessageBody", id],
    () => getOpsMessageBody(id),
  );

  if (isError) {
    return (
      <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3">
        <p className="text-xs font-medium text-red-700">Couldn&apos;t load this message body.</p>
        <p className="mt-1 text-[11px] text-red-500">{error?.message ?? "Unknown error"}</p>
      </div>
    );
  }
  if (isPending) return <Skeleton className="mt-2 h-24 w-full rounded" />;

  if (data.html === null && data.text === null) {
    return (
      <p className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
        No body stored for this message. The producer read {data.source}, which keeps the send record
        without the copy.
      </p>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
      {data.html !== null ? (
        // The raw HTML is shown as TEXT rather than rendered: this is a staff
        // audit surface over third-party mail, and rendering a counterparty's
        // markup in the console is a script-execution surface we have no reason
        // to open.
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-gray-700">
          {data.html}
        </pre>
      ) : (
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs text-gray-700">
          {data.text}
        </pre>
      )}
      <p className="mt-2 text-[10px] uppercase tracking-wide text-gray-400">source: {data.source}</p>
    </div>
  );
}

function MessageRow({ message }: { message: OpsMessage }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-b border-gray-100 py-3 last:border-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <DirectionMark direction={message.direction} />
        <KindPill kind={message.kind} />
        {message.transport && (
          <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
            {message.transport}
          </span>
        )}
        {message.step !== null && (
          <span className="text-[10px] tabular-nums text-gray-400">step {num(message.step)}</span>
        )}
        {message.placement && (
          <span className="text-[10px] text-gray-400">landed in {message.placement}</span>
        )}
        {message.outcome && <span className="text-[10px] text-gray-400">{message.outcome}</span>}
        <span className="ml-auto text-[10px] tabular-nums text-gray-400">{utc(message.occurredAt)}</span>
      </div>
      <p className="mt-1 break-all text-sm text-gray-900">{message.subject ?? "(no subject)"}</p>
      <p className="mt-0.5 break-all text-[11px] text-gray-500">
        {message.direction === "out"
          ? `${message.accountEmail ?? "—"} → ${message.counterparty ?? "—"}`
          : `${message.counterparty ?? "—"} → ${message.accountEmail ?? "—"}`}
      </p>
      {(message.spfPass !== null || message.dkimPass !== null || message.dmarcPass !== null) && (
        <p className="mt-0.5 flex flex-wrap gap-1.5 text-[10px] text-gray-400">
          {(
            [
              ["SPF", message.spfPass],
              ["DKIM", message.dkimPass],
              ["DMARC", message.dmarcPass],
            ] as const
          ).map(([label, pass]) =>
            pass === null ? null : (
              <span key={label} className={pass ? "text-emerald-600" : "text-red-600"}>
                {label} {pass ? "pass" : "fail"}
              </span>
            ),
          )}
        </p>
      )}
      {message.contextRef && (
        <p className="mt-0.5 text-[10px] text-gray-400">context: {message.contextRef}</p>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-1.5 rounded-md border border-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50"
      >
        {open ? "Hide body" : "Read body"}
      </button>
      {open && <MessageBody id={message.id} />}
    </li>
  );
}

function ThreadPanel({ thread, onClose }: { thread: OpsThread; onClose: () => void }) {
  // One page of messages per thread. A thread of more than 200 messages does not
  // exist in this estate; if one ever does, the count line says so rather than
  // the list silently truncating.
  const query = useMemo(() => buildMessagesQuery({ threadId: thread.threadId }, { limit: 200 }), [thread.threadId]);
  const { data, isPending, isError, error } = useAuthQuery<OpsMessages>(
    ["opsMessages", query],
    () => getOpsMessages(query),
  );

  const ordered = useMemo(() => (data ? threadReadingOrder(data.messages) : []), [data]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/20" />
      <div className="relative flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-200 bg-white p-5">
          <div className="min-w-0">
            <p className="break-all text-sm font-semibold text-gray-900">
              {thread.subject ?? "(no subject)"}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-1.5">
              <KindPill kind={thread.kind} />
              <span className="break-all text-xs text-gray-400">
                {thread.accountEmail ?? "—"} ↔ {thread.counterparty ?? "—"}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close panel"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-3 p-5">
          {/* The linked facts: the address, its mailbox, the domain it sits on,
              the delivery verdict, and the caller that launched the sequence. */}
          <PanelGroup title="Who and what">
            <PanelRow label="Sending address">{thread.accountEmail ?? "—"}</PanelRow>
            <PanelRow label="Mailbox">{thread.mailboxLogin ?? "—"}</PanelRow>
            <PanelRow label="Domain">
              {thread.accountEmail?.split("@")[1] ?? "—"}
            </PanelRow>
            <PanelRow label="Transport">{thread.transport ?? "—"}</PanelRow>
            <PanelRow label="Counterparty">{thread.counterparty ?? "—"}</PanelRow>
            <PanelRow label="Lead">{thread.leadEmail ?? "—"}</PanelRow>
          </PanelGroup>

          <PanelGroup title="Outcome">
            <PanelRow label="Delivery">{thread.deliveryStatus ?? "—"}</PanelRow>
            <PanelRow label="Reply classification">{thread.replyClassification ?? "—"}</PanelRow>
            <PanelRow label="Reply kind">{thread.replyKind ?? "—"}</PanelRow>
            <PanelRow label="Placement">{thread.placement ?? "—"}</PanelRow>
            <PanelRow label="Messages">
              {num(thread.messageCount)} ({num(thread.outboundCount)} out, {num(thread.inboundCount)} in)
            </PanelRow>
            <PanelRow label="First activity">{utc(thread.firstAt)}</PanelRow>
            <PanelRow label="Last activity">{utc(thread.lastAt)}</PanelRow>
          </PanelGroup>

          <PanelGroup title="Caller">
            <PanelRow label="Sequence">
              <span className="break-all font-mono text-[11px]">{thread.instantlyCampaignId ?? "—"}</span>
            </PanelRow>
            <PanelRow label="Org">
              <span className="break-all font-mono text-[11px]">{thread.orgId ?? "—"}</span>
            </PanelRow>
            <PanelRow label="Campaign">
              <span className="break-all font-mono text-[11px]">{thread.campaignId ?? "—"}</span>
            </PanelRow>
            <PanelRow label="Brands">
              <span className="break-all font-mono text-[11px]">
                {thread.brandIds.length ? thread.brandIds.join(", ") : "—"}
              </span>
            </PanelRow>
          </PanelGroup>

          <PanelGroup title={`Messages${data ? ` (${num(ordered.length)})` : ""}`}>
            {isError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-xs font-medium text-red-700">Couldn&apos;t load this thread.</p>
                <p className="mt-1 text-[11px] text-red-500">{error?.message ?? "Unknown error"}</p>
              </div>
            ) : isPending ? (
              <div className="flex flex-col gap-2 py-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded" />
                ))}
              </div>
            ) : ordered.length === 0 ? (
              <p className="py-2 text-xs text-gray-400">No message rows for this thread.</p>
            ) : (
              <ol className="flex flex-col">
                {ordered.map((m) => (
                  <MessageRow key={m.id} message={m} />
                ))}
              </ol>
            )}
          </PanelGroup>
        </div>
      </div>
    </div>
  );
}

const EMPTY_FILTERS: InboxFilters = {};

export default function ColdEmailInboxPage() {
  // Two copies of the filters on purpose: `draft` is what the reader is typing,
  // `applied` is what the wire carries. Firing a request per keystroke on a
  // 70k-row list is what the Apply button avoids.
  const [draft, setDraft] = useState<InboxFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<InboxFilters>(EMPTY_FILTERS);
  const [cursor, setCursor] = useState<string | null>(null);
  const [rows, setRows] = useState<OpsThread[]>([]);
  const [selected, setSelected] = useState<OpsThread | null>(null);

  const query = useMemo(
    () => buildThreadsQuery(applied, { limit: INBOX_PAGE_SIZE, cursor }),
    [applied, cursor],
  );

  const { data, isPending, isFetching, isError, error } = useAuthQuery<OpsThreads>(
    ["opsThreads", query],
    () => getOpsThreads(query),
  );

  // Accumulate pages. A page fetched at `cursor === null` REPLACES the list (it
  // is page one of a new filter set); every later page appends, de-duplicated by
  // thread id because the producer pages over a moving index.
  useEffect(() => {
    if (!data) return;
    setRows((prev) =>
      cursor === null ? data.threads.slice() : appendPage(prev, data.threads, (t) => t.threadId),
    );
  }, [data, cursor]);

  function apply(next: InboxFilters) {
    setApplied(next);
    setCursor(null);
    setRows([]);
    setSelected(null);
  }

  const narrowed = hasActiveFilters(applied);
  const nextCursor = data?.nextCursor ?? null;

  const field =
    "w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 placeholder:text-gray-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100";

  const set = (patch: Partial<InboxFilters>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Cold email: inbox"
        blurb="Every thread the estate sent or received, of every typology. Filter it down, page through it, open a thread to read its messages in order with the body fetched on demand."
      />

      <Section
        title="Filters"
        blurb="Nothing is sent blank: a field left empty is left off the request. Applying resets to the first page."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            apply(draft);
          }}
          className="flex flex-col gap-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">Kind</span>
              <select
                className={field}
                value={draft.kind ?? ""}
                onChange={(e) => set({ kind: e.target.value || undefined })}
              >
                <option value="">Any</option>
                {THREAD_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {messageKindLabel(k)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">Direction</span>
              <select
                className={field}
                value={draft.direction ?? ""}
                onChange={(e) => set({ direction: e.target.value || undefined })}
              >
                <option value="">Any</option>
                {INBOX_DIRECTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d === "in" ? "Inbound" : "Outbound"}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">Has a reply</span>
              <select
                className={field}
                value={draft.hasInbound === undefined ? "" : draft.hasInbound ? "true" : "false"}
                onChange={(e) =>
                  set({ hasInbound: e.target.value === "" ? undefined : e.target.value === "true" })
                }
              >
                <option value="">Any</option>
                <option value="true">Replied</option>
                <option value="false">No reply</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">Placement</span>
              <select
                className={field}
                value={draft.placement ?? ""}
                onChange={(e) => set({ placement: e.target.value || undefined })}
              >
                <option value="">Any</option>
                {MESSAGE_PLACEMENTS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">Sending address</span>
              <input
                className={field}
                value={draft.account ?? ""}
                onChange={(e) => set({ account: e.target.value })}
                placeholder="paisley@example.com"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">Mailbox</span>
              <input
                className={field}
                value={draft.mailbox ?? ""}
                onChange={(e) => set({ mailbox: e.target.value })}
                placeholder="login@example.com"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">Domain</span>
              <input
                className={field}
                value={draft.domain ?? ""}
                onChange={(e) => set({ domain: e.target.value })}
                placeholder="example.com"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">Counterparty</span>
              <input
                className={field}
                value={draft.counterparty ?? ""}
                onChange={(e) => set({ counterparty: e.target.value })}
                placeholder="prospect@company.com"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">Org id</span>
              <input
                className={field}
                value={draft.orgId ?? ""}
                onChange={(e) => set({ orgId: e.target.value })}
                placeholder="uuid"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">Campaign id</span>
              <input
                className={field}
                value={draft.campaignId ?? ""}
                onChange={(e) => set({ campaignId: e.target.value })}
                placeholder="uuid"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">Since</span>
              <input
                type="date"
                className={field}
                value={draft.since ?? ""}
                onChange={(e) => set({ since: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">Until</span>
              <input
                type="date"
                className={field}
                value={draft.until ?? ""}
                onChange={(e) => set({ until: e.target.value })}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(EMPTY_FILTERS);
                apply(EMPTY_FILTERS);
              }}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Clear
            </button>
            <span className="text-xs text-gray-400">
              {narrowed ? "Filtered" : "Everything, newest activity first"} · {num(INBOX_PAGE_SIZE)} per
              page
            </span>
          </div>
        </form>
      </Section>

      <Section
        title="Threads"
        blurb="One row per thread, newest activity first. Open a row to read its messages."
        isPending={isPending && rows.length === 0}
        isError={isError}
        error={error}
        empty={!isPending && !isError && rows.length === 0 ? "No thread matches these filters." : null}
      >
        {rows.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3 font-medium">Thread</th>
                    <th className="py-2 px-3 font-medium">Sending address</th>
                    <th className="py-2 px-3 font-medium">Counterparty</th>
                    <th className="py-2 px-3 font-medium">Outcome</th>
                    <th className="py-2 px-3 text-right font-medium">Messages</th>
                    <th className="py-2 pl-3 text-right font-medium">Last activity</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr
                      key={t.threadId}
                      onClick={() => setSelected(t)}
                      className="cursor-pointer border-b border-gray-100 last:border-0 align-top hover:bg-gray-50"
                    >
                      <td className="py-2.5 pr-3">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <KindPill kind={t.kind} />
                          {t.transport && (
                            <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                              {t.transport}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block break-all font-medium text-gray-900">
                          {t.subject ?? "(no subject)"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="break-all text-gray-700">{t.accountEmail ?? "—"}</span>
                        {t.mailboxLogin && t.mailboxLogin !== t.accountEmail && (
                          <span className="block break-all text-[10px] text-gray-400">
                            via {t.mailboxLogin}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 break-all text-gray-700">{t.counterparty ?? "—"}</td>
                      <td className="py-2.5 px-3">
                        <span className="text-gray-700">{t.deliveryStatus ?? "—"}</span>
                        {(t.replyClassification || t.replyKind) && (
                          <span className="block text-[10px] text-gray-400">
                            {[t.replyClassification, t.replyKind].filter(Boolean).join(" · ")}
                          </span>
                        )}
                        {t.placement && (
                          <span className="block text-[10px] text-gray-400">landed in {t.placement}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">
                        {num(t.messageCount)}
                        <span className="block text-[10px] text-gray-400">
                          {num(t.outboundCount)} out · {num(t.inboundCount)} in
                        </span>
                      </td>
                      <td className="py-2.5 pl-3 text-right tabular-nums text-gray-500">
                        {utc(t.lastAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {nextCursor === null ? (
                <span className="text-xs text-gray-400">
                  End of the list. {num(rows.length)} thread{rows.length === 1 ? "" : "s"} loaded.
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={isFetching}
                    onClick={() => setCursor(nextCursor)}
                    className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-wait"
                  >
                    {isFetching ? "Loading…" : "Load more"}
                  </button>
                  <span className="text-xs text-gray-400">
                    {num(rows.length)} loaded. The list is paged with a cursor; it is never fetched whole.
                  </span>
                </>
              )}
            </div>
          </>
        )}
      </Section>

      {selected && <ThreadPanel thread={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
