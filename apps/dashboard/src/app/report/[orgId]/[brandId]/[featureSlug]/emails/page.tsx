import { Suspense } from "react";
import { SectionCard } from "@/components/report/section-card";
import { CsvDownloadButton, GoogleSheetsButton, type CsvColumn } from "@/components/report/csv-button";
import { ListSectionSkeleton } from "@/components/report/skeletons";
import { fetchEmails, fetchCampaigns, fetchWorkflows } from "@/lib/report-api";
import type { Email } from "@/lib/api";

interface PageProps {
  params: Promise<{ orgId: string; brandId: string; featureSlug: string }>;
}

interface EmailRow {
  subject: string;
  to: string;
  toCompany: string;
  workflow: string;
  campaign: string;
  createdAt: string;
  bodyText: string;
}

export default async function EmailsPage({ params }: PageProps) {
  const { orgId, brandId, featureSlug } = await params;
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl">
      <Suspense
        fallback={
          <ListSectionSkeleton
            title="Emails generated"
            description="Every email produced by the workflows, including subject and body."
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
      subject: e.subject,
      to: `${e.leadFirstName} ${e.leadLastName}`.trim(),
      toCompany: e.leadCompany,
      workflow: workflowNameBySlug.get(wfSlug) ?? e.generationRun?.taskName ?? "",
      campaign: sole?.name ?? "",
      createdAt: e.createdAt,
      bodyText: e.bodyText ?? "",
    };
  }

  const rows = emails.map(toRow);

  const csvColumns: CsvColumn<EmailRow>[] = [
    { label: "Subject", value: (r) => r.subject },
    { label: "Recipient", value: (r) => r.to },
    { label: "Company", value: (r) => r.toCompany },
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
          <CsvDownloadButton filename={`emails-${featureSlug}.csv`} rows={rows} columns={csvColumns} />
          <GoogleSheetsButton />
        </>
      }
      placeholder={campaigns.length > 1}
      placeholderNote={campaigns.length > 1 ? "Workflow + campaign columns unavailable until backend exposes the join. Showing emails without per-campaign attribution." : undefined}
    >
      {rows.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-gray-500">No emails generated yet.</div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {emails.map((e) => (
            <EmailItem key={e.id} email={e} />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function EmailItem({ email }: { email: Email }) {
  const createdAt = new Date(email.createdAt);
  return (
    <li className="px-5 py-4">
      <div className="flex items-baseline justify-between gap-4 mb-2 flex-wrap">
        <div className="font-medium text-gray-900">{email.subject}</div>
        <div className="text-xs text-gray-400">
          {createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
        </div>
      </div>
      <div className="text-xs text-gray-500 mb-2">
        To <span className="font-medium text-gray-700">{email.leadFirstName} {email.leadLastName}</span>
        {email.leadCompany && <> at <span className="font-medium text-gray-700">{email.leadCompany}</span></>}
        {email.leadTitle && <> · {email.leadTitle}</>}
      </div>
      {email.bodyText ? (
        <details className="mt-2">
          <summary className="text-xs text-brand-600 cursor-pointer hover:underline">View body</summary>
          <pre className="mt-2 text-xs text-gray-700 bg-gray-50 border border-gray-100 rounded p-3 whitespace-pre-wrap font-sans">{email.bodyText}</pre>
        </details>
      ) : null}
      {email.sequence && email.sequence.length > 1 && (
        <div className="text-xs text-gray-400 mt-1">{email.sequence.length} sequence steps</div>
      )}
    </li>
  );
}
