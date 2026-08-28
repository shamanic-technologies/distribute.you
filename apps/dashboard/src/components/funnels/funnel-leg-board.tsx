"use client";

import { useState } from "react";
import { BoardSlot } from "@/components/boards/board-slot";
import { useBoardDrag } from "@/components/boards/use-board-drag";
import { CompanyLogo } from "@/components/company-logo";
import { StageStatementForm } from "@/components/leads/lead-funnel-stage-section";
import { REPLY_TONE_PILL } from "@/lib/reply-kind";
import type { LegBoardCard, LegBoardColumn } from "@/lib/funnel-leg-board";

/**
 * ONE ARROW of the funnel, as two columns a lead is moved across.
 *
 * The Leads page's board triages a lead — still in play, or why not. This asks the other
 * question, one arrow at a time: who reached the step before, and who has crossed. It is
 * a separate board because the WRITE is different: crossing a funnel arrow states a step
 * statement, which lead-service refuses without a cost, and the triage board has nowhere
 * to ask for one.
 *
 * Everything ELSE is shared, deliberately. The GESTURE is `useBoardDrag`, the same one the
 * triage board runs — hold to lift, tap to open, a live ghost under the pointer, a dashed
 * slot where the card came from and where it is going. A person who learned the board on
 * the Leads page has learned this one, and two copies of a pointer state machine drift the
 * first time either is touched.
 *
 * A move is a STATEMENT, so the drop does not write — it opens the same
 * `StageStatementForm` the lead panel uses, which asks what the step cost and, on the
 * step that closes a deal, what it was worth. A board that wrote on drop would meet
 * lead-service's refusal after the card had already moved.
 *
 * ONE DIRECTION. A card moves from the step before into this one and never back: a lead
 * who attended a meeting did attend it, and un-saying that is not a correction a board
 * can make honestly. The lead's own panel is where a statement is restated.
 */

