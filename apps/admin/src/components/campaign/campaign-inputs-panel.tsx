"use client";

import { useEffect, useRef, type ReactNode } from "react";

function displayField(raw: string | null | undefined): string {
  if (!raw) return "";
  if (!raw.startsWith("{") && !raw.startsWith("[")) return raw;
  try {
    const parsed = JSON.parse(raw);
    return flatten(parsed);
  } catch {
    return raw;
  }
}

function flatten(obj: unknown): string {
  if (obj == null) return "";
  if (typeof obj === "string") return obj;
  if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
  if (Array.isArray(obj)) return obj.map(flatten).filter(Boolean).join("\n");
  if (typeof obj === "object") return Object.values(obj as Record<string, unknown>).map(flatten).filter(Boolean).join("\n");
  return String(obj);
}

const KNOWN_FIELDS: { key: string; label: string }[] = [
  { key: "targetAudience", label: "Target Audience" },
  { key: "targetOutcome", label: "Target Outcome" },
  { key: "valueForTarget", label: "Value for Target" },
  { key: "urgency", label: "Urgency" },
  { key: "scarcity", label: "Scarcity" },
  { key: "riskReversal", label: "Risk Reversal" },
  { key: "socialProof", label: "Social Proof" },
];

interface CampaignInputsPanelProps {
  open: boolean;
  onClose: () => void;
  featureInputs: Record<string, string> | null;
}

export function CampaignInputsPanel({ open, onClose, featureInputs }: CampaignInputsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  const entries: { label: string; value: string }[] = [];
  if (featureInputs) {
    // Show known fields first, then any remaining keys
    const shown = new Set<string>();
    for (const { key, label } of KNOWN_FIELDS) {
      if (featureInputs[key]) {
        entries.push({ label, value: displayField(featureInputs[key]) });
        shown.add(key);
      }
    }
    for (const [key, val] of Object.entries(featureInputs)) {
      if (!shown.has(key) && val) {
        const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();
        entries.push({ label, value: displayField(val) });
      }
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col animate-slide-in-right"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="font-display font-semibold text-gray-800">Campaign Inputs</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {entries.length === 0 ? (
            <p className="text-sm text-gray-500">No inputs configured for this campaign.</p>
          ) : (
            entries.map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
                <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 whitespace-pre-line">
                  {value}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
