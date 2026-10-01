"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getPersonTimeline, listPeople } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { POLL_INTERVAL } from "@/lib/query-options";
import { formatCount } from "@/lib/format-number";
import { friendlyDateTime, timeAgo } from "@/lib/friendly-datetime";
import {
  PEOPLE_PAGE_SIZE,
  channelLabel,
  personChannels,
  personName,
  sourceLabel,
  sourceLine,
  stateLabel,
  timelineSourceNote,
  type Person,
  type PersonTimelineItem,
} from "@/lib/people-conversations";
import { EmptyNote, Initials, Shimmer } from "@/components/v2/ui";
import { useRowKeys } from "@/components/v2/records";

/** The thread reads every source live on each call, so it refreshes slower than the list. */
const TIMELINE_POLL = 60_000;

/** A message longer than this opens folded, so one long email does not bury the thread. */
const FOLD_AT = 600;

/**
 * Conversations: everyone this brand is in conversation with, on any channel, as one
 * inbox. The list is crm-service's merged people (its order, its totals, one state per
 * person); opening a person reads their whole exchange across Gmail, cold email,
 * messaging apps and their CRM as ONE thread, oldest first. Read-only: nothing here
 * writes back to any of those tools.
 */
export function V2ConversationsView({ brandId }: { brandId: string }) {
  const isBeta = useIsBetaUser();
  const params = useSearchParams();
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [cursor, setCursor] = useState(-1);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const openKey = params.get("person");

  const listQ = useAuthQuery(
    ["people", brandId, page],
    () => listPeople(brandId, { limit: PEOPLE_PAGE_SIZE, offset: page * PEOPLE_PAGE_SIZE }),
    { enabled: isBeta, refetchInterval: POLL_INTERVAL },
  );
  const list = listQ.data ?? null;
  const people = list?.people ?? null;

  const open = (p: Person) => {
    const next = new URLSearchParams(params.toString());
    next.set("person", p.personKey);
    router.replace(`?${next.toString()}`, { scroll: false });
  };
  useRowKeys({
    count: people?.length ?? 0,
    cursor,
    setCursor,
    onOpen: (i) => people?.[i] && open(people[i]),
    searchRef,
  });

  if (!isBeta) {
    return (
      <div className="k-card">
        <EmptyNote>This page is still in beta and is not open on your account yet.</EmptyNote>
      </div>
    );
  }

  // Answered once (success or failure): a poll on a failed read must not repaint a skeleton.
  if (!listQ.isFetchedAfterMount && !list) return <ListShimmer />;
  if (!list) {
    return (
      <div className="k-card">
        <EmptyNote>We could not load your conversations. Retrying.</EmptyNote>
      </div>
    );
  }

  const building = list.scope.status === "building" || list.scope.status === "pending";
  const pages = Math.max(1, Math.ceil(list.total / PEOPLE_PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        <section className="k-card flex max-h-[calc(100vh-220px)] min-h-[420px] flex-col overflow-hidden">
          <header className="k-line-subtle flex h-10 shrink-0 items-center justify-between border-b px-4">
            <span className="k-label">People</span>
            <span className="k-fg3 text-[12px] tabular-nums">{formatCount(list.total)}</span>
          </header>
          <div className="k-scroll min-h-0 flex-1 overflow-y-auto">
            {people && people.length > 0 ? (
              <ul>
                {people.map((p, i) => (
                  <PersonRow
                    key={p.personKey}
                    person={p}
                    selected={p.personKey === openKey}
                    cursor={i === cursor}
                    onOpen={() => open(p)}
                    onHover={() => setCursor(i)}
                  />
                ))}
              </ul>
            ) : building ? (
              <EmptyNote>We are gathering your conversations for the first time. This takes a few minutes.</EmptyNote>
            ) : (
              <EmptyNote>Nobody in conversation yet. Connect a source below to see your people here.</EmptyNote>
            )}
          </div>
          <footer className="k-fg3 k-line-subtle flex h-10 shrink-0 items-center justify-between border-t px-4 text-[12px] tabular-nums">
            <span>
              Page {page + 1} of {pages}
            </span>
            <span className="flex items-center gap-1.5">
              <button type="button" className="k-btn h-6 px-2 text-[12px]" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <button type="button" className="k-btn h-6 px-2 text-[12px]" disabled={list.nextOffset == null} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </span>
          </footer>
        </section>

        <section className="k-card flex max-h-[calc(100vh-220px)] min-h-[420px] flex-col overflow-hidden">
          {openKey ? (
            <Thread brandId={brandId} personKey={openKey} />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <EmptyNote>Pick a person to read the whole conversation, every channel in one thread.</EmptyNote>
            </div>
          )}
        </section>
      </div>

      <SourcesStrip sources={list.sources} lastBuiltAt={list.scope.lastBuiltAt} lastError={list.scope.status === "error" ? list.scope.lastError : null} />
    </div>
  );
}

function PersonRow({
  person,
  selected,
  cursor,
  onOpen,
  onHover,
}: {
  person: Person;
  selected: boolean;
  cursor: boolean;
  onOpen: () => void;
  onHover: () => void;
}) {
  const name = personName(person);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        onMouseEnter={onHover}
        aria-current={selected ? "true" : undefined}
        className={`k-row k-line-subtle flex w-full items-start gap-3 border-b px-4 py-2.5 text-left ${selected || cursor ? "k-selected" : ""}`}
      >
        <Initials name={name} size={28} round />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[13px] font-medium">{name}</span>
            {person.lastActivityAt && (
              <span className="k-fg3 ml-auto shrink-0 text-[12px] tabular-nums">{timeAgo(person.lastActivityAt)}</span>
            )}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="k-chip">{stateLabel(person.state)}</span>
            {personChannels(person).map((c) => (
              <span key={c} className="k-fg3 text-[12px]">
                {channelLabel(c)}
              </span>
            ))}
            {person.company && <span className="k-fg3 truncate text-[12px]">· {person.company}</span>}
          </span>
        </span>
      </button>
    </li>
  );
}

