"use client";

import type { ManualQualificationStatus } from "@/lib/api";
import { classificationPillClass, statusLabel, statusToClassification } from "@/lib/manual-qualification";

export function ManualQualificationBadge({ status }: { status: ManualQualificationStatus }) {
  const classification = statusToClassification(status);
  return (
    <span
      data-testid="manual-qualification-badge"
      data-status={status}
      data-classification={classification}
      className={`text-xs px-2 py-0.5 rounded-full border ${classificationPillClass(classification)}`}
    >
      {statusLabel(status)}
    </span>
  );
}
