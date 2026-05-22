import { Suspense } from "react";
import { SectionCard } from "@/components/report/section-card";
import { CsvDownloadButton, GoogleSheetsButton } from "@/components/report/csv-button";
import { toCsv, type CsvColumn } from "@/components/report/csv";
import { TableSectionSkeleton } from "@/components/report/skeletons";
import { EmailsTable, type EmailRow } from "@/components/report/emails-table";
import { fetchEmails, fetchCampaigns, fetchWorkflows } from "@/lib/report-api";
import type { Email } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface PageProps {
  params: Promise<{ orgId: string; brandId: string; featureSlug: string }>;
}

const EMAIL_COLUMNS = ["Subject", "To", "Company", "Workflow", "Campaign", "Sent"];

export default async function EmailsPage({ params }: PageProps) {
  const { orgId, brandId, featureSlug } = await params;
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl">
      <Suspense
        fallback={
          <TableSectionSkeleton
            title="Emails generated"
            description="Every email produced by the workflows, including subject and body."
            columnLabels={EMAIL_COLUMNS}
          />
        }
      >
        <EmailsSection orgId={orgId} brandId={brandId} featureSlug={featureSlug} />
      </Suspense>
    </div>
  );
}

async function EmailsSection({ orgId, brandId, featureSlug }: { orgId: string; brandId: string; featureSlug: string }) {
  const [emails, campaigns, workflows] = await Promise.all([
    fetchEmails(orgId, brandId),
    fetchCampaigns(orgId, brandId, featureSlug),
    fetchWorkflows(orgId, featureSlug),
  ]);

  const sole = campaigns.length === 1 ? campaigns[0] : null;
  const workflowNameBySlug = new Map(workflows.map((w) => [w.workflowSlug, w.workflowDynastyName]));

  function toRow(e: Email): EmailRow {
    const wfSlug = sole?.workflowSlug ?? "";
    return {
      id: e.id,
      subject: e.subject,
      recipient: `${e.leadFirstName} ${e.leadLastName}`.trim(),
      recipientCompany: e.leadCompany,
      recipientTitle: e.leadTitle,
      workflow: workflowNameBySlug.get(wfSlug) ?? e.generationRun?.taskName ?? "",
      campaign: sole?.name ?? "",
      createdAt: e.createdAt,
      bodyText: e.bodyText ?? "",
    };
  }

  const rows = emails.map(toRow);

  const csvColumns: CsvColumn<EmailRow>[] = [
    { label: "Subject", value: (r) => r.subject },
    { label: "Recipient", value: (r) => r.recipient },
    { label: "Recipient title", value: (r) => r.recipientTitle },
    { label: "Company", value: (r) => r.recipientCompany },
    { label: "Workflow", value: (r) => r.workflow },
    { label: "Campaign", value: (r) => r.campaign },
    { label: "Created at", value: (r) => r.createdAt },
    { label: "Body text", value: (r) => r.bodyText },
  ];

  return (
    <SectionCard
      title="Emails generated"
      description="Every email produced by the workflows, including subject and body."
      count={rows.length}
      actions={
        <>
          <CsvDownloadButton filename={`emails-${featureSlug}.csv`} csv={toCsv(rows, csvColumns)} isEmpty={rows.length === 0} />
          <GoogleSheetsButton />
        </>
      }
      placeholder={campaigns.length > 1}
      placeholderNote={campaigns.length > 1 ? "Workflow + campaign columns unavailable until backend exposes the join. Showing emails without per-campaign attribution." : undefined}
    >
      <EmailsTable rows={rows} />
    </SectionCard>
  );
}
