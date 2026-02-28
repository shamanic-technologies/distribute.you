"use client";

import { useState } from "react";
import { URLS } from "@mcpfactory/content";
import type { BrandEntry, WorkflowEntry } from "@/lib/fetch-leaderboard";
import { formatPercent, formatCostCents } from "@/lib/fetch-leaderboard";

type Tab = "brands" | "workflows";

interface PerformancePreviewProps {
  brands: BrandEntry[];
  workflows: WorkflowEntry[];
}

export function PerformancePreview({ brands, workflows }: PerformancePreviewProps) {
  const [tab, setTab] = useState<Tab>("brands");

  return (
    <div>
      {/* Tabs */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setTab("brands")}
            className={`px-5 py-2 rounded-md text-sm font-medium transition ${
              tab === "brands"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Brands
            <span className="ml-1.5 text-xs text-gray-400">{brands.length}</span>
          </button>
          <button
            onClick={() => setTab("workflows")}
            className={`px-5 py-2 rounded-md text-sm font-medium transition ${
              tab === "workflows"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Workflows
            <span className="ml-1.5 text-xs text-gray-400">{workflows.length}</span>
          </button>
        </div>
        <a
          href={URLS.performance}
          className="text-sm text-brand-600 hover:text-brand-700 font-medium transition flex items-center gap-1"
        >
          See all
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        {tab === "brands" ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">% Opens</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">% Clicks</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">% Replies</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">$/Open</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">$/Click</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">$/Reply</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {brands.map((brand, i) => {
                const displayName = brand.brandName || brand.brandDomain || "Unknown";
                return (
                  <tr key={brand.brandDomain ?? i} className={`${i === 0 ? "bg-brand-50/30" : ""} hover:bg-gray-50 transition`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 uppercase">
                          {displayName.charAt(0)}
                        </div>
                        <span className={`font-medium text-sm ${i === 0 ? "text-gray-900" : "text-gray-700"}`}>{displayName}</span>
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-right font-mono text-xs ${i === 0 ? "text-gray-900 font-medium" : "text-gray-500"}`}>
                      {brand.emailsSent > 0 ? formatPercent(brand.openRate) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 font-mono text-xs">
                      {brand.emailsSent > 0 ? formatPercent(brand.clickRate) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 font-mono text-xs">
                      {brand.emailsSent > 0 ? formatPercent(brand.replyRate) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 font-mono text-xs">{formatCostCents(brand.costPerOpenCents)}</td>
                    <td className="px-4 py-3 text-right text-gray-500 font-mono text-xs">{formatCostCents(brand.costPerClickCents)}</td>
                    <td className="px-4 py-3 text-right text-gray-500 font-mono text-xs">{formatCostCents(brand.costPerReplyCents)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Workflow</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">% Opens</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">% Clicks</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">% Replies</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">$/Open</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">$/Click</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">$/Reply</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {workflows.map((wf, i) => (
                <tr key={wf.workflowName} className={`${i === 0 ? "bg-brand-50/30" : ""} hover:bg-gray-50 transition`}>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-medium ${i === 0 ? "text-gray-900" : "text-gray-700"}`}>
                      {wf.displayName || wf.workflowName}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-mono text-xs ${i === 0 ? "text-gray-900 font-medium" : "text-gray-500"}`}>
                    {wf.emailsSent > 0 ? formatPercent(wf.openRate) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 font-mono text-xs">
                    {wf.emailsSent > 0 ? formatPercent(wf.clickRate) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 font-mono text-xs">
                    {wf.emailsSent > 0 ? formatPercent(wf.replyRate) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 font-mono text-xs">{formatCostCents(wf.costPerOpenCents)}</td>
                  <td className="px-4 py-3 text-right text-gray-500 font-mono text-xs">{formatCostCents(wf.costPerClickCents)}</td>
                  <td className="px-4 py-3 text-right text-gray-500 font-mono text-xs">{formatCostCents(wf.costPerReplyCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
