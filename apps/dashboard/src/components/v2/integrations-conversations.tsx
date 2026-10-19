"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { ApiError, getLeadTimeline, getPersonTimeline, getUniboxLead, listPeople, listUniboxLeads, sendUniboxReply, setCrmPairingRuling } from "@/lib/api";
import { pendingReplies, replyErrorMessage, replyTarget, type LocalReply } from "@/lib/unibox-reply";
import { rulingErrorMessage } from "@/lib/crm-pairings";
import { ownQueryData } from "@/lib/own-query-data";
import { useAuthQuery, useOrgQueryGate } from "@/lib/use-auth-query";
import { useStaffMode } from "@/lib/use-staff-mode";
import { POLL_INTERVAL } from "@/lib/query-options";
import { formatCount } from "@/lib/format-number";
import { friendlyDateTime, timeAgo } from "@/lib/friendly-datetime";
import {
  personLeadRowId,
  personName,
  personStatusLabel,
  possibleLeadName,
  possibleLeadRuledLine,
  type PossibleLead,
  sourceLine,
  timelineSourceNote,
  type Person,
  type PersonTimeline,
  type PersonTimelineItem,
} from "@/lib/people-conversations";
import { EmptyNote, Initials, MarkLines, Shimmer } from "@/components/v2/ui";
import { CompanyMark } from "@/components/v2/people-bits";
import { parseFrom, personCompanyDomain, personSourceMarks, sourceMark, type SourceMark } from "@/lib/conversation-sources";
import { RecordsToolbar } from "@/components/v2/records";
import { THREAD_SCROLL_STEP, uniboxKeyAction, type UniboxPane } from "@/lib/unibox-keys";
import { timelineTag, type TimelineTag } from "@/lib/timeline-tags";
import { conversationItemTag, conversationSourceWord, joinConversationLabels, liveItems, standingTag, type ConversationItem, type ConversationTimeline } from "@/lib/conversation-timeline";
import { ConversationTags } from "@/components/v2/conversation-timeline";
import { useSelectedOfferIfAny } from "@/components/v2/selected-offer";
import { TagChip } from "@/components/v2/tag-chip";
import { WrittenWithTags, useLeadWrittenBy } from "@/components/v2/written-with-tags";
import { writtenMessageId, type WrittenBy } from "@/lib/written-by";
import { itemCallId } from "@/lib/api-calls";
import { ApiCallDetailPanel } from "@/components/v2/api-call-detail";
import { RelationshipChips, UnmergeMenu } from "@/components/v2/relationship-tags";
import { UNIBOX_DIMENSIONS, filtersFromParams, filtersKey, uniboxRowId, uniboxRowKey, uniboxRowTitle, uniboxThreadRef, type UniboxDimension, type UniboxPage, type UniboxRow } from "@/lib/unibox-leads";
import { UniboxFilterBar, UniboxLeadCardPanel, UniboxRowTags } from "@/components/v2/unibox-lead-card";

// The publishable logo.dev token the dashboard already ships (company-logo.tsx).
const LOGO_DEV_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";

/** The thread reads every source live on each call, so it refreshes slower than the list. */
const TIMELINE_POLL = 60_000;
/** A source still re-reading (crm-service `refreshing`) is asked again sooner. */
const TIMELINE_REFRESHING_POLL = 10_000;

/**
 * The thread opens on its latest messages only; older ones load as the top scrolls into
 * view (owner 2026-10-14: « peut même être 10 »). One person's whole thread was 6,963
 * items, 10.7 MB, 14-16 s in one read.
 */
const THREAD_PAGE = 10;

/** How many threads, from the top of the list, load before anyone clicks. */
const PRELOAD_TOP = 8;

const timelineKey = (brandId: string, ref: string) => ["personTimeline", brandId, ref] as const;
/** One read shape for the Thread and every preload: same key, same pages. */
const timelineQuery = (brandId: string, ref: string) => ({
  queryKey: timelineKey(brandId, ref),
  queryFn: ({ pageParam }: { pageParam: string | null }) =>
    getPersonTimeline(brandId, ref, { limit: THREAD_PAGE, before: pageParam }),
  initialPageParam: null as string | null,
  // `pages[0]` is the latest page, each next one the page above it.
  getNextPageParam: (last: PersonTimeline) => (last.page?.hasOlder ? (last.page.olderCursor ?? undefined) : undefined),
});
const factsKey = (leadRowId: string | null, brandId: string, offerId: string | null) =>
  ["leadTimeline", leadRowId, brandId, offerId] as const;

/** How long the typing pauses before the search is asked. */
const SEARCH_DEBOUNCE_MS = 150;

/** A message longer than this opens folded, so one long email does not bury the thread. */
const FOLD_AT = 600;

