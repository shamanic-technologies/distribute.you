"use client";

import { useState } from "react";
import { CompanyLogo } from "@/components/company-logo";
import { StageStatementForm } from "@/components/leads/lead-funnel-stage-section";
import type { LegBoardCard, LegBoardColumn } from "@/lib/funnel-leg-board";

/**
 * ONE ARROW of the funnel, as two columns a lead is dragged across.
 *
 * The Leads page's board triages a lead — still in play, or why not. This asks the other
 * question, one arrow at a time: who reached the step before, and who has crossed. It is
 * a separate board because the WRITE is different: crossing a funnel arrow states a step
 * statement, which lead-service refuses without a cost, and the triage board has nowhere
 * to ask for one. Its own comment says exactly that.
 *
 * A move is a STATEMENT, so the drop does not write — it opens the same
 * `StageStatementForm` the lead panel uses, which asks what the step cost and, on the
 * step that closes a deal, what it was worth. A board that wrote on drop would meet
 * lead-service's refusal after the card had already moved.
 *
 * Reachable without a pointer: every card carries a Move button doing what the drag does.
 * Drag is a mouse affordance and a phone has none — the same reason the triage board
 * carries one.
 *
 * ONE DIRECTION. A card moves from the step before into this one and never back: a lead
 * who attended a meeting did attend it, and un-saying that is not a correction a board
 * can make honestly. The lead's own panel is where a statement is restated.
 */
export function FunnelLegBoard({
  columns,
  cards,
  totals,
  needsValue,
  busy,
  error,
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
  onOpen: (leadRowId: string) => void;
  onCross: (leadRowId: string, input: { costCents: number; valueCents?: number }) => void;
}) {
  const [pending, setPending] = useState<LegBoardCard | null>(null);
  const [dragging, setDragging] = useState<LegBoardCard | null>(null);
  const [over, setOver] = useState(false);

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

      <div className="grid gap-3 sm:grid-cols-2">
        {(["from", "to"] as const).map((side) => {
          const column = columns[side];
          const list = cards[side];
          const total = totals[side];
          const isTarget = side === "to";
          return (
            <section
              key={side}
              data-testid={`leg-board-column-${side}`}
              onDragOver={(e) => {
                if (!isTarget || !dragging || dragging.side === "to") return;
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => isTarget && setOver(false)}
              onDrop={() => {
                setOver(false);
                if (!isTarget || !dragging || dragging.side === "to") return;
                setPending(dragging);
                setDragging(null);
              }}
              className={`rounded-xl border bg-gray-50 p-3 transition ${
                isTarget && over ? "border-brand-300 bg-brand-50" : "border-gray-200"
              }`}
            >
              <header className="mb-2 flex items-center gap-2">
                {/* No mark here: the page header above already draws the arrow's, and a
                    second tile per column would say the same thing three times. */}
                <h3 className="text-sm font-medium text-gray-800">{column.label}</h3>
                <span className="text-xs text-gray-500">{total.toLocaleString("en-US")}</span>
              </header>

              {list.length === 0 ? (
                <p className="px-1 py-6 text-center text-xs text-gray-500">
                  {isTarget
                    ? "Nobody has crossed this step yet."
                    : "Nobody has reached the step before this one yet."}
                </p>
              ) : (
                <ul className="space-y-2">
                  {list.map((card) => (
                    <li
                      key={card.id}
                      draggable={!isTarget}
                      onDragStart={() => setDragging(card)}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(false);
                      }}
                      className="rounded-lg border border-gray-200 bg-white p-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <CompanyLogo domain={card.orgDomain} name={card.orgName} size={28} />
                        <button
                          type="button"
                          onClick={() => onOpen(card.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block truncate text-sm text-gray-800">{card.name}</span>
                          {card.orgName && (
                            <span className="block truncate text-xs text-gray-500">
                              {card.orgName}
                            </span>
                          )}
                        </button>
                        {/* The keyboard and touch path to the same move the drag makes.
                            A bordered control rather than a bare word: a quiet grey
                            label reads as a caption and never gets pressed. */}
                        {!isTarget && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setPending(card)}
                            className="shrink-0 rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                          >
                            Move
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

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
    </div>
  );
}
