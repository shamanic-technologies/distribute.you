"use client";

import { useState, useMemo } from "react";
import { type Lead } from "@/lib/api";
import { useCampaign } from "@/lib/campaign-context";
import { BrandLogo } from "@/components/brand-logo";

interface DerivedCompany {
  name: string;
  domain: string | null;
  industry: string | null;
  employeeCount: string | null;
  leadsCount: number;
  totalCostInUsdCents: string | null;
  costs: Array<{ costName: string; quantity: number; totalCostInUsdCents: number }>;
}

function deriveCompanies(leads: Lead[]): DerivedCompany[] {
  const map = new Map<string, { leads: Lead[] }>();
  for (const lead of leads) {
    const name = lead.organizationName;
    if (!name) continue;
    const entry = map.get(name);
    if (entry) {
      entry.leads.push(lead);
    } else {
      map.set(name, { leads: [lead] });
    }
  }

  return Array.from(map.entries()).map(([name, { leads: companyLeads }]) => {
    const first = companyLeads[0];

    // Aggregate costs across all leads' enrichment runs
    let totalCents = 0;
    const costAgg = new Map<string, { quantity: number; totalCostInUsdCents: number }>();
    for (const lead of companyLeads) {
      if (!lead.enrichmentRun) continue;
      totalCents += parseFloat(lead.enrichmentRun.totalCostInUsdCents) || 0;
      for (const cost of lead.enrichmentRun.costs) {
        const existing = costAgg.get(cost.costName);
        const q = parseFloat(cost.quantity) || 0;
        const t = parseFloat(cost.totalCostInUsdCents) || 0;
        if (existing) {
          existing.quantity += q;
          existing.totalCostInUsdCents += t;
        } else {
          costAgg.set(cost.costName, { quantity: q, totalCostInUsdCents: t });
        }
      }
    }

    return {
      name,
      domain: first.organizationDomain,
      industry: first.organizationIndustry,
      employeeCount: first.organizationSize,
      leadsCount: companyLeads.length,
      totalCostInUsdCents: totalCents > 0 ? String(totalCents) : null,
      costs: Array.from(costAgg.entries()).map(([costName, agg]) => ({ costName, ...agg })),
    };
  });
}

function formatCostRounded(totalCents: string | null): string | null {
  if (!totalCents) return null;
  const cents = parseFloat(totalCents);
  if (isNaN(cents) || cents === 0) return null;
  const usd = cents / 100;
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

function formatCostDetailed(cents: number): string {
  const val = cents / 100;
  return `$${val.toFixed(4)}`;
}

export default function CampaignCompaniesPage() {
  const { leads, loading: isLoading } = useCampaign();
  const companies = useMemo(() => deriveCompanies(leads), [leads]);
  const [selectedCompany, setSelectedCompany] = useState<DerivedCompany | null>(null);

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
      {/* Company List */}
      <div className={`${selectedCompany ? 'hidden md:block md:w-1/2' : 'w-full'} p-4 md:p-8 overflow-y-auto transition-all`}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-xl font-bold text-gray-800">
            Companies
            <span className="ml-2 text-sm font-normal text-gray-500">({companies.length})</span>
          </h1>
        </div>

        {companies.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="text-4xl mb-4">&#127970;</div>
            <h3 className="font-display font-bold text-lg text-gray-800 mb-2">No companies yet</h3>
            <p className="text-gray-600 text-sm">Companies will appear here once leads are found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {companies.map((company) => {
              const cost = formatCostRounded(company.totalCostInUsdCents);
              return (
                <button
                  key={company.name}
                  onClick={() => setSelectedCompany(company)}
                  className={`w-full text-left bg-white rounded-xl border p-4 hover:border-brand-300 hover:shadow-sm transition ${
                    selectedCompany?.name === company.name ? 'border-brand-500 ring-1 ring-brand-500' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                      {company.domain ? (
                        <BrandLogo domain={company.domain} size={32} className="rounded-lg" />
                      ) : (
                        <span className="text-gray-500 font-medium text-sm">
                          {company.name[0]}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-800 truncate">{company.name}</p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-sm text-gray-500 truncate">
                          {company.industry || "No industry"} &middot; {company.leadsCount} lead{company.leadsCount !== 1 ? "s" : ""}
                        </p>
                        {cost && (
                          <span className="text-xs text-gray-400 ml-2 shrink-0">{cost}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Company Detail Panel */}
      {selectedCompany && (
        <div className="absolute inset-0 md:relative md:w-1/2 bg-gray-50 md:border-l border-gray-200 overflow-y-auto z-10">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
            <button
              onClick={() => setSelectedCompany(null)}
              className="md:hidden flex items-center gap-2 text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h2 className="font-semibold text-gray-800 hidden md:block">Company Details</h2>
            <button
              onClick={() => setSelectedCompany(null)}
              className="text-gray-400 hover:text-gray-600 hidden md:block"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-4 md:p-6">
            {/* Company Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                  {selectedCompany.domain ? (
                    <BrandLogo domain={selectedCompany.domain} size={40} className="rounded-lg" />
                  ) : (
                    <span className="text-gray-500 font-semibold text-lg">
                      {selectedCompany.name[0]}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">{selectedCompany.name}</h3>
                  {selectedCompany.domain && (
                    <a
                      href={`https://${selectedCompany.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-brand-500 hover:underline"
                    >
                      {selectedCompany.domain}
                    </a>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Industry:</span>
                  <p className="font-medium">{selectedCompany.industry || "-"}</p>
                </div>
                <div>
                  <span className="text-gray-500">Size:</span>
                  <p className="font-medium">{selectedCompany.employeeCount ? `${selectedCompany.employeeCount} employees` : "-"}</p>
                </div>
                <div>
                  <span className="text-gray-500">Leads:</span>
                  <p className="font-medium">
                    <span className="text-xs bg-brand-50 text-brand-700 px-2 py-1 rounded-full">
                      {selectedCompany.leadsCount} lead{selectedCompany.leadsCount !== 1 ? "s" : ""}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Enrichment Cost */}
            {selectedCompany.totalCostInUsdCents && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Enrichment Cost</h3>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-500">Total ({selectedCompany.leadsCount} enrichments)</span>
                  <span className="font-medium text-gray-700">
                    {formatCostDetailed(parseFloat(selectedCompany.totalCostInUsdCents))}
                  </span>
                </div>
                {selectedCompany.costs.length > 0 && (
                  <div className="space-y-1 border-t border-gray-100 pt-2">
                    {selectedCompany.costs.map((cost) => (
                      <div key={cost.costName} className="flex items-center justify-between text-xs text-gray-400">
                        <span className="font-mono">{cost.costName}</span>
                        <span>
                          {cost.quantity.toLocaleString()} × {formatCostDetailed(cost.totalCostInUsdCents / cost.quantity)}
                          {" = "}
                          {formatCostDetailed(cost.totalCostInUsdCents)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
