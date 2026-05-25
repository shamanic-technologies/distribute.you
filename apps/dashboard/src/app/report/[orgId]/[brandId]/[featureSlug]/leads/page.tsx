import { Suspense } from "react";
import { SectionCard } from "@/components/report/section-card";
import { CsvDownloadButton } from "@/components/report/csv-button";
import { toCsv, type CsvColumn } from "@/components/report/csv";
import { TableSectionSkeleton } from "@/components/report/skeletons";
import { PublicLeadsView } from "@/components/report/public-leads-view";
import type { LeadRow, LeadEmailSummary } from "@/components/report/leads-table";
import { fetchAllEmails, fetchLeads, fetchWorkflows } from "@/lib/report-api";
import { getLeadConsolidatedStatus, type Email, type Lead } from "@/lib/api";

export const revalidate = 14400;
export const maxDuration = 300;

interface PageProps {
  params: Promise<{ orgId: string; brandId: string; featureSlug: string }>;
}

// Mirror the live table column order so the loading skeleton matches the
// rendered table 1:1 — Industry + Country were dropped from the live
// table in favor of a "Last activity" column.
const LEADS_COLUMNS = ["Name", "Email", "Title", "Company", "Last activity"];

function leadKey(campaignId: string, firstName: string, lastName: string): string {
  return `${campaignId}::${firstName.toLowerCase()}::${lastName.toLowerCase()}`;
}

function indexEmailsByLead(
  emails: Email[],
  workflowNameByTask: Map<string, string>,
): Map<string, LeadEmailSummary[]> {
  const map = new Map<string, LeadEmailSummary[]>();
  for (const e of emails) {
    const k = leadKey(e.campaignId, e.leadFirstName ?? "", e.leadLastName ?? "");
    const taskName = e.generationRun?.taskName ?? "";
    // Only surface the workflow tag when we have a mapped human-readable
    // display name. Falling back to the raw `taskName` (e.g.
    // "single-generation") leaks an internal pipeline label that is not
    // meaningful to the recipient and clutters the per-email row.
    const summary: LeadEmailSummary = {
      subject: e.subject ?? "",
      bodyText: e.bodyText ?? "",
      sentAt: e.createdAt,
      workflow: workflowNameByTask.get(taskName) ?? "",
    };
    const existing = map.get(k);
    if (existing) existing.push(summary);
    else map.set(k, [summary]);
  }
  for (const list of map.values()) list.sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
  return map;
}

function toRow(
  lead: Lead,
  workflowName: string,
  emailsByLead: Map<string, LeadEmailSummary[]>,
): LeadRow {
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
    emails: emailsByLead.get(leadKey(lead.campaignId, firstName, lastName)) ?? [],
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
  // Leads + workflows + emails server-side, in parallel. Emails are now
  // embedded into each LeadRow so the drawer opens with zero client-side
  // fetch — all three calls are individually `unstable_cache`-wrapped, so
  // the second visitor in a 4h window pays nothing.
  const [leads, workflows, emails] = await Promise.all([
    fetchLeads(orgId, brandId, featureSlug),
    fetchWorkflows(orgId, featureSlug).catch((err) => {
      console.error(`[report-leads] fetchWorkflows failed (workflow names will show as —):`, err);
      return [];
    }),
    fetchAllEmails(orgId, brandId, featureSlug).catch((err) => {
      console.error(`[report-leads] fetchAllEmails failed (drawer will show empty):`, err);
      return [] as Email[];
    }),
  ]);

  const workflowNameBySlug = new Map(workflows.map((w) => [w.workflowSlug, w.workflowDynastyName]));
  const workflowNameByTask = new Map(workflows.map((w) => [w.workflowSlug, w.workflowDynastyName]));
  const emailsByLead = indexEmailsByLead(emails, workflowNameByTask);
  const rows = leads.map((l) => toRow(l, l.workflowSlug ? (workflowNameBySlug.get(l.workflowSlug) ?? "") : "", emailsByLead));

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
      <PublicLeadsView rows={rows} />
    </SectionCard>
  );
}
