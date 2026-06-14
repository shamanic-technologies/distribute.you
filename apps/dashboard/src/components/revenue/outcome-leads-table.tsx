"use client";

import { useState } from "react";
import type { ConversionLead } from "@/lib/revenue-view";
import { usePaginated, TablePager } from "@/components/table-pagination";

// ── formatting ──────────────────────────────────────────────────────────────
function formatUsd(n: number): string {
  // A positive amount that rounds down to $0 reads as "free" — show "<$1".
  if (n > 0 && Math.round(n) === 0) return "<$1";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
function formatPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  // Sub-1% conversions are real — keep one decimal under 10%, integer above.
  return n < 10 ? `${n.toFixed(1)}%` : `${Math.round(n)}%`;
}
function fullName(first: string | null, last: string | null): string {
  const n = `${first ?? ""} ${last ?? ""}`.trim();
  return n || "Unknown";
}
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0].charAt(0) + (parts[1]?.charAt(0) ?? "")).toUpperCase();
}

// Publishable logo.dev key (same one the conversions table + public report use).
const LOGO_DEV_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";
function orgLogoSrc(logoUrl: string | null, domain?: string | null): string | null {
  if (logoUrl) return logoUrl;
  if (domain) return `https://img.logo.dev/${encodeURIComponent(domain)}?token=${LOGO_DEV_TOKEN}&size=64`;
  return null;
}

function Avatar({ photoUrl, name }: { photoUrl: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  if (photoUrl && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={photoUrl}
        alt={name}
        onError={() => setBroken(true)}
        className="w-8 h-8 rounded-full object-cover bg-gray-100 shrink-0"
      />
    );
  }
  return (
    <span className="w-8 h-8 rounded-full bg-brand-50 text-brand-700 text-xs font-medium flex items-center justify-center shrink-0">
      {initials(name)}
    </span>
  );
}

function OrgLogo({ logoUrl, domain, name }: { logoUrl: string | null; domain?: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  const src = broken ? null : orgLogoSrc(logoUrl, domain);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name}
        onError={() => setBroken(true)}
        className="w-5 h-5 rounded object-contain bg-white border border-gray-200 shrink-0"
      />
    );
  }
  return (
    <span className="w-5 h-5 rounded bg-gray-100 text-gray-500 text-[10px] font-semibold flex items-center justify-center shrink-0">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * Lead table for the outcome lenses (Signups / Booked Meetings / Sales). Columns:
 * Lead | <probability> | Expected revenue. Probability + revenue come straight
 * from features-service (`conversionProbabilityPct` / `expectedRevenueUsd`) — no
 * client-side math. The probability header label is lens-specific.
 */
export function OutcomeLeadsTable({
  leads,
  probabilityLabel,
  empty,
}: {
  leads: ConversionLead[];
  probabilityLabel: string;
  empty: string;
}) {
  const { pageItems, page, setPage, pageCount, total, from, to } = usePaginated(leads);

  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
        {empty}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
            <th className="px-4 py-3 font-medium">Lead</th>
            <th className="px-4 py-3 font-medium text-right">{probabilityLabel}</th>
            <th className="px-4 py-3 font-medium text-right">Expected revenue</th>
          </tr>
        </thead>
        <tbody>
          {pageItems.map((l) => {
            const name = fullName(l.firstName, l.lastName);
            return (
              <tr key={l.leadId} className="border-t border-gray-100 hover:bg-gray-50/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar photoUrl={l.photoUrl} name={name} />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate">{name}</p>
                      <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                        <OrgLogo logoUrl={l.orgLogoUrl} domain={l.orgDomain} name={l.orgName ?? "—"} />
                        <span className="truncate">{l.orgName ?? "—"}</span>
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-700 whitespace-nowrap tabular-nums">
                  {formatPct(l.conversionProbabilityPct)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-800 whitespace-nowrap tabular-nums">
                  {formatUsd(l.expectedRevenueUsd)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <TablePager page={page} pageCount={pageCount} from={from} to={to} total={total} onPage={setPage} />
    </div>
  );
}
