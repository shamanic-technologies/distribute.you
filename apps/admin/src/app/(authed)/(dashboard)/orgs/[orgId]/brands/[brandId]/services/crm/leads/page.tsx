"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listCrmContacts, getCrmServeStats, type CrmContact } from "@/lib/api";
import { EntitySearchBar } from "@/components/entity-search-bar";

// Brand-level CRM "Leads" page — the concatenated pool of silver contacts the
// user uploaded as CSVs (crm-service `GET /orgs/contacts`). Read-only.

function contactName(c: CrmContact): string {
  const full = (c.fullName ?? "").trim();
  if (full) return full;
  const parts = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
  return parts || "—";
}

function ConsentBadge({ status, unsubscribed }: { status: string | null; unsubscribed: boolean }) {
  if (unsubscribed) {
    return <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-100 text-amber-700 border-amber-200">Unsubscribed</span>;
  }
  const s = (status ?? "").toLowerCase();
  const style = s === "opted_in" || s === "consented"
    ? "bg-green-100 text-green-700 border-green-200"
    : s === "opted_out"
      ? "bg-red-100 text-red-600 border-red-200"
      : "bg-gray-100 text-gray-500 border-gray-200";
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${style}`}>{status || "unknown"}</span>;
}

export default function CrmLeadsPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const [search, setSearch] = useState("");

  const { data, isPending } = useAuthQuery(
    ["crmContacts", brandId],
    () => listCrmContacts(brandId),
    { refetchInterval: 5_000 },
  );

  // Served-vs-remaining counts. Reached via a sibling api-service proxy route
  // (`/v1/orgs/contacts/serve-stats`); until it deploys the read errors and the
  // strip stays hidden (tolerant — a reassurance stat, not a hard dependency).
  const { data: serveStats } = useAuthQuery(
    ["crmServeStats", brandId],
    () => getCrmServeStats(brandId),
    { refetchInterval: 30_000, retry: false },
  );

  const contacts = data?.contacts ?? [];

  const filtered = useMemo(() => {
    if (!search) return contacts;
    const q = search.toLowerCase();
    return contacts.filter((c) =>
      contactName(c).toLowerCase().includes(q)
      || (c.primaryEmail ?? "").toLowerCase().includes(q)
      || (c.phoneE164 ?? "").toLowerCase().includes(q),
    );
  }, [contacts, search]);

  const showSkeleton = isPending && !data;

  return (
    <div className="p-4 md:p-8 overflow-y-auto h-full">
      <div className="flex items-start justify-between mb-4">
        <h1 className="font-display text-xl font-bold text-gray-800">
          Leads
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({contacts.length.toLocaleString("en-US")} uploaded contacts)
          </span>
        </h1>
      </div>

      {serveStats && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Served", value: serveStats.served },
            { label: "Remaining sendable", value: serveStats.remainingSendable },
            { label: "Total sendable", value: serveStats.totalSendable },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-3">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-lg font-bold text-gray-800">{s.value.toLocaleString("en-US")}</p>
            </div>
          ))}
        </div>
      )}

      <EntitySearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search by name, email, or phone..."
        resultCount={filtered.length}
        totalCount={contacts.length}
      />

      {showSkeleton ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
          <div className="h-10 bg-gray-100 border-b border-gray-100" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 border-b border-gray-50 last:border-b-0" />
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <h3 className="font-display font-bold text-lg text-gray-800 mb-2">No contacts yet</h3>
          <p className="text-gray-600 text-sm">Contacts appear here once a CRM CSV is uploaded under Sources.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-sm">No contacts match your search.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3 hidden sm:table-cell">Phone</th>
                <th className="px-4 py-3 hidden md:table-cell">Consent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-800 truncate max-w-[200px] block">{contactName(c)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-600 truncate max-w-[240px] block">{c.primaryEmail || "—"}</span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-gray-600">{c.phoneE164 || "—"}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <ConsentBadge status={c.consentStatus ?? null} unsubscribed={c.unsubscribed} />
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
