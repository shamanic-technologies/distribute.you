"use client";

import { useState } from "react";
import { CompanyLogo } from "@/components/company-logo";
import { InfoTooltip } from "@/components/visibility/metric-info";
import {
  LEAD_BOARD_COLUMNS,
  columnReplyKinds,
  movableColumnsFrom,
  type LeadBoardColumn,
  type LeadBoardColumnKey,
} from "@/lib/lead-board";
import { REPLY_TONE_PILL, replyKindOption, type ReplyKind } from "@/lib/reply-kind";

/**
 * The leads BOARD — four triage columns, one card per lead.
 *
 * The tabs beside it are nested subsets (a lead that replied is also in Contacted), so
 * reading them tells you how many leads cleared each bar but never where any one lead
 * IS. The board is the other statement: a partition, one card per lead.
 *
 * Three things are load-bearing and none of them is the layout:
 *
 *   - **A move states a REPLY KIND, so it asks WHICH.** "Sales interest" is three
 *     different things a prospect can have said, and recording the wrong one is worse
 *     than recording nothing — so a drop opens a picker of that column's own kinds
 *     rather than writing a guess. The kinds are the catalogue's, the same words the
 *     lead panel uses.
 *   - **Opt-out takes no card.** Unsubscribing is the prospect's act and it is legally
 *     binding; a control that let us record it on their behalf would be recording a
 *     consent decision they never made. The column renders, and refuses.
 *   - **Every column says in one line what lands in it.** The splits here are not
 *     obvious from the words alone — a bounce sits under Contacted, a "no" sits under
 *     Contacted, and only an objective fact about the person reaches Disqualified.
 *
 * Reachable without a pointer: a card carries a Move control listing the same targets a
 * drag offers, because drag-and-drop is a mouse affordance and a phone has none.
 */

/** What the board needs of a lead. Structural, so nothing here imports a wire type. */
export interface LeadBoardCard {
  /** The leads_campaigns row id — what the card's own open action addresses. */
  id: string;
  /** The lead's email — what a reply-kind statement is written against. */
  email: string | null;
  name: string;
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
   * triage and cannot write it. The cards then carry no Move control rather than one
   * that fails on press.
   */
  canMove: boolean;
  onOpen: (leadRowId: string) => void;
  onMove: (email: string, kind: ReplyKind) => void;
}) {
  const [pending, setPending] = useState<PendingMove | null>(null);
  const [dragging, setDragging] = useState<LeadBoardCard | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const startMove = (card: LeadBoardCard, to: LeadBoardColumn) => {
    setMenuFor(null);
    setPending({ card, to });
  };

  const pendingKinds = pending ? columnReplyKinds(pending.to.key) : [];

  return (
    <div className="space-y-3">
      {pending && pending.card.email && (
        <div
          className="rounded-xl border border-gray-200 bg-white p-3"
          data-testid="lead-board-move-form"
        >
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
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600" data-testid="lead-board-error">
          {error}
        </p>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {LEAD_BOARD_COLUMNS.map((column) => {
          const inColumn = cards.filter((c) => c.column === column.key);
          const takesDrop =
            canMove && column.writable && dragging != null && dragging.column !== column.key;
          return (
            <section
              key={column.key}
              aria-label={column.label}
              data-testid={`lead-board-column-${column.key}`}
              onDragOver={(e) => {
                if (takesDrop) e.preventDefault();
              }}
              onDrop={(e) => {
                if (!takesDrop || !dragging) return;
                e.preventDefault();
                startMove(dragging, column);
                setDragging(null);
              }}
              className={`w-64 shrink-0 rounded-xl border p-2 ${
                takesDrop ? "border-purple-200 bg-purple-50" : "border-gray-200 bg-gray-50"
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
                  const stated = replyKindOption(card.replyKind);
                  return (
                    <article
                      key={card.id}
                      draggable={targets.length > 0}
                      onDragStart={() => setDragging(card)}
                      onDragEnd={() => setDragging(null)}
                      className="rounded-lg border border-gray-200 bg-white p-2"
                    >
                      <button
                        type="button"
                        onClick={() => onOpen(card.id)}
                        className="flex w-full min-w-0 items-center gap-2 text-left"
                      >
                        <CompanyLogo domain={card.orgDomain} name={card.orgName} size={24} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-gray-800">
                            {card.name}
                          </span>
                          {card.orgName && (
                            <span className="block truncate text-xs text-gray-500">
                              {card.orgName}
                            </span>
                          )}
                        </span>
                      </button>

                      {/* WHY this card is in this column, when somebody said so. A
                          column holds several kinds, so the badge is the only place the
                          particular one survives. */}
                      {stated && (
                        <span
                          className={`mt-1.5 inline-flex rounded-full border px-1.5 py-0.5 text-[11px] ${REPLY_TONE_PILL[stated.tone]}`}
                        >
                          {stated.label}
                        </span>
                      )}

                      {targets.length > 0 && (
                        <div className="mt-1.5">
                          {/* Bordered rather than a bare grey word: a plain text
                              control in a quiet colour reads as a label and never
                              gets pressed, which is how the resend link on the
                              verify screen went unused. */}
                          <button
                            type="button"
                            onClick={() => setMenuFor(menuFor === card.id ? null : card.id)}
                            aria-expanded={menuFor === card.id}
                            aria-label={`Move ${card.name} to another column`}
                            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-300"
                          >
                            Move
                            <span aria-hidden className="text-gray-400">
                              {menuFor === card.id ? "▴" : "▾"}
                            </span>
                          </button>
                          {menuFor === card.id && (
                            <ul className="mt-1 space-y-0.5">
                              {targets.map((target) => (
                                <li key={target.key}>
                                  <button
                                    type="button"
                                    onClick={() => startMove(card, target)}
                                    className="w-full rounded px-1.5 py-1 text-left text-xs text-gray-600 hover:bg-gray-50"
                                  >
                                    {target.label}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
                {inColumn.length === 0 && (
                  <p className="px-1 py-3 text-xs text-gray-400">Nobody here yet.</p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <p className="text-xs text-gray-500">
        A bounce and a &quot;not interested&quot; both stay in Contacted.{" "}
        <InfoTooltip tip="A bounce is a delivery failure, not an opinion: the address needs repairing, the person may still be interested. And in sales a no is the start of the conversation, so only an objective fact about the person (wrong role, moved on) reaches Disqualified." />
      </p>
    </div>
  );
}
