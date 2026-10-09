"use client";

import { useState } from "react";
import { ChatCircleDotsIcon } from "@phosphor-icons/react/dist/csr/ChatCircleDots";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { CopilotChat } from "@/components/v2/copilot-chat";

/**
 * The staff Copilot as a widget (owner 2026-10-09): a bubble bottom right that floats above
 * the page. It opens on every load; a click on the bubble closes it, another
 * click reopens it. The chat stays mounted while closed, so an answer keeps streaming.
 */
export function CopilotWidget({ orgId, brandId }: { orgId: string; brandId: string }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <div
        aria-hidden={!open}
        className={`k-popover fixed bottom-20 right-4 z-40 flex h-[min(720px,calc(100dvh-112px))] w-[min(440px,calc(100vw-32px))] origin-bottom-right flex-col overflow-hidden transition-[opacity,transform] duration-200 ease-[cubic-bezier(.23,1,.32,1)] ${
          open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        }`}
        inert={!open}
      >
        <CopilotChat orgId={orgId} brandId={brandId} />
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close the copilot" : "Open the copilot"}
        aria-expanded={open}
        className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-[var(--elev-popover)] transition-transform duration-150 ease-out hover:scale-105 active:scale-95"
      >
        {open ? <XIcon size={20} weight="bold" /> : <ChatCircleDotsIcon size={22} weight="fill" />}
      </button>
    </>
  );
}
