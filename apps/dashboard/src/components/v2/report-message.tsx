"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { listUnitReports } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { isMessageReported, messageWrittenUnit } from "@/lib/unit-reports";
import { useUnitReport } from "@/lib/use-unit-report";

/** The org's reports of one lead's messages: ONE read per thread (every message shares the key). */
function unitReportsKey(leadId: string) {
  return ["unitReports", "lead-service", leadId, "message_written"] as const;
}

/**
 * "Report" on a message we wrote (SCRIPT-VALUE-RATING-1113, owner 2026-11-13: « enlevons le point
 * positif, juste un message de report not good »). A sent message cannot be edited, so the client
 * says it here: an optional note, one click, one `reported` report of the message's Unit. The
 * message stays as it is; the row only says it was reported. No positive vote.
 *
 * The mark is read back from features-service (`GET /orgs/unit-reports`, the lead's reports): a
 * report whose `unitAt` is this message's send time marks it, after a reload too.
 */
export function ReportMessage({ leadId, sentAt }: { leadId: string; sentAt: string | null }) {
  const send = useUnitReport();
  const qc = useQueryClient();
  const reports = useAuthQuery(unitReportsKey(leadId), () =>
    listUnitReports({ subjectService: "lead-service", subjectId: leadId, outcomeKey: "message_written" }),
  );
  const servedReported = isMessageReported(reports.data, sentAt);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed" | "staff">("idle");

  const open = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = 288;
    setAt({ top: r.bottom + 6, left: Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8)) });
  };
  const close = () => setAt(null);

  useEffect(() => {
    if (!at) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !popRef.current?.contains(t)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [at]);

  const submit = async () => {
    setState("sending");
    try {
      // Staff mode is staff acting on the account, never the client: nothing is stored.
      const stored = await send(messageWrittenUnit(leadId, sentAt), "reported", note);
      if (!stored) {
        setState("staff");
        return;
      }
      setState("sent");
      close();
      // Re-read so the served list carries it (and the disk copy a reload paints from).
      void qc.invalidateQueries({ queryKey: unitReportsKey(leadId) });
    } catch (e) {
      console.error("[dashboard] message report not stored", { leadId, e });
      setState("failed");
    }
  };

  if (state === "sent" || servedReported) {
    return (
      <span className="k-fg3 inline-flex h-6 items-center px-1.5 text-[12px]" data-reported>
        Reported
      </span>
    );
  }

  const host = typeof document !== "undefined" ? document.getElementById("v2-portal") ?? document.body : null;
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-expanded={Boolean(at)}
        className="k-btn-ghost k-fg3 h-6 px-1.5 text-[12px]"
        onClick={() => (at ? close() : open())}
      >
        Report
      </button>
      {at && host
        ? createPortal(
            <div
              ref={popRef}
              role="dialog"
              aria-label="Report this message"
              className="k-popover fixed z-50 w-72 p-3"
              style={{ top: at.top, left: at.left, boxShadow: "var(--elev-popover)" }}
            >
              <div className="flex items-center justify-between">
                <p className="k-label">Report this message</p>
                <button type="button" aria-label="Close" className="k-btn-ghost h-6 w-6 justify-center p-0" onClick={close}>
                  ×
                </button>
              </div>
              <label className="k-inset mt-2 block rounded-lg px-3 py-2">
                <span className="sr-only">What is wrong with it</span>
                <textarea
                  autoFocus
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && state !== "sending") void submit();
                  }}
                  placeholder="What is wrong with it? (optional)"
                  className="block w-full resize-none bg-transparent text-[13px] leading-5 outline-none placeholder:text-[var(--fg-3)]"
                />
              </label>
              <div className="mt-2 flex items-center gap-2">
                {state === "staff" ? (
                  <span className="k-fg3 min-w-0 flex-1 text-[12px]">Not sent: Staff mode is on.</span>
                ) : state === "failed" ? (
                  <span role="alert" className="min-w-0 flex-1 text-[12px] text-[var(--data-rose)]">
                    Not sent. Try again.
                  </span>
                ) : (
                  <span className="k-fg3 min-w-0 flex-1 text-[12px]">Our next messages learn from it.</span>
                )}
                <button type="button" className="k-btn-strong" disabled={state === "sending"} onClick={() => void submit()}>
                  {state === "sending" ? "Sending…" : "Send report"}
                </button>
              </div>
            </div>,
            host,
          )
        : null}
    </>
  );
}
