"use client";

import { useState } from "react";
import Image from "next/image";
import { WORKFLOW_CATEGORY_LABELS } from "@mcpfactory/content";
import {
  formatPercent,
  formatCostCents,
  formatWorkflowName,
  type BrandLeaderboardEntry,
  type WorkflowLeaderboardEntry,
} from "@/lib/fetch-leaderboard";

const LOGO_DEV_TOKEN = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;

type SortKey = "openRate" | "clickRate" | "replyRate" | "interestedRate" | "costPerOpenCents" | "costPerClickCents" | "costPerReplyCents" | "emailsSent" | "totalCostUsdCents" | "runCount";

function SortHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  currentDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
}) {
  const active = currentSort === sortKey;
  return (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-primary-600 select-none"
      onClick={() => onSort(sortKey)}
    >
      {label} {active ? (currentDir === "desc" ? "↓" : "↑") : ""}
    </th>
  );
}

export function BrandLeaderboard({ brands, maxEntries }: { brands: BrandLeaderboardEntry[]; maxEntries?: number }) {
  const [sortKey, setSortKey] = useState<SortKey>("costPerReplyCents");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...brands].sort((a, b) => {
    const av = a[sortKey as keyof BrandLeaderboardEntry] ?? 0;
    const bv = b[sortKey as keyof BrandLeaderboardEntry] ?? 0;
    return sortDir === "desc" ? Number(bv) - Number(av) : Number(av) - Number(bv);
  });

  const visible = maxEntries ? sorted.slice(0, maxEntries) : sorted;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Brand
            </th>
            <SortHeader label="% Opens" sortKey="openRate" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="% Clicks" sortKey="clickRate" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="% Replies" sortKey="replyRate" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="$/Open" sortKey="costPerOpenCents" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="$/Click" sortKey="costPerClickCents" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="$/Reply" sortKey="costPerReplyCents" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {visible.map((brand, i) => (
            <tr key={brand.brandId || brand.brandDomain || i} className="hover:bg-gray-50">
              <td className="px-4 py-4 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  {brand.brandDomain && LOGO_DEV_TOKEN ? (
                    <Image
                      src={`https://img.logo.dev/${brand.brandDomain}?token=${LOGO_DEV_TOKEN}&size=64`}
                      alt={brand.brandDomain}
                      width={28}
                      height={28}
                      className="rounded"
                      unoptimized
                    />
                  ) : (
                    <div className="w-7 h-7 bg-primary-100 rounded flex items-center justify-center text-primary-600 text-sm font-bold">
                      {(brand.brandName || brand.brandDomain || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm font-medium text-gray-900">
                    {brand.brandName || brand.brandDomain || "Unknown"}
                  </span>
                </div>
              </td>
              <td className="px-4 py-4 text-sm text-gray-600">{brand.emailsSent > 0 ? formatPercent(brand.openRate) : "—"}</td>
              <td className="px-4 py-4 text-sm text-gray-600">{brand.emailsSent > 0 ? formatPercent(brand.clickRate) : "—"}</td>
              <td className="px-4 py-4 text-sm text-gray-600">{brand.emailsSent > 0 ? formatPercent(brand.replyRate) : "—"}</td>
              <td className="px-4 py-4 text-sm text-gray-600">{formatCostCents(brand.costPerOpenCents)}</td>
              <td className="px-4 py-4 text-sm text-gray-600">{formatCostCents(brand.costPerClickCents)}</td>
              <td className="px-4 py-4 text-sm text-gray-600">{formatCostCents(brand.costPerReplyCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WorkflowLeaderboard({ workflows, inSection = false, maxEntries }: { workflows: WorkflowLeaderboardEntry[]; inSection?: boolean; maxEntries?: number }) {
  const [sortKey, setSortKey] = useState<SortKey>("costPerReplyCents");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<WorkflowLeaderboardEntry | null>(null);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...workflows].sort((a, b) => {
    const av = a[sortKey as keyof WorkflowLeaderboardEntry] ?? 0;
    const bv = b[sortKey as keyof WorkflowLeaderboardEntry] ?? 0;
    return sortDir === "desc" ? Number(bv) - Number(av) : Number(av) - Number(bv);
  });

  const visible = maxEntries ? sorted.slice(0, maxEntries) : sorted;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Workflow
              </th>
              <SortHeader label="% Opens" sortKey="openRate" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="% Clicks" sortKey="clickRate" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="% Replies" sortKey="replyRate" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="$/Open" sortKey="costPerOpenCents" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="$/Click" sortKey="costPerClickCents" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="$/Reply" sortKey="costPerReplyCents" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {visible.map((wf) => (
              <tr
                key={wf.workflowName}
                className={`hover:bg-gray-50 cursor-pointer ${selected?.workflowName === wf.workflowName ? "bg-primary-50" : ""}`}
                onClick={() => setSelected(selected?.workflowName === wf.workflowName ? null : wf)}
              >
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {inSection && wf.signatureName
                        ? wf.signatureName.charAt(0).toUpperCase() + wf.signatureName.slice(1)
                        : wf.displayName || formatWorkflowName(wf.workflowName)}
                    </span>
                    {!inSection && wf.category && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        {WORKFLOW_CATEGORY_LABELS[wf.category]}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-gray-600">{wf.emailsSent > 0 ? formatPercent(wf.openRate) : "—"}</td>
                <td className="px-4 py-4 text-sm text-gray-600">{wf.emailsSent > 0 ? formatPercent(wf.clickRate) : "—"}</td>
                <td className="px-4 py-4 text-sm text-gray-600">{wf.emailsSent > 0 ? formatPercent(wf.replyRate) : "—"}</td>
                <td className="px-4 py-4 text-sm text-gray-600">{formatCostCents(wf.costPerOpenCents)}</td>
                <td className="px-4 py-4 text-sm text-gray-600">{formatCostCents(wf.costPerClickCents)}</td>
                <td className="px-4 py-4 text-sm text-gray-600">{formatCostCents(wf.costPerReplyCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <WorkflowDetailPanel workflow={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function WorkflowDetailPanel({ workflow: wf, onClose }: { workflow: WorkflowLeaderboardEntry; onClose: () => void }) {
  const name = wf.signatureName
    ? wf.signatureName.charAt(0).toUpperCase() + wf.signatureName.slice(1)
    : wf.displayName || formatWorkflowName(wf.workflowName);

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-xl z-50 overflow-y-auto animate-slide-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="px-6 py-5 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <DetailStat label="Total Spent" value={formatCostCents(wf.totalCostUsdCents)} />
            <DetailStat label="Emails Sent" value={wf.emailsSent > 0 ? wf.emailsSent.toLocaleString() : "—"} />
            <DetailStat label="Runs" value={wf.runCount > 0 ? wf.runCount.toLocaleString() : "—"} />
            <DetailStat label="Interested" value={wf.emailsSent > 0 ? formatPercent(wf.interestedRate) : "—"} />
          </div>

          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Rates</h4>
            <div className="space-y-2">
              <DetailRow label="Open Rate" value={wf.emailsSent > 0 ? formatPercent(wf.openRate) : "—"} sub={`${wf.emailsOpened.toLocaleString()} opens`} />
              <DetailRow label="Click Rate" value={wf.emailsSent > 0 ? formatPercent(wf.clickRate) : "—"} sub={`${wf.emailsClicked.toLocaleString()} clicks`} />
              <DetailRow label="Reply Rate" value={wf.emailsSent > 0 ? formatPercent(wf.replyRate) : "—"} sub={`${wf.emailsReplied.toLocaleString()} replies`} />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Cost per Action</h4>
            <div className="space-y-2">
              <DetailRow label="$/Open" value={formatCostCents(wf.costPerOpenCents)} />
              <DetailRow label="$/Click" value={formatCostCents(wf.costPerClickCents)} />
              <DetailRow label="$/Reply" value={formatCostCents(wf.costPerReplyCents)} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold text-gray-900 mt-0.5">{value}</div>
    </div>
  );
}

function DetailRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div>
        <span className="text-sm text-gray-600">{label}</span>
        {sub && <span className="text-xs text-gray-400 ml-2">{sub}</span>}
      </div>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}
