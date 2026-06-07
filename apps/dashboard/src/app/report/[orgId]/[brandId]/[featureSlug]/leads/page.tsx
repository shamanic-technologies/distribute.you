import { Suspense } from "react";
import { SectionCard } from "@/components/report/section-card";
import { CsvDownloadButton } from "@/components/report/csv-button";
import { toCsv, type CsvColumn } from "@/components/report/csv";
import { TableSectionSkeleton } from "@/components/report/skeletons";
import { PublicLeadsView } from "@/components/report/public-leads-view";
import type { LeadRow } from "@/components/report/leads-table";
import { fetchLeads, fetchWorkflows } from "@/lib/report-api";
import { getLeadConsolidatedStatus, type Lead } from "@/lib/api";

export const revalidate = 14400;
export const maxDuration = 300;

interface PageProps {
  params: Promise<{ orgId: string; brandId: string; featureSlug: string }>;
}

// Mirror the live table column order so the loading skeleton matches the
// rendered table 1:1 — Industry + Country were dropped from the live
// table in favor of a "Last activity" column.
const LEADS_COLUMNS = ["Name", "Email", "Title", "Company", "Last activity"];

function toRow(lead: Lead, workflowName: string): LeadRow {
  const org = lead.lead?.organization;
  const job = lead.lead?.employmentHistory?.find((e) => e.current);
  const firstName = lead.lead?.firstName ?? "";
  const lastName = lead.lead?.lastName ?? "";
  return {
    email: lead.email,
    firstName,
    lastName,
    title: job?.title ?? lead.lead?.headline ?? "",
    company: org?.name ?? "",
    companyDomain: org?.primaryDomain ?? "",
    industry: org?.industry ?? "",
    country: org?.country ?? "",
    city: lead.lead?.city ?? "",
    companyEmployees: org?.estimatedNumEmployees ?? null,
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
    globalBounced: lead.global?.bounced ?? false,
    globalUnsubscribed: lead.global?.unsubscribed ?? false,
    servedAt: lead.servedAt,
    lastDeliveredAt: lead.lastDeliveredAt,
  };
}

export default async function LeadsPage({ params }: PageProps) {
  const { orgId, brandId, featureSlug } = await params;
  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <Suspense
        fallback={
          <TableSectionSkeleton
            title="Leads"
            description="Every prospect considered."
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
  // Leads + workflows server-side, in parallel. Emails are no longer
  // embedded — the per-row payload exploded the HTML to ~15MB / ~25s
  // streaming time, even on warm cache. The drawer now lazy-fetches
  // emails via `GET /api/report/.../lead-emails` when the user clicks a
  // row; that endpoint is backed by the same `unstable_cache`-wrapped
  // `fetchEmailsForCampaign` call, so the first drawer open within a 4h
  // window pays the upstream fill and every later open hits the cache.
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

  return (
    <SectionCard
      title="Leads"
      description="Every prospect considered."
      count={rows.length}
      actions={
        <CsvDownloadButton filename={`leads-${featureSlug}.csv`} csv={toCsv(rows, csvColumns)} isEmpty={rows.length === 0} />
      }
    >
      <PublicLeadsView
        rows={rows}
        emailsApiUrl={`/api/report/${orgId}/${brandId}/${featureSlug}/lead-emails`}
      />
    </SectionCard>
  );
}
