"use client";

import type { ConversionLead } from "@/lib/revenue-view";
import type { Lead, Email } from "@/lib/api";

// ── formatting ──────────────────────────────────────────────────────────────
function fullName(first: string | null, last: string | null): string {
  return `${first ?? ""} ${last ?? ""}`.trim() || "Unknown";
}
function formatUsd(n: number): string {
  if (n > 0 && Math.round(n) === 0) return "<$1";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
function formatPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n < 10 ? `${n.toFixed(1)}%` : `${Math.round(n)}%`;
}
function formatDateTime(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Outreach status progression. Each lead's boolean flags say WHICH stages were
// reached (real); per-step timestamps don't exist yet (backend gap) — only
// `servedAt` (Found) and `lastDeliveredAt` (Delivered) are known, shown when
// present. Reply sentiment annotates the Replied stage.
const STAGES: { key: keyof Lead; label: string }[] = [
  { key: "contacted", label: "Contacted" },
  { key: "sent", label: "Email sent" },
  { key: "delivered", label: "Delivered" },
  { key: "opened", label: "Opened" },
  { key: "clicked", label: "Clicked through" },
  { key: "replied", label: "Replied" },
];

function StatusTimeline({ lead }: { lead: Lead | null }) {
  if (!lead) {
    return <p className="text-xs text-gray-400">No status history available.</p>;
  }
  const deliveredAt = formatDateTime(lead.lastDeliveredAt);
  const foundAt = formatDateTime(lead.servedAt);
  return (
    <ol className="space-y-2">
      {STAGES.map((s) => {
        const reached = Boolean(lead[s.key]);
        const time =
          s.key === "delivered" ? deliveredAt : s.key === "contacted" ? foundAt : null;
        const replyTag =
          s.key === "replied" && reached && lead.replyClassification
            ? ` · ${lead.replyClassification}`
            : "";
        return (
          <li key={s.key} className="flex items-center gap-3 text-sm">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                reached ? "bg-brand-500" : "bg-gray-200"
              }`}
            />
            <span className={reached ? "text-gray-800 font-medium" : "text-gray-400"}>
              {s.label}
              {replyTag}
            </span>
            {reached && time && (
              <span className="ml-auto text-xs text-gray-400 whitespace-nowrap">{time}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function EmailCard({ email }: { email: Email }) {
  const sentAt = formatDateTime(email.createdAt);
  const workflow = email.generationRun?.taskName ?? null;
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-gray-800 text-sm">{email.subject || "(no subject)"}</p>
        {sentAt && <span className="text-xs text-gray-400 whitespace-nowrap">{sentAt}</span>}
      </div>
      {workflow && <p className="text-[10px] text-gray-400 mt-0.5">{workflow}</p>}
      {email.bodyText && (
        <p className="mt-2 text-xs text-gray-600 whitespace-pre-wrap line-clamp-[12]">
          {email.bodyText}
        </p>
      )}
    </div>
  );
}

/**
 * Slide-over panel for a selected outcome lead. Shows the real outreach status
 * progression (from the lead's delivery booleans) + every email actually sent to
 * the lead. All data is real: status booleans from lead-service, emails from the
 * emails endpoint. Per-step event timestamps are a backend follow-up — only the
 * known `servedAt` / `lastDeliveredAt` are surfaced today.
 */
export function OutcomeLeadPanel({
  lead,
  fullLead,
  emails,
  probabilityLabel,
  onClose,
}: {
  lead: ConversionLead;
  fullLead: Lead | null;
  emails: Email[];
  probabilityLabel: string;
  onClose: () => void;
}) {
  const name = fullName(lead.firstName, lead.lastName);
  return (
    <>
      {/* scrim */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/20"
      />
      <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto bg-white shadow-xl border-l border-gray-200">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold text-gray-900 truncate">{name}</h2>
            {lead.orgName && <p className="text-xs text-gray-400 truncate">{lead.orgName}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none shrink-0"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-6">
          {/* headline numbers */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs text-gray-400">{probabilityLabel}</p>
              <p className="mt-0.5 text-lg font-bold text-gray-900 tabular-nums">
                {formatPct(lead.conversionProbabilityPct)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs text-gray-400">Expected revenue</p>
              <p className="mt-0.5 text-lg font-bold text-gray-900 tabular-nums">
                {formatUsd(lead.expectedRevenueUsd)}
              </p>
            </div>
          </div>

          {/* status history */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Status history
            </h3>
            <StatusTimeline lead={fullLead} />
          </div>

          {/* emails sent */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Emails sent {emails.length > 0 && `(${emails.length})`}
            </h3>
            {emails.length === 0 ? (
              <p className="text-xs text-gray-400">No emails sent to this lead yet.</p>
            ) : (
              <div className="space-y-3">
                {emails.map((e) => (
                  <EmailCard key={e.id} email={e} />
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
