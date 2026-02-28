"use client";

import { useState } from "react";
import { URLS } from "@mcpfactory/content";

type Tab = "brands" | "workflows";

const BRAND_DATA = [
  { name: "Acme SaaS", domain: "acme.com", emails: 4280, openRate: 38.1, clickRate: 12.4, costPerOpen: 0.02 },
  { name: "Nebula AI", domain: "nebula.ai", emails: 3150, openRate: 35.7, clickRate: 10.8, costPerOpen: 0.03 },
  { name: "Startly", domain: "startly.io", emails: 2890, openRate: 31.2, clickRate: 9.1, costPerOpen: 0.04 },
];

const WORKFLOW_DATA = [
  { name: "aurora-v3", category: "Welcome Emails", runs: 1240, openRate: 34.2, replyRate: 8.1, costPerReply: 0.12 },
  { name: "nova-v2", category: "Welcome Emails", runs: 980, openRate: 31.8, replyRate: 7.4, costPerReply: 0.15 },
  { name: "sienna-v1", category: "Cold Outreach", runs: 870, openRate: 28.5, replyRate: 6.2, costPerReply: 0.18 },
];

export function PerformancePreview() {
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
            <span className="ml-1.5 text-xs text-gray-400">{BRAND_DATA.length}</span>
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
            <span className="ml-1.5 text-xs text-gray-400">{WORKFLOW_DATA.length}</span>
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
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Emails</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Open %</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Click %</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">$/Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {BRAND_DATA.map((brand, i) => (
                <tr key={brand.domain} className={`${i === 0 ? "bg-brand-50/30" : ""} hover:bg-gray-50 transition`}>
                  <td className={`px-4 py-3 font-mono text-xs ${i === 0 ? "text-brand-600 font-bold" : "text-gray-400"}`}>
                    {i + 1}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 uppercase">
                        {brand.name.charAt(0)}
                      </div>
                      <div>
                        <div className={`font-medium ${i === 0 ? "text-gray-900" : "text-gray-700"}`}>{brand.name}</div>
                        <div className="text-xs text-gray-400">{brand.domain}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 font-mono text-xs">{brand.emails.toLocaleString()}</td>
                  <td className={`px-4 py-3 text-right font-mono text-xs ${i === 0 ? "text-gray-900 font-medium" : "text-gray-500"}`}>
                    {brand.openRate}%
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 font-mono text-xs">{brand.clickRate}%</td>
                  <td className="px-4 py-3 text-right text-gray-500 font-mono text-xs">${brand.costPerOpen.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Workflow</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Runs</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Open %</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Reply %</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">$/Reply</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {WORKFLOW_DATA.map((wf, i) => (
                <tr key={wf.name} className={`${i === 0 ? "bg-brand-50/30" : ""} hover:bg-gray-50 transition`}>
                  <td className={`px-4 py-3 font-mono text-xs ${i === 0 ? "text-brand-600 font-bold" : "text-gray-400"}`}>
                    {i + 1}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-xs ${i === 0 ? "text-gray-900 font-medium" : "text-gray-700"}`}>
                      {wf.name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {wf.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 font-mono text-xs">{wf.runs.toLocaleString()}</td>
                  <td className={`px-4 py-3 text-right font-mono text-xs ${i === 0 ? "text-gray-900 font-medium" : "text-gray-500"}`}>
                    {wf.openRate}%
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 font-mono text-xs">{wf.replyRate}%</td>
                  <td className="px-4 py-3 text-right text-gray-500 font-mono text-xs">${wf.costPerReply.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
