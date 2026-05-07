"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import {
  upgradeWorkflow,
  forkWorkflow,
  type UpgradeWorkflowResult,
  type ForkWorkflowResult,
} from "@/lib/api";
import type { DAG } from "@/lib/api";

type Mode = "upgrade" | "fork";

interface WorkflowActionModalProps {
  mode: Mode;
  workflowId: string;
  workflowSlug: string;
  currentDag?: DAG;
  onClose: () => void;
  onSuccess: (newWorkflowId: string) => void;
}

export function WorkflowActionModal({
  mode,
  workflowId,
  workflowSlug,
  currentDag,
  onClose,
  onSuccess,
}: WorkflowActionModalProps) {
  const { getToken } = useAuth();
  const [description, setDescription] = useState("");
  const [hintsText, setHintsText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const token = (await getToken()) ?? undefined;
      const trimmedHints = hintsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (mode === "upgrade") {
        return upgradeWorkflow(
          {
            workflowSlug,
            description,
            hints: trimmedHints.length > 0 ? trimmedHints : undefined,
          },
          token,
        );
      }

      if (!currentDag) {
        throw new Error("Cannot fork without current workflow DAG");
      }
      return forkWorkflow(
        workflowId,
        { dag: currentDag, description },
        token,
      );
    },
    onSuccess: (result) => {
      const newId =
        mode === "upgrade"
          ? (result as UpgradeWorkflowResult).workflow.id
          : (result as ForkWorkflowResult).id;
      onSuccess(newId);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Request failed");
    },
  });

  const isPending = mutation.isPending;
  const tooShort = description.trim().length < 10;
  const isUpgrade = mode === "upgrade";
  const title = isUpgrade ? "Upgrade workflow" : "Fork as new variant";
  const submitLabel = isUpgrade ? "Upgrade" : "Fork";
  const helper = isUpgrade
    ? "Describe what to change. Stays in the same dynasty."
    : "Describe the variant. Creates a new dynasty.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/40"
        onClick={isPending ? undefined : onClose}
      />
      <div className="relative w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-white/[0.08]">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/[0.06]">
          <h2 className="font-display font-bold text-base text-gray-900 dark:text-gray-100">
            {title}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {helper}
          </p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Description
            </span>
            <textarea
              autoFocus
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                isUpgrade
                  ? "e.g. Add a step that scrapes the lead's website before sending."
                  : "e.g. Same outreach but for podcasts instead of journalists."
              }
              className="mt-1 w-full rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              disabled={isPending}
            />
            <span className="mt-1 block text-[11px] text-gray-400">
              Min 10 characters.
            </span>
          </label>
          {isUpgrade && (
            <label className="block">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Hints (comma-separated, optional)
              </span>
              <input
                type="text"
                value={hintsText}
                onChange={(e) => setHintsText(e.target.value)}
                placeholder="e.g. retry on 429, prefer apollo, dedupe by domain"
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                disabled={isPending}
              />
            </label>
          )}
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-gray-100 dark:border-white/[0.06] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
            disabled={isPending || tooShort}
            className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "Working…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
