"use client";

import { useEffect, useState } from "react";
import {
  getLeadConsolidatedStatus,
  type Lead,
  type ManualQualificationClassification,
  type ManualQualificationStatus,
} from "@/lib/api";
import {
  MANUAL_QUALIFICATION_STATUSES,
  classificationPillClass,
  statusLabel,
  statusToClassification,
} from "@/lib/manual-qualification";
import { useSetManualQualification } from "@/lib/use-manual-qualification";

interface Props {
  lead: Lead;
  brandId: string;
  currentStatus: ManualQualificationStatus | null;
  onClose: () => void;
}

interface BoolRowDef {
  label: string;
  value: boolean | null;
}

function leadBoolRows(lead: Lead): BoolRowDef[] {
  return [
    { label: "Contacted", value: lead.contacted },
    { label: "Sent", value: lead.sent },
    { label: "Delivered", value: lead.delivered },
    { label: "Opened", value: lead.opened },
    { label: "Clicked", value: lead.clicked },
    { label: "Bounced", value: lead.bounced },
    { label: "Unsubscribed", value: lead.unsubscribed },
    { label: "Replied", value: lead.replied },
    { label: "Global bounced", value: lead.global?.bounced ?? null },
    { label: "Global unsubscribed", value: lead.global?.unsubscribed ?? null },
  ];
}

function BoolPill({ value }: { value: boolean | null }) {
  if (value === null) return <span className="text-xs text-gray-300">—</span>;
  if (value) return <span className="text-xs font-medium text-green-700">✓</span>;
  return <span className="text-xs font-medium text-gray-300">✗</span>;
}

const CLASSIFICATION_GROUPS: ReadonlyArray<{
  classification: ManualQualificationClassification;
  label: string;
  statuses: readonly ManualQualificationStatus[];
}> = [
  {
    classification: "positive",
    label: "Positive",
    statuses: ["lead_interested", "lead_meeting_booked", "lead_closed"],
  },
  {
    classification: "negative",
    label: "Negative",
    statuses: ["lead_not_interested", "lead_wrong_person"],
  },
  {
    classification: "neutral",
    label: "Neutral",
    statuses: ["lead_neutral", "lead_out_of_office", "auto_reply_received"],
  },
];

// Defensive: groups must cover the full enum so a future addition surfaces here.
const COVERED = new Set(CLASSIFICATION_GROUPS.flatMap((g) => g.statuses));
for (const s of MANUAL_QUALIFICATION_STATUSES) {
  if (!COVERED.has(s)) {
    console.error(`[dashboard] EditLeadStatusModal: status "${s}" not in any classification group`);
  }
}

export function EditLeadStatusModal({ lead, brandId, currentStatus, onClose }: Props) {
  const mutation = useSetManualQualification(brandId);
  const [pendingStatus, setPendingStatus] = useState<ManualQualificationStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handlePick(status: ManualQualificationStatus) {
    if (mutation.isPending) return;
    setErrorMessage(null);
    setPendingStatus(status);
    mutation.mutate(
      { campaignId: lead.campaignId, email: lead.email, status },
      {
        onError: (err: Error) => {
          setErrorMessage(err.message || "Failed to set qualification");
        },
        onSettled: () => {
          setPendingStatus(null);
        },
      },
    );
  }

  const consolidated = getLeadConsolidatedStatus(lead);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-lead-status-title"
      data-testid="edit-lead-status-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl border border-gray-200 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between">
          <h2 id="edit-lead-status-title" className="font-semibold text-gray-800 text-sm">
            Edit lead status
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 text-sm">
          <p className="text-gray-500 text-xs mb-1">Lead</p>
          <p className="font-medium text-gray-800 mb-3">{lead.email}</p>

          <section className="mb-5">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Current state (read-only)
            </h3>
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Consolidated</span>
                <span className="text-xs font-medium text-gray-800 capitalize">{consolidated}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Reply auto-class</span>
                <span className="text-xs font-medium text-gray-800">
                  {lead.replyClassification ?? "—"}
                </span>
              </div>
              {leadBoolRows(lead).map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-gray-600">{row.label}</span>
                  <BoolPill value={row.value} />
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Manual qualification
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Click any status to commit. Re-clicking the current value is a no-op.
            </p>

            <div className="space-y-3">
              {CLASSIFICATION_GROUPS.map((group) => (
                <div key={group.classification}>
                  <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                    {group.label}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.statuses.map((status) => {
                      const isCurrent = status === currentStatus;
                      const isPending = pendingStatus === status;
                      const classificationClass = classificationPillClass(statusToClassification(status));
                      return (
                        <button
                          key={status}
                          type="button"
                          data-testid={`status-option-${status}`}
                          data-current={isCurrent}
                          onClick={() => handlePick(status)}
                          disabled={mutation.isPending}
                          className={`text-xs px-3 py-1.5 rounded-full border transition flex items-center gap-1.5 ${
                            isCurrent ? classificationClass : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                          } ${mutation.isPending ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          {isCurrent && <span aria-hidden="true">●</span>}
                          {statusLabel(status)}
                          {isPending && (
                            <span
                              data-testid="status-pending-spinner"
                              className="inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {errorMessage && (
              <p
                role="alert"
                data-testid="manual-qualification-error"
                className="mt-3 text-xs text-red-600"
              >
                {errorMessage}
              </p>
            )}
          </section>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-5 py-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
