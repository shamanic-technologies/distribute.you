"use client";

import { useMemo, useState } from "react";

const STATUS_STYLES: Record<string, string> = {
  replied: "bg-green-100 text-green-700 border-green-200",
  clicked: "bg-emerald-100 text-emerald-700 border-emerald-200",
  opened: "bg-blue-100 text-blue-700 border-blue-200",
  delivered: "bg-sky-100 text-sky-700 border-sky-200",
  sent: "bg-indigo-100 text-indigo-700 border-indigo-200",
  bounced: "bg-red-100 text-red-700 border-red-200",
  unsubscribed: "bg-zinc-200 text-zinc-700 border-zinc-300",
  contacted: "bg-purple-100 text-purple-700 border-purple-200",
  served: "bg-cyan-100 text-cyan-700 border-cyan-200",
  skipped: "bg-yellow-100 text-yellow-800 border-yellow-200",
  buffered: "bg-amber-100 text-amber-800 border-amber-200",
  claimed: "bg-orange-100 text-orange-800 border-orange-200",
};

export interface LeadRow {
  email: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  companyDomain: string;
  industry: string;
  country: string;
  status: string;
  emailStatus: string;
  campaign: string;
}

type SortKey = "name" | "email" | "title" | "company" | "industry" | "country" | "status" | "campaign";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 25;

interface LeadsTableProps {
  rows: LeadRow[];
}

export function LeadsTable({ rows }: LeadsTableProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);

  const allStatuses = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.status);
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      const hay = `${r.firstName} ${r.lastName} ${r.email} ${r.title} ${r.company} ${r.industry} ${r.country} ${r.campaign}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, statusFilter]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      const av = pickSortValue(a, sortKey).toLowerCase();
      const bv = pickSortValue(b, sortKey).toLowerCase();
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const pageRows = sorted.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  return (
    <div>
      <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap gap-3 items-center bg-gray-50/40">
        <input
          type="search"
          placeholder="Search name, email, company…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          className="flex-1 min-w-[200px] text-sm px-3 py-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
        >
          <option value="all">All statuses</option>
          {allStatuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="text-xs text-gray-500">{sorted.length.toLocaleString("en-US")} matching</span>
      </div>

      {pageRows.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-gray-500">No leads match.</div>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-50">
            <tr>
              <SortHeader label="Name" sortKey="name" currentKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Email" sortKey="email" currentKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Title" sortKey="title" currentKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Company" sortKey="company" currentKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Industry" sortKey="industry" currentKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Country" sortKey="country" currentKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Status" sortKey="status" currentKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Campaign" sortKey="campaign" currentKey={sortKey} dir={sortDir} onClick={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, i) => (
              <tr
                key={`${r.email}-${i}`}
                className="border-t border-gray-100 hover:bg-gray-50 transition"
              >
                <td className="px-4 py-2.5 align-top text-gray-900 font-medium">{r.firstName} {r.lastName}</td>
                <td className="px-4 py-2.5 align-top font-mono text-xs text-gray-700">{r.email}</td>
                <td className="px-4 py-2.5 align-top text-gray-700">{r.title || "—"}</td>
                <td className="px-4 py-2.5 align-top">
                  <div className="text-gray-700">{r.company || "—"}</div>
                  {r.companyDomain && <div className="text-xs text-gray-400">{r.companyDomain}</div>}
                </td>
                <td className="px-4 py-2.5 align-top text-gray-700">{r.industry || "—"}</td>
                <td className="px-4 py-2.5 align-top text-gray-700">{r.country || "—"}</td>
                <td className="px-4 py-2.5 align-top">
                  <span
                    className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[r.status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 align-top text-gray-700">{r.campaign || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {sorted.length > PAGE_SIZE && (
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600 bg-gray-50/40">
          <span>
            Showing {(pageClamped - 1) * PAGE_SIZE + 1}–{Math.min(pageClamped * PAGE_SIZE, sorted.length)} of {sorted.length.toLocaleString("en-US")}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pageClamped === 1}
              className="px-3 py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <span>
              Page {pageClamped} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={pageClamped === totalPages}
              className="px-3 py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function pickSortValue(row: LeadRow, key: SortKey): string {
  switch (key) {
    case "name": return `${row.firstName} ${row.lastName}`;
    case "email": return row.email;
    case "title": return row.title;
    case "company": return row.company;
    case "industry": return row.industry;
    case "country": return row.country;
    case "status": return row.status;
    case "campaign": return row.campaign;
  }
}

function SortHeader({ label, sortKey, currentKey, dir, onClick }: { label: string; sortKey: SortKey; currentKey: SortKey; dir: SortDir; onClick: (k: SortKey) => void }) {
  const isActive = sortKey === currentKey;
  return (
    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 cursor-pointer select-none hover:text-gray-700"
        onClick={() => onClick(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d={dir === "asc" ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
          </svg>
        )}
      </span>
    </th>
  );
}
