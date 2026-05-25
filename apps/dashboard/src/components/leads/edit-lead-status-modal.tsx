"use client";

import {
  getLeadConsolidatedStatus,
  type Lead,
  type ManualQualificationStatus,
} from "@/lib/api";
import {
  EditManualQualificationModal,
  type ReadOnlySummary,
} from "@/components/manual-qualification/edit-manual-qualification-modal";

interface Props {
  lead: Lead;
  brandId: string;
  currentStatus: ManualQualificationStatus | null;
  onClose: () => void;
}

function buildLeadSummary(lead: Lead): ReadOnlySummary {
  return {
    consolidatedLabel: getLeadConsolidatedStatus(lead),
    replyClassification: lead.replyClassification ?? null,
    boolRows: [
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
    ],
  };
}

export function EditLeadStatusModal({ lead, brandId, currentStatus, onClose }: Props) {
  return (
    <EditManualQualificationModal
      campaignId={lead.campaignId}
      email={lead.email}
      brandId={brandId}
      currentStatus={currentStatus}
      readOnlySummary={buildLeadSummary(lead)}
      onClose={onClose}
    />
  );
}
