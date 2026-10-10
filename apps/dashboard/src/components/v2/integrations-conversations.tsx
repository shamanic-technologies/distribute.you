"use client";

import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { ApiError, getLeadTimeline, getPersonTimeline, listPeople, setCrmPairingRuling } from "@/lib/api";
import { rulingErrorMessage } from "@/lib/crm-pairings";
import { ownQueryData } from "@/lib/own-query-data";
import { useAuthQuery, useOrgQueryGate } from "@/lib/use-auth-query";
import { POLL_INTERVAL } from "@/lib/query-options";
import { formatCount } from "@/lib/format-number";
import { friendlyDateTime, timeAgo } from "@/lib/friendly-datetime";
import {
  PEOPLE_PAGE_SIZE,
  personLeadRowId,
  personName,
  personStatusLabel,
  possibleLeadHint,
  possibleLeadName,
  possibleLeadRuledLine,
  type PossibleLead,
  sourceLine,
  timelineSourceNote,
  type Person,
  type PersonTimelineItem,
} from "@/lib/people-conversations";
import { EmptyNote, Initials, Shimmer } from "@/components/v2/ui";
import { CompanyMark } from "@/components/v2/people-bits";
import { parseFrom, personCompanyDomain, personSourceMarks, sourceMark, type SourceMark } from "@/lib/conversation-sources";
import { RecordsToolbar, useRowKeys } from "@/components/v2/records";
import { timelineTag, type TimelineTag } from "@/lib/timeline-tags";
import { conversationItemTag, conversationSourceWord, joinConversationLabels, liveItems, type ConversationItem } from "@/lib/conversation-timeline";
import { ConversationTags } from "@/components/v2/conversation-timeline";
import { useSelectedOfferIfAny } from "@/components/v2/selected-offer";
import { ICON_PATH, TONE_COLOR, TagChip } from "@/components/v2/tag-chip";
import { LEAD_FAMILIES, familyFilter, familyLook, type FamilyFilter } from "@/lib/lead-families";

// The publishable logo.dev token the dashboard already ships (company-logo.tsx).
const LOGO_DEV_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";

/** The thread reads every source live on each call, so it refreshes slower than the list. */
const TIMELINE_POLL = 60_000;

/** How many threads, from the top of the list, load before anyone clicks. */
const PRELOAD_TOP = 8;

const timelineKey = (brandId: string, personKey: string) => ["personTimeline", brandId, personKey] as const;
const factsKey = (leadRowId: string | null, brandId: string, offerId: string | null) =>
  ["leadTimeline", leadRowId, brandId, offerId] as const;

