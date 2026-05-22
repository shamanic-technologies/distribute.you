import { Suspense } from "react";
import { SectionCard } from "@/components/report/section-card";
import { CsvDownloadButton, GoogleSheetsButton } from "@/components/report/csv-button";
import { toCsv, type CsvColumn } from "@/components/report/csv";
import { TableSectionSkeleton } from "@/components/report/skeletons";
import { CampaignsTable, type CampaignRow } from "@/components/report/campaigns-table";
import { fetchCampaigns, fetchLeads, fetchEmails, fetchWorkflows } from "@/lib/report-api";
import type { Campaign } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface PageProps {
  params: Promise<{ orgId: string; brandId: string; featureSlug: string }>;
}

const CAMPAIGN_COLUMNS = ["Campaign", "Status", "Workflow", "Budget", "Leads", "Emails", "Created"];

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
  const [campaigns, leads, emails, workflows] = await Promise.all([
    fetchCampaigns(orgId, brandId, featureSlug),
    fetchLeads(orgId, brandId, featureSlug),
    fetchEmails(orgId, brandId),
    fetchWorkflows(orgId, featureSlug),
  ]);

  const leadCountByCampaign = new Map<string, number>();
  for (const l of leads) {
    leadCountByCampaign.set(l.campaignId, (leadCountByCampaign.get(l.campaignId) ?? 0) + 1);
  }
  const soleEmailCount = campaigns.length === 1 ? emails.length : null;
  const workflowNameBySlug = new Map(workflows.map((w) => [w.workflowSlug, w.workflowDynastyName]));

  const rows: CampaignRow[] = campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    workflow: (c.workflowSlug && workflowNameBySlug.get(c.workflowSlug)) || "",
    budget: formatBudget(c),
    leadCount: leadCountByCampaign.get(c.id) ?? 0,
    emailCount: campaigns.length === 1 ? soleEmailCount : null,
    createdAt: c.createdAt,
  }));

  const csvColumns: CsvColumn<CampaignRow>[] = [
    { label: "Name", value: (r) => r.name },
    { label: "Status", value: (r) => r.status },
    { label: "Workflow", value: (r) => r.workflow },
    { label: "Budget", value: (r) => r.budget },
    { label: "Leads", value: (r) => r.leadCount },
    { label: "Emails", value: (r) => r.emailCount ?? "" },
    { label: "Created at", value: (r) => r.createdAt },
  ];

  return (
    <SectionCard
      title="Campaigns"
      description="Outreach programs running on this feature. Each campaign uses one workflow."
      count={rows.length}
      actions={
        <>
          <CsvDownloadButton filename={`campaigns-${featureSlug}.csv`} csv={toCsv(rows, csvColumns)} isEmpty={rows.length === 0} />
          <GoogleSheetsButton />
        </>
      }
      placeholder={campaigns.length > 1}
      placeholderNote={campaigns.length > 1 ? "Per-campaign email counts unavailable — backend join pending. Lead counts are accurate." : undefined}
    >
      <CampaignsTable rows={rows} />
    </SectionCard>
  );
}