/**
 * The Unibox (owner 2026-10-17): the list is lead-service's Unibox, ONLY the people crm-service
 * tags professional to the brand, each a lead with six tags lead-service decides, filtered by
 * lead-service. Opening a lead reads their whole exchange from crm-service (every channel, one
 * thread, oldest first), and the lead card beside it states the six tags and the campaigns.
 * One write: a person who wrote back to our cold email is answered by hand from the reply box
 * under the thread (instantly-service sends it, in the same thread, from the mailbox that wrote to them).
 */
export function V2ConversationsView({ brandId }: { brandId: string }) {
  const params = useSearchParams();
  // A click (a lead, a filter) only rewrites the URL: no Next navigation, so no round trip to
  // the page server before the screen changes (owner 2026-10-08: "tout est trop lent"). Next
  // keeps useSearchParams in step with the native history call, but only when the state passed
  // is NOT its own: handed the current entry's state, Next reads the call as one of its own and
  // skips the sync, so the URL changed and the panel stayed on "Pick a person" (prod 2026-10-10).
  // Pass null; Next copies its state.
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(key, value);
    else next.delete(key);
    window.history.replaceState(null, "", `?${next.toString()}`);
  };
  const [cursor, setCursor] = useState(-1);
  const searchRef = useRef<HTMLInputElement | null>(null);
  // The URL names the row by its relation (`relationKey`, one human at one company: the same
  // human can own several rows), else its opaque `humanId`, never an address (owner 2026-10-10).
  const openKey = params.get("lead");
  // lead-service searches name and email, asked once the typing pauses.
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  // The six tag filters, each a served filter (lead-service narrows and counts the list).
  const filters = filtersFromParams(params);
  const fKey = filtersKey(filters);
  const pickFilter = (dim: UniboxDimension, values: string[]) => setParam(dim, values.length ? values.join(",") : null);

  // The first rows load at once, the next ones as the end of the list scrolls into view
  // (owner 2026-10-08: no pages to click through).
  const gate = useOrgQueryGate();
  const listQ = useInfiniteQuery({
    queryKey: ["uniboxLeads", brandId, q, fKey],
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      listUniboxLeads(brandId, filters, { limit: UNIBOX_PAGE_SIZE, q, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last: UniboxPage) => last.nextCursor ?? undefined,
    enabled: gate && !!brandId,
    refetchInterval: POLL_INTERVAL,
    // While a new search is asked, the last answer for the SAME filters stays on screen,
    // never a blank list; a filter click never shows another filter's rows.
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[3] === fKey ? prev : undefined),
  });
  const queryClient = useQueryClient();
  const list = listQ.data?.pages[0] ?? null;
  const rows = listQ.data ? listQ.data.pages.flatMap((p) => p.rows) : null;
  const settled = !listQ.isPlaceholderData && search.trim() === q;
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
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, rows?.length]);

  // Under the cards, which sources feed the threads (crm-service, unchanged).
  const sourcesQ = useAuthQuery(["people", brandId, "sources"], () => listPeople(brandId, { limit: 1, offset: 0 }), {
    enabled: !!brandId,
    refetchInterval: POLL_INTERVAL,
  });
  const sources = sourcesQ.data ?? null;

  // A thread opens from memory: the top rows' threads (and their cards) load with the list,
  // any other row's as the pointer reaches it. Same key and read as the Thread itself.
  // The lead-service facts load WITH the thread, keyed on the lead row the thread names (same
  // key and read as the Thread), never after the click.
  const selected = useSelectedOfferIfAny();
  const offerId = selected?.offerId ?? null;
  const offerSettled = selected ? selected.settled : true;
  const preload = (r: UniboxRow) => {
    const ref = uniboxThreadRef(r);
    if (ref) {
      void queryClient.prefetchInfiniteQuery({ ...timelineQuery(brandId, ref), staleTime: TIMELINE_POLL }).then(() => {
        const thread = queryClient.getQueryData<InfiniteData<PersonTimeline>>(timelineKey(brandId, ref));
        const leadRowId = thread ? personLeadRowId(thread.pages[0].person) : null;
        if (!leadRowId || !offerSettled) return;
        void queryClient.prefetchQuery({
          queryKey: factsKey(leadRowId, brandId, offerId),
          queryFn: () => getLeadTimeline(leadRowId, { brandId, offerId }),
          staleTime: TIMELINE_POLL,
        });
      });
    }
    void queryClient.prefetchQuery({
      queryKey: leadCardKey(brandId, uniboxRowId(r)),
      queryFn: () => getUniboxLead(brandId, uniboxRowId(r)),
      staleTime: TIMELINE_POLL,
    });
  };
  const top = (rows ?? []).slice(0, PRELOAD_TOP);
  const topKeys = top.map(uniboxRowKey).join("|");
  useEffect(() => {
    if (!gate || !topKeys) return;
    for (const r of top) preload(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate, brandId, topKeys, offerId, offerSettled]);
  // J/K moves the cursor: the row it lands on loads too.
  const cursorRow = cursor >= 0 ? (rows?.[cursor] ?? null) : null;
  useEffect(() => {
    if (gate && cursorRow) preload(cursorRow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate, cursorRow ? uniboxRowKey(cursorRow) : null]);

  const open = (r: UniboxRow) => setParam("lead", uniboxRowId(r));
  // The Unibox opens on the lead on top (owner 2026-10-08), and a new search or filter on its
  // first result. A lead already in the URL (a click, a shared link) is kept.
  const first = settled ? (rows?.[0] ?? null) : null;
  const openedFor = useRef<string | null>(null);
  const listedFor = `${fKey}|${q}`;
  useEffect(() => {
    if (!first) return;
    const changed = openedFor.current !== null && openedFor.current !== listedFor;
    openedFor.current = listedFor;
    if (!openKey || changed) open(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first ? uniboxRowKey(first) : null, openKey, listedFor]);
  // The keyboard (owner 2026-10-10): Up/Down open the previous/next lead, Right/Left move
  // between the list and the thread, and inside the thread Up/Down scroll it.
  const [pane, setPane] = useState<UniboxPane>("list");
  // A narrow panel (a phone, or the Copilot open beside it) shows the list OR the thread,
  // never both stacked: a tap opened a thread below the fold (owner 2026-10-13).
  const [narrowView, setNarrowView] = useState<UniboxPane>("list");
  const threadCard = useRef<HTMLElement | null>(null);
  // Hidden, the list loses its scroll: back from a thread, it reopens where it was.
  const listScrollTop = useRef(0);
  useEffect(() => {
    if (narrowView === "list") {
      if (scrollBox.current) scrollBox.current.scrollTop = listScrollTop.current;
      return;
    }
    const el = threadCard.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
  }, [narrowView]);
  const threadScroll = useRef<HTMLDivElement | null>(null);
  const openIndex = rows && openKey ? rows.findIndex((r) => uniboxRowId(r) === openKey) : -1;
  // The neighbours load too, so the next press opens from memory.
  const prevRow = openIndex > 0 ? (rows?.[openIndex - 1] ?? null) : null;
  const nextRow = openIndex >= 0 ? (rows?.[openIndex + 1] ?? null) : null;
  useEffect(() => {
    if (!gate) return;
    if (prevRow) preload(prevRow);
    if (nextRow) preload(nextRow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate, prevRow ? uniboxRowKey(prevRow) : null, nextRow ? uniboxRowKey(nextRow) : null]);
  const keys = useRef({ rows, openIndex, pane, hasOpen: Boolean(openKey) });
  keys.current = { rows, openIndex, pane, hasOpen: Boolean(openKey) };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const s = keys.current;
      const action = uniboxKeyAction({
        key: e.key,
        typing: Boolean(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)),
        inSearch: t === searchRef.current,
        modified: e.metaKey || e.ctrlKey || e.altKey,
        pane: s.pane,
        hasOpen: s.hasOpen,
        openIndex: s.openIndex,
        count: s.rows?.length ?? 0,
      });
      if (!action) return;
      e.preventDefault();
      if (action.type === "search") {
        searchRef.current?.focus();
      } else if (action.type === "pane") {
        setPane(action.pane);
        setNarrowView(action.pane);
      } else if (action.type === "scroll") {
        threadScroll.current?.scrollBy({ top: action.direction * THREAD_SCROLL_STEP });
      } else {
        const r = s.rows?.[action.index];
        if (!r) return;
        searchRef.current?.blur();
        setPane("list");
        setCursor(action.index);
        open(r);
        scrollBox.current?.querySelector(`[data-row="${action.index}"]`)?.scrollIntoView({ block: "nearest" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The open lead's card: the six tags and the campaigns. Its lead also names the thread when
  // the row is not in the loaded pages (a shared link).
  const openRow = rows?.find((r) => uniboxRowId(r) === openKey) ?? null;
  const cardQ = useAuthQuery(leadCardKey(brandId, openKey ?? ""), () => getUniboxLead(brandId, openKey!), {
    enabled: !!brandId && !!openKey,
    refetchInterval: TIMELINE_POLL,
  });
  const card = openKey ? ownQueryData(cardQ) : undefined;
  const threadRef = openRow ? uniboxThreadRef(openRow) : card ? uniboxThreadRef(card.lead) : null;

  // Answered once (success or failure): a poll on a failed read must not repaint a skeleton.
  if (!listQ.isFetchedAfterMount && !list) return <ListShimmer />;
  const filtered = UNIBOX_DIMENSIONS.some((d) => (filters[d]?.length ?? 0) > 0);
  // A filtered read that fails keeps the page and its filters; the plain list failing is the page failing.
  if (!list && !filtered && !q) {
    return (
      <div className="k-card">
        <EmptyNote>We could not load your conversations. Retrying.</EmptyNote>
      </div>
    );
  }

  return (
    <div className="@container space-y-4 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
      {/* The search runs the whole width, above the cards (owner 2026-10-08). */}
      <div className="shrink-0 [&>div]:p-0 md:[&>div]:p-0 [&>div>div:last-child]:min-w-0 [&>div>div:last-child]:max-w-full [&_label]:w-auto [&_label]:min-w-[240px] [&_label]:max-w-none [&_label]:flex-1">
        <RecordsToolbar search={search} onSearch={setSearch} placeholder="Search by name or email" inputRef={searchRef} />
      </div>
      <UniboxFilterBar filters={filters} ladder={list?.lifecycleLadder ?? []} onPick={pickFilter} />
      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-rows-[minmax(0,1fr)] @3xl:grid-cols-[340px_minmax(0,1fr)]">
        <section
          className={`k-card max-h-[calc(100dvh-220px)] min-h-[420px] flex-col overflow-hidden lg:max-h-none lg:min-h-0 @3xl:flex ${narrowView === "list" ? "flex" : "hidden"}`}
        >
          <header className="k-line-subtle flex h-10 shrink-0 items-center justify-between border-b px-4">
            <span className="k-label">Leads</span>
            <span className="k-fg3 text-[12px] tabular-nums">{list && settled ? formatCount(list.total) : "—"}</span>
          </header>
          <div ref={scrollBox} className="k-scroll min-h-0 flex-1 overflow-y-auto">
            {rows && rows.length > 0 ? (
              <ul>
                {rows.map((r, i) => (
                  <LeadRow
                    key={uniboxRowKey(r)}
                    index={i}
                    row={r}
                    selected={uniboxRowId(r) === openKey}
                    cursor={i === cursor}
                    onOpen={() => {
                      setPane("list");
                      listScrollTop.current = scrollBox.current?.scrollTop ?? 0;
                      setNarrowView("thread");
                      open(r);
                    }}
                    onHover={() => {
                      setCursor(i);
                      preload(r);
                    }}
                  />
                ))}
                {hasNextPage && settled && (
                  <li ref={sentinel} className="space-y-2 px-4 py-3" aria-label="Loading more leads">
                    <Shimmer className="h-9 w-full" />
                    <Shimmer className="h-9 w-full" />
                  </li>
                )}
              </ul>
            ) : list && !settled ? (
              <ListRowsShimmer />
            ) : !list ? (
              <EmptyNote>We could not load this list right now. Retrying.</EmptyNote>
            ) : q ? (
              <EmptyNote>No lead matches &ldquo;{q}&rdquo;.</EmptyNote>
            ) : filtered ? (
              <EmptyNote>No lead matches these filters.</EmptyNote>
            ) : (
              <EmptyNote>No lead yet. People you work with show up here once a connected source names them.</EmptyNote>
            )}
          </div>
        </section>

        {/* The thread and, beside it, the lead card (always open, like an inbox contact sidebar). */}
        <div
          className={`min-h-0 gap-4 lg:min-h-0 @3xl:flex @3xl:flex-col @6xl:flex-row ${narrowView === "thread" ? "flex flex-col" : "hidden"}`}
        >
          {/* The thread pane takes Up/Down once the reader moves into it (Right, or a click).
              Its frame is an outline: an inset shadow paints UNDER the scrolled messages. */}
          <section
            ref={threadCard}
            onMouseDown={() => setPane("thread")}
            style={pane === "thread" ? { outline: "1px solid var(--accent)", outlineOffset: "-1px" } : undefined}
            className="k-card flex max-h-[calc(100dvh-160px)] min-h-[420px] min-w-0 flex-1 scroll-mt-16 flex-col overflow-hidden lg:max-h-none lg:min-h-0"
          >
            {/* keel.css is unlayered: `@3xl:hidden` on the k-btn-ghost itself loses, so a wrapper hides it. */}
            <div className="shrink-0 @3xl:hidden">
              <button
                type="button"
                onClick={() => {
                  setPane("list");
                  setNarrowView("list");
                }}
                className="k-btn-ghost k-line-subtle h-10 w-full justify-start gap-1.5 rounded-none border-b px-4"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Leads
              </button>
            </div>
            {threadRef ? (
              <Thread brandId={brandId} personRef={threadRef} listed={null} scrollRef={threadScroll} />
            ) : openKey && !card && !cardQ.isFetchedAfterMount ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 5 }, (_, i) => (
                  <Shimmer key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <EmptyNote>
                  {openKey ? "No conversation to show for this lead." : "Pick a lead to read the whole conversation, every channel in one thread."}
                </EmptyNote>
              </div>
            )}
          </section>
          {openKey && (
            <UniboxLeadCardPanel
              card={card ?? null}
              failed={!card && cardQ.isFetchedAfterMount}
              listed={openRow}
            />
          )}
        </div>
      </div>

      {sources && (
        <SourcesStrip sources={sources.sources} lastBuiltAt={list?.builtAt ?? sources.scope.lastBuiltAt} lastError={sources.scope.status === "error" ? sources.scope.lastError : null} />
      )}
    </div>
  );
}

const UNIBOX_PAGE_SIZE = 100;
const leadCardKey = (brandId: string, rowId: string) => ["uniboxLead", brandId, rowId] as const;

/** One lead in the list: name, last activity, then lead-service's stage, conversation and types. */
function LeadRow({
  index,
  row,
  selected,
  cursor,
  onOpen,
  onHover,
}: {
  index: number;
  row: UniboxRow;
  selected: boolean;
  cursor: boolean;
  onOpen: () => void;
  onHover: () => void;
}) {
  const name = uniboxRowTitle(row);
  return (
    <li data-row={index}>
      <button
        type="button"
        onClick={onOpen}
        onMouseEnter={onHover}
        aria-current={selected ? "true" : undefined}
        className={`k-row k-line-subtle flex w-full items-start gap-3 border-b px-4 py-2.5 text-left ${selected || cursor ? "k-selected" : ""}`}
      >
        {/* The mark is as tall as the two lines beside it (owner 2026-10-11, MarkLines). */}
        <MarkLines className="flex-1" gap="gap-3" mark={(px) => (row.company?.domain ? <CompanyMark name={row.company.name ?? name} domain={row.company.domain} size={px} /> : <PersonMark name={name} emails={row.emails} size={px} />)}>
          <span className="flex items-center gap-2">
            <span className="truncate text-[13px] font-medium">{name}</span>
            {row.lastActivityAt && <span className="k-fg3 ml-auto shrink-0 text-[12px] tabular-nums">{timeAgo(row.lastActivityAt)}</span>}
          </span>
          <UniboxRowTags row={row} />
        </MarkLines>
      </button>
    </li>
  );
}

function Thread({
  brandId,
  personRef: ref,
  listed,
  scrollRef,
}: {
  brandId: string;
  personRef: string;
  listed: Person | null;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const gate = useOrgQueryGate();
  const q = useInfiniteQuery({
    ...timelineQuery(brandId, ref),
    enabled: gate && !!brandId,
    refetchInterval: (query) =>
      query.state.data?.pages.some((p) => p.sources.some((s) => s.refreshing)) ? TIMELINE_REFRESHING_POLL : TIMELINE_POLL,
  });
  // The conversation at the selected offer: lead-service's labelled facts and its tags, keyed
  // on the lead row whose standing decided this person's state (none = not one of our leads).
  const selected = useSelectedOfferIfAny();
  const offerId = selected?.offerId ?? null;
  const offerSettled = selected ? selected.settled : true;
  // Only THIS person's data: the app-wide placeholder would hand a re-keyed query the last person's.
  const pages = ownQueryData(q)?.pages;
  // The latest page names the person and the sources; the older pages go above it.
  const data = pages ? { ...pages[0], items: [...pages].reverse().flatMap((p) => p.items) } : undefined;
  // The list row already names the lead row, so the facts start with the thread, not after it.
  const leadRowId = data ? personLeadRowId(data.person) : listed ? personLeadRowId(listed) : null;
  const factsQ = useAuthQuery(
    factsKey(leadRowId, brandId, offerId),
    () => getLeadTimeline(leadRowId!, { brandId, offerId }),
    { enabled: Boolean(leadRowId) && offerSettled, refetchInterval: TIMELINE_POLL },
  );
  // No lead row (a CRM-only person) means no lead-service facts, never the previous person's.
  const facts = leadRowId ? ownQueryData(factsQ) : undefined;
  // What each message we sent this person was written with, any channel (owner 2026-10-19), keyed on the conversation's lead.
  const writtenBy = useLeadWrittenBy(facts?.leadId ?? null);
  // Replies sent from this screen, per person, shown until the served thread carries them.
  const [sentByRef, setSentByRef] = useState<Record<string, LocalReply[]>>({});
  const local = data ? pendingReplies(sentByRef[ref] ?? [], data.items) : [];
  // Oldest first, so the latest exchange is at the bottom: open there, as any inbox does.
  // Only a change at the BOTTOM (a new message, a reply sent) scrolls down; an older page
  // loading above keeps the messages being read where they are.
  const latest = pages?.[0].items ?? [];
  const bottomKey = `${latest.length}|${latest[latest.length - 1]?.at ?? ""}|${local.length}`;
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [ref, bottomKey, scrollRef]);
  const pageCount = pages?.length ?? 0;
  const heightBefore = useRef<{ ref: string; pages: number; height: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const before = heightBefore.current;
    if (el && before && before.ref === ref && pageCount > before.pages) {
      el.scrollTop = before.top + (el.scrollHeight - before.height);
    }
    heightBefore.current = el ? { ref, pages: pageCount, height: el.scrollHeight, top: el.scrollTop } : null;
  }, [ref, pageCount, scrollRef]);
  const top = useRef<HTMLDivElement | null>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = q;
  useEffect(() => {
    const el = top.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || isFetchingNextPage) return;
        const box = scrollRef.current;
        if (box) heightBefore.current = { ref, pages: pageCount, height: box.scrollHeight, top: box.scrollTop };
        void fetchNextPage();
      },
      { root: scrollRef.current, rootMargin: "300px 0px 0px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, ref, pageCount, scrollRef]);
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
  const target = replyTarget(person, items);
  return (
    <>
      <header className="k-line-subtle shrink-0 border-b px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <MarkLines
            className="min-w-0 flex-1 basis-[220px]"
            gap="gap-3"
            mark={(px) => <PersonMark name={name} emails={person.emails} size={px} />}
            after={<PossibleLeadRulings brandId={brandId} person={person} threadRef={ref} />}
          >
            <h2 className="truncate text-[14px] font-semibold">{name}</h2>
            <p className="k-fg3 truncate text-[12px]">
              {[...person.emails, ...person.phones].join(" · ") || "—"}
            </p>
          </MarkLines>
          {(status || listed?.relationship) && (
            <span className="ml-auto flex shrink-0 flex-wrap items-center gap-1.5">
              {listed?.relationship && (
                <RelationshipChips tags={listed.relationship.tags} unsureTags={listed.relationship.unsureTags} />
              )}
              {status && <PersonTag label={status} state={person.state} />}
              {listed?.relationship?.merges && listed.relationship.merges.length > 0 && (
                <UnmergeMenu brandId={brandId} name={name} merges={listed.relationship.merges} />
              )}
            </span>
          )}
        </div>
        {facts ? (
          <div className="mt-2">
            <ConversationTags tags={facts.tags} disqualification={facts.disqualification} />
          </div>
        ) : null}
      </header>
      <div ref={scrollRef} className="k-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {hasNextPage && (
          <div ref={top} aria-busy={isFetchingNextPage}>
            <Shimmer className="h-14 w-full rounded-lg" />
          </div>
        )}
        {items.length === 0 ? (
          <EmptyNote>No message or event with this person on any connected source.</EmptyNote>
        ) : (
          threadRows(items, facts ? liveItems(facts) : []).map((row, i) =>
            row.fact ? (
              <FactRow key={row.fact.id} fact={row.fact} writtenBy={writtenBy} />
            ) : (
              <ThreadItem
                key={i}
                brandId={brandId}
                item={row.item}
                tag={row.tag}
                writtenBy={writtenBy}
                campaignId={sentCampaignId(row.item, facts)}
              />
            ),
          )
        )}
        {local.map((l) => (
          <ThreadItem key={l.reply.messageId} brandId={brandId} item={localReplyItem(l)} tag={null} />
        ))}
      </div>
      {target && (
        <ReplyBox
          key={ref}
          brandId={brandId}
          email={target}
          name={name}
          onSent={(l) => setSentByRef((m) => ({ ...m, [ref]: [...(m[ref] ?? []), l] }))}
        />
      )}
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

/** A reply sent from this screen, as the thread item it becomes once the thread re-reads. */
function localReplyItem(l: LocalReply): PersonTimelineItem {
  return {
    at: l.sentAt,
    source: "instantly",
    channel: "email",
    kind: "message",
    direction: "outbound",
    subject: l.reply.subject,
    text: l.text,
    from: l.reply.from,
    to: [l.reply.leadEmail],
    event: null,
  };
}

/**
 * Under the thread: type a plain answer and send it. instantly-service sends it in the
 * same thread, from where the prospect wrote last (the cold mailbox, or one of our
 * people's own address); it picks the sender, never us. Cmd/Ctrl+Enter sends. On a refusal the text stays in the box.
 */
function ReplyBox({ brandId, email, name, onSent }: { brandId: string; email: string; name: string; onSent: (l: LocalReply) => void }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement | null>(null);
  // The box grows with the text, up to a few lines; the thread keeps the rest of the height.
  // Empty, it keeps its two rows: mounted hidden (a phone shows the list first), a measure
  // reads 0 and would collapse it.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (!text) {
      el.style.height = "";
      return;
    }
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);
  const send = async () => {
    const words = text.trim();
    if (!words || sending) return;
    setSending(true);
    setError(null);
    const sentAt = new Date().toISOString();
    try {
      const reply = await sendUniboxReply({ brandId, email, text: words });
      onSent({ sentAt, text: words, reply });
      setText("");
    } catch (err) {
      console.error("[v2 unibox] reply send failed", err);
      const body = err instanceof ApiError ? err.body : null;
      setError(replyErrorMessage(err instanceof ApiError ? err.status : null, typeof body?.code === "string" ? body.code : null));
      setSending(false);
      return;
    }
    setSending(false);
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["personTimeline", brandId] }),
        queryClient.refetchQueries({ queryKey: ["people", brandId] }),
      ]);
    } catch (err) {
      console.error("[v2 unibox] re-read after reply failed", err);
    }
  };
  const first = name.split(" ")[0] || name;
  return (
    <form
      className="k-line-subtle shrink-0 border-t p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <label className="k-inset block rounded-lg px-3 py-2">
        <span className="sr-only">Reply to {name}</span>
        <textarea
          ref={box}
          value={text}
          rows={2}
          disabled={sending}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={`Write your reply to ${first}`}
          className="block w-full resize-none bg-transparent text-[13px] leading-5 outline-none placeholder:text-[var(--fg-3)]"
          style={{ font: "inherit" }}
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {error ? (
          <span role="alert" className="min-w-0 flex-1 text-[12px] text-[var(--data-rose)]">
            {error}
          </span>
        ) : (
          <span className="k-fg3 min-w-0 flex-1 text-[12px]">Your reply goes out in this thread, where they last wrote.</span>
        )}
        {/* keel.css is unlayered: `hidden` on the k-kbd itself loses, so the wrapper hides it. */}
        <span className="hidden sm:inline-flex">
          <span className="k-kbd">⌘ Enter</span>
        </span>
        <button type="submit" disabled={sending || !text.trim()} className="k-btn-accent disabled:opacity-40">
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </form>
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

function FactRow({ fact, writtenBy = null }: { fact: ConversationItem; writtenBy?: WrittenBy | null }) {
  const meta = [conversationSourceWord(fact.source), fact.occurredAt ? friendlyDateTime(fact.occurredAt) : "No date"].join(" · ");
  return (
    <div className="k-fg2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
      <TagChip tag={conversationItemTag(fact.label)} />
      {/* A message of ours the thread does not hold: its own row, on its id only (no campaign fallback). */}
      <WrittenWithTags writtenBy={writtenBy} messageId={fact.id} campaignId={null} at={fact.occurredAt} />
      <span className="k-fg3">{meta}</span>
      {fact.attributable === false ? <span className="k-fg3 whitespace-nowrap">· Not ours</span> : null}
    </div>
  );
}

/**
 * The campaign that sent one of our emails: lead-service's fact for it (same identity as the
 * thread's `outreachFact`) names it. Null for anything else: no campaign, no "written by".
 */
function sentCampaignId(item: PersonTimelineItem, facts: ConversationTimeline | undefined): string | null {
  if (item.direction !== "outbound" || !item.outreachFact || !facts) return null;
  return facts.items.find((f) => f.id === item.outreachFact!.subjectKey)?.campaignId ?? null;
}

function ThreadItem({
  brandId,
  item,
  tag,
  writtenBy = null,
  campaignId = null,
}: {
  brandId: string;
  item: PersonTimelineItem;
  tag: TimelineTag | null;
  writtenBy?: WrittenBy | null;
  campaignId?: string | null;
}) {
  // Where it came from, as a mark and its name: our own sends and visits read as Distribute.
  const mark = sourceMark(item.source, item.channel);
  const meta = [mark.name, item.at ? friendlyDateTime(item.at) : "No date"].join(" · ");

  if (item.kind === "event") {
    // A product event the brand's own PostHog recorded (a signup walk step, owner 2026-10-15)
    // reads as crm-service's one line: the step and what the person entered.
    const said = item.source === "posthog" && item.event?.step === "event" ? item.text : null;
    return (
      <div className="grid gap-1">
        <div className="k-fg2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
          <TagChip tag={tag ?? timelineTag(item)} />
          <SourceLogo mark={mark} size={14} />
          <span className="k-fg3">{meta}</span>
        </div>
        {said ? <p className="k-fg2 whitespace-pre-wrap break-words text-[13px] leading-5">{said}</p> : null}
      </div>
    );
  }

  return (
    <Message
      brandId={brandId}
      item={item}
      mark={mark}
      meta={meta}
      tag={tag ?? timelineTag(item)}
      written={
        item.direction === "outbound" ? (
          <WrittenWithTags writtenBy={writtenBy} messageId={writtenMessageId(item)} campaignId={campaignId} at={item.at} />
        ) : null
      }
    />
  );
}

/** A person's tag: their standing, coloured like the same fact in the thread (owner 2026-10-10). */
function PersonTag({ label, state }: { label: string; state: string }) {
  return <TagChip tag={standingTag(state, label)} />;
}

function Message({
  brandId,
  item,
  mark,
  meta,
  tag,
  written = null,
}: {
  brandId: string;
  item: PersonTimelineItem;
  mark: SourceMark;
  meta: string;
  tag: TimelineTag;
  /** What it was written with (model + tactics, tags beside its label), on a message we sent; null elsewhere. */
  written?: ReactNode;
}) {
  // The mark up front is WHO wrote it: the person's company logo (initials without one)
  // on their side, the source's mark on ours. Where it came from rides the meta line.
  const sender = parseFrom(item.from);
  // "Not cleaned" is our pipeline's word (google-service's judge pending), staff mode only.
  const { staffMode } = useStaffMode();
  const [open, setOpen] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const outbound = item.direction === "outbound";
  const notCleaned = item.textClean != null && !item.textClean.cleaned;
  const original = item.textClean?.original ?? null;
  const hasOriginal = original != null && original !== item.text;
  const body = showOriginal && hasOriginal ? original : item.text;
  const long = (body?.length ?? 0) > FOLD_AT;
  // An API / MCP call: our answer opens the whole call (request and response), read on demand.
  const callId = outbound ? itemCallId(item) : null;
  const [callOpen, setCallOpen] = useState(false);
  return (
    <article className={`max-w-[92%] rounded-lg px-3 py-2 sm:max-w-[85%] ${outbound ? "k-inset ml-auto" : "k-panel"}`}>
      {/* On a narrow bubble the line WRAPS: squeezed, the sender's name and address shrank to nothing. */}
      <p className="k-fg3 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
        {outbound ? (
          <SourceLogo mark={mark} size={16} />
        ) : (
          <PersonMark name={sender.name ?? sender.email ?? "Them"} emails={sender.email ? [sender.email] : []} size={16} />
        )}
        <span className="min-w-0 max-w-full truncate">{sender.name ?? sender.email ?? (outbound ? "You" : "Them")}</span>
        {/* The address it was written FROM, on every message: a person can write from
            several mailboxes (work, personal), and a name alone hides which one (owner 2026-10-09). */}
        {sender.name && sender.email && <span className="k-mono min-w-0 max-w-full truncate text-[11.5px]">{sender.email}</span>}
        <span className="flex min-w-0 items-center gap-1">
          ·{!outbound && <SourceLogo mark={mark} size={12} />}
          {meta}
        </span>
        <span className="ml-auto flex min-w-0 max-w-full items-center justify-end gap-1.5">
          <TagChip tag={tag} />
          {written}
        </span>
        {staffMode && notCleaned && <span className="k-chip shrink-0">Not cleaned</span>}
      </p>
      {item.subject && <p className="mt-1 text-[13px] font-medium">{item.subject}</p>}
      {body ? (
        <p className={`mt-1 whitespace-pre-wrap break-words text-[13px] leading-5 ${long && !open ? "line-clamp-[10]" : ""}`}>{body}</p>
      ) : (
        <p className="k-fg4 mt-1 text-[13px]">—</p>
      )}
      {(long || hasOriginal || callId) && (
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
          {callId && (
            <button type="button" aria-expanded={callOpen} className="k-btn-ghost h-6 px-1.5 text-[12px]" onClick={() => setCallOpen((o) => !o)}>
              {callOpen ? "Hide request and response" : "Show request and response"}
            </button>
          )}
        </div>
      )}
      {callId && callOpen && <ApiCallDetailPanel brandId={brandId} callId={callId} />}
    </article>
  );
}

/**
 * The thread header's guessed pairings, one line each, with the two rulings the Integrations
 * pairing drawer already sends (lead-service owns them). crm-service re-reads the pairing on
 * its own cadence, so the stated ruling holds on the line until the served person moves.
 */
function PossibleLeadRulings({ brandId, person, threadRef }: { brandId: string; person: Person; threadRef: string }) {
  const leads = person.possibleLeads ?? [];
  if (leads.length === 0) return null;
  return (
    <div className="mt-1 space-y-1">
      {leads.map((l) => (
        <PossibleLeadRuling key={`${person.personKey}|${l.crmContactId}|${l.leadId ?? l.email}`} brandId={brandId} person={person} threadRef={threadRef} lead={l} />
      ))}
    </div>
  );
}

function PossibleLeadRuling({ brandId, person, threadRef, lead }: { brandId: string; person: Person; threadRef: string; lead: PossibleLead }) {
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
        // The thread on screen, keyed by its ref (a Unibox row's relation, not the person).
        queryClient.refetchQueries({ queryKey: timelineKey(brandId, threadRef) }),
      ]);
    } catch (err) {
      console.error("[v2 unibox] re-read after ruling failed", err);
    }
    setPending(null);
  };
  return (
    <div className="k-fg2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-[18px]">
      <span className="flex min-w-0 max-w-full items-center gap-1.5">
        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--data-amber)]" />
        <span className="min-w-0 truncate" title={name}>
          {ruled ? possibleLeadRuledLine(name, ruled) : `Maybe the same as ${name}, to confirm`}
        </span>
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

/** A search still asked with no loaded row matching yet: rows, not "no match". */
function ListRowsShimmer() {
  return (
    <div className="space-y-2 px-4 py-3" aria-label="Searching">
      {Array.from({ length: 4 }, (_, i) => (
        <Shimmer key={i} className="h-10 w-full" />
      ))}
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
