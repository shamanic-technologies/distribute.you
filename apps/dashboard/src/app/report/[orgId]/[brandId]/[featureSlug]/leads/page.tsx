import { Suspense } from "react";
import { SectionCard } from "@/components/report/section-card";
import { CsvDownloadButton, GoogleSheetsButton } from "@/components/report/csv-button";
import { toCsv, type CsvColumn } from "@/components/report/csv";
import { TableSectionSkeleton } from "@/components/report/skeletons";
import { LeadsTable, type LeadRow } from "@/components/report/leads-table";
import { fetchLeads, fetchCampaigns, REPORT_FETCH_LIMIT } from "@/lib/report-api";
import { getLeadConsolidatedStatus, type Lead } from "@/lib/api";

export const revalidate = 30;
export const maxDuration = 60;

interface PageProps {
  params: Promise<{ orgId: string; brandId: string; featureSlug: string }>;
}

const LEADS_COLUMNS = ["Name", "Email", "Title", "Company", "Industry", "Country", "Status", "Campaign"];

function toRow(lead: Lead, campaignName: string): LeadRow {
  const org = lead.lead?.organization;
  const job = lead.lead?.employmentHistory?.find((e) => e.current);
  return {
    email: lead.email,
    firstName: lead.lead?.firstName ?? "",
    lastName: lead.lead?.lastName ?? "",
    title: job?.title ?? lead.lead?.headline ?? "",
    company: org?.name ?? "",
    companyDomain: org?.primaryDomain ?? "",
    industry: org?.industry ?? "",
    country: org?.country ?? "",
    status: getLeadConsolidatedStatus(lead),
    emailStatus: lead.emailStatus ?? "",
    campaign: campaignName,
  };
}

export default async function LeadsPage({ params }: PageProps) {
  const { orgId, brandId, featureSlug } = await params;
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl">
      <Suspense
        fallback={
          <TableSectionSkeleton
            title="Leads"
            description="Every prospect (company × person) targeted by Sales Cold Email Outreach."
            columnLabels={LEADS_COLUMNS}
          />
        }
      >
        <LeadsSection orgId={orgId} brandId={brandId} featureSlug={featureSlug} />
      </Suspense>
    </div>
  );
}

async function LeadsSection({ orgId, brandId, featureSlug }: { orgId: string; brandId: string; featureSlug: string }) {
  const [leads, campaigns] = await Promise.all([
    fetchLeads(orgId, brandId, featureSlug),
    fetchCampaigns(orgId, brandId, featureSlug),
  ]);
  const campaignNameById = new Map(campaigns.map((c) => [c.id, c.name]));
  const rows = leads.map((l) => toRow(l, campaignNameById.get(l.campaignId) ?? ""));

  const csvColumns: CsvColumn<LeadRow>[] = [
    { label: "First name", value: (r) => r.firstName },
    { label: "Last name", value: (r) => r.lastName },
    { label: "Email", value: (r) => r.email },
    { label: "Title", value: (r) => r.title },
    { label: "Company", value: (r) => r.company },
    { label: "Company domain", value: (r) => r.companyDomain },
    { label: "Industry", value: (r) => r.industry },
    { label: "Country", value: (r) => r.country },
    { label: "Status", value: (r) => r.status },
    { label: "Email status", value: (r) => r.emailStatus },
    { label: "Campaign", value: (r) => r.campaign },
  ];

  const truncated = rows.length >= REPORT_FETCH_LIMIT;

  return (
    <SectionCard
      title="Leads"
      description="Every prospect (company × person) targeted by Sales Cold Email Outreach."
      count={rows.length}
      actions={
        <>
          <CsvDownloadButton filename={`leads-${featureSlug}.csv`} csv={toCsv(rows, csvColumns)} isEmpty={rows.length === 0} />
          <GoogleSheetsButton />
        </>
      }
      placeholder={truncated}
      placeholderNote={truncated ? `Showing first ${REPORT_FETCH_LIMIT} leads. Backend pagination needed to surface more.` : undefined}
    >
      <LeadsTable rows={rows} />
    </SectionCard>
  );
}
