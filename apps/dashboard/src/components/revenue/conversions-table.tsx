"use client";

import { useState } from "react";
import type {
  ConversionOrg,
  ConversionLead,
  ConversionEvent,
} from "@/lib/revenue-view";
import { usePaginated, TablePager } from "@/components/table-pagination";
import type { ConversionDetail } from "@/components/revenue/conversion-detail-panel";

// ── formatting ──────────────────────────────────────────────────────────────
function formatUsd(n: number): string {
  // A positive amount that rounds down to $0 reads as "free" — show "<$1"
  // instead so a sub-dollar expected revenue isn't mistaken for nothing.
  if (n > 0 && Math.round(n) === 0) return "<$1";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
// Re-exported for the detail panel (keeps one formatting source).
export { formatUsd as fmtUsd, formatDate as fmtDate };
function fullName(first: string | null, last: string | null): string {
  const n = `${first ?? ""} ${last ?? ""}`.trim();
  return n || "Unknown";
}
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0].charAt(0) + (parts[1]?.charAt(0) ?? "")).toUpperCase();
}

// Funnel-graded chips. Delivery stages (contacted → sent → delivered) read as a
// progression leading up to the engagement stages (visit, reply). The single
// furthest delivery stage shows per org/lead row until engagement replaces it;
// the Events tab itemises every stage. Backend is authoritative — do not derive.
const CHANNEL_META: Record<string, { label: string; className: string }> = {
  contacted: { label: "Contacted", className: "bg-gray-50 text-gray-600 border-gray-200" },
  sent: { label: "Sent", className: "bg-slate-100 text-slate-700 border-slate-300" },
  delivered: { label: "Delivered", className: "bg-amber-50 text-amber-700 border-amber-200" },
  visit: { label: "Website visit", className: "bg-blue-50 text-blue-700 border-blue-200" },
  reply: { label: "Positive reply", className: "bg-green-50 text-green-700 border-green-200" },
};
function channelMeta(channel: string) {
  return (
    CHANNEL_META[channel] ?? {
      label: channel,
      className: "bg-gray-50 text-gray-600 border-gray-200",
    }
  );
}

