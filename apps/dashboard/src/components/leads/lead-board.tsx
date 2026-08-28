"use client";

import { useState } from "react";
import { StageStatementForm } from "@/components/leads/lead-funnel-stage-section";
import { CompanyLogo } from "@/components/company-logo";
import { InfoTooltip } from "@/components/visibility/metric-info";
import {
  SOURCE_LABEL,
  movableColumnsFrom,
  type LeadBoardColumn,
  type LeadBoardColumnKey,
} from "@/lib/lead-board";
import { stageRequiresValue, type WritableStageKey } from "@/lib/lead-funnel-stages";

/**
 * The leads BOARD — the funnel laid out as columns, one card per lead.
 *
 * The tabs beside it are nested subsets (a lead that replied is also in Outreach), so
 * reading them tells you how many leads cleared each bar but never where any one lead
 * IS. The board is the other statement: a partition, one card per lead, in the furthest
 * step it reached. That is what a person moving work along reads.
 *
 * Three things are load-bearing and none of them is the layout:
 *
 *   - **A move is a STATEMENT, and lead-service refuses one without a cost.** So a drop
 *     cannot write on its own: it opens the SAME `StageStatementForm` the lead panel
 *     uses, which asks what the step cost and — on the one step the producer prices —
 *     what the deal was worth. A board that wrote on drop would meet a 400 the person
 *     never had a chance to answer.
 *   - **Only some columns take a card.** lead-service accepts a statement on five of the
 *     seven steps; a reply's kind is a fact about a message and a click is measured by
 *     the delivery layer, so neither can be stated. Those columns render, and refuse.
 *   - **Every column says where its evidence comes from.** That is the question somebody
 *     asked of this board out loud: which of these did we update ourselves, and which
 *     did the platform see. It sits on the column because it is a property of the STEP.
 *
 * Reachable without a pointer: a card carries a Move control listing the same targets a
 * drag offers, because drag-and-drop is a mouse affordance and a phone has none.
 */

/** What the board needs of a lead. Structural, so nothing here imports a wire type. */
export interface LeadBoardCard {
  /** The leads_campaigns row id — what a statement is written against. */
  id: string;
  name: string;
  orgName: string | null;
  orgDomain: string | null;
  column: LeadBoardColumnKey;
}

/** The move a person has picked but not yet priced. */
interface PendingMove {
  card: LeadBoardCard;
  to: LeadBoardColumn;
}

const SOURCE_TONE: Record<string, string> = {
  measured: "bg-blue-50 text-blue-700 border-blue-200",
  tracked: "bg-indigo-50 text-indigo-700 border-indigo-200",
  stated: "bg-purple-50 text-purple-700 border-purple-200",
};

const SOURCE_TIP: Record<string, string> = {
  measured:
    "We see this one happen: the reply arrived, or the link was clicked. Nobody types it and nobody can.",
  tracked:
    "Your own conversion tracker reported it. It only fills in once that tracker is wired up.",
  stated:
    "Nothing can observe this one, so somebody has to say it happened. Drag a card here, or use Move on the card.",
};

export function LeadBoard({
  columns,
  cards,
  busy,
  error,
  onOpen,
  onMove,
}: {
  columns: LeadBoardColumn[];
  cards: LeadBoardCard[];
  busy: boolean;
  error: string | null;
  onOpen: (leadRowId: string) => void;
  onMove: (
    leadRowId: string,
    step: WritableStageKey,
    input: { costCents: number; valueCents?: number },
  ) => void;
}) {
  const [pending, setPending] = useState<PendingMove | null>(null);
  const [dragging, setDragging] = useState<LeadBoardCard | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const startMove = (card: LeadBoardCard, to: LeadBoardColumn) => {
    setMenuFor(null);
    setPending({ card, to });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span>Where each step comes from:</span>
        {(["measured", "tracked", "stated"] as const).map((source) => (
          <span
            key={source}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${SOURCE_TONE[source]}`}
          >
            {SOURCE_LABEL[source]}
            <InfoTooltip tip={SOURCE_TIP[source]} />
          </span>
        ))}
      </div>

      {pending && (
        <div
          className="rounded-xl border border-gray-200 bg-white p-3"
          data-testid="lead-board-move-form"
        >
          <p className="mb-2 text-sm text-gray-800">
            Move <span className="font-medium">{pending.card.name}</span> to{" "}
            <span className="font-medium">{pending.to.label}</span>
          </p>
          <StageStatementForm
            label={pending.to.label}
            tone="outcome"
            needsValue={stageRequiresValue(pending.to.key as WritableStageKey)}
            busy={busy}
            onSubmit={(input) => {
              onMove(pending.card.id, pending.to.key as WritableStageKey, input);
              setPending(null);
            }}
            onCancel={() => setPending(null)}
          />
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600" data-testid="lead-board-error">
          {error}
        </p>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((column) => {
          const inColumn = cards.filter((c) => c.column === column.key);
          const takesDrop =
            column.writable && dragging != null && dragging.column !== column.key;
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
                {column.source ? (
                  <span
                    className={`mt-1 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] ${SOURCE_TONE[column.source]}`}
                  >
                    {SOURCE_LABEL[column.source]}
                  </span>
                ) : (
                  <span className="mt-1 block text-[11px] text-gray-400">
                    Contacted, nothing back yet
                  </span>
                )}
              </header>

              <div className="space-y-2">
                {inColumn.map((card) => {
                  const targets = movableColumnsFrom(columns, card.column);
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
                            aria-label={`Move ${card.name} to another step`}
                            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-300"
                          >
                            Move
                            <span aria-hidden className="text-gray-400">
                              {menuFor === card.id ? "\u25B4" : "\u25BE"}
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
    </div>
  );
}
