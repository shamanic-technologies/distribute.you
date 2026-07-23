"use client";

import { useState, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  listCrmUploads,
  listCrmContacts,
  uploadCrmContacts,
  type CrmUpload,
  type CrmContact,
} from "@/lib/api";
import { EntitySearchBar } from "@/components/entity-search-bar";

// Brand-level CRM "Sources" page — every CSV upload imported into crm-service
// for this brand (crm-service `GET /orgs/contacts/uploads`). Click a row to
// inspect the file: its columns, the AI-typed enum per column, and example
// values (sampled from the promoted contacts, shared cache with the Leads page).

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

// AI-typed field enum → colorful tag. crm-service types each CSV column as one of
// email / phone / first_name / last_name / full_name / other.
function enumTagStyle(t: string): string {
  switch (t) {
    case "email": return "bg-green-100 text-green-700 border-green-200";
    case "phone": return "bg-blue-100 text-blue-700 border-blue-200";
    case "full_name":
    case "first_name":
    case "last_name": return "bg-violet-100 text-violet-700 border-violet-200";
    default: return "bg-gray-100 text-gray-600 border-gray-200"; // other
  }
}

function EnumTag({ type }: { type: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${enumTagStyle(type)}`}>
      {type}
    </span>
  );
}

// The typed columns are promoted onto the contact; the `other` columns stay in
// `rawAttributes` keyed by the original header. This resolves either.
function contactValueForColumn(c: CrmContact, colName: string, enumType: string): string | null {
  switch (enumType) {
    case "email": return c.primaryEmail ?? null;
    case "phone": return c.phoneE164 ?? null;
    case "full_name": return c.fullName ?? null;
    case "first_name": return c.firstName ?? null;
    case "last_name": return c.lastName ?? null;
    default: return c.rawAttributes?.[colName] ?? null;
  }
}

interface ColumnInfo {
  colName: string;
  enumType: string;
  examples: string[];
}

function UploadDetailPanel({
  upload,
  columns,
  onClose,
}: {
  upload: CrmUpload;
  columns: ColumnInfo[];
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 md:relative md:w-1/2 bg-gray-50 md:border-l border-gray-200 overflow-y-auto z-10">
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <button onClick={onClose} className="md:hidden flex items-center gap-2 text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back
        </button>
        <h2 className="font-semibold text-gray-800 hidden md:block truncate">{upload.filename || "Upload"}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hidden md:block">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="p-4 md:p-6 space-y-4">
        {/* File info */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">File</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="sm:col-span-2"><span className="text-gray-500">Filename:</span><p className="font-medium break-all">{upload.filename || "—"}</p></div>
            <div><span className="text-gray-500">Rows:</span><p className="font-medium">{(upload.rowCount ?? 0).toLocaleString("en-US")}</p></div>
            <div><span className="text-gray-500">Columns:</span><p className="font-medium">{columns.length}</p></div>
            <div><span className="text-gray-500">Status:</span><p className="font-medium"><StatusBadge status={upload.status ?? null} /></p></div>
            <div><span className="text-gray-500">Mapping:</span><p className="font-medium">{upload.mappingProvenance || "—"}</p></div>
            <div className="sm:col-span-2"><span className="text-gray-500">Uploaded:</span><p className="font-medium">{upload.uploadedAt ? new Date(upload.uploadedAt).toLocaleString() : "—"}<span className="text-gray-400"> ({timeAgo(upload.uploadedAt ?? null)})</span></p></div>
            <div className="sm:col-span-2"><span className="text-gray-500">Upload id:</span><p className="font-mono text-xs text-gray-500 break-all">{upload.id}</p></div>
          </div>
        </div>

        {/* Columns + AI typing + examples */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Columns ({columns.length})</h3>
          {columns.length === 0 ? (
            <p className="text-sm text-gray-500">No column mapping recorded for this upload.</p>
          ) : (
            <div className="space-y-3">
              {columns.map((col) => (
                <div key={col.colName} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-medium text-gray-800 text-sm break-all">{col.colName}</span>
                    <EnumTag type={col.enumType} />
                  </div>
                  {col.examples.length === 0 ? (
                    <p className="text-xs text-gray-400">No example values</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {col.examples.map((ex, i) => (
                        <span key={i} className="text-xs bg-gray-50 border border-gray-200 rounded px-2 py-0.5 text-gray-600 max-w-full truncate" title={ex}>
                          {ex}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CrmSourcesPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      await uploadCrmContacts(brandId, file);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["crmUploads", brandId] }),
        queryClient.invalidateQueries({ queryKey: ["crmContacts", brandId] }),
      ]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const { data, isPending } = useAuthQuery(
    ["crmUploads", brandId],
    () => listCrmUploads(brandId),
    { refetchInterval: 5_000 },
  );

  // Contacts feed the per-column example values; shared cache key with the Leads
  // page so it dedupes rather than double-fetching.
  const { data: contactsData } = useAuthQuery(
    ["crmContacts", brandId],
    () => listCrmContacts(brandId),
    { refetchInterval: 5_000 },
  );
  const contacts = contactsData?.contacts ?? [];

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

  const selected = useMemo(
    () => uploads.find((u) => u.id === selectedId) ?? null,
    [uploads, selectedId],
  );

  // Column name → AI enum → up to 3 distinct non-empty example values, sampled
  // from this upload's promoted contacts. Pure display derivation of wire data.
  const columns: ColumnInfo[] = useMemo(() => {
    if (!selected) return [];
    const mapping = selected.columnMapping ?? {};
    const rows = contacts.filter((c) => c.sourceUploadId === selected.id);
    return Object.entries(mapping).map(([colName, enumType]) => {
      const examples: string[] = [];
      for (const c of rows) {
        const v = contactValueForColumn(c, colName, enumType);
        if (v && v.trim() && !examples.includes(v)) {
          examples.push(v);
          if (examples.length >= 3) break;
        }
      }
      return { colName, enumType, examples };
    });
  }, [selected, contacts]);

  const showSkeleton = isPending && !data;

  return (
    <div className="flex flex-col md:flex-row h-full relative">
      <div className={`${selected ? "hidden md:block md:w-1/2" : "w-full"} p-4 md:p-8 overflow-y-auto transition-all`}>
        <div className="flex items-start justify-between mb-4 gap-3">
          <h1 className="font-display text-xl font-bold text-gray-800">
            Sources
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({uploads.length.toLocaleString("en-US")} CSV {uploads.length === 1 ? "upload" : "uploads"})
            </span>
          </h1>
          <div className="shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFile}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={`text-sm px-3 py-2 rounded-lg border font-medium transition ${
                uploading
                  ? "bg-gray-100 text-gray-400 border-gray-200 cursor-wait"
                  : "bg-brand-50 text-brand-700 border-brand-200 hover:bg-brand-100"
              }`}
            >
              {uploading ? "Uploading…" : "Upload CSV"}
            </button>
          </div>
        </div>

        {uploadError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {uploadError}
          </div>
        )}

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
                  <tr
                    key={u.id}
                    onClick={() => setSelectedId(u.id)}
                    className={`cursor-pointer hover:bg-gray-50 transition ${selectedId === u.id ? "bg-brand-50" : ""}`}
                  >
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

      {selected && (
        <UploadDetailPanel upload={selected} columns={columns} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
