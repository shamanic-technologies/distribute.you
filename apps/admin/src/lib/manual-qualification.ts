import type { ManualQualification, ManualQualificationClassification, ManualQualificationStatus } from "./api";

// Mirrors instantly-service `REPLY_CLASSIFICATION_MAP` (src/lib/silver-promote.ts:56-65).
// Keep in sync with the 8-value enum on api-service `/v1/emails/manual-qualifications`.
const STATUS_CLASSIFICATION: Record<ManualQualificationStatus, ManualQualificationClassification> = {
  lead_interested: "positive",
  lead_referral: "positive",
  lead_info_requested: "positive",
  lead_meeting_requested: "positive",
  lead_meeting_booked: "positive",
  lead_closed: "positive",
  lead_not_interested: "negative",
  lead_wrong_person: "negative",
  lead_neutral: "neutral",
  lead_out_of_office: "neutral",
  auto_reply_received: "neutral",
};

const STATUS_LABEL: Record<ManualQualificationStatus, string> = {
  lead_interested: "Interested",
  lead_referral: "Not them, but points us on",
  lead_info_requested: "Wants to know more",
  lead_meeting_requested: "Wants to book",
  lead_meeting_booked: "Meeting booked",
  lead_closed: "Closed (won)",
  lead_not_interested: "Not interested",
  lead_wrong_person: "Wrong person",
  lead_neutral: "Neutral",
  lead_out_of_office: "Out of office",
  auto_reply_received: "Auto-reply",
};

const CLASSIFICATION_PILL: Record<ManualQualificationClassification, string> = {
  positive: "bg-green-100 text-green-700 border-green-200",
  negative: "bg-red-100 text-red-700 border-red-200",
  neutral: "bg-gray-100 text-gray-600 border-gray-200",
};

/**
 * What a person may STATE about a reply, in the order they triage.
 *
 * Narrower than the type on purpose. `lead_meeting_booked` and `lead_closed` are still
 * typed, because historical rows carry them and must render — but they are facts about
 * the DEAL, now stated on the funnel stages in the same panel. Offering them here too
 * would let one fact be recorded in two stores, which is exactly what let a booked
 * meeting erase the reply sentiment that led to it.
 */
export const MANUAL_QUALIFICATION_STATUSES: readonly ManualQualificationStatus[] = [
  "lead_interested",
  "lead_info_requested",
  "lead_meeting_requested",
  "lead_referral",
  "lead_not_interested",
  "lead_wrong_person",
  "lead_neutral",
  "lead_out_of_office",
  "auto_reply_received",
];

export function statusToClassification(status: ManualQualificationStatus): ManualQualificationClassification {
  return STATUS_CLASSIFICATION[status];
}

export function statusLabel(status: ManualQualificationStatus): string {
  return STATUS_LABEL[status];
}

export function classificationPillClass(classification: ManualQualificationClassification): string {
  return CLASSIFICATION_PILL[classification];
}

export function qualificationKey(campaignId: string, email: string): string {
  return `${campaignId}|${email.toLowerCase()}`;
}

// Build a map keyed on `(campaignId, email)` to the most-recent qualification.
// Backend returns rows sorted by qualifiedAt DESC, so the first row per key wins.
export function buildLatestQualificationMap(
  qualifications: readonly ManualQualification[],
): Map<string, ManualQualification> {
  const map = new Map<string, ManualQualification>();
  for (const q of qualifications) {
    const key = qualificationKey(q.campaignId, q.email);
    if (!map.has(key)) map.set(key, q);
  }
  return map;
}
