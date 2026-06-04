"use client";

import type {
  ConversionOrg,
  ConversionLead,
  ConversionEvent,
} from "@/lib/revenue-view";

// ── formatting ──────────────────────────────────────────────────────────────
function formatUsd(n: number): string {
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
function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

const CHANNEL_META: Record<string, { label: string; className: string }> = {
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
function Avatar({
  photoUrl,
  first,
  last,
}: {
  photoUrl: string | null;
  first: string;
  last: string;
}) {
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={photoUrl}
        alt={`${first} ${last}`}
        className="w-8 h-8 rounded-full object-cover bg-gray-100 shrink-0"
      />
    );
  }
  return (
    <span className="w-8 h-8 rounded-full bg-brand-50 text-brand-700 text-xs font-medium flex items-center justify-center shrink-0">
      {initials(first, last)}
    </span>
  );
}

function OrgLogo({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={logoUrl}
        alt={name}
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

function ChannelTags({ channels }: { channels: string[] }) {
  if (channels.length === 0) return <span className="text-gray-300">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {channels.map((c) => {
        const meta = channelMeta(c);
        return (
          <span
            key={c}
            className={`text-[10px] px-2 py-0.5 rounded-full border ${meta.className}`}
          >
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
}: {
  headers: string[];
  children: React.ReactNode;
  empty: string;
  rows: number;
}) {
  if (rows === 0) {
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
            {headers.map((h, i) => (
              <th
                key={h}
                className={`px-4 py-3 font-medium ${i >= 2 ? "text-right" : ""}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// ── tables ──────────────────────────────────────────────────────────────────

/** Org-level conversions — overview table + Organizations tab (deduped, org-first). */
export function OrgConversionsTable({ orgs }: { orgs: ConversionOrg[] }) {
  return (
    <TableShell
      headers={["Organization", "Conversions", "Expected revenue", "Latest activity"]}
      empty="No conversions yet."
      rows={orgs.length}
    >
      {orgs.map((o) => (
        <tr key={o.orgId} className="border-t border-gray-100 hover:bg-gray-50/60">
          <td className="px-4 py-3">
            <div className="flex items-center gap-3">
              <OrgLogo logoUrl={o.orgLogoUrl} name={o.orgName} />
              <div className="min-w-0">
                <p className="font-medium text-gray-800 truncate">{o.orgName}</p>
                {o.topLead && (
                  <p className="text-xs text-gray-400 truncate">
                    {o.topLead.firstName} {o.topLead.lastName}
                  </p>
                )}
              </div>
            </div>
          </td>
          <td className="px-4 py-3">
            <ChannelTags channels={o.channels} />
          </td>
          <td className="px-4 py-3 text-right font-semibold text-gray-800 whitespace-nowrap">
            {formatUsd(o.expectedRevenueUsd)}
          </td>
          <td className="px-4 py-3 text-right text-gray-500 whitespace-nowrap">
            {formatDate(o.mostAdvancedDate)}
          </td>
        </tr>
      ))}
    </TableShell>
  );
}

/** Person-level conversions — Leads tab. */
export function LeadConversionsTable({ leads }: { leads: ConversionLead[] }) {
  return (
    <TableShell
      headers={["Lead", "Conversions", "Expected revenue", "Latest activity"]}
      empty="No lead conversions yet."
      rows={leads.length}
    >
      {leads.map((l) => (
        <tr key={l.personId} className="border-t border-gray-100 hover:bg-gray-50/60">
          <td className="px-4 py-3">
            <div className="flex items-center gap-3">
              <Avatar photoUrl={l.photoUrl} first={l.firstName} last={l.lastName} />
              <div className="min-w-0">
                <p className="font-medium text-gray-800 truncate">
                  {l.firstName} {l.lastName}
                </p>
                <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                  <OrgLogo logoUrl={l.orgLogoUrl} name={l.orgName} />
                  <span className="truncate">{l.orgName}</span>
                </p>
              </div>
            </div>
          </td>
          <td className="px-4 py-3">
            <ChannelTags channels={l.channels} />
          </td>
          <td className="px-4 py-3 text-right font-semibold text-gray-800 whitespace-nowrap">
            {formatUsd(l.expectedRevenueUsd)}
          </td>
          <td className="px-4 py-3 text-right text-gray-500 whitespace-nowrap">
            {formatDate(l.eventDate)}
          </td>
        </tr>
      ))}
    </TableShell>
  );
}

/** Raw event log — Events tab (single tag per row). */
export function EventConversionsTable({ events }: { events: ConversionEvent[] }) {
  return (
    <TableShell
      headers={["Lead", "Event", "Pipeline added", "Date"]}
      empty="No conversion events yet."
      rows={events.length}
    >
      {events.map((e) => {
        const meta = channelMeta(e.channel);
        return (
          <tr key={e.eventId} className="border-t border-gray-100 hover:bg-gray-50/60">
            <td className="px-4 py-3">
              <div className="flex items-center gap-3">
                <Avatar photoUrl={e.photoUrl} first={e.firstName} last={e.lastName} />
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 truncate">
                    {e.firstName} {e.lastName}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{e.orgName}</p>
                </div>
              </div>
            </td>
            <td className="px-4 py-3">
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${meta.className}`}>
                {meta.label}
              </span>
            </td>
            <td className="px-4 py-3 text-right font-medium text-gray-700 whitespace-nowrap">
              {formatUsd(e.contributionUsd)}
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
