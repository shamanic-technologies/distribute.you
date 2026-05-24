import { Suspense } from "react";
import { SectionCard } from "@/components/report/section-card";
import { CsvDownloadButton, GoogleSheetsButton } from "@/components/report/csv-button";
import { toCsv, type CsvColumn } from "@/components/report/csv";
import { TableSectionSkeleton } from "@/components/report/skeletons";
import { LeadsTable, type LeadRow, type LeadEmailSummary } from "@/components/report/leads-table";
import { fetchLeads, fetchCampaigns, fetchEmails, fetchWorkflows, REPORT_FETCH_LIMIT } from "@/lib/report-api";
import { getLeadConsolidatedStatus, type Lead, type Email } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface PageProps {
  params: Promise<{ orgId: string; brandId: string; featureSlug: string }>;
}

const LEADS_COLUMNS = ["Name", "Email", "Title", "Company", "Industry", "Country", "Status", "Campaign"];

function leadKey(campaignId: string, firstName: string, lastName: string): string {
  return `${campaignId}::${firstName.toLowerCase()}::${lastName.toLowerCase()}`;
}

function toRow(lead: Lead, campaignName: string, emails: LeadEmailSummary[]): LeadRow {
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
    emailStatus: lead.emailStatus ?? "",
    campaign: campaignName,
    emails,
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
  const [leads, campaigns, emails, workflows] = await Promise.all([
    fetchLeads(orgId, brandId, featureSlug),
    fetchCampaigns(orgId, brandId, featureSlug),
    fetchEmails(orgId, brandId),
    fetchWorkflows(orgId, featureSlug),
  ]);

  const campaignNameById = new Map(campaigns.map((c) => [c.id, c.name]));
  const workflowNameBySlug = new Map(workflows.map((w) => [w.workflowSlug, w.workflowDynastyName]));

  // Index emails by (campaignId, firstName, lastName). The /v1/emails payload
  // doesn't carry the lead's email address, so we match on the campaign +
  // recipient name tuple, which is the closest stable join available today.
  const emailsByKey = new Map<string, LeadEmailSummary[]>();
  for (const e of emails) {
    const key = leadKey(e.campaignId, e.leadFirstName, e.leadLastName);
    const taskName = e.generationRun?.taskName ?? "";
    const summary: LeadEmailSummary = {
      subject: e.subject,
      bodyText: e.bodyText ?? "",
      sentAt: e.createdAt,
      workflow: workflowNameBySlug.get(taskName) ?? taskName ?? "",
    };
    const existing = emailsByKey.get(key);
    if (existing) existing.push(summary);
    else emailsByKey.set(key, [summary]);
  }

  const rows = leads.map((l) => {
    const fn = l.lead?.firstName ?? "";
    const ln = l.lead?.lastName ?? "";
    const matched = emailsByKey.get(leadKey(l.campaignId, fn, ln)) ?? [];
    // Newest first
    matched.sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
    return toRow(l, campaignNameById.get(l.campaignId) ?? "", matched);
  });

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
    { label: "Campaign", value: (r) => r.campaign },
    // Per-milestone columns in chronological order. yes/no booleans so the
    // CSV is greppable and the client can pivot in a spreadsheet.
    { label: "Contacted", value: (r) => yesNo(r.contacted) },
    { label: "Sent", value: (r) => yesNo(r.sent) },
    { label: "Delivered", value: (r) => yesNo(r.delivered) },
    { label: "Opened", value: (r) => yesNo(r.opened) },
    { label: "Clicked", value: (r) => yesNo(r.clicked) },
    { label: "Replied", value: (r) => yesNo(r.replied) },
    { label: "Reply classification", value: (r) => r.replyClassification ?? "" },
    { label: "Bounced", value: (r) => yesNo(r.bounced) },
    { label: "Unsubscribed", value: (r) => yesNo(r.unsubscribed) },
    { label: "Emails sent count", value: (r) => r.emails.length },
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
      <LeadsTable rows={rows} />
    </SectionCard>
  );
}