/** The card's two lines plus its status tag — the shape the triage board's cards wear. */
function CardBody({
  card,
  columns,
  onMenu,
  menuOpen,
}: {
  card: LegBoardCard;
  columns: { from: LegBoardColumn; to: LegBoardColumn };
  /** Absent on the drag ghost, which offers no controls. */
  onMenu?: () => void;
  menuOpen?: boolean;
}) {
  // WHERE this lead is, said on the card. A board sorted by status whose cards do not
  // state one makes the reader hold the column headers in their head while they scroll,
  // and the ghost under the pointer leaves its column behind entirely.
  const crossed = card.side === "to";
  const tag = crossed ? columns.to.label : columns.from.label;
  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <CompanyLogo domain={card.orgDomain} name={card.orgName ?? card.name} size={32} />
        <div className="flex h-8 min-w-0 flex-col justify-center">
          <span
            className="truncate leading-[14px] text-sm text-gray-800"
            title={card.orgName ?? undefined}
          >
            {card.orgName ?? card.name}
          </span>
          <span className="block truncate text-xs leading-[18px] text-gray-500" title={card.name}>
            {card.name}
          </span>
        </div>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span
          data-testid="leg-board-card-tag"
          className={`inline-flex min-w-0 truncate rounded-full border px-1.5 py-0.5 text-[11px] ${
            crossed ? REPLY_TONE_PILL.positive : REPLY_TONE_PILL.neutral
          }`}
        >
          {tag}
        </span>
        {/* The keyboard and touch path to the same move the hold makes. A `⋯` on the tag's
            own row rather than a labelled button: it costs the card no extra line, and it
            is the control the triage board already taught. */}
        {onMenu && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMenu();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-expanded={menuOpen}
            aria-label={`Move ${card.name} to ${columns.to.label}`}
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

export function FunnelLegBoard({
  columns,
  cards,
  totals,
  needsValue,
  busy,
  error,
  writable,
  onOpen,
  onCross,
}: {
  columns: { from: LegBoardColumn; to: LegBoardColumn };
  cards: { from: LegBoardCard[]; to: LegBoardCard[] };
  /** How many are on each side BEFORE the cap, so a capped column can say so. */
  totals: { from: number; to: number };
  /** Whether crossing this arrow also has to say what the deal was worth. */
  needsValue: boolean;
  busy: boolean;
  error: string | null;
  /**
   * Whether lead-service takes a statement on this step at all. A positive REPLY is a
   * fact about a message and a website VISIT is measured by the delivery layer, so those
   * arrows render read-only: the cards carry no move control rather than one that fails
   * on press, and the reason is stated once above the columns.
   */
  writable: boolean;
  onOpen: (leadRowId: string) => void;
  onCross: (leadRowId: string, input: { costCents: number; valueCents?: number }) => void;
}) {
  const [pending, setPending] = useState<LegBoardCard | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const board = useBoardDrag<LegBoardCard>({
    idOf: (card) => card.id,
    columnOf: (card) => card.side,
    // ONE DIRECTION: only a card on the near side can be picked up, and only when the
    // step takes a statement at all.
    canDrag: (card) => writable && card.side === "from",
    onDrop: (card, columnKey) => {
      if (columnKey !== "to") return;
      setPending(card);
    },
    onTap: (card) => onOpen(card.id),
  });

  return (
    <div className="space-y-3">
      {pending && (
        <div
          className="rounded-xl border border-gray-200 bg-white p-3"
          data-testid="leg-board-cross-form"
        >
          <p className="mb-2 text-sm text-gray-800">
            <span className="font-medium">{pending.name}</span> reached{" "}
            <span className="font-medium">{columns.to.label.toLowerCase()}</span>. What did that
            step cost you?
          </p>
          <StageStatementForm
            label={columns.to.label}
            tone="outcome"
            needsValue={needsValue}
            busy={busy}
            onSubmit={(input) => {
              onCross(pending.id, input);
              setPending(null);
            }}
            onCancel={() => setPending(null)}
          />
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div ref={board.railRef} className="grid gap-3 overflow-x-auto sm:grid-cols-2">
        {(["from", "to"] as const).map((side) => {
          const column = columns[side];
          const list = cards[side];
          const total = totals[side];
          const under = board.showsSlot(side);
          return (
            <section
              key={side}
              aria-label={column.label}
              data-board-column={side}
              data-testid={`leg-board-column-${side}`}
              className={`rounded-xl border p-3 ${
                under ? "border-purple-200 bg-purple-50" : "border-gray-200 bg-gray-50"
              }`}
            >
              <header className="mb-2 flex items-center gap-2">
                {/* No mark here: the page header above already draws the arrow's, and a
                    second tile per column would say the same thing three times. */}
                <h3 className="text-sm font-medium text-gray-800">{column.label}</h3>
                <span className="text-xs text-gray-500">{total.toLocaleString("en-US")}</span>
              </header>

              <div className="space-y-2">
                {list.map((card) => {
                  const lifted = board.isLifted(card);
                  // The card in the air leaves its OUTLINE behind: a column that collapses
                  // under the finger reflows the board mid-drag.
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
                  const movable = writable && card.side === "from";
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
                        columns={columns}
                        onMenu={movable ? () => setMenuFor(menuFor === card.id ? null : card.id) : undefined}
                        menuOpen={menuFor === card.id}
                      />
                      {menuFor === card.id && movable && (
                        <ul className="mt-1.5 space-y-0.5 border-t border-gray-100 pt-1.5">
                          <li>
                            <button
                              type="button"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuFor(null);
                                setPending(card);
                              }}
                              className="w-full rounded px-1.5 py-1 text-left text-xs text-gray-600 hover:bg-gray-50"
                            >
                              {columns.to.label}
                            </button>
                          </li>
                        </ul>
                      )}
                    </article>
                  );
                })}

                {/* Where the held card would land, opened BEFORE release so a drop is
                    confirmed rather than discovered. */}
                {under && <BoardSlot variant="target" />}

                {list.length === 0 && !under && (
                  <p className="px-1 py-6 text-center text-xs text-gray-500">
                    {side === "to"
                      ? "Nobody has crossed this step yet."
                      : "Nobody has reached the step before this one yet."}
                  </p>
                )}
              </div>

              {/* Never a silent truncation: a column showing 60 of 9,166 and saying
                  nothing claims the funnel is smaller than it is. */}
              {total > list.length && (
                <p className="mt-2 px-1 text-xs text-gray-400">
                  {/* The number DRAWN, not the cap: they coincide in the app and the cap
                      is the wrong number to state when they do not. */}
                  Showing the first {list.length} of {total.toLocaleString("en-US")}. The Leads
                  page lists them all.
                </p>
              )}
            </section>
          );
        })}
      </div>

      {/* The card under the pointer. A LIVE element rather than a native drag image,
          which is what keeps its rounded corners rounded and its background opaque. */}
      {board.drag && (
        <div
          data-testid="leg-board-drag-ghost"
          aria-hidden
          className="pointer-events-none fixed z-50 w-60 rotate-2 rounded-lg border border-gray-200 bg-white p-2 shadow-lg"
          style={{ left: board.drag.x - 40, top: board.drag.y - 24 }}
        >
          <CardBody card={board.drag.card} columns={columns} />
        </div>
      )}

      <p className="text-xs text-gray-500">
        {writable
          ? "Hold a card to move it, tap to open it. Moving it asks what the step cost you."
          : "This step is measured for you, so it takes no statement by hand."}
      </p>
    </div>
  );
}
