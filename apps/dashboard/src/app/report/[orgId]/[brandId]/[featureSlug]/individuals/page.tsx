import { Suspense } from "react";
import { SectionCard } from "@/components/report/section-card";
import { CsvDownloadButton, GoogleSheetsButton } from "@/components/report/csv-button";
import { toCsv, type CsvColumn } from "@/components/report/csv";
import { TableSectionSkeleton } from "@/components/report/skeletons";
import { IndividualsTable } from "@/components/report/individuals-table";
import { fetchLeads, deriveIndividualsFromLeads, type IndividualRow } from "@/lib/report-api";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface PageProps {
  params: Promise<{ orgId: string; brandId: string; featureSlug: string }>;
}

const INDIVIDUAL_COLUMNS = ["Name", "Email", "Title", "Seniority", "Department", "Company", "Location", "Status"];

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
      <IndividualsTable rows={individuals} />
    </SectionCard>
  );
}
