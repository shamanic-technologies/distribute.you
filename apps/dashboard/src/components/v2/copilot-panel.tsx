"use client";

import { CaretDoubleRightIcon } from "@phosphor-icons/react/dist/csr/CaretDoubleRight";
import dynamic from "next/dynamic";

// The chat (AI SDK, markdown, its cards) is its own chunk, still server-rendered: the page's shell
// and query provider hydrate without waiting on it, and the server HTML of the panel stays in place
// until its chunk arrives (MON-PAGE-SPEED-FLOOR-1120: the v2 shell's JavaScript is every page's floor).
const CopilotChat = dynamic(() => import("@/components/v2/copilot-chat").then((m) => m.CopilotChat));
import { useCopilotDock } from "@/components/v2/copilot-dock";

/**
 * The Copilot as a right panel beside the page (owner 2026-10-10, replaces the
 * 10-09 bubble): shown by default, the arrow in its header hides it, the top bar's
 * "Copilot" button brings it back. Below `lg` it slides over the page instead of
 * squeezing it. Hidden = not displayed + `inert`, never unmounted: an answer keeps streaming.
 */
export function CopilotPanel({ orgId, brandId }: { orgId: string; brandId: string }) {
  const { open, setOpen } = useCopilotDock();
  return (
    <aside
      data-copilot
      aria-hidden={!open}
      inert={!open}
      className={`k-panel fixed inset-y-2 right-2 z-40 w-[min(420px,calc(100vw-16px))] flex-col overflow-hidden shadow-[var(--elev-popover)] lg:static lg:my-2 lg:mr-2 lg:w-[400px] lg:shrink-0 lg:shadow-[var(--elev-panel)] ${
        open ? "flex" : "hidden"
      }`}
    >
      <CopilotChat
        orgId={orgId}
        brandId={brandId}
        headerAction={
          <button type="button" onClick={() => setOpen(false)} aria-label="Hide the copilot" title="Hide the copilot" className="k-btn-ghost w-7 justify-center px-0">
            <CaretDoubleRightIcon size={14} weight="bold" />
          </button>
        }
      />
    </aside>
  );
}
