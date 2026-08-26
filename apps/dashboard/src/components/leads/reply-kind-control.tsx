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
 * Presentational — the page owns the read and the write.
 */

import { useState } from "react";
import {
  REPLY_TONE_LABEL,
  REPLY_TONE_ORDER,
  REPLY_TONE_PILL,
  replyKindOption,
  replyKindsByTone,
  type ReplyKind,
} from "@/lib/reply-kind";

export function ReplyKindControl({
  kind,
  tracked,
  pending,
  disabled = false,
  onSet,
}: {
  /** The kind already stated or observed, verbatim from the producer. */
  kind: string | null;
  /** We saw a positive reply automatically, but nobody has said which kind. */
  tracked: boolean;
  pending: boolean;
  disabled?: boolean;
  onSet: (kind: ReplyKind) => void;
}) {
  const [open, setOpen] = useState(false);
  const option = replyKindOption(kind);

  // A value the producer serves and this build does not render. Says so rather than
  // falling back to "nothing stated", which would invite someone to overwrite a real
  // statement they simply cannot see.
  const unknown = kind != null && option == null;

  const current = option ? (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${REPLY_TONE_PILL[option.tone]}`}>
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
                  onClick={() => {
                    setOpen(false);
                    // Re-stating what is already stated is a no-op rather than a
                    // second identical row in the record of who said what.
                    if (o.kind !== kind) onSet(o.kind);
                  }}
                  className={`block w-full text-left px-2 py-1 text-xs rounded hover:bg-gray-50 ${
                    o.kind === kind ? "font-semibold text-gray-900" : "text-gray-700"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
