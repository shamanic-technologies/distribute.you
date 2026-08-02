"use client";

import { useEffect, useMemo, useRef } from "react";
import { sanitizeEmailHtml } from "@/lib/sanitize-email-html";

/**
 * An email, shown the way its recipient will see it.
 *
 * Rendered in an IFRAME rather than inlined into the page. An email carries its
 * own full-page background table, its own font stack and its own colours, all
 * written as inline styles on the elements — drop that into the console's DOM
 * and the two fight: the console's `html.dark` remap repaints the card, its
 * base styles reset the tables, and what the author approves is a hybrid that
 * exists nowhere. The iframe is a separate document, so the email is alone in
 * it, exactly as it is alone in an inbox.
 *
 * `sandbox=""` grants nothing: no scripts, no forms, no navigation, no access
 * to this page. Images still load, which is all an email needs. The HTML is
 * sanitized on the way in as well — belt and braces on markup that arrives over
 * the wire.
 *
 * The iframe takes the panel's width with no minimum. The email is built to be
 * responsive — a 600px card that goes edge to edge on a narrow screen — so this
 * shows it at the width the person looking at it would receive it, rather than
 * forcing the desktop rendering onto a phone.
 */

/**
 * A browser needs a document, and an email body is a fragment. Mail clients wrap
 * it the same way; the wrapper adds no styling of its own beyond removing the
 * default body margin, so nothing here can flatter what the email itself does.
 */
function asDocument(html: string): string {
  return (
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `</head><body style="margin:0">${html}</body></html>`
  );
}

export interface EmailPreviewModalProps {
  /** Subject line, as it will appear in the inbox. Null while it is still unwritten. */
  subject: string | null;
  /** The address it is sent from. */
  from: string;
  /** The rendered email body. Null while it is being fetched. */
  html: string | null;
  /** Why there is no body to show, when there is none. */
  error?: string | null;
  /** Anything worth stating beside the message — an appended footer, a bad image. */
  notes?: string[];
  onClose: () => void;
}

export function EmailPreviewModal({
  subject,
  from,
  html,
  error = null,
  notes = [],
  onClose,
}: EmailPreviewModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const srcDoc = useMemo(
    () => (html === null ? null : asDocument(sanitizeEmailHtml(html))),
    [html]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Email preview"
        className="relative flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
      >
        {/* The inbox header: who it is from, and what the subject line reads. */}
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-base font-semibold text-gray-900 break-words">
              {subject ?? <span className="font-normal text-gray-300">No subject yet</span>}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              From <span className="font-medium text-gray-700">{from}</span>
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            Close
          </button>
        </div>

        {notes.length > 0 ? (
          <ul className="border-b border-gray-100 bg-gray-50 px-5 py-2 space-y-0.5">
            {notes.map((note) => (
              <li key={note} className="text-xs text-gray-500">
                {note}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex-1 overflow-auto bg-gray-100">
          {error !== null ? (
            <p className="px-5 py-8 text-center text-sm font-medium text-red-600">{error}</p>
          ) : srcDoc === null ? (
            <p className="px-5 py-8 text-center text-sm text-gray-500">Rendering it...</p>
          ) : (
            <iframe
              title="Email preview"
              sandbox=""
              srcDoc={srcDoc}
              className="h-full w-full border-0"
            />
          )}
        </div>
      </div>
    </div>
  );
}
