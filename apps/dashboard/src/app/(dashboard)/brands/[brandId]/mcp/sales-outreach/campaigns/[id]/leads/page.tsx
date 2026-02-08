"use client";

import { useState } from "react";
import { type Lead, type RunCost } from "@/lib/api";
import { useCampaign } from "@/lib/campaign-context";

function formatCostRounded(run: Lead["enrichmentRun"]): string | null {
  if (!run) return null;
  const cents = parseFloat(run.totalCostInUsdCents);
  if (isNaN(cents) || cents === 0) return null;
  const usd = cents / 100;
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

function formatCostDetailed(cents: string): string {
  const val = parseFloat(cents) / 100;
  return `$${val.toFixed(4)}`;
}

function formatDuration(startedAt: string, completedAt: string | null): string | null {
  if (!completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function CampaignLeadsPage() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const { leads, loading: isLoading } = useCampaign();

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-32 bg-gray-200 rounded" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-full relative">
      {/* Lead List */}
      <div className={`${selectedLead ? 'hidden md:block md:w-1/2' : 'w-full'} p-4 md:p-8 overflow-y-auto transition-all`}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-xl font-bold text-gray-800">
            Leads
            <span className="ml-2 text-sm font-normal text-gray-500">({leads.length})</span>
          </h1>
        </div>

        {leads.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="text-4xl mb-4">👥</div>
            <h3 className="font-display font-bold text-lg text-gray-800 mb-2">No leads yet</h3>
            <p className="text-gray-600 text-sm">Leads will appear here once the campaign runs.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {leads.map((lead) => {
              const cost = formatCostRounded(lead.enrichmentRun);
              return (
                <button
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className={`w-full text-left bg-white rounded-xl border p-4 hover:border-primary-300 hover:shadow-sm transition ${
                    selectedLead?.id === lead.id ? 'border-primary-500 ring-1 ring-primary-500' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-800 truncate">
                      {lead.firstName} {lead.lastName}
                    </p>
                    {lead.linkedinUrl && (
                      <a
                        href={lead.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-600 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z" />
                        </svg>
                      </a>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm text-gray-500 truncate">
                      {lead.title || "No title"} {lead.organizationName ? `• ${lead.organizationName}` : ""}
                    </p>
                    {cost && (
                      <span className="text-xs text-gray-400 ml-2 shrink-0">{cost}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Lead Detail Panel */}
      {selectedLead && (
        <div className="absolute inset-0 md:relative md:w-1/2 bg-gray-50 md:border-l border-gray-200 overflow-y-auto z-10">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
            <button
              onClick={() => setSelectedLead(null)}
              className="md:hidden flex items-center gap-2 text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h2 className="font-semibold text-gray-800 hidden md:block">Lead Details</h2>
            <button
              onClick={() => setSelectedLead(null)}
              className="text-gray-400 hover:text-gray-600 hidden md:block"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-4 md:p-6">
            {/* Contact Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Name:</span>
                  <p className="font-medium">{selectedLead.firstName} {selectedLead.lastName}</p>
                </div>
                <div>
                  <span className="text-gray-500">Email:</span>
                  <p className="font-medium">{selectedLead.email}</p>
                  {selectedLead.emailStatus && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      selectedLead.emailStatus === "verified" ? "bg-green-100 text-green-700" :
                      selectedLead.emailStatus === "guessed" ? "bg-yellow-100 text-yellow-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {selectedLead.emailStatus}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-gray-500">Title:</span>
                  <p className="font-medium">{selectedLead.title || "-"}</p>
                </div>
                <div>
                  <span className="text-gray-500">Status:</span>
                  <p className="font-medium">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      selectedLead.status === "contacted" ? "bg-green-100 text-green-700" :
                      selectedLead.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {selectedLead.status}
                    </span>
                  </p>
                </div>
                {selectedLead.linkedinUrl && (
                  <div className="sm:col-span-2">
                    <span className="text-gray-500">LinkedIn:</span>
                    <p>
                      <a
                        href={selectedLead.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline text-sm"
                      >
                        {selectedLead.linkedinUrl}
                      </a>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Organization Info */}
            {(selectedLead.organizationName || selectedLead.organizationDomain || selectedLead.organizationIndustry) && (
              <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Organization</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Company:</span>
                    <p className="font-medium">{selectedLead.organizationName || "-"}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Domain:</span>
                    <p className="font-medium">{selectedLead.organizationDomain || "-"}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Industry:</span>
                    <p className="font-medium">{selectedLead.organizationIndustry || "-"}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Size:</span>
                    <p className="font-medium">{selectedLead.organizationSize ? `${selectedLead.organizationSize} employees` : "-"}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Run & Cost Info */}
            {selectedLead.enrichmentRun && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Enrichment Cost</h3>
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                    selectedLead.enrichmentRun.status === "completed" ? "bg-green-400" :
                    selectedLead.enrichmentRun.status === "failed" ? "bg-red-400" :
                    "bg-yellow-400"
                  }`} />
                  <span>{selectedLead.enrichmentRun.status}</span>
                  {formatDuration(selectedLead.enrichmentRun.startedAt, selectedLead.enrichmentRun.completedAt) && (
                    <span>• {formatDuration(selectedLead.enrichmentRun.startedAt, selectedLead.enrichmentRun.completedAt)}</span>
                  )}
                  <span className="ml-auto font-medium text-gray-700">
                    {formatCostDetailed(selectedLead.enrichmentRun.totalCostInUsdCents)}
                  </span>
                </div>
                {selectedLead.enrichmentRun.costs.length > 0 && (
                  <div className="space-y-1">
                    {selectedLead.enrichmentRun.costs.map((cost) => (
                      <div key={cost.costName} className="flex items-center justify-between text-xs text-gray-400">
                        <span className="font-mono">{cost.costName}</span>
                        <span>
                          {Number(cost.quantity).toLocaleString()} × {formatCostDetailed(cost.unitCostInUsdCents)}
                          {" = "}
                          {formatCostDetailed(cost.totalCostInUsdCents)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Metadata */}
            <div className="mt-4 text-xs text-gray-400">
              Found: {new Date(selectedLead.createdAt).toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
