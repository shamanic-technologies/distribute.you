import { Suspense } from "react";
import { SectionCard } from "@/components/report/section-card";
import { CsvDownloadButton, GoogleSheetsButton } from "@/components/report/csv-button";
import { toCsv, type CsvColumn } from "@/components/report/csv";
import { TableSectionSkeleton } from "@/components/report/skeletons";
import { CompaniesTable } from "@/components/report/companies-table";
import { fetchLeads, deriveCompaniesFromLeads, type CompanyRow } from "@/lib/report-api";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface PageProps {
  params: Promise<{ orgId: string; brandId: string; featureSlug: string }>;
}

const COMPANY_COLUMNS = ["Company", "Industry", "Employees", "Location", "Leads"];

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
          <CsvDownloadButton filename={`companies-${featureSlug}.csv`} csv={toCsv(companies, csvColumns)} isEmpty={companies.length === 0} />
          <GoogleSheetsButton />
        </>
      }
    >
      <CompaniesTable rows={companies} />
    </SectionCard>
  );
}
