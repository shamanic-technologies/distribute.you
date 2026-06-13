import type { LeadStatus } from "@/lib/mock-data";

const LABELS: Record<LeadStatus, string> = {
  sent: "Sent",
  opened: "Opened",
  replied: "Replied",
  bounced: "Bounced",
};

export function StatusChip({ status }: { status: LeadStatus }) {
  return (
    <span className={`lead-status ${status}`}>
      <span className="lead-status-dot" />
      {LABELS[status]}
    </span>
  );
}