// ── primitives ──────────────────────────────────────────────────────────────
export function Avatar({ photoUrl, name }: { photoUrl: string | null; name: string }) {
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

// Publishable logo.dev key (same one the public-report CompanyLogo uses).
const LOGO_DEV_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";
function orgLogoSrc(logoUrl: string | null, domain?: string | null): string | null {
  if (logoUrl) return logoUrl; // backend-provided logo wins
  if (domain) return `https://img.logo.dev/${encodeURIComponent(domain)}?token=${LOGO_DEV_TOKEN}&size=64`;
  return null;
}

export function OrgLogo({
  logoUrl,
  domain,
  name,
}: {
  logoUrl: string | null;
  domain?: string | null;
  name: string;
}) {
  const [broken, setBroken] = useState(false);
  const src = broken ? null : orgLogoSrc(logoUrl, domain);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name}
        onError={() => setBroken(true)}
        className="w-8 h-8 rounded-md object-contain bg-white border border-gray-200 shrink-0"
      />
    );
  }
  return (
    <span className="w-8 h-8 rounded-md bg-gray-100 text-gray-500 text-xs font-semibold flex items-center justify-center shrink-0">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export function ChannelTags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return <span className="text-gray-300">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((c) => {
        const meta = channelMeta(c);
        return (
          <span key={c} className={`text-[10px] px-2 py-0.5 rounded-full border ${meta.className}`}>
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}

function TableShell({
  headers,
  children,
  empty,
  rows,
  footer,
}: {
  headers: string[];
  children: React.ReactNode;
  empty: string;
  rows: number;
  footer?: React.ReactNode;
}) {
  if (rows === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
        {empty}
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <table className="min-w-[640px] w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
            {headers.map((h, i) => (
              <th key={h} className={`px-4 py-3 font-medium ${i >= 2 ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {footer}
    </div>
  );
}

// ── tables ──────────────────────────────────────────────────────────────────

// Row → detail-panel payload builders (one formatting/identity source).
function orgDetail(o: ConversionOrg, orgName: string): ConversionDetail {
  return {
    kind: "org",
    title: orgName,
    subtitle: o.topPerson ? fullName(o.topPerson.firstName, o.topPerson.lastName) : null,
    logoUrl: o.orgLogoUrl,
    orgDomain: o.orgDomain,
    tags: o.tags,
    expectedRevenueUsd: o.expectedRevenueUsd,
    date: o.mostAdvancedDate,
  };
}
function leadDetail(l: ConversionLead, name: string): ConversionDetail {
  return {
    kind: "lead",
    title: name,
    subtitle: l.orgName,
    photoUrl: l.photoUrl,
    logoUrl: l.orgLogoUrl,
    orgDomain: l.orgDomain,
    orgName: l.orgName,
    tags: l.tags,
    expectedRevenueUsd: l.expectedRevenueUsd,
    date: l.date,
    probabilityPct: l.conversionProbabilityPct ?? null,
  };
}

const clickableRow = (onSelect: unknown) =>
  `border-t border-gray-100 hover:bg-gray-50/60${onSelect ? " cursor-pointer" : ""}`;

/** Org-level conversions — overview table + Organizations tab (deduped, org-first). */
export function OrgConversionsTable({
  orgs,
  onSelect,
}: {
  orgs: ConversionOrg[];
  onSelect?: (d: ConversionDetail) => void;
}) {
  const { pageItems, page, setPage, pageCount, total, from, to } = usePaginated(orgs);
  return (
    <TableShell
      headers={["Organization", "Conversions", "Latest activity"]}
      empty="No conversions yet."
      rows={orgs.length}
      footer={
        <TablePager page={page} pageCount={pageCount} from={from} to={to} total={total} onPage={setPage} />
      }
    >
      {pageItems.map((o, i) => {
        const orgName = o.orgName ?? "Unknown";
        return (
          <tr
            key={o.orgId ?? `${orgName}-${i}`}
            className={clickableRow(onSelect)}
            onClick={onSelect ? () => onSelect(orgDetail(o, orgName)) : undefined}
          >
            <td className="px-4 py-3">
              <div className="flex items-center gap-3">
                <OrgLogo logoUrl={o.orgLogoUrl} domain={o.orgDomain} name={orgName} />
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 truncate">{orgName}</p>
                  {o.topPerson && (
                    <p className="text-xs text-gray-400 truncate">
                      {fullName(o.topPerson.firstName, o.topPerson.lastName)}
                    </p>
                  )}
                </div>
              </div>
            </td>
            <td className="px-4 py-3">
              <ChannelTags tags={o.tags} />
            </td>
            <td className="px-4 py-3 text-right text-gray-500 whitespace-nowrap">
              {formatDate(o.mostAdvancedDate)}
            </td>
          </tr>
        );
      })}
    </TableShell>
  );
}

/** Person-level conversions — Leads tab. */
export function LeadConversionsTable({
  leads,
  onSelect,
}: {
  leads: ConversionLead[];
  onSelect?: (d: ConversionDetail) => void;
}) {
  const { pageItems, page, setPage, pageCount, total, from, to } = usePaginated(leads);
  return (
    <TableShell
      headers={["Lead", "Conversions", "Latest activity"]}
      empty="No lead conversions yet."
      rows={leads.length}
      footer={
        <TablePager page={page} pageCount={pageCount} from={from} to={to} total={total} onPage={setPage} />
      }
    >
      {pageItems.map((l) => {
        const name = fullName(l.firstName, l.lastName);
        return (
          <tr
            key={l.leadId}
            className={clickableRow(onSelect)}
            onClick={onSelect ? () => onSelect(leadDetail(l, name)) : undefined}
          >
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
            <td className="px-4 py-3">
              <ChannelTags tags={l.tags} />
            </td>
            <td className="px-4 py-3 text-right text-gray-500 whitespace-nowrap">
              {formatDate(l.date)}
            </td>
          </tr>
        );
      })}
    </TableShell>
  );
}

/** Raw event log — Events tab (single tag per row). Itemises every funnel stage
 *  per lead, so the row count is high — paginate 20/page.
 *
 *  `photoByLeadId` carries each lead's profile photo (joined from the same
 *  `/revenue` payload's `leads[]` by the caller) so events show the person's
 *  picture, falling back to initials when absent/broken. */
export function EventConversionsTable({
  events,
  photoByLeadId,
}: {
  events: ConversionEvent[];
  photoByLeadId?: Map<string, string | null>;
}) {
  const { pageItems, page, setPage, pageCount, total, from, to } = usePaginated(events);
  return (
    <TableShell
      headers={["Lead", "Event", "Date"]}
      empty="No conversion events yet."
      rows={events.length}
      footer={
        <TablePager page={page} pageCount={pageCount} from={from} to={to} total={total} onPage={setPage} />
      }
    >
      {pageItems.map((e, i) => {
        const meta = channelMeta(e.eventType);
        const person = e.person ?? "Unknown";
        return (
          <tr
            key={`${e.leadId}-${e.eventType}-${e.eventDate}-${i}`}
            className="border-t border-gray-100 hover:bg-gray-50/60"
          >
            <td className="px-4 py-3">
              <div className="flex items-center gap-3">
                <Avatar photoUrl={photoByLeadId?.get(e.leadId) ?? null} name={person} />
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 truncate">{person}</p>
                  {e.org && <p className="text-xs text-gray-400 truncate">{e.org}</p>}
                </div>
              </div>
            </td>
            <td className="px-4 py-3">
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${meta.className}`}>
                {meta.label}
              </span>
            </td>
            <td className="px-4 py-3 text-right text-gray-500 whitespace-nowrap">
              {formatDate(e.eventDate)}
            </td>
          </tr>
        );
      })}
    </TableShell>
  );
}
