import { Suspense } from "react";
import { SectionCard } from "@/components/report/section-card";
import { DataTable, type TableColumn } from "@/components/report/data-table";
import { CsvDownloadButton, GoogleSheetsButton } from "@/components/report/csv-button";
import { toCsv, type CsvColumn } from "@/components/report/csv";
import { TableSectionSkeleton } from "@/components/report/skeletons";
import { fetchLeads, deriveIndividualsFromLeads, type IndividualRow } from "@/lib/report-api";

interface PageProps {
  params: Promise<{ orgId: string; brandId: string; featureSlug: string }>;
}

const INDIVIDUAL_COLUMNS = ["Name", "Email", "Title", "Seniority", "Department", "Company", "Location", "Links"];

export default async function IndividualsPage({ params }: PageProps) {
  const { orgId, brandId, featureSlug } = await params;
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl">
      <Suspense
        fallback={
          <TableSectionSkeleton
            title="Individuals"
            description="Every person enriched and queued for outreach, with the maximum metadata available."
            columnLabels={INDIVIDUAL_COLUMNS}
          />
        }
      >
        <IndividualsSection orgId={orgId} brandId={brandId} featureSlug={featureSlug} />
      </Suspense>
    </div>
  );
}

async function IndividualsSection({ orgId, brandId, featureSlug }: { orgId: string; brandId: string; featureSlug: string }) {
  const leads = await fetchLeads(orgId, brandId, featureSlug);
  const individuals = deriveIndividualsFromLeads(leads);

  const columns: TableColumn<IndividualRow>[] = [
    {
      key: "name",
      label: "Name",
      render: (i) => (
        <div>
          <div className="font-medium text-gray-900">{i.firstName} {i.lastName}</div>
          {i.headline && <div className="text-xs text-gray-400">{i.headline}</div>}
        </div>
      ),
    },
    { key: "email", label: "Email", render: (i) => <span className="font-mono text-xs">{i.email}</span> },
    { key: "title", label: "Title", render: (i) => i.title ?? "—" },
    { key: "seniority", label: "Seniority", render: (i) => i.seniority ?? "—" },
    { key: "department", label: "Department", render: (i) => i.department ?? "—" },
    { key: "company", label: "Company", render: (i) => i.company ?? "—" },
    { key: "location", label: "Location", render: (i) => [i.city, i.state, i.country].filter(Boolean).join(", ") || "—" },
    {
      key: "links",
      label: "Links",
      render: (i) => (
        <div className="flex gap-2">
          {i.linkedinUrl && (
            <a href={i.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline">
              LinkedIn
            </a>
          )}
          {i.twitterUrl && (
            <a href={i.twitterUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline">
              Twitter
            </a>
          )}
        </div>
      ),
    },
  ];

  const csvColumns: CsvColumn<IndividualRow>[] = [
    { label: "First name", value: (i) => i.firstName },
    { label: "Last name", value: (i) => i.lastName },
    { label: "Email", value: (i) => i.email },
    { label: "Headline", value: (i) => i.headline },
    { label: "Title", value: (i) => i.title },
    { label: "Seniority", value: (i) => i.seniority },
    { label: "Department", value: (i) => i.department },
    { label: "Company", value: (i) => i.company },
    { label: "City", value: (i) => i.city },
    { label: "State", value: (i) => i.state },
    { label: "Country", value: (i) => i.country },
    { label: "LinkedIn URL", value: (i) => i.linkedinUrl },
    { label: "Twitter URL", value: (i) => i.twitterUrl },
    { label: "Status", value: (i) => i.status },
    { label: "Email status", value: (i) => i.emailStatus },
  ];

  return (
    <SectionCard
      title="Individuals"
      description="Every person enriched and queued for outreach, with the maximum metadata available."
      count={individuals.length}
      actions={
        <>
          <CsvDownloadButton filename={`individuals-${featureSlug}.csv`} csv={toCsv(individuals, csvColumns)} isEmpty={individuals.length === 0} />
          <GoogleSheetsButton />
        </>
      }
    >
      <DataTable rows={individuals} columns={columns} rowKey={(i, idx) => `${i.email}-${idx}`} emptyMessage="No individuals yet." />
    </SectionCard>
  );
}
