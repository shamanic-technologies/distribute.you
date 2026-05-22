import { Suspense } from "react";
import { SectionCard } from "@/components/report/section-card";
import { DataTable, type TableColumn } from "@/components/report/data-table";
import { CsvDownloadButton, GoogleSheetsButton, type CsvColumn } from "@/components/report/csv-button";
import { TableSectionSkeleton } from "@/components/report/skeletons";
import { fetchLeads, deriveCompaniesFromLeads, type CompanyRow } from "@/lib/report-api";

interface PageProps {
  params: Promise<{ orgId: string; brandId: string; featureSlug: string }>;
}

const COMPANY_COLUMNS = ["Company", "Industry", "Employees", "Location", "Leads", "Links"];

export default async function CompaniesPage({ params }: PageProps) {
  const { orgId, brandId, featureSlug } = await params;
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl">
      <Suspense
        fallback={
          <TableSectionSkeleton
            title="Companies"
            description="Unique organizations targeted across the feature's campaigns. Derived from enriched lead data."
            columnLabels={COMPANY_COLUMNS}
          />
        }
      >
        <CompaniesSection orgId={orgId} brandId={brandId} featureSlug={featureSlug} />
      </Suspense>
    </div>
  );
}

async function CompaniesSection({ orgId, brandId, featureSlug }: { orgId: string; brandId: string; featureSlug: string }) {
  const leads = await fetchLeads(orgId, brandId, featureSlug);
  const companies = deriveCompaniesFromLeads(leads);

  const columns: TableColumn<CompanyRow>[] = [
    {
      key: "name",
      label: "Company",
      render: (c) => (
        <div>
          <div className="font-medium text-gray-900">{c.name || "—"}</div>
          {c.domain && <div className="text-xs text-gray-400">{c.domain}</div>}
        </div>
      ),
    },
    { key: "industry", label: "Industry", render: (c) => c.industry ?? "—" },
    { key: "employees", label: "Employees", render: (c) => c.employees?.toLocaleString("en-US") ?? "—" },
    { key: "location", label: "Location", render: (c) => [c.city, c.country].filter(Boolean).join(", ") || "—" },
    {
      key: "leadCount",
      label: "Leads",
      render: (c) => <span className="font-medium text-brand-700">{c.leadCount}</span>,
    },
    {
      key: "links",
      label: "Links",
      render: (c) => (
        <div className="flex gap-2">
          {c.websiteUrl && (
            <a href={c.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline">
              Site
            </a>
          )}
          {c.linkedinUrl && (
            <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline">
              LinkedIn
            </a>
          )}
        </div>
      ),
    },
  ];

  const csvColumns: CsvColumn<CompanyRow>[] = [
    { label: "Name", value: (c) => c.name },
    { label: "Domain", value: (c) => c.domain },
    { label: "Industry", value: (c) => c.industry },
    { label: "Employees", value: (c) => c.employees },
    { label: "City", value: (c) => c.city },
    { label: "Country", value: (c) => c.country },
    { label: "Website URL", value: (c) => c.websiteUrl },
    { label: "LinkedIn URL", value: (c) => c.linkedinUrl },
    { label: "Leads targeted", value: (c) => c.leadCount },
  ];

  return (
    <SectionCard
      title="Companies"
      description="Unique organizations targeted across the feature's campaigns. Derived from enriched lead data."
      count={companies.length}
      actions={
        <>
          <CsvDownloadButton filename={`companies-${featureSlug}.csv`} rows={companies} columns={csvColumns} />
          <GoogleSheetsButton />
        </>
      }
    >
      <DataTable rows={companies} columns={columns} rowKey={(c, i) => `${c.name}-${i}`} emptyMessage="No companies yet." />
    </SectionCard>
  );
}
