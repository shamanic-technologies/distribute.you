"use client";

import { useEffect, useRef, useState } from "react";
import { CopilotChat } from "@/components/v2/copilot-chat";
import { PANEL_PCT_DEFAULT, PANEL_PCT_STORAGE_KEY, clampPanelPct, parseStoredPanelPct } from "@/lib/copilot";

/**
 * The Copilot frame: the chat sits on the canvas, the page is the inset panel on the right,
 * a third of the width by default and resizable from its left edge (the width is kept).
 * Below `lg` there is no room for both: the page alone, as for a customer.
 */
export function CopilotFrame({ orgId, brandId, children }: { orgId: string; brandId: string; children: React.ReactNode }) {
  const [pct, setPct] = useState(PANEL_PCT_DEFAULT);
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      setPct(parseStoredPanelPct(localStorage.getItem(PANEL_PCT_STORAGE_KEY)));
    } catch {
      // No storage: the default split.
    }
  }, []);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const row = rowRef.current;
    if (!row) return;
    e.preventDefault();
    const rect = row.getBoundingClientRect();
    let last = pct;
    const move = (ev: PointerEvent) => {
      last = clampPanelPct(((rect.right - ev.clientX) / rect.width) * 100);
      setPct(last);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      try {
        localStorage.setItem(PANEL_PCT_STORAGE_KEY, String(last));
      } catch {
        // No storage: the width holds until the reload.
      }
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <div ref={rowRef} className="flex min-w-0 flex-1">
      <div className="hidden min-w-0 flex-1 lg:block">
        <CopilotChat orgId={orgId} brandId={brandId} />
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the page panel"
        onPointerDown={onPointerDown}
        className="group hidden w-2 shrink-0 cursor-col-resize items-center justify-center lg:flex"
      >
        <span className="h-10 w-[3px] rounded-full bg-[var(--line)] opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
      </div>
      <main
        style={{ "--copilot-panel": `${pct}%` } as React.CSSProperties}
        className="k-panel k-scroll relative my-2 ml-2 mr-2 min-w-0 flex-1 overflow-y-auto lg:ml-0 lg:w-[var(--copilot-panel)] lg:flex-none"
      >
        {children}
      </main>
    </div>
  );
}
