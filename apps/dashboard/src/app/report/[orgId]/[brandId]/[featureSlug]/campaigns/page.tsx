import { Suspense } from "react";
import { SectionCard } from "@/components/report/section-card";
import { DataTable, type TableColumn } from "@/components/report/data-table";
import { CsvDownloadButton, GoogleSheetsButton, type CsvColumn } from "@/components/report/csv-button";
import { TableSectionSkeleton } from "@/components/report/skeletons";
import { fetchCampaigns, fetchLeads, fetchEmails } from "@/lib/report-api";
import type { Campaign } from "@/lib/api";

interface PageProps {
  params: Promise<{ orgId: string; brandId: string; featureSlug: string }>;
}

const STATUS_STYLES: Record<string, string> = {
  ongoing: "bg-blue-100 text-blue-700",
  paused: "bg-yellow-100 text-yellow-700",
  stopped: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-600",
};

const CAMPAIGN_COLUMNS = ["Campaign", "Status", "Workflow", "Budget", "Leads", "Emails", "Created"];

interface CampaignRow {
  id: string;
  name: string;
  status: string;
  workflow: string;
  budget: string;
  leadCount: number;
  emailCount: number;
  createdAt: string;
}

function formatBudget(c: Campaign): string {
  if (c.maxBudgetMonthlyUsd) return `$${Number(c.maxBudgetMonthlyUsd).toLocaleString("en-US")} / month`;
  if (c.maxBudgetWeeklyUsd) return `$${Number(c.maxBudgetWeeklyUsd).toLocaleString("en-US")} / week`;
  if (c.maxBudgetDailyUsd) return `$${Number(c.maxBudgetDailyUsd).toLocaleString("en-US")} / day`;
  if (c.maxBudgetTotalUsd) return `$${Number(c.maxBudgetTotalUsd).toLocaleString("en-US")} one-off`;
  return "—";
}

export default async function CampaignsPage({ params }: PageProps) {
  const { orgId, brandId, featureSlug } = await params;
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl">
      <Suspense
        fallback={
          <TableSectionSkeleton
            title="Campaigns"
            description="Outreach programs running on this feature. Each campaign uses one workflow."
            columnLabels={CAMPAIGN_COLUMNS}
          />
        }
      >
        <CampaignsSection orgId={orgId} brandId={brandId} featureSlug={featureSlug} />
      </Suspense>
    </div>
  );
}

async function CampaignsSection({ orgId, brandId, featureSlug }: { orgId: string; brandId: string; featureSlug: string }) {
  const [campaigns, leads, emails] = await Promise.all([
    fetchCampaigns(orgId, brandId, featureSlug),
    fetchLeads(orgId, brandId, featureSlug),
    fetchEmails(orgId, brandId),
  ]);

  const leadCountByCampaign = new Map<string, number>();
  for (const l of leads) {
    leadCountByCampaign.set(l.campaignId, (leadCountByCampaign.get(l.campaignId) ?? 0) + 1);
  }
  const soleEmailCount = campaigns.length === 1 ? emails.length : 0;

  const rows: CampaignRow[] = campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    workflow: c.workflowSlug ?? "",
    budget: formatBudget(c),
    leadCount: leadCountByCampaign.get(c.id) ?? 0,
    emailCount: campaigns.length === 1 ? soleEmailCount : 0,
    createdAt: c.createdAt,
  }));

  const columns: TableColumn<CampaignRow>[] = [
    { key: "name", label: "Campaign", render: (r) => <span className="font-medium text-gray-900">{r.name}</span> },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[r.status] ?? "bg-gray-100 text-gray-500"}`}>
          {r.status}
        </span>
      ),
    },
    { key: "workflow", label: "Workflow", render: (r) => <span className="font-mono text-xs">{r.workflow || "—"}</span> },
    { key: "budget", label: "Budget", render: (r) => r.budget },
    { key: "leadCount", label: "Leads", render: (r) => r.leadCount.toLocaleString("en-US") },
    {
      key: "emailCount",
      label: "Emails",
      render: (r) => (campaigns.length === 1 ? r.emailCount.toLocaleString("en-US") : <span className="text-gray-300" title="Per-campaign join pending">—</span>),
    },
    {
      key: "createdAt",
      label: "Created",
      render: (r) => new Date(r.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" }),
    },
  ];

  const csvColumns: CsvColumn<CampaignRow>[] = [
    { label: "Campaign ID", value: (r) => r.id },
    { label: "Name", value: (r) => r.name },
    { label: "Status", value: (r) => r.status },
    { label: "Workflow", value: (r) => r.workflow },
    { label: "Budget", value: (r) => r.budget },
    { label: "Leads", value: (r) => r.leadCount },
    { label: "Emails", value: (r) => r.emailCount },
    { label: "Created at", value: (r) => r.createdAt },
  ];

  return (
    <SectionCard
      title="Campaigns"
      description="Outreach programs running on this feature. Each campaign uses one workflow."
      count={rows.length}
      actions={
        <>
          <CsvDownloadButton filename={`campaigns-${brandId}.csv`} rows={rows} columns={csvColumns} />
          <GoogleSheetsButton />
        </>
      }
      placeholder={campaigns.length > 1}
      placeholderNote={campaigns.length > 1 ? "Per-campaign email counts unavailable — backend join pending. Lead counts are accurate." : undefined}
    >
      <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} emptyMessage="No campaigns yet." />
    </SectionCard>
  );
}
