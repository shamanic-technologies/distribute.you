"use client";

/**
 * What kind of reply arrived, stated by a person.
 *
 * Sits on the reply row of the funnel-progress panel. It is a PICKER rather than the
 * two buttons every other row carries, because a reply is not a yes/no: there are nine
 * kinds in four groups, and the whole reason the vocabulary split four ways on the
 * positive side is that "positive" alone cannot separate "interested but not the buyer"
 * from "wants to book".
 *
 * Clicking the kind that is ALREADY stated takes the statement back rather than doing
 * nothing. Re-picking it used to be a deliberate no-op — the producer is idempotent on
 * the current value, so it was one anyway — which left a person who picked the wrong
 * kind with no way out at all: the vocabulary has no "nothing stated" member to pick
 * instead. The one gesture a person reaches for to undo a choice is the choice itself.
 *
 * Presentational — the page owns the read and the write.
 */

import { useState } from "react";
import {
  REPLY_TONE_LABEL,
  REPLY_TONE_ORDER,
  replyKindOption,
  replyKindPill,
  replyKindsByTone,
  type ReplyKind,
} from "@/lib/reply-kind";

export function ReplyKindControl({
  kind,
  tracked,
  pending,
  disabled = false,
  onSet,
  onWithdraw,
}: {
  /** The kind already stated or observed, verbatim from the producer. */
  kind: string | null;
  /** We saw a positive reply automatically, but nobody has said which kind. */
  tracked: boolean;
  pending: boolean;
  disabled?: boolean;
  onSet: (kind: ReplyKind) => void;
  /**
   * Take the standing statement back. Absent on a surface with nothing to withdraw
   * against, and the picker then reads exactly as it did before: re-picking the stated
   * kind is a no-op rather than an undo that goes nowhere.
   */
  onWithdraw?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const option = replyKindOption(kind);

  // A value the producer serves and this build does not render. Says so rather than
  // falling back to "nothing stated", which would invite someone to overwrite a real
  // statement they simply cannot see.
  const unknown = kind != null && option == null;

  const current = option ? (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${replyKindPill(option.kind)}`}>
      {option.label}
    </span>
  ) : unknown ? (
    <span className="text-xs text-gray-500">Stated, not shown here yet</span>
  ) : tracked ? (
    <span className="text-xs text-gray-500">Replied, kind not stated</span>
  ) : (
    <span className="text-xs text-gray-400">Not seen</span>
  );

  return (
    <span className="relative flex items-center gap-1.5">
      {current}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || pending}
        aria-expanded={open}
        aria-label={option ? "Change the reply kind" : "State the reply kind"}
        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border bg-white text-gray-500 border-gray-200 hover:bg-gray-50 ${
          pending ? "cursor-wait" : "disabled:opacity-40 disabled:cursor-not-allowed"
        }`}
      >
        {pending && (
          <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
        )}
        {option || unknown ? "Change" : "State"}
      </button>

      {open && (
        <span
          role="listbox"
          className="absolute right-0 top-full z-20 mt-1 w-56 max-w-[calc(100vw-32px)] rounded-lg border border-gray-200 bg-white shadow-lg p-1"
        >
          {REPLY_TONE_ORDER.map((tone) => (
            <span key={tone} className="block">
              <span className="block px-2 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                {REPLY_TONE_LABEL[tone]}
              </span>
              {replyKindsByTone(tone).map((o) => (
                <button
                  key={o.kind}
                  type="button"
                  role="option"
                  aria-selected={o.kind === kind}
                  title={
                    o.kind === kind && onWithdraw
                      ? "Take this statement back"
                      : undefined
                  }
                  onClick={() => {
                    setOpen(false);
                    // The stated kind, pressed again, TAKES THE STATEMENT BACK. Sending
                    // it once more would be a no-op at the producer (it is idempotent on
                    // the standing value), so nothing is lost and the one gesture a
                    // person reaches for to undo a choice finally does something.
                    if (o.kind !== kind) onSet(o.kind);
                    else onWithdraw?.();
                  }}
                  className={`flex w-full items-center justify-between gap-2 text-left px-2 py-1 text-xs rounded hover:bg-gray-50 ${
                    o.kind === kind ? "font-semibold text-gray-900" : "text-gray-700"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    {/* The kind's own colour, on the row that states it — so the pill
                        that appears after the press is the one the reader picked, and
                        the four positive kinds stop reading as four identical greens.
                        The dot borrows the pill's fill and border, not a fifth token. */}
                    <span
                      aria-hidden
                      className={`h-2 w-2 shrink-0 rounded-full border ${replyKindPill(o.kind)}`}
                    />
                    <span className="truncate">{o.label}</span>
                  </span>
                  {/* Said out loud on the row, because a control whose whole behaviour
                      is "press the thing you already pressed" is not discoverable from
                      the thing itself. */}
                  {o.kind === kind && onWithdraw && (
                    <span className="text-[10px] font-normal text-gray-400">Clear</span>
                  )}
                </button>
              ))}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