/** How long the typing pauses before the search is asked. */
const SEARCH_DEBOUNCE_MS = 300;

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
  const params = useSearchParams();
  // A click (a person, a family button) only rewrites the URL: no Next navigation, so no
  // round trip to the page server before the screen changes (owner 2026-10-08: "tout est
  // trop lent"). Next keeps useSearchParams in step with the native history call, but
  // only when the state passed is NOT its own: handed the current entry's state, Next
  // reads the call as one of its own and skips the sync, so the URL changed and the
  // panel stayed on "Pick a person" (prod 2026-10-10). Pass null; Next copies its state.
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(window.location.search);
    next.set(key, value);
    window.history.replaceState(null, "", `?${next.toString()}`);
  };
  const [cursor, setCursor] = useState(-1);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const openKey = params.get("person");
  // The search runs at crm-service (names, addresses, companies AND message text across
  // every page), asked once the typing pauses.
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  // Filter buttons (owner 2026-10-08): All by default. The families and their counts are
  // crm-service's (features-service's verdict).
  const family = familyFilter(params.get("family"));
  const pickFamily = (f: FamilyFilter) => setParam("family", f);

  // The first rows load at once, the next ones as the end of the list scrolls into view
  // (owner 2026-10-08: no pages to click through).
  const gate = useOrgQueryGate();
  const listQuery = (f: FamilyFilter) => ({
    queryKey: ["people", brandId, "scroll", q, f],
    queryFn: ({ pageParam }: { pageParam: number }) =>
      listPeople(brandId, { limit: PEOPLE_PAGE_SIZE, offset: pageParam, q, family: f === "all" ? undefined : f }),
    initialPageParam: 0,
    getNextPageParam: (last: { nextOffset?: number | null }) => last.nextOffset ?? undefined,
  });
  const listQ = useInfiniteQuery({
    ...listQuery(family),
    enabled: gate && !!brandId,
    refetchInterval: POLL_INTERVAL,
  });
  const list = listQ.data?.pages[0] ?? null;
  const families = list?.families ?? null;
  const people = listQ.data ? listQ.data.pages.flatMap((p) => p.people) : null;
  const scrollBox = useRef<HTMLDivElement | null>(null);
  const sentinel = useRef<HTMLLIElement | null>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = listQ;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage();
      },
      { root: scrollBox.current, rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, people?.length]);

  // A thread opens from memory: the top rows' threads load with the list, any other row's
  // as the pointer reaches it. Same key and read as the Thread itself.
  const queryClient = useQueryClient();
  // The other family buttons answer from memory: their first page loads with the page
  // (the plain list only; a search asks per family on click).
  const listLoaded = Boolean(list);
  useEffect(() => {
    if (!gate || !brandId || !listLoaded || q) return;
    for (const f of [...LEAD_FAMILIES.map((x) => x.key), "all" as const]) {
      if (f !== family) void queryClient.prefetchInfiniteQuery({ ...listQuery(f), staleTime: POLL_INTERVAL });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate, brandId, q, listLoaded]);
  // The lead-service facts load WITH the thread, keyed on the list row's lead (same key
  // and read as the Thread), never after it.
  const selected = useSelectedOfferIfAny();
  const offerId = selected?.offerId ?? null;
  const offerSettled = selected ? selected.settled : true;
  const preload = (p: Person) => {
    void queryClient.prefetchQuery({
      queryKey: timelineKey(brandId, p.personKey),
      queryFn: () => getPersonTimeline(brandId, p.personKey),
      staleTime: TIMELINE_POLL,
    });
    const leadRowId = personLeadRowId(p);
    if (leadRowId && offerSettled) {
      void queryClient.prefetchQuery({
        queryKey: factsKey(leadRowId, brandId, offerId),
        queryFn: () => getLeadTimeline(leadRowId, { brandId, offerId }),
        staleTime: TIMELINE_POLL,
      });
    }
  };
  const top = (people ?? []).slice(0, PRELOAD_TOP);
  const topKeys = top.map((p) => p.personKey).join("|");
  useEffect(() => {
    if (!gate || !topKeys) return;
    for (const p of top) preload(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate, brandId, topKeys, offerId, offerSettled]);
  // J/K moves the cursor: the row it lands on loads too.
  const cursorPerson = cursor >= 0 ? (people?.[cursor] ?? null) : null;
  useEffect(() => {
    if (gate && cursorPerson) preload(cursorPerson);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate, cursorPerson?.personKey]);

  const open = (p: Person) => setParam("person", p.personKey);
  // The Unibox opens on the person on top (owner 2026-10-08), and a new search on its
  // first result. A person already in the URL (a click, a shared link) is kept.
  const first = listQ.isPlaceholderData ? null : (people?.[0] ?? null);
  const openedForQ = useRef<string | null>(null);
  const listedFor = `${family}|${q}`;
  useEffect(() => {
    if (!first) return;
    const newSearch = openedForQ.current !== null && openedForQ.current !== listedFor;
    openedForQ.current = listedFor;
    if (!openKey || newSearch) open(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first?.personKey, openKey, listedFor]);
  useRowKeys({
    count: people?.length ?? 0,
    cursor,
    setCursor,
    onOpen: (i) => people?.[i] && open(people[i]),
    searchRef,
  });

  // Answered once (success or failure): a poll on a failed read must not repaint a skeleton.
  if (!listQ.isFetchedAfterMount && !list) return <ListShimmer />;
  // A filtered read that fails keeps the page and its buttons (All still works); the
  // unfiltered list failing is the whole page failing.
  if (!list && family === "all") {
    return (
      <div className="k-card">
        <EmptyNote>We could not load your conversations. Retrying.</EmptyNote>
      </div>
    );
  }

  const building = list ? list.scope.status === "building" || list.scope.status === "pending" : false;
  const familyLabel = LEAD_FAMILIES.find((f) => f.key === family)?.label.toLowerCase() ?? "people";

  return (
    <div className="space-y-4 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
      {/* The search runs the whole width, above both cards (owner 2026-10-08). */}
      <div className="shrink-0 [&>div]:p-0 md:[&>div]:p-0 [&_label]:w-auto [&_label]:min-w-[240px] [&_label]:max-w-none [&_label]:flex-1">
        <RecordsToolbar
          search={search}
          onSearch={setSearch}
          placeholder="Search people and messages"
          inputRef={searchRef}
          right={<FamilyButtons value={family} families={families} onPick={pickFamily} />}
        />
      </div>
      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[380px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
        <section className="k-card flex max-h-[calc(100vh-220px)] min-h-[420px] flex-col overflow-hidden lg:max-h-none">
          <header className="k-line-subtle flex h-10 shrink-0 items-center justify-between border-b px-4">
            <span className="k-label">People</span>
            <span className="k-fg3 text-[12px] tabular-nums">{list ? formatCount(list.total) : "—"}</span>
          </header>
          <div ref={scrollBox} className="k-scroll min-h-0 flex-1 overflow-y-auto">
            {people && people.length > 0 ? (
              <ul>
                {people.map((p, i) => (
                  <PersonRow
                    key={p.personKey}
                    person={p}
                    selected={p.personKey === openKey}
                    cursor={i === cursor}
                    onOpen={() => open(p)}
                    onHover={() => {
                      setCursor(i);
                      preload(p);
                    }}
                  />
                ))}
                {hasNextPage && (
                  <li ref={sentinel} className="space-y-2 px-4 py-3" aria-label="Loading more people">
                    <Shimmer className="h-9 w-full" />
                    <Shimmer className="h-9 w-full" />
                  </li>
                )}
              </ul>
            ) : !list ? (
              <EmptyNote>We could not sort people into Hot, Won, Lost and Cold right now. All still lists everyone.</EmptyNote>
            ) : q ? (
              <EmptyNote>No conversation matches &ldquo;{q}&rdquo;.</EmptyNote>
            ) : family !== "all" ? (
              <EmptyNote>No {familyLabel} in your conversations.</EmptyNote>
            ) : building ? (
              <EmptyNote>We are gathering your conversations for the first time. This takes a few minutes.</EmptyNote>
            ) : (
              <EmptyNote>Nobody in conversation yet. Connect a source below to see your people here.</EmptyNote>
            )}
          </div>
        </section>

        <section className="k-card flex max-h-[calc(100vh-220px)] min-h-[420px] flex-col overflow-hidden lg:max-h-none">
          {openKey ? (
            <Thread brandId={brandId} personKey={openKey} listed={people?.find((p) => p.personKey === openKey) ?? null} />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <EmptyNote>Pick a person to read the whole conversation, every channel in one thread.</EmptyNote>
            </div>
          )}
        </section>
      </div>

      {list && (
        <SourcesStrip sources={list.sources} lastBuiltAt={list.scope.lastBuiltAt} lastError={list.scope.status === "error" ? list.scope.lastError : null} />
      )}
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
  const status = personStatusLabel(person);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        onMouseEnter={onHover}
        aria-current={selected ? "true" : undefined}
        className={`k-row k-line-subtle flex w-full items-start gap-3 border-b px-4 py-2.5 text-left ${selected || cursor ? "k-selected" : ""}`}
      >
        <PersonMark name={name} emails={person.emails} size={28} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[13px] font-medium">{name}</span>
            {person.lastActivityAt && (
              <span className="k-fg3 ml-auto shrink-0 text-[12px] tabular-nums">{timeAgo(person.lastActivityAt)}</span>
            )}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            {status && <PersonTag label={status} family={person.family} />}
            {personSourceMarks(person.presences).map((m) => (
              <SourceLogo key={m.key} mark={m} size={14} />
            ))}
            {person.company && <span className="k-fg3 truncate text-[12px]">· {person.company}</span>}
          </span>
          <MatchLine person={person} />
          <PossibleLeadLine person={person} />
        </span>
      </button>
    </li>
  );
}

function Thread({ brandId, personKey, listed }: { brandId: string; personKey: string; listed: Person | null }) {
  const q = useAuthQuery(timelineKey(brandId, personKey), () => getPersonTimeline(brandId, personKey), {
    refetchInterval: TIMELINE_POLL,
  });
  // The conversation at the selected offer: lead-service's labelled facts and its tags, keyed
  // on the lead row whose standing decided this person's state (none = not one of our leads).
  const selected = useSelectedOfferIfAny();
  const offerId = selected?.offerId ?? null;
  const offerSettled = selected ? selected.settled : true;
  // Only THIS person's data: the app-wide placeholder would hand a re-keyed query the last person's.
  const data = ownQueryData(q);
  // The list row already names the lead row, so the facts start with the thread, not after it.
  const leadRowId = data ? personLeadRowId(data.person) : listed ? personLeadRowId(listed) : null;
  const factsQ = useAuthQuery(
    factsKey(leadRowId, brandId, offerId),
    () => getLeadTimeline(leadRowId!, { brandId, offerId }),
    { enabled: Boolean(leadRowId) && offerSettled, refetchInterval: TIMELINE_POLL },
  );
  // No lead row (a CRM-only person) means no lead-service facts, never the previous person's.
  const facts = leadRowId ? ownQueryData(factsQ) : undefined;
  // Oldest first, so the latest exchange is at the bottom: open there, as any inbox does.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const itemCount = data?.items.length ?? 0;
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [personKey, itemCount]);
  if (!q.isFetchedAfterMount && !data) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 5 }, (_, i) => (
          <Shimmer key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }
  if (!data) return <EmptyNote>We could not load this conversation. Retrying.</EmptyNote>;

  const { person, items, sources } = data;
  const notes = sources.map(timelineSourceNote).filter((n): n is string => n !== null);
  const name = personName(person);
  const status = personStatusLabel(person);
  return (
    <>
      <header className="k-line-subtle shrink-0 border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <PersonMark name={name} emails={person.emails} size={32} />
          <div className="min-w-0">
            <h2 className="truncate text-[14px] font-semibold">{name}</h2>
            <p className="k-fg3 truncate text-[12px]">
              {[...person.emails, ...person.phones].join(" · ") || "—"}
            </p>
            <PossibleLeadRulings brandId={brandId} person={person} />
          </div>
          {status && <span className="k-chip ml-auto shrink-0">{status}</span>}
        </div>
        {facts ? (
          <div className="mt-2">
            <ConversationTags tags={facts.tags} />
          </div>
        ) : null}
      </header>
      <div ref={scrollRef} className="k-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {items.length === 0 ? (
          <EmptyNote>No message or event with this person on any connected source.</EmptyNote>
        ) : (
          threadRows(items, facts ? liveItems(facts) : []).map((row, i) =>
            row.fact ? <FactRow key={row.fact.id} fact={row.fact} /> : <ThreadItem key={i} item={row.item} tag={row.tag} />,
          )
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

type ThreadRow =
  | { fact: null; item: PersonTimelineItem; tag: TimelineTag | null; at: string | null }
  | { fact: ConversationItem; item: null; tag: null; at: string | null };

/**
 * The thread, each item carrying lead-service's label: a sent email by the fact it names, any
 * other item by the fact recorded at the same instant; a stored fact no message or event matches (a statement made by hand, a fact
 * from their CRM) is still shown, in its place in time.
 */
function threadRows(items: PersonTimelineItem[], facts: ConversationItem[]): ThreadRow[] {
  const { labels, unmatched } = joinConversationLabels(items, facts);
  const rows: ThreadRow[] = items.map((item, i) => ({ fact: null, item, tag: labels[i], at: item.at }));
  for (const fact of unmatched) {
    const t = fact.occurredAt ? Date.parse(fact.occurredAt) : Number.POSITIVE_INFINITY;
    const at = rows.findIndex((r) => (r.at ? Date.parse(r.at) : Number.POSITIVE_INFINITY) > t);
    rows.splice(at === -1 ? rows.length : at, 0, { fact, item: null, tag: null, at: fact.occurredAt });
  }
  return rows;
}

function FactRow({ fact }: { fact: ConversationItem }) {
  const meta = [conversationSourceWord(fact.source), fact.occurredAt ? friendlyDateTime(fact.occurredAt) : "No date"].join(" · ");
  return (
    <div className="k-fg2 flex items-center gap-2 text-[12px]">
      <TagChip tag={conversationItemTag(fact.label)} />
      <span className="k-fg3">{meta}</span>
      {fact.attributable === false ? <span className="k-fg3">· Not ours</span> : null}
    </div>
  );
}

function ThreadItem({ item, tag }: { item: PersonTimelineItem; tag: TimelineTag | null }) {
  // Where it came from, as a mark and its name: our own sends and visits read as Distribute.
  const mark = sourceMark(item.source, item.channel);
  const meta = [mark.name, item.at ? friendlyDateTime(item.at) : "No date"].join(" · ");

  if (item.kind === "event") {
    return (
      <div className="k-fg2 flex items-center gap-2 text-[12px]">
        <TagChip tag={tag ?? timelineTag(item)} />
        <SourceLogo mark={mark} size={14} />
        <span className="k-fg3">{meta}</span>
      </div>
    );
  }

  return <Message item={item} mark={mark} meta={meta} tag={tag ?? timelineTag(item)} />;
}

/** A person's tag: their state in their family's colour and icon (no family = plain). */
function PersonTag({ label, family }: { label: string; family: string | null | undefined }) {
  const look = familyLook(family);
  if (!look) return <span className="k-chip">{label}</span>;
  return <TagChip tag={{ label, ...look }} />;
}

/** Beside the search: one button per lead family with its served count, then All. */
function FamilyButtons({
  value,
  families,
  onPick,
}: {
  value: FamilyFilter;
  families: { status: string; counts: Record<"won" | "hot" | "lost" | "cold", number> } | null;
  onPick: (f: FamilyFilter) => void;
}) {
  const counts = families && families.status !== "failed" ? families.counts : null;
  return (
    <div role="group" aria-label="Filter by lead family" className="flex flex-wrap items-center gap-1.5">
      {LEAD_FAMILIES.map((f) => {
        const on = value === f.key;
        const color = TONE_COLOR[f.tone];
        return (
          <button
            key={f.key}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(f.key)}
            className="k-btn gap-1.5"
            style={on ? { color, background: `color-mix(in srgb, ${color} 14%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 40%, transparent)` } : undefined}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ color }}>
              <path d={ICON_PATH[f.icon]} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {f.label}
            <span className={`tabular-nums ${on ? "" : "k-fg3"}`}>{counts ? formatCount(counts[f.key]) : "—"}</span>
          </button>
        );
      })}
      <button type="button" aria-pressed={value === "all"} onClick={() => onPick("all")} className={`k-btn ${value === "all" ? "k-selected" : ""}`}>
        All
      </button>
    </div>
  );
}

