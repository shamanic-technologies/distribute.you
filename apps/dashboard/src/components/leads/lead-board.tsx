"use client";

import { useEffect, useMemo, useState } from "react";
import { BoardSlot } from "@/components/boards/board-slot";
import { useBoardDrag } from "@/components/boards/use-board-drag";
import { CompanyLogo } from "@/components/company-logo";
import {
  LEAD_BOARD_COLUMNS,
  LEAD_BOARD_PAGE_SIZE,
  columnMoveRefusal,
  columnPage,
  columnReplyKinds,
  movableColumnsFrom,
  type LeadBoardColumn,
  type LeadBoardColumnKey,
} from "@/lib/lead-board";
import { REPLY_TONE_PILL, replyKindOption, type ReplyKind, type ReplyTone } from "@/lib/reply-kind";
import { timeAgo } from "@/lib/friendly-datetime";

/**
 * The leads BOARD — four triage columns, one card per lead.
 *
 * The tabs it replaced are nested subsets (a lead that replied is also in Contacted),
 * so reading them tells you how many leads cleared each bar but never where any one
 * lead IS. The board is the other statement: a partition, one card per lead.
 *
 * Four things are load-bearing and none of them is the layout:
 *
 *   - **A move states a REPLY KIND, so it asks WHICH.** "Sales interest" is three
 *     different things a prospect can have said, and recording the wrong one is worse
 *     than recording nothing — so a drop opens a picker of that column's own kinds
 *     rather than writing a guess. The kinds are the catalogue's, the same words the
 *     lead panel uses.
 *   - **Every column accepts the drop, and the form is where a move is refused.** A
 *     target that silently rejects a drag reads as a broken board rather than as a
 *     rule. Opt-out therefore takes the card, opens the form, and says why nothing can
 *     be written — `columnReplyKinds` is empty for it because instantly-service's
 *     vocabulary has no unsubscribe value, so there is literally nothing to state.
 *   - **ONE gesture does two things, and the difference is TIME.** A quick tap opens
 *     the lead's panel; holding picks the card up. That is why this does not use HTML5
 *     `draggable`: native drag fires on no touch device at all, and its drag image is
 *     a screenshot the browser composites — which is where the square white corners
 *     behind a rounded card come from. The ghost below is a live element, so its
 *     radius and its shadow are the card's own.
 *   - **Every card wears a tag, and the tag says WHEN.** The kind somebody stated when
 *     there is one, the column's own word when there is not — and beside it, quieter,
 *     how long ago that happened. A card with no tag reads as a card we know nothing
 *     about, and we always know at least that we contacted them; a tag with no date
 *     reads as a state with no age, which is the one thing a triage board is read for.
 *     That line replaced the per-card move menu: the same row now states the card
 *     rather than offering to change it, and a move is the drag the board already has.
 */

/** What the board needs of a lead. Structural, so nothing here imports a wire type. */
export interface LeadBoardCard {
  /** The leads_campaigns row id — what the card's own open action addresses. */
  id: string;
  /** The lead's email — what a reply-kind statement is written against. */
  email: string | null;
  name: string;
  /** The person's photo, when the enrichment carried one. Falls back to an initial. */
  photoUrl: string | null;
  orgName: string | null;
  orgDomain: string | null;
  column: LeadBoardColumnKey;
  /** The kind already stated for this lead, rendered as its badge when there is one. */
  replyKind: string | null;
  /**
   * The lead's most-advanced delivery status, in the SAME words the leads table's own
   * badge uses (`lib/lead-status.ts`) — "Website visit", "Delivered", "Sent",
   * "Bounced", "Queued". It is what the card's tag says when nobody has stated a kind,
   * and `statusAt` below is the instant that proves THIS status and no other.
   *
   * Passed in rather than derived here: the page holds the wire row, and this
   * component takes nothing from the wire on purpose.
   */
  statusLabel: string;
  statusTone: ReplyTone;
  /**
   * When the card's STATUS happened — the moment somebody stated the kind when one
   * was stated, otherwise the timestamp that proves the lead's own delivery status.
   *
   * Null when we hold no instant for it, and the card then says nothing rather than
   * dating the status from whatever else it has. A tag with the wrong date under it
   * is worse than a tag with none.
   */
  statusAt: string | null;
}

