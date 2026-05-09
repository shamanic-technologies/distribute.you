"use client";

import { useState, useMemo } from "react";
import { type Lead } from "@/lib/api";
import { useCampaign } from "@/lib/campaign-context";
import { BrandLogo } from "@/components/brand-logo";
import { EntitySearchBar } from "@/components/entity-search-bar";

interface DerivedCompany {
  name: string;
  domain: string | null;
  industry: string | null;
  employeeCount: string | null;
  leadsCount: number;
}

function deriveCompanies(leads: Lead[]): DerivedCompany[] {
  const map = new Map<string, { leads: Lead[] }>();
  for (const lead of leads) {
    const name = lead.enrichment?.organizationName ?? null;
    if (!name) continue;
    const entry = map.get(name);
    if (entry) {
      entry.leads.push(lead);
    } else {
      map.set(name, { leads: [lead] });
    }
  }

  return Array.from(map.entries()).map(([name, { leads: companyLeads }]) => {
    const firstE = companyLeads[0].enrichment;
    return {
      name,
      domain: firstE?.organizationDomain ?? null,
      industry: firstE?.organizationIndustry ?? null,
      employeeCount: firstE?.organizationSize ?? null,
      leadsCount: companyLeads.length,
    };
  });
}

export default function CampaignCompaniesPage() {
  const { leads, loading: isLoading } = useCampaign();
  const companies = useMemo(() => deriveCompanies(leads), [leads]);
  const [selectedCompany, setSelectedCompany] = useState<DerivedCompany | null>(null);
  const [search, setSearch] = useState("");

  const filteredCompanies = useMemo(() => {
    if (!search) return companies;
    const q = search.toLowerCase();
    return companies.filter((c) =>
      c.name.toLowerCase().includes(q) || (c.industry?.toLowerCase().includes(q) ?? false)
    );
  }, [companies, search]);

  if (isLoading && leads.length === 0) {
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
            <span className="ml-2 text-sm font-normal text-gray-500">({companies.length.toLocaleString("en-US")})</span>
          </h1>
        </div>

        <EntitySearchBar value={search} onChange={setSearch} placeholder="Search by company or industry..." resultCount={filteredCompanies.length} totalCount={companies.length} />

        {filteredCompanies.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="text-4xl mb-4">&#127970;</div>
            <h3 className="font-display font-bold text-lg text-gray-800 mb-2">{companies.length === 0 ? "No companies yet" : "No matching companies"}</h3>
            <p className="text-gray-600 text-sm">{companies.length === 0 ? "Companies will appear here once leads are found." : "Try a different search term."}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredCompanies.map((company) => (
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
                    <p className="text-sm text-gray-500 truncate mt-1">
                      {company.industry || "No industry"} &middot; {company.leadsCount} lead{company.leadsCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </button>
            ))}
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
          </div>
        </div>
      )}
    </div>
  );
}
