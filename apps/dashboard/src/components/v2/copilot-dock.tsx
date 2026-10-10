"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ChatCircleDotsIcon } from "@phosphor-icons/react/dist/csr/ChatCircleDots";

/**
 * Whether the Copilot panel is shown (owner 2026-10-10: a right panel, always on, a
 * button hides it, a button in the top bar brings it back). The choice survives a reload.
 * Kept apart from the panel so the top bar can read it without importing the chat.
 */
const STORAGE_KEY = "v2.copilot.open";

interface CopilotDock {
  /** On a brand page: the panel exists. */
  available: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const CopilotDockContext = createContext<CopilotDock>({ available: false, open: false, setOpen: () => {} });

export function useCopilotDock() {
  return useContext(CopilotDockContext);
}

export function useCopilotDockState(available: boolean): CopilotDock {
  const [open, setOpenState] = useState(true);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // First visit on a narrow screen: the panel would cover the page, start hidden.
      if (stored === null) setOpenState(window.matchMedia("(min-width: 1024px)").matches);
      else setOpenState(stored === "1");
    } catch {
      // Storage blocked: stay open, the default.
    }
  }, []);
  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Storage blocked: the choice lasts until the reload.
    }
  }, []);
  return { available, open, setOpen };
}

/** The top bar's way back to a hidden Copilot. Nothing while it is shown. */
export function CopilotShowButton() {
  const { available, open, setOpen } = useCopilotDock();
  if (!available || open) return null;
  return (
    <button type="button" onClick={() => setOpen(true)} aria-label="Show the copilot" className="k-btn gap-1.5">
      <ChatCircleDotsIcon size={14} weight="fill" className="text-[var(--accent)]" />
      Copilot
    </button>
  );
}
