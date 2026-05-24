import { Suspense } from "react";
import { SectionCard } from "@/components/report/section-card";
import { CsvDownloadButton, GoogleSheetsButton } from "@/components/report/csv-button";
import { toCsv, type CsvColumn } from "@/components/report/csv";
import { TableSectionSkeleton } from "@/components/report/skeletons";
import { LeadsTable, type LeadRow } from "@/components/report/leads-table";
import { fetchLeads, fetchWorkflows, REPORT_FETCH_LIMIT } from "@/lib/report-api";
import { getLeadConsolidatedStatus, type Lead } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface PageProps {
  params: Promise<{ orgId: string; brandId: string; featureSlug: string }>;
}

const LEADS_COLUMNS = ["Name", "Email", "Title", "Company", "Industry", "Country"];

function toRow(lead: Lead, workflowName: string): LeadRow {
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
    city: lead.lead?.city ?? "",
    linkedinUrl: lead.lead?.linkedinUrl ?? null,
    status: getLeadConsolidatedStatus(lead),
    intakeStatus: lead.status,
    emailStatus: lead.emailStatus ?? "",
    workflow: workflowName,
    campaignId: lead.campaignId,
    contacted: lead.contacted,
    sent: lead.sent,
    delivered: lead.delivered,
    opened: lead.opened,
    clicked: lead.clicked,
    bounced: lead.bounced,
    unsubscribed: lead.unsubscribed,
    replied: lead.replied,
    replyClassification: lead.replyClassification,
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
            description="Every prospect targeted, with company, email and current status."
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
  // ONLY leads + workflows server-side. Emails are fetched lazily by the
  // drawer when the user clicks a row — avoids the slow /v1/emails call
  // from blocking the page render. Workflows give us the human-readable
  // dynasty name for the Workflow column.
  const [leads, workflows] = await Promise.all([
    fetchLeads(orgId, brandId, featureSlug),
    fetchWorkflows(orgId, featureSlug).catch((err) => {
      console.error(`[report-leads] fetchWorkflows failed (workflow names will show as —):`, err);
      return [];
    }),
  ]);

  const workflowNameBySlug = new Map(workflows.map((w) => [w.workflowSlug, w.workflowDynastyName]));
  const rows = leads.map((l) => toRow(l, l.workflowSlug ? (workflowNameBySlug.get(l.workflowSlug) ?? "") : ""));

  const yesNo = (v: boolean) => (v ? "yes" : "no");

  const csvColumns: CsvColumn<LeadRow>[] = [
    { label: "First name", value: (r) => r.firstName },
    { label: "Last name", value: (r) => r.lastName },
    { label: "Email", value: (r) => r.email },
    { label: "Title", value: (r) => r.title },
    { label: "Company", value: (r) => r.company },
    { label: "Company domain", value: (r) => r.companyDomain },
    { label: "Industry", value: (r) => r.industry },
    { label: "Country", value: (r) => r.country },
    { label: "Current status", value: (r) => r.status },
    { label: "Email delivery state", value: (r) => r.emailStatus },
    { label: "Workflow", value: (r) => r.workflow },
    { label: "Contacted", value: (r) => yesNo(r.contacted) },
    { label: "Sent", value: (r) => yesNo(r.sent) },
    { label: "Delivered", value: (r) => yesNo(r.delivered) },
    { label: "Opened", value: (r) => yesNo(r.opened) },
    { label: "Clicked", value: (r) => yesNo(r.clicked) },
    { label: "Replied", value: (r) => yesNo(r.replied) },
    { label: "Reply classification", value: (r) => r.replyClassification ?? "" },
    { label: "Bounced", value: (r) => yesNo(r.bounced) },
    { label: "Unsubscribed", value: (r) => yesNo(r.unsubscribed) },
  ];

  const truncated = rows.length >= REPORT_FETCH_LIMIT;

  return (
    <SectionCard
      title="Leads"
      description={
        truncated
          ? `Every prospect targeted. Showing first ${REPORT_FETCH_LIMIT}.`
          : "Every prospect targeted, with company, email and current status."
      }
      count={rows.length}
      actions={
        <>
          <CsvDownloadButton filename={`leads-${featureSlug}.csv`} csv={toCsv(rows, csvColumns)} isEmpty={rows.length === 0} />
          <GoogleSheetsButton />
        </>
      }
    >
      <LeadsTable rows={rows} orgId={orgId} brandId={brandId} featureSlug={featureSlug} />
    </SectionCard>
  );
}
