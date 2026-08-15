"use client";

import { useEffect } from "react";
import { XMarkIcon } from "@heroicons/react/20/solid";
import { WorkflowChat } from "@/components/workflows/workflow-chat";

interface WorkflowAiPanelProps {
  open: boolean;
  onClose: () => void;
  /**
   * Chat context. Built by the page from the workflow catalogue — see
   * `workflowCatalogueInstructions`. Never carries a DAG.
   */
  context: Record<string, unknown>;
  /**
   * Session key for the conversation. NOT a workflow UUID: this chat spans every
   * workflow of the feature, so the thread is keyed on the page, and one thread
   * survives across the several workflows a session may touch.
   */
  sessionKey: string;
}

/**
 * The Workflow page's "Edit with AI" surface: the SAME chat the single-workflow
 * editor runs, in a right-side overlay over the table.
 *
 * Overlay rather than a column because the table is the thing being talked
 * about — a split layout would halve it, and the answer the user is waiting for
 * is a new ROW in it, not a redraw of the panel.
 *
 * It stays MOUNTED once opened (hidden, not unmounted) so closing the panel to
 * look at the table does not abort a streaming answer or lose the thread.
 */
export function WorkflowAiPanel({ open, onClose, context, sessionKey }: WorkflowAiPanelProps) {
  // Esc closes. Bound only while open, so it cannot swallow the key elsewhere.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-40 ${open ? "" : "pointer-events-none invisible"}`}
      aria-hidden={!open}
    >
      {/* Scrim: dims the table and takes the click that closes the panel. */}
      <div
        className={`absolute inset-0 bg-gray-900/30 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-label="Edit workflows with AI"
        className={`absolute inset-y-0 right-0 flex w-full max-w-full flex-col border-l border-gray-200 bg-white shadow-xl transition-transform sm:w-[560px] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">Edit with AI</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Name a workflow and say what to change. A workflow it creates shows up in the
              table with no numbers yet, because it has not run.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-m-1.5 rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          <WorkflowChat workflowId={sessionKey} workflowContext={context} />
        </div>
      </aside>
    </div>
  );
}
