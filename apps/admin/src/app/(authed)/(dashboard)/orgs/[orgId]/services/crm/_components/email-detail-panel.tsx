"use client";

import { useEffect, useMemo } from "react";
import type { GoogleMessage } from "./messages-list";
import { parseGmailPayload, type GmailMessageShape } from "./parse-gmail-payload";
import { parseGmailBody } from "./parse-gmail-body";
import { sanitizeEmailHtml } from "./sanitize-email-html";

function findAllHeaders(
  headers: Array<{ name?: string; value?: string }> | undefined,
  name: string,
): string[] {
  if (!headers) return [];
  const target = name.toLowerCase();
  const out: string[] = [];
  for (const h of headers) {
    if (typeof h?.name === "string" && h.name.toLowerCase() === target && typeof h.value === "string") {
      out.push(h.value);
    }
  }
  return out;
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function EmailDetailPanel({
  message,
  onClose,
}: {
  message: GoogleMessage;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const envelope = message.payload;
  const innerPayload = envelope?.payload;

  const parsed = parseGmailPayload(message as unknown as GmailMessageShape);
  const headers = innerPayload?.headers;

  // Prefer the typed google-service fields; fall back to the raw payload while
  // the additive typed rollout is not yet live (payload is real wire data). Body,
  // Cc/Bcc/Reply-To have no typed replacement in the contract → payload only.
  const subject =
    typeof message.subject === "string" && message.subject.length > 0
      ? message.subject
      : parsed.subject;
  const fromLine =
    (typeof message.fromName === "string" && message.fromName.length > 0
      ? message.fromName
      : null) ??
    (typeof message.fromEmail === "string" && message.fromEmail.length > 0
      ? message.fromEmail
      : null) ??
    parsed.from;
  const toAddrs =
    Array.isArray(message.to) && message.to.length > 0
      ? message.to
      : findAllHeaders(headers, "To");
  const dateLine =
    typeof message.sentAt === "string" && message.sentAt.length > 0
      ? new Date(message.sentAt).toLocaleString()
      : parsed.date;
  const labelIds =
    Array.isArray(message.labels) && message.labels.length > 0
      ? message.labels
      : envelope?.labelIds;
  const ccAddrs = findAllHeaders(headers, "Cc");
  const bccAddrs = findAllHeaders(headers, "Bcc");
  const replyTo = findAllHeaders(headers, "Reply-To");

  const body = useMemo(() => parseGmailBody(innerPayload), [innerPayload]);
  const sanitizedHtml = useMemo(
    () => (body.html !== null ? sanitizeEmailHtml(body.html) : null),
    [body.html],
  );

  const bodyMissing = body.html === null && body.text === null;
  if (bodyMissing) {
    console.error(
      "[dashboard] EmailDetailPanel: no renderable body found in payload",
      message.id ?? message.gmailMessageId,
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 z-50 w-full md:w-[640px] lg:w-[760px] bg-white shadow-2xl flex flex-col">
        <div className="border-b border-gray-100 p-5 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="font-display font-bold text-xl text-gray-800 leading-tight break-words">
                {subject ?? <span className="text-gray-400 italic">(no subject)</span>}
              </h2>
              {fromLine !== null && (
                <p className="text-sm text-gray-600 mt-2 break-words">
                  <span className="text-gray-400">From: </span>
                  {fromLine}
                </p>
              )}
              {toAddrs.length > 0 && (
                <p className="text-sm text-gray-600 mt-1 break-words">
                  <span className="text-gray-400">To: </span>
                  {toAddrs.join(", ")}
                </p>
              )}
              {ccAddrs.length > 0 && (
                <p className="text-sm text-gray-600 mt-1 break-words">
                  <span className="text-gray-400">Cc: </span>
                  {ccAddrs.join(", ")}
                </p>
              )}
              {bccAddrs.length > 0 && (
                <p className="text-sm text-gray-600 mt-1 break-words">
                  <span className="text-gray-400">Bcc: </span>
                  {bccAddrs.join(", ")}
                </p>
              )}
              {replyTo.length > 0 && (
                <p className="text-sm text-gray-600 mt-1 break-words">
                  <span className="text-gray-400">Reply-To: </span>
                  {replyTo.join(", ")}
                </p>
              )}
              {dateLine !== null && (
                <p className="text-xs text-gray-400 mt-2">{dateLine}</p>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 hover:bg-gray-100 rounded-lg transition flex-shrink-0"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {Array.isArray(labelIds) && labelIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {labelIds.map((label) => (
                <span
                  key={label}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {bodyMissing ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              Failed to render email body. Payload is missing or unparseable.
            </div>
          ) : sanitizedHtml !== null ? (
            <div
              className="prose prose-sm max-w-none text-gray-800"
              // eslint-disable-next-line react/no-danger -- sanitized via DOMPurify in sanitize-email-html.ts
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />
          ) : body.text !== null ? (
            <pre className="whitespace-pre-wrap break-words text-sm text-gray-800 font-sans">
              {body.text}
            </pre>
          ) : null}

          {body.attachments.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Attachments ({body.attachments.length})
              </h3>
              <ul className="space-y-1.5">
                {body.attachments.map((att, idx) => (
                  <li
                    key={`${att.filename}-${idx}`}
                    className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1 mr-3">
                      <p className="text-gray-800 truncate">{att.filename}</p>
                      <p className="text-xs text-gray-400">{att.mimeType}</p>
                    </div>
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {formatBytes(att.size)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {message.threadId !== undefined && (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                <span className="font-mono">threadId: {message.threadId}</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