/** The move a person has picked but not yet said the kind of. */
interface PendingMove {
  card: LeadBoardCard;
  to: LeadBoardColumn;
}

/** The person's face, or their initial. 18px so the second line keeps its own height. */
function PersonMark({ photoUrl, name }: { photoUrl: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  const box = { width: 18, height: 18 };
  if (photoUrl && !broken) {
    return (
      <img
        src={photoUrl}
        alt=""
        style={box}
        className="shrink-0 rounded-full object-cover"
        loading="lazy"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span
      style={{ ...box, fontSize: 9 }}
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-gray-200 font-medium text-gray-500"
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/**
 * The card's two lines plus its tag — the shape a campaign wears everywhere else in
 * the dashboard (`CampaignIdentity`): what this is on top, where it came from
 * underneath, quieter, behind "Via".
 *
 * The ORG leads because a board is read company by company; the person follows. The
 * tag row states WHAT this card is and HOW LONG it has been that, on one line: the
 * two together are the whole reading a triage board is scanned for, and neither is
 * useful without the other.
 */
function CardBody({ card }: { card: LeadBoardCard }) {
  const stated = replyKindOption(card.replyKind);
  // The tag states what we last OBSERVED about this person, never the column it is
  // already sitting in: a card reading "Sales interest" under a heading reading
  // "Sales interest" spends its one tag saying nothing a reader did not have. So a
  // lead in Sales interest reads "Website visit", and one in Leads reads "Delivered"
  // or "Sent" or "Bounced" — the thing that actually distinguishes it from the card
  // above it. A kind somebody STATED still wins, because it is the more specific
  // answer and a person wrote it.
  const tag = stated
    ? { label: stated.label, tone: stated.tone as ReplyTone }
    : { label: card.statusLabel, tone: card.statusTone };
  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <CompanyLogo domain={card.orgDomain} name={card.orgName ?? card.name} size={32} />
        <div className="flex h-8 min-w-0 flex-col justify-center">
          <span className="truncate leading-[14px] text-sm text-gray-800" title={card.orgName ?? undefined}>
            {card.orgName ?? card.name}
          </span>
          <span className="flex h-[18px] min-w-0 items-center gap-1 text-xs leading-[18px] text-gray-500">
            <span className="shrink-0">Via</span>
            <PersonMark photoUrl={card.photoUrl} name={card.name} />
            <span className="truncate" title={card.name}>
              {card.name}
            </span>
          </span>
        </div>
      </div>

      <div className="mt-1.5 flex min-w-0 items-center gap-2">
        {/* WHAT WE LAST OBSERVED about this person — never the column's own word,
            which the heading above already carries. A kind somebody stated when there
            is one, otherwise the lead's most-advanced delivery status in the table's
            own vocabulary. Every card wears one: a tagless card reads as one we know
            nothing about, when we always know at least that we wrote to them. */}
        <span
          data-testid="lead-board-card-tag"
          className={`inline-flex min-w-0 truncate rounded-full border px-1.5 py-0.5 text-[11px] ${REPLY_TONE_PILL[tag.tone]}`}
        >
          {tag.label}
        </span>
        {/* HOW LONG it has been that. Quiet grey and beside the tag rather than pinned
            to the right: it qualifies the tag, so it reads as part of the same
            statement instead of as a second column of its own. The TAG is what gives
            way when the row is tight, never the date: the longest kind is far longer
            than any age, and a truncated "3 h…" states nothing at all. Absent instant
            renders nothing — an undated status is honest, an invented date is not. */}
        {card.statusAt && (
          <span
            data-testid="lead-board-card-age"
            className="shrink-0 text-[11px] text-gray-400"
            title={new Date(card.statusAt).toLocaleString()}
          >
            {timeAgo(card.statusAt)}
          </span>
        )}
      </div>
    </>
  );
}

export function LeadBoard({
  cards,
  busy,
  error,
  canMove,
  filterKey,
  onOpen,
  onMove,
}: {
  cards: LeadBoardCard[];
  busy: boolean;
  error: string | null;
  /**
   * What the page filtered this set by — the search box's text today.
   *
   * A column's reveal is a statement about the set the reader was looking at, so it
   * has to fall back when the set is re-queried, or a search that narrows Contacted to
   * three cards leaves the previous "showing 200" in place and the reader reads an
   * empty tail as the board loading. It is a PROP rather than a diff on `cards`
   * because `cards` is rebuilt on every poll: resetting on that would collapse a
   * column the reader had opened, every thirty seconds, for no reason they could see.
   */
  filterKey: string;
  /**
   * Whether a statement can be written at all. A reply kind is recorded against the
   * lead's CAMPAIGN, so a brand-level board — which spans several — can show the
   * triage and cannot write it. The cards then carry no move control rather than one
   * that fails on press.
   */
  canMove: boolean;
  onOpen: (leadRowId: string) => void;
  /**
   * The statement, plus the column it was made from.
   *
   * The column is not derivable from the kind here: where a card lands is
   * lead-service's answer, not a mapping this app holds. The page needs it only to
   * hold the card in place for the round trip — see the latch there.
   */
  onMove: (email: string, kind: ReplyKind, column: LeadBoardColumnKey) => void;
}) {
  const [pending, setPending] = useState<PendingMove | null>(null);
  // How many cards each column has been asked for. Per column, because the columns are
  // wildly different sizes — Contacted holds the whole campaign and Opt-out holds a
  // handful — so one shared count would either hide most of the board or defeat itself.
  const [shown, setShown] = useState<Record<string, number>>({});
  useEffect(() => {
    setShown({});
  }, [filterKey]);

  // One pass rather than a `filter` per column inside the render: the whole campaign's
  // leads go through this, and the render already walks four columns.
  const byColumn = useMemo(() => {
    const out = new Map<LeadBoardColumnKey, LeadBoardCard[]>();
    for (const column of LEAD_BOARD_COLUMNS) out.set(column.key, []);
    for (const card of cards) out.get(card.column)?.push(card);
    return out;
  }, [cards]);

  const startMove = (card: LeadBoardCard, to: LeadBoardColumn) => {
    setPending({ card, to });
  };

  // The gesture is the SHARED one every kanban here runs (`useBoardDrag`): hold to lift,
  // tap to open, the column under the pointer read off the document, the rail scrolling
  // itself at its edges. Only the WRITE is this board's own — a move states a reply kind,
  // which is why the drop opens a picker rather than committing anything.
  const board = useBoardDrag<LeadBoardCard>({
    idOf: (card) => card.id,
    columnOf: (card) => card.column,
    canDrag: (card) =>
      canMove && Boolean(card.email) && movableColumnsFrom(card.column).length > 0,
    onDrop: (card, columnKey) => {
      const to = LEAD_BOARD_COLUMNS.find((c) => c.key === columnKey);
      if (to) startMove(card, to);
    },
    onTap: (card) => onOpen(card.id),
  });
  const drag = board.drag;

  const pendingKinds = pending ? columnReplyKinds(pending.to.key) : [];
  const pendingRefusal = pending ? columnMoveRefusal(pending.to.key) : null;

  return (
    <div className="space-y-3">
      {pending && (
        <div
          className="rounded-xl border border-gray-200 bg-white p-3"
          data-testid="lead-board-move-form"
        >
          {pendingRefusal || pendingKinds.length === 0 || !pending.card.email ? (
            <>
              <p className="mb-2 text-sm text-gray-800">
                <span className="font-medium">{pending.card.name}</span> stays where they
                are.
              </p>
              <p className="mb-2 text-xs text-gray-500">
                {pendingRefusal ?? "Nothing can be recorded for this move."}
              </p>
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
              >
                OK
              </button>
            </>
          ) : (
            <>
              <p className="mb-2 text-sm text-gray-800">
                What did <span className="font-medium">{pending.card.name}</span> say?
              </p>
              <div className="flex flex-wrap gap-2">
                {pendingKinds.map((kind) => {
                  const option = replyKindOption(kind);
                  if (!option) return null;
                  return (
                    <button
                      key={kind}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        onMove(pending.card.email as string, kind, pending.to.key);
                        setPending(null);
                      }}
                      className={`rounded-full border px-2.5 py-1 text-xs ${REPLY_TONE_PILL[option.tone]} ${
                        busy ? "cursor-wait" : "hover:opacity-80"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setPending(null)}
                  className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600" data-testid="lead-board-error">
          {error}
        </p>
      )}

      <div ref={board.railRef} className="flex gap-3 overflow-x-auto pb-2">
        {LEAD_BOARD_COLUMNS.map((column) => {
          const inColumn = byColumn.get(column.key) ?? [];
          // "Not placed" reports that lead-service could not place some leads, so
          // drawing it on a healthy campaign advertises a problem that is not there.
          // The other four are the shape of the board and stay either way.
          if (column.hideWhenEmpty && inColumn.length === 0) return null;
          const { visible, remaining } = columnPage(
            inColumn.length,
            shown[column.key] ?? LEAD_BOARD_PAGE_SIZE,
          );
          const drawn = inColumn.slice(0, visible);
          // Every column lights up under a dragged card — the drop is accepted
          // everywhere and the form is where it is refused.
          const under = board.showsSlot(column.key);
          return (
            <section
              key={column.key}
              aria-label={column.label}
              data-board-column={column.key}
              data-testid={`lead-board-column-${column.key}`}
              className={`w-64 shrink-0 rounded-xl border p-2 ${
                under ? "border-purple-200 bg-purple-50" : "border-gray-200 bg-gray-50"
              }`}
            >
              <header className="mb-2 px-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-gray-800">
                    {column.label}
                  </span>
                  <span className="text-xs text-gray-500">{inColumn.length}</span>
                </div>
                <span className="mt-1 block text-[11px] text-gray-500">{column.blurb}</span>
              </header>

              <div className="space-y-2">
                {drawn.map((card) => {
                  const lifted = board.isLifted(card);
                  // The card in the air leaves its OUTLINE behind rather than fading in
                  // place: a column that collapses under the finger reflows the board
                  // mid-drag, and a 40%-opacity card still reads as a card that is here.
                  if (lifted) {
                    return (
                      <div
                        key={card.id}
                        {...board.cardHandlers(card)}
                        style={{ touchAction: "none" }}
                      >
                        <BoardSlot variant="origin" />
                      </div>
                    );
                  }
                  return (
                    <article
                      key={card.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open ${card.name}`}
                      {...board.cardHandlers(card)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onOpen(card.id);
                        }
                      }}
                      className="select-none cursor-pointer rounded-lg border border-gray-200 bg-white p-2 hover:border-gray-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-300"
                    >
                      <CardBody card={card} />
                    </article>
                  );
                })}
                {/* Where the held card would land, opened BEFORE release so a drop is
                    confirmed rather than discovered. Last in the column: the cards carry
                    no order anybody stated, so claiming a position would be inventing one. */}
                {under && <BoardSlot variant="target" />}
                {inColumn.length === 0 && !under && (
                  <p className="px-1 py-3 text-xs text-gray-400">Nobody here yet.</p>
                )}
                {/* States what is LEFT, not what a press adds: the reader is deciding
                    whether to keep going, and the size of the tail is what answers that.
                    A button rather than scroll-triggered loading — a board is a set
                    somebody is working, so the column grows when they ask and the page
                    never moves under them. */}
                {remaining > 0 && (
                  <button
                    type="button"
                    data-testid={`lead-board-more-${column.key}`}
                    onClick={() =>
                      setShown((prev) => ({
                        ...prev,
                        [column.key]: visible + LEAD_BOARD_PAGE_SIZE,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-300"
                  >
                    Show more ({remaining.toLocaleString("en-US")} left)
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* The card under the pointer. A LIVE element rather than a native drag image,
          which is what keeps its rounded corners rounded and its background opaque —
          the browser's own drag image composites the card onto a square and shows the
          page through the radius. */}
      {drag && (
        <div
          data-testid="lead-board-drag-ghost"
          aria-hidden
          className="pointer-events-none fixed z-50 w-60 rotate-2 rounded-lg border border-gray-200 bg-white p-2 shadow-lg"
          style={{ left: drag.x - 40, top: drag.y - 24 }}
        >
          <CardBody card={drag.card} />
        </div>
      )}
    </div>
  );
}
