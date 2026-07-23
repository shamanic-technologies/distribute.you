"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listCrmUploads, type CrmUpload } from "@/lib/api";
import { EntitySearchBar } from "@/components/entity-search-bar";

// Brand-level CRM "Sources" page — every CSV upload imported into crm-service
// for this brand (crm-service `GET /orgs/contacts/uploads`). Read-only.

function timeAgo(date: string | null): string {
  if (!date) return "—";
  const then = new Date(date);
  if (Number.isNaN(then.getTime())) return "—";
  const seconds = Math.floor((Date.now() - then.getTime()) / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? "").toLowerCase();
  const style = s === "promoted" || s === "ready" || s === "complete"
    ? "bg-green-100 text-green-700 border-green-200"
    : s === "failed" || s === "error"
      ? "bg-red-100 text-red-600 border-red-200"
      : "bg-blue-100 text-blue-600 border-blue-200";
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${style}`}>{status || "unknown"}</span>;
}

export default function CrmSourcesPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const [search, setSearch] = useState("");

  const { data, isPending } = useAuthQuery(
    ["crmUploads", brandId],
    () => listCrmUploads(brandId),
    { refetchInterval: 5_000 },
  );

  const uploads = data?.uploads ?? [];

  const sorted = useMemo(
    () => [...uploads].sort((a, b) => {
      const at = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
      const bt = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
      return bt - at;
    }),
    [uploads],
  );

  const filtered = useMemo(() => {
    if (!search) return sorted;
    const q = search.toLowerCase();
    return sorted.filter((u) =>
      (u.filename ?? "").toLowerCase().includes(q)
      || (u.status ?? "").toLowerCase().includes(q),
    );
  }, [sorted, search]);

  const showSkeleton = isPending && !data;

  return (
    <div className="p-4 md:p-8 overflow-y-auto h-full">
      <div className="flex items-start justify-between mb-4">
        <h1 className="font-display text-xl font-bold text-gray-800">
          Sources
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({uploads.length.toLocaleString("en-US")} CSV {uploads.length === 1 ? "upload" : "uploads"})
          </span>
        </h1>
      </div>

      <EntitySearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search by filename or status..."
        resultCount={filtered.length}
        totalCount={uploads.length}
      />

      {showSkeleton ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
          <div className="h-10 bg-gray-100 border-b border-gray-100" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 border-b border-gray-50 last:border-b-0" />
          ))}
        </div>
      ) : uploads.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <h3 className="font-display font-bold text-lg text-gray-800 mb-2">No uploads yet</h3>
          <p className="text-gray-600 text-sm">CRM CSV files imported for this brand appear here.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-sm">No uploads match your search.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Rows</th>
                <th className="px-4 py-3 hidden sm:table-cell">Status</th>
                <th className="px-4 py-3 hidden md:table-cell">Mapping</th>
                <th className="px-4 py-3 hidden md:table-cell">Uploaded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-800 truncate max-w-[240px] block">{u.filename || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{(u.rowCount ?? 0).toLocaleString("en-US")}</td>
                  <td className="px-4 py-3 hidden sm:table-cell"><StatusBadge status={u.status ?? null} /></td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-gray-500">{u.mappingProvenance || "—"}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-gray-500" title={u.uploadedAt ? new Date(u.uploadedAt).toLocaleString() : undefined}>
                      {timeAgo(u.uploadedAt ?? null)}
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
