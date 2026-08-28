"use client";

import { useState } from "react";
import { BoardSlot } from "@/components/boards/board-slot";
import { useBoardDrag } from "@/components/boards/use-board-drag";
import { CompanyLogo } from "@/components/company-logo";
import { InfoTooltip } from "@/components/visibility/metric-info";
import {
  LEAD_BOARD_COLUMNS,
  columnMoveRefusal,
  columnReplyKinds,
  movableColumnsFrom,
  type LeadBoardColumn,
  type LeadBoardColumnKey,
} from "@/lib/lead-board";
import { REPLY_TONE_PILL, replyKindOption, type ReplyKind, type ReplyTone } from "@/lib/reply-kind";

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
 *   - **Every card wears a tag.** The kind somebody stated when there is one, the
 *     column's own word when there is not. A card with no tag reads as a card we know
 *     nothing about, and we always know at least that we contacted them.
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
  /** The kind already stated for this lead, rendered as its badge. */
  replyKind: string | null;
}

/** The move a person has picked but not yet said the kind of. */
interface PendingMove {
  card: LeadBoardCard;
  to: LeadBoardColumn;
}

/**
 * The tone of a card's tag when nobody has stated a kind — the column's own verdict.
 *
 * Positive/negative rather than all-neutral because the column IS the judgement at
 * that point, and a Disqualified card reading in the same grey as a Contacted one
 * hides the only thing the board is sorted by.
 */
const COLUMN_TONE: Record<LeadBoardColumnKey, ReplyTone> = {
  contacted: "neutral",
  sales_interest: "positive",
  disqualified: "negative",
  opt_out: "negative",
};

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
 * tag row carries the move control on its right, so stating what a card is and
 * offering to change it cost ONE line between them rather than two.
 */
function CardBody({
  card,
  onMenu,
  menuOpen,
}: {
  card: LeadBoardCard;
  /** Absent on the drag ghost, which offers no controls. */
  onMenu?: () => void;
  menuOpen?: boolean;
}) {
  const stated = replyKindOption(card.replyKind);
  const column = LEAD_BOARD_COLUMNS.find((c) => c.key === card.column);
  const tag = stated
    ? { label: stated.label, tone: stated.tone }
    : { label: column?.label ?? "Contacted", tone: COLUMN_TONE[card.column] };
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

      <div className="mt-1.5 flex items-center justify-between gap-2">
        {/* WHY this card is in this column. A column holds several kinds, so the badge
            is the only place the particular one survives — and when nobody has stated
            one the column's own word stands in, because a tagless card reads as
            unknown when it is merely un-replied-to. */}
        <span
          data-testid="lead-board-card-tag"
          className={`inline-flex min-w-0 truncate rounded-full border px-1.5 py-0.5 text-[11px] ${REPLY_TONE_PILL[tag.tone]}`}
        >
          {tag.label}
        </span>
        {onMenu && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMenu();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-expanded={menuOpen}
            aria-label={`Move ${card.name} to another column`}
            className="shrink-0 rounded-md px-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-300"
          >
            <span aria-hidden className="text-sm leading-none">
              &#8943;
            </span>
          </button>
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
  onOpen,
  onMove,
}: {
  cards: LeadBoardCard[];
  busy: boolean;
  error: string | null;
  /**
   * Whether a statement can be written at all. A reply kind is recorded against the
   * lead's CAMPAIGN, so a brand-level board — which spans several — can show the
   * triage and cannot write it. The cards then carry no move control rather than one
   * that fails on press.
   */
  canMove: boolean;
  onOpen: (leadRowId: string) => void;
  onMove: (email: string, kind: ReplyKind) => void;
}) {
  const [pending, setPending] = useState<PendingMove | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const startMove = (card: LeadBoardCard, to: LeadBoardColumn) => {
    setMenuFor(null);
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
                        onMove(pending.card.email as string, kind);
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
          const inColumn = cards.filter((c) => c.column === column.key);
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
                {inColumn.map((card) => {
                  const targets = canMove && card.email ? movableColumnsFrom(card.column) : [];
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
                      <CardBody
                        card={card}
                        onMenu={targets.length > 0 ? () => setMenuFor(menuFor === card.id ? null : card.id) : undefined}
                        menuOpen={menuFor === card.id}
                      />
                      {menuFor === card.id && targets.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5 border-t border-gray-100 pt-1.5">
                          {targets.map((target) => (
                            <li key={target.key}>
                              <button
                                type="button"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startMove(card, target);
                                }}
                                className="w-full rounded px-1.5 py-1 text-left text-xs text-gray-600 hover:bg-gray-50"
                              >
                                {target.label}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
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

      <p className="text-xs text-gray-500">
        Hold a card to move it, tap to open it. A bounce and a &quot;not
        interested&quot; both stay in Contacted.{" "}
        <InfoTooltip tip="A bounce is a delivery failure, not an opinion: the address needs repairing, the person may still be interested. And in sales a no is the start of the conversation, so only an objective fact about the person (wrong role, moved on) reaches Disqualified." />
      </p>
    </div>
  );
}
