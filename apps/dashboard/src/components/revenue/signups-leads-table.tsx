"use client";

import { useMemo } from "react";
import { getLeadConsolidatedStatus, type Lead, type LeadConsolidatedStatus } from "@/lib/api";
import { LEAD_STATUS_PRIORITY, leadStatusLabel, leadStatusStyle } from "@/lib/lead-status-display";
import { Skeleton } from "@/components/skeleton";

/**
 * Engaged-leads table for the Signups page — every lead that has OPENED,
 * CLICKED, or SIGNED UP. (The signups "signup" status doesn't exist in the
 * backend yet; once it does it slots in here — see `isEngaged`.) Replaces the
 * signups-lensed ConversionsTabs, which only counted click-throughs and so read
 * empty. Reads the real brand leads and dedupes per lead, keeping the
 * most-advanced status.
 */

// A lead counts as engaged once it opened or clicked (or — future — signed up).
// `signedUp` is not a Lead field yet; guarded optional read so it lights up for
// free the day the backend adds it.
function isEngaged(l: Lead): boolean {
  const signedUp = (l as unknown as { signedUp?: boolean }).signedUp === true;
  return l.opened || l.clicked || signedUp;
}

function rank(status: LeadConsolidatedStatus): number {
  const i = LEAD_STATUS_PRIORITY.indexOf(status);
  return i === -1 ? Number.POSITIVE_INFINITY : i;
}

export function SignupsLeadsTable({ leads, pending }: { leads: Lead[]; pending: boolean }) {
  // Dedupe by canonical leadId (a lead recurs across campaign memberships); keep
  // the most-advanced status row.
  const rows = useMemo(() => {
    const byId = new Map<string, { lead: Lead; status: LeadConsolidatedStatus }>();
    for (const l of leads) {
      if (!isEngaged(l)) continue;
      const key = l.leadId ?? l.id;
      const status = getLeadConsolidatedStatus(l);
      const prev = byId.get(key);
      if (!prev || rank(status) < rank(prev.status)) byId.set(key, { lead: l, status });
    }
    return Array.from(byId.values()).sort((a, b) => rank(a.status) - rank(b.status));
  }, [leads]);

  const name = (l: Lead): string => {
    const fl = l.lead;
    const full = fl ? `${fl.firstName ?? ""} ${fl.lastName ?? ""}`.trim() : "";
    return full || l.email;
  };
  const company = (l: Lead): string => l.lead?.organization?.name ?? "—";

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-4 md:px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Engaged leads</h3>
        <p className="text-[11px] text-gray-400 mt-0.5">
          Everyone who opened, clicked, or signed up{rows.length > 0 ? ` · ${rows.length}` : ""}.
        </p>
      </div>

      {pending ? (
        <div className="p-4 space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-9 w-full rounded" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="p-8 text-center text-sm text-gray-400">No opened, clicked, or signed-up leads yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="font-medium px-4 md:px-5 py-2">Lead</th>
                <th className="font-medium px-4 py-2">Company</th>
                <th className="font-medium px-4 md:px-5 py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ lead, status }) => (
                <tr key={lead.leadId ?? lead.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 md:px-5 py-2.5">
                    <div className="font-medium text-gray-900">{name(lead)}</div>
                    <div className="text-[11px] text-gray-400">{lead.email}</div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{company(lead)}</td>
                  <td className="px-4 md:px-5 py-2.5 text-right">
                    <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border ${leadStatusStyle(status)}`}>
                      {leadStatusLabel(status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
