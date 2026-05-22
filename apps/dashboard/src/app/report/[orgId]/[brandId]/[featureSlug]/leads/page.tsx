import { SectionCard } from "@/components/report/section-card";
import { DataTable, type TableColumn } from "@/components/report/data-table";
import { CsvDownloadButton, GoogleSheetsButton, type CsvColumn } from "@/components/report/csv-button";
import { fetchLeads } from "@/lib/report-api";
import { getLeadConsolidatedStatus, type Lead } from "@/lib/api";

interface PageProps {
  params: Promise<{ orgId: string; brandId: string; featureSlug: string }>;
}

const STATUS_STYLES: Record<string, string> = {
  replied: "bg-green-100 text-green-700",
  clicked: "bg-emerald-100 text-emerald-700",
  opened: "bg-blue-100 text-blue-700",
  delivered: "bg-sky-100 text-sky-700",
  sent: "bg-indigo-100 text-indigo-700",
  bounced: "bg-red-100 text-red-600",
  unsubscribed: "bg-gray-200 text-gray-600",
  contacted: "bg-purple-100 text-purple-700",
  served: "bg-cyan-100 text-cyan-700",
  skipped: "bg-yellow-100 text-yellow-700",
  buffered: "bg-gray-100 text-gray-500",
  claimed: "bg-gray-100 text-gray-500",
};

interface LeadRow {
  email: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  companyDomain: string;
  industry: string;
  country: string;
  status: string;
  emailStatus: string;
  campaignId: string;
}

function toRow(lead: Lead): LeadRow {
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
    campaignId: lead.campaignId,
  };
}

export default async function LeadsPage({ params }: PageProps) {
  const { brandId, featureSlug } = await params;
  const leads = await fetchLeads(brandId, featureSlug);
  const rows = leads.map(toRow);

  const columns: TableColumn<LeadRow>[] = [
    { key: "name", label: "Name", render: (r) => <span className="font-medium text-gray-900">{r.firstName} {r.lastName}</span> },
    { key: "email", label: "Email", render: (r) => <span className="font-mono text-xs">{r.email}</span> },
    { key: "title", label: "Title", render: (r) => r.title },
    {
      key: "company",
      label: "Company",
      render: (r) => (
        <div>
          <div>{r.company}</div>
          {r.companyDomain && <div className="text-xs text-gray-400">{r.companyDomain}</div>}
        </div>
      ),
    },
    { key: "industry", label: "Industry", render: (r) => r.industry },
    { key: "country", label: "Country", render: (r) => r.country },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[r.status] ?? "bg-gray-100 text-gray-500"}`}>
          {r.status}
        </span>
      ),
    },
  ];

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
    { label: "Campaign ID", value: (r) => r.campaignId },
  ];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl">
      <SectionCard
        title="Leads"
        description="Every prospect (company × person) targeted by Sales Cold Email Outreach."
        count={rows.length}
        actions={
          <>
            <CsvDownloadButton filename={`leads-${brandId}.csv`} rows={rows} columns={csvColumns} />
            <GoogleSheetsButton />
          </>
        }
      >
        <DataTable rows={rows} columns={columns} rowKey={(_, i) => String(i)} emptyMessage="No leads yet." />
      </SectionCard>
    </div>
  );
}