function Message({ item, mark, meta, tag }: { item: PersonTimelineItem; mark: SourceMark; meta: string; tag: TimelineTag }) {
  // The mark up front is WHO wrote it: the person's company logo (initials without one)
  // on their side, the source's mark on ours. Where it came from rides the meta line.
  const sender = parseFrom(item.from);
  const [open, setOpen] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const outbound = item.direction === "outbound";
  const notCleaned = item.textClean != null && !item.textClean.cleaned;
  const original = item.textClean?.original ?? null;
  const hasOriginal = original != null && original !== item.text;
  const body = showOriginal && hasOriginal ? original : item.text;
  const long = (body?.length ?? 0) > FOLD_AT;
  return (
    <article className={`max-w-[85%] rounded-lg px-3 py-2 ${outbound ? "k-inset ml-auto" : "k-panel"}`}>
      <p className="k-fg3 flex min-w-0 items-center gap-2 text-[12px]">
        {outbound ? (
          <SourceLogo mark={mark} size={16} />
        ) : (
          <PersonMark name={sender.name ?? sender.email ?? "Them"} emails={sender.email ? [sender.email] : []} size={16} />
        )}
        <span className="truncate">{sender.name ?? sender.email ?? (outbound ? "You" : "Them")}</span>
        {/* The address it was written FROM, on every message: a person can write from
            several mailboxes (work, personal), and a name alone hides which one (owner 2026-10-09). */}
        {sender.name && sender.email && <span className="k-mono min-w-0 truncate text-[11.5px]">{sender.email}</span>}
        <span className="flex shrink-0 items-center gap-1">
          ·{!outbound && <SourceLogo mark={mark} size={12} />}
          {meta}
        </span>
        <span className="ml-auto shrink-0">
          <TagChip tag={tag} />
        </span>
        {notCleaned && <span className="k-chip shrink-0">Not cleaned</span>}
      </p>
      {item.subject && <p className="mt-1 text-[13px] font-medium">{item.subject}</p>}
      {body ? (
        <p className={`mt-1 whitespace-pre-wrap break-words text-[13px] leading-5 ${long && !open ? "line-clamp-[10]" : ""}`}>{body}</p>
      ) : (
        <p className="k-fg4 mt-1 text-[13px]">—</p>
      )}
      {(long || hasOriginal) && (
        <div className="mt-1 flex gap-1">
          {long && (
            <button type="button" className="k-btn-ghost h-6 px-1.5 text-[12px]" onClick={() => setOpen((o) => !o)}>
              {open ? "Show less" : "Show all"}
            </button>
          )}
          {hasOriginal && (
            <button type="button" className="k-btn-ghost h-6 px-1.5 text-[12px]" onClick={() => setShowOriginal((o) => !o)}>
              {showOriginal ? "Show what they wrote" : "Show original"}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

/** Under a search: why this person matched, the newest matching message first. */
function MatchLine({ person }: { person: Person }) {
  const matches = person.matches ?? [];
  const message = matches.find((m) => m.field === "message" && m.excerpt);
  const identity = matches.find((m) => m.field !== "message" && m.field !== "name" && m.value);
  if (!message && !identity) return null;
  const more = (person.messageMatches ?? 0) > 1 ? ` · ${formatCount(person.messageMatches!)} messages` : "";
  return (
    <span className="k-fg2 mt-1 line-clamp-2 block text-[12px] leading-[18px]">
      {message ? `${message.direction === "outbound" ? "You: " : ""}${message.excerpt}${more}` : identity!.value}
    </span>
  );
}

/** A guessed pairing with one of our leads, stated as a hint (the lead keeps its own row). */
function PossibleLeadLine({ person }: { person: Person }) {
  const hint = possibleLeadHint(person);
  if (!hint) return null;
  return (
    <span className="k-fg2 mt-1 flex min-w-0 items-center gap-1.5 text-[12px] leading-[18px]">
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--data-amber)]" />
      <span className="truncate" title={hint}>{hint}</span>
    </span>
  );
}

/**
 * The thread header's guessed pairings, one line each, with the two rulings the Integrations
 * pairing drawer already sends (lead-service owns them). crm-service re-reads the pairing on
 * its own cadence, so the stated ruling holds on the line until the served person moves.
 */
function PossibleLeadRulings({ brandId, person }: { brandId: string; person: Person }) {
  const leads = person.possibleLeads ?? [];
  if (leads.length === 0) return null;
  return (
    <div className="mt-1 space-y-1">
      {leads.map((l) => (
        <PossibleLeadRuling key={`${person.personKey}|${l.crmContactId}|${l.leadId ?? l.email}`} brandId={brandId} person={person} lead={l} />
      ))}
    </div>
  );
}

function PossibleLeadRuling({ brandId, person, lead }: { brandId: string; person: Person; lead: PossibleLead }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<"accepted" | "rejected" | null>(null);
  const [ruled, setRuled] = useState<"accepted" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const name = possibleLeadName(lead);
  if (!name) return null;
  const leadId = lead.leadId ?? null;
  const rule = async (ruling: "accepted" | "rejected") => {
    if (!leadId) return;
    setPending(ruling);
    setError(null);
    try {
      await setCrmPairingRuling({ brandId, crmContactId: lead.crmContactId, leadId, ruling });
    } catch (err) {
      console.error("[v2 unibox] ruling write failed", err);
      setError(rulingErrorMessage(err instanceof ApiError ? err.status : null, "rule"));
      setPending(null);
      return;
    }
    setRuled(ruling);
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["people", brandId] }),
        queryClient.refetchQueries({ queryKey: timelineKey(brandId, person.personKey) }),
      ]);
    } catch (err) {
      console.error("[v2 unibox] re-read after ruling failed", err);
    }
    setPending(null);
  };
  return (
    <div className="k-fg2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-[18px]">
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--data-amber)]" />
      <span className="min-w-0 truncate" title={name}>
        {ruled ? possibleLeadRuledLine(name, ruled) : `Maybe the same as ${name}, to confirm`}
      </span>
      {leadId && !ruled ? (
        <span className="flex shrink-0 gap-1">
          <button type="button" disabled={pending != null} onClick={() => rule("accepted")} className="k-btn disabled:cursor-wait">
            {pending === "accepted" ? "Saving..." : "Same person"}
          </button>
          <button type="button" disabled={pending != null} onClick={() => rule("rejected")} className="k-btn-ghost disabled:cursor-wait">
            {pending === "rejected" ? "Saving..." : "Not the same"}
          </button>
        </span>
      ) : null}
      {error ? <span className="text-[var(--data-rose)]">{error}</span> : null}
    </div>
  );
}

/** A person: their company's logo when a work address names it, else initials. */
function PersonMark({ name, emails, size }: { name: string; emails: string[]; size: number }) {
  const domain = personCompanyDomain(emails);
  return domain ? <CompanyMark name={name} domain={domain} size={size} /> : <Initials name={name} size={size} round />;
}

/** Where a record came from, as its logo; the name rides the tooltip and the meta line. */
function SourceLogo({ mark, size }: { mark: SourceMark; size: number }) {
  const [broken, setBroken] = useState(false);
  const src = mark.src ?? (mark.domain ? `https://img.logo.dev/${encodeURIComponent(mark.domain)}?token=${LOGO_DEV_TOKEN}&size=${size * 2}&fallback=404` : null);
  if (!src || broken) return <Initials name={mark.name} size={size} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={mark.name}
      title={mark.name}
      onError={() => setBroken(true)}
      className="shrink-0 rounded-[4px] bg-white object-contain"
      style={{ width: size, height: size }}
    />
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
