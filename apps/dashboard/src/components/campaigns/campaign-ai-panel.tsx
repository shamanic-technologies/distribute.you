"use client";

import { useEffect, useMemo } from "react";
import { SparklesIcon, XMarkIcon } from "@heroicons/react/20/solid";
import { CampaignPrefillChat } from "./campaign-prefill-chat";
import type { FeatureInput } from "@/lib/api";

/* ─── Helpers ─────────────────────────────────────────────────────── */

function displayField(raw: string | null | undefined): string {
  if (!raw) return "";
  if (!raw.startsWith("{") && !raw.startsWith("[")) return raw;
  try {
    return flatten(JSON.parse(raw));
  } catch {
    return raw;
  }
}

function flatten(obj: unknown): string {
  if (obj == null) return "";
  if (typeof obj === "string") return obj;
  if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
  if (Array.isArray(obj)) return obj.map(flatten).filter(Boolean).join("\n");
  if (typeof obj === "object")
    return Object.values(obj as Record<string, unknown>)
      .map(flatten)
      .filter(Boolean)
      .join("\n");
  return String(obj);
}

/* ─── Inputs column ──────────────────────────────────────────────── */

function InputsColumn({
  formData,
  featureInputs,
}: {
  formData: Record<string, string>;
  featureInputs: FeatureInput[];
}) {
  const entries = useMemo(() => {
    const result: { label: string; value: string }[] = [];
    for (const input of featureInputs) {
      const raw = formData[input.key];
      result.push({ label: input.label, value: displayField(raw) });
    }
    return result;
  }, [formData, featureInputs]);

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-200">
        <h2 className="font-display font-semibold text-gray-800">
          Campaign Inputs
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {entries.length === 0 ? (
          <p className="text-sm text-gray-500">No inputs configured.</p>
        ) : (
          entries.map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
              <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 whitespace-pre-line min-h-[2.25rem]">
                {value || (
                  <span className="text-gray-300 italic">Empty</span>
                )}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ─── Main panel ─────────────────────────────────────────────────── */

interface CampaignAIPanelProps {
  open: boolean;
  onClose: () => void;
  chatId: string;
  campaignContext: Record<string, unknown>;
  formData: Record<string, string>;
  featureInputs: FeatureInput[];
  onFieldsUpdate: (fields: Record<string, string>) => void;
}

export function CampaignAIPanel({
  open,
  onClose,
  chatId,
  campaignContext,
  formData,
  featureInputs,
  onFieldsUpdate,
}: CampaignAIPanelProps) {
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-4xl bg-white shadow-xl z-50 flex flex-col animate-slide-in-right">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-4 h-4 text-brand-500" />
            <span className="font-display font-semibold text-gray-800">
              Edit with AI
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Two-column content */}
        <div className="flex flex-1 min-h-0">
          {/* Left: Inputs preview */}
          <div className="w-1/2 border-r border-gray-200 flex flex-col min-h-0">
            <InputsColumn
              formData={formData}
              featureInputs={featureInputs}
            />
          </div>

          {/* Right: Chat */}
          <div className="w-1/2 flex flex-col min-h-0">
            <CampaignPrefillChat
              chatId={chatId}
              campaignContext={campaignContext}
              onFieldsUpdate={onFieldsUpdate}
            />
          </div>
        </div>
      </div>
    </>
  );
}
