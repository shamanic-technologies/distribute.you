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

export function BrandLeaderboard({ brands }: { brands: BrandLeaderboardEntry[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("totalCostUsdCents");
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

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Brand
            </th>
            <SortHeader label="Spent" sortKey="totalCostUsdCents" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="Emails" sortKey="emailsSent" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="% Opens" sortKey="openRate" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="% Visits" sortKey="clickRate" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="% Replies" sortKey="replyRate" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="$/Open" sortKey="costPerOpenCents" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="$/Visit" sortKey="costPerClickCents" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="$/Reply" sortKey="costPerReplyCents" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sorted.map((brand, i) => (
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
              <td className="px-4 py-4 text-sm font-medium text-gray-900">{formatCostCents(brand.totalCostUsdCents)}</td>
              <td className="px-4 py-4 text-sm text-gray-600">{brand.emailsSent > 0 ? brand.emailsSent.toLocaleString() : "—"}</td>
              <td className="px-4 py-4 text-sm text-gray-600">{brand.emailsSent > 0 ? formatPercent(brand.openRate) : "—"}</td>
              <td className="px-4 py-4 text-sm text-gray-600">{brand.emailsSent > 0 ? formatPercent(brand.clickRate) : "—"}</td>
              <td className="px-4 py-4 text-sm font-medium text-gray-900">{brand.emailsSent > 0 ? formatPercent(brand.replyRate) : "—"}</td>
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

export function WorkflowLeaderboard({ workflows, inSection = false }: { workflows: WorkflowLeaderboardEntry[]; inSection?: boolean }) {
  const [sortKey, setSortKey] = useState<SortKey>("totalCostUsdCents");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Workflow
            </th>
            <SortHeader label="Runs" sortKey="runCount" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="Spent" sortKey="totalCostUsdCents" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="Sent" sortKey="emailsSent" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="% Opens" sortKey="openRate" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="% Replies" sortKey="replyRate" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="% Interested" sortKey="interestedRate" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="$/Reply" sortKey="costPerReplyCents" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sorted.map((wf) => (
            <tr key={wf.workflowName} className="hover:bg-gray-50">
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
              <td className="px-4 py-4 text-sm font-medium text-gray-900">{wf.runCount > 0 ? wf.runCount.toLocaleString() : "—"}</td>
              <td className="px-4 py-4 text-sm text-gray-600">{formatCostCents(wf.totalCostUsdCents)}</td>
              <td className="px-4 py-4 text-sm text-gray-600">{wf.emailsSent > 0 ? wf.emailsSent.toLocaleString() : "—"}</td>
              <td className="px-4 py-4 text-sm text-gray-600">{wf.emailsSent > 0 ? formatPercent(wf.openRate) : "—"}</td>
              <td className="px-4 py-4 text-sm text-gray-600">{wf.emailsSent > 0 ? formatPercent(wf.replyRate) : "—"}</td>
              <td className="px-4 py-4 text-sm font-medium text-gray-900">{wf.emailsSent > 0 ? formatPercent(wf.interestedRate) : "—"}</td>
              <td className="px-4 py-4 text-sm text-gray-600">{formatCostCents(wf.costPerReplyCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