function Thread({ brandId, personKey }: { brandId: string; personKey: string }) {
  const q = useAuthQuery(["personTimeline", brandId, personKey], () => getPersonTimeline(brandId, personKey), {
    refetchInterval: TIMELINE_POLL,
  });
  // Oldest first, so the latest exchange is at the bottom: open there, as any inbox does.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const itemCount = q.data?.items.length ?? 0;
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [personKey, itemCount]);
  if (!q.isFetchedAfterMount && !q.data) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 5 }, (_, i) => (
          <Shimmer key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }
  if (!q.data) return <EmptyNote>We could not load this conversation. Retrying.</EmptyNote>;

  const { person, items, sources } = q.data;
  const notes = sources.map(timelineSourceNote).filter((n): n is string => n !== null);
  const name = personName(person);
  return (
    <>
      <header className="k-line-subtle shrink-0 border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Initials name={name} size={32} round />
          <div className="min-w-0">
            <h2 className="truncate text-[14px] font-semibold">{name}</h2>
            <p className="k-fg3 truncate text-[12px]">
              {[...person.emails, ...person.phones].join(" · ") || "—"}
            </p>
          </div>
          <span className="k-chip ml-auto shrink-0">{stateLabel(person.state)}</span>
        </div>
      </header>
      <div ref={scrollRef} className="k-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {items.length === 0 ? (
          <EmptyNote>No message or event with this person on any connected source.</EmptyNote>
        ) : (
          items.map((it, i) => <ThreadItem key={i} item={it} />)
        )}
      </div>
      {notes.length > 0 && (
        <footer className="k-fg3 k-line-subtle shrink-0 space-y-0.5 border-t px-4 py-2.5 text-[12px]">
          {notes.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </footer>
      )}
    </>
  );
}

function ThreadItem({ item }: { item: PersonTimelineItem }) {
  const meta = [
    channelLabel(item.channel),
    item.source !== "matrix" && item.channel !== "email" ? sourceLabel(item.source) : null,
    item.at ? friendlyDateTime(item.at) : "No date",
  ]
    .filter(Boolean)
    .join(" · ");

  if (item.kind === "event") {
    return (
      <div className="k-fg2 flex items-center gap-2 text-[12px]">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--data-teal)]" aria-hidden="true" />
        <span className="font-medium">{item.event ? stateLabel(item.event.step) : (item.subject ?? "Event")}</span>
        <span className="k-fg3">{meta}</span>
      </div>
    );
  }

  return <Message item={item} meta={meta} />;
}

function Message({ item, meta }: { item: PersonTimelineItem; meta: string }) {
  const [open, setOpen] = useState(false);
  const outbound = item.direction === "outbound";
  const long = (item.text?.length ?? 0) > FOLD_AT;
  return (
    <article className={`max-w-[85%] rounded-lg px-3 py-2 ${outbound ? "k-inset ml-auto" : "k-panel"}`}>
      <p className="k-fg3 truncate text-[12px]">
        {item.from ?? (outbound ? "You" : "Them")} · {meta}
      </p>
      {item.subject && <p className="mt-1 text-[13px] font-medium">{item.subject}</p>}
      {item.text ? (
        <>
          <p className={`mt-1 whitespace-pre-wrap break-words text-[13px] leading-5 ${long && !open ? "line-clamp-[10]" : ""}`}>{item.text}</p>
          {long && (
            <button type="button" className="k-btn-ghost mt-1 h-6 px-1.5 text-[12px]" onClick={() => setOpen((o) => !o)}>
              {open ? "Show less" : "Show all"}
            </button>
          )}
        </>
      ) : (
        <p className="k-fg4 mt-1 text-[13px]">—</p>
      )}
    </article>
  );
}

function SourcesStrip({
  sources,
  lastBuiltAt,
  lastError,
}: {
  sources: Parameters<typeof sourceLine>[0][];
  lastBuiltAt: string | null;
  lastError: string | null;
}) {
  const TONE: Record<string, string> = {
    ok: "bg-[var(--data-teal)]",
    off: "border-[1.5px] border-[var(--fg-3)]",
    failed: "bg-[var(--data-rose)]",
    pending: "bg-[var(--data-amber)]",
  };
  return (
    <div className="k-fg3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px]">
      {sources.map((s) => {
        const line = sourceLine(s);
        return (
          <span key={s.source} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${TONE[line.tone]}`} aria-hidden="true" />
            {line.text}
          </span>
        );
      })}
      <span className="ml-auto">
        {lastError ? `Last refresh failed: ${lastError}` : lastBuiltAt ? `Refreshed ${timeAgo(lastBuiltAt)}` : null}
      </span>
    </div>
  );
}

function ListShimmer() {
  return (
    <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
      <div className="k-card space-y-2 p-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Shimmer key={i} className="h-10 w-full" />
        ))}
      </div>
      <div className="k-card min-h-[420px]" />
    </div>
  );
}
