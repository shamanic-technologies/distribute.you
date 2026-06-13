"use client";

import type { Lead } from "@/lib/mock-data";
import { StatusChip } from "./status-chip";
import { ChevronLeftIcon, CloseIcon } from "./icons";

export function LeadDrawer({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const open = lead !== null;

  return (
    <>
      <div className={`lead-drawer-overlay${open ? " open" : ""}`} onClick={onClose} />
      <div className={`lead-drawer${open ? " open" : ""}`}>
        <div className="drawer-header">
          <button className="drawer-back" onClick={onClose}>
            <ChevronLeftIcon width={14} height={14} />
            All leads
          </button>
          <button className="drawer-close" onClick={onClose}>
            <CloseIcon width={12} height={12} />
          </button>
        </div>

        {lead && (
          <>
            <div className="drawer-lead-info">
              <div className="drawer-org-logo">{lead.initials}</div>
              <div>
                <div className="drawer-org-name">{lead.company}</div>
                <div className="drawer-contact">{lead.contact} · {lead.role}</div>
                <div className="drawer-meta">Sent {lead.date} &nbsp;·&nbsp; <StatusChip status={lead.status} /></div>
              </div>
            </div>

            <div className="drawer-thread">
              {lead.emailSent ? (
                <div className="thread-msg outbound">
                  <div className="thread-msg-head">
                    <span className="thread-msg-from">You (via distribute)</span>
                    <span className="thread-msg-date">{lead.date}</span>
                  </div>
                  <div className="thread-msg-body">{lead.emailSent}</div>
                </div>
              ) : null}
              {lead.reply ? (
                <div className="thread-msg inbound">
                  <div className="thread-msg-head">
                    <span className="thread-msg-from">{lead.contact}</span>
                    <span className="thread-msg-date">{lead.date}</span>
                  </div>
                  <div className="thread-msg-body">{lead.reply}</div>
                </div>
              ) : null}
              {!lead.emailSent && !lead.reply ? (
                <div className="empty-state">
                  <p>{lead.status === "bounced" ? "Email bounced — address may be invalid." : `No reply yet. Email was ${lead.status}.`}</p>
                </div>
              ) : null}
            </div>

            <div className="drawer-actions">
              <button className="btn btn-p" style={{ flex: 1, justifyContent: "center" }}>Reply</button>
              <button className="btn btn-g" style={{ flex: 1, justifyContent: "center" }}>Mark as closed</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
