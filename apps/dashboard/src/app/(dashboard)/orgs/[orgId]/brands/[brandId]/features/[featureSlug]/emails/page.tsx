"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listBrandEmails, type Email } from "@/lib/api";

const POLL_INTERVAL = 5_000;

function getEmailBody(email: Email): { html: string | null; text: string | null } {
  if (email.bodyHtml || email.bodyText) {
    return { html: email.bodyHtml, text: email.bodyText };
  }
  if (email.sequence && email.sequence.length > 0) {
    return { html: email.sequence[0].bodyHtml, text: email.sequence[0].bodyText };
  }
  return { html: null, text: null };
}

function formatRecipient(email: Email): string {
  const name = [email.leadFirstName, email.leadLastName].filter(Boolean).join(" ");
  const company = email.leadCompany;
  if (name && company) return `${name} — ${company}`;
  if (name) return name;
  if (company) return company;
  return "Unknown recipient";
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

function formatCostRounded(run: Email["generationRun"]): string | null {
  if (!run) return null;
  const cents = parseFloat(run.totalCostInUsdCents);
  if (isNaN(cents) || cents === 0) return null;
  const usd = cents / 100;
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

function formatCostDetailed(cents: string): string {
  const val = parseFloat(cents) / 100;
  return `$${val.toFixed(4)}`;
}

function formatDuration(startedAt: string, completedAt: string | null): string | null {
  if (!completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTotalCost(emails: Email[]): string | null {
  let totalCents = 0;
  for (const email of emails) {
    if (email.generationRun) {
      const cents = parseFloat(email.generationRun.totalCostInUsdCents);
      if (!isNaN(cents)) totalCents += cents;
    }
  }
  if (totalCents === 0) return null;
  const usd = totalCents / 100;
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

function PersonInitials({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = [firstName?.[0], lastName?.[0]].filter(Boolean).join("").toUpperCase() || "?";
  return (
    <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold shrink-0">
      {initials}
    </div>
  );
}

export default function FeatureEmailsPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  const { data, isLoading } = useAuthQuery(
    ["brandEmails", brandId],
    () => listBrandEmails(brandId),
    { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false },
  );

  const emails = data?.emails ?? [];
  const totalCost = useMemo(() => formatTotalCost(emails), [emails]);

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-32 bg-gray-200 rounded" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-full relative">
      {/* Email List */}
      <div className={`${selectedEmail ? 'hidden md:block md:w-1/2' : 'w-full'} p-4 md:p-8 overflow-y-auto transition-all`}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-xl font-bold text-gray-800">
            Emails
            <span className="ml-2 text-sm font-normal text-gray-500">({emails.length} across all campaigns)</span>
          </h1>
          {totalCost && (
            <span className="text-sm text-gray-500">
              Total cost: <span className="font-medium text-gray-700">{totalCost}</span>
            </span>
          )}
        </div>

        {emails.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <h3 className="font-display font-bold text-lg text-gray-800 mb-2">No emails yet</h3>
            <p className="text-gray-600 text-sm">Emails will appear here once campaigns generate them.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {emails.map((email) => {
              const cost = formatCostRounded(email.generationRun);
              const recipient = formatRecipient(email);
              const name = [email.leadFirstName, email.leadLastName].filter(Boolean).join(" ");
              return (
                <button
                  key={email.id}
                  onClick={() => setSelectedEmail(email)}
                  title={recipient}
                  className={`w-full text-left bg-white rounded-xl border p-4 hover:border-brand-300 hover:shadow-sm transition ${
                    selectedEmail?.id === email.id ? 'border-brand-500 ring-1 ring-brand-500' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <PersonInitials firstName={email.leadFirstName} lastName={email.leadLastName} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-800 truncate text-sm">
                          {name || "Unknown"}
                        </p>
                        {email.leadCompany && (
                          <span className="text-xs text-gray-400 truncate shrink-0">
                            {email.leadCompany}
                          </span>
                        )}
                      </div>
                      {email.leadTitle && (
                        <p className="text-xs text-gray-400 truncate">{email.leadTitle}</p>
                      )}
                    </div>
                    <div className="hidden lg:block min-w-0 flex-1">
                      <p className="text-sm text-gray-600 truncate">{email.subject}</p>
                    </div>
                    {cost && (
                      <span className="text-xs text-gray-400 shrink-0 hidden sm:block">{cost}</span>
                    )}
                    <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap" title={new Date(email.createdAt).toLocaleString()}>
                      {timeAgo(email.createdAt)}
                    </span>
                  </div>
                  <p className="lg:hidden text-sm text-gray-600 truncate mt-1.5 ml-11">{email.subject}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Email Detail Panel */}
      {selectedEmail && (
        <div className="absolute inset-0 md:relative md:w-1/2 bg-gray-50 md:border-l border-gray-200 overflow-y-auto z-10">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
            <button
              onClick={() => setSelectedEmail(null)}
              className="md:hidden flex items-center gap-2 text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h2 className="font-semibold text-gray-800 hidden md:block">Email Preview</h2>
            <button
              onClick={() => setSelectedEmail(null)}
              className="text-gray-400 hover:text-gray-600 hidden md:block"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-4 md:p-6">
            {/* Recipient Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4" title={formatRecipient(selectedEmail)}>
              <div className="flex items-center gap-3 mb-3">
                <PersonInitials firstName={selectedEmail.leadFirstName} lastName={selectedEmail.leadLastName} />
                <div>
                  <p className="font-medium text-gray-800">
                    {[selectedEmail.leadFirstName, selectedEmail.leadLastName].filter(Boolean).join(" ") || "Unknown"}
                  </p>
                  {selectedEmail.leadTitle && (
                    <p className="text-sm text-gray-500">{selectedEmail.leadTitle}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Company:</span>
                  <p className="font-medium">{selectedEmail.leadCompany || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Industry:</span>
                  <p className="font-medium">{selectedEmail.leadIndustry || '-'}</p>
                </div>
              </div>
            </div>

            {/* Email Content */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
                <p className="font-semibold text-gray-800">{selectedEmail.subject}</p>
                <p className="text-xs text-gray-500 mt-1">
                  From: {selectedEmail.clientCompanyName || 'Your Company'}
                </p>
              </div>
              <div className="p-4">
                {(() => {
                  const body = getEmailBody(selectedEmail);
                  if (body.html) {
                    return (
                      <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: body.html }}
                      />
                    );
                  }
                  if (body.text) {
                    return (
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                        {body.text}
                      </pre>
                    );
                  }
                  return (
                    <p className="text-sm text-gray-400 italic">No email body available</p>
                  );
                })()}
              </div>
            </div>

            {/* Run & Cost Info */}
            {selectedEmail.generationRun && (
              <div className="mt-4 bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                    selectedEmail.generationRun.status === "completed" ? "bg-green-400" :
                    selectedEmail.generationRun.status === "failed" ? "bg-red-400" :
                    "bg-yellow-400"
                  }`} />
                  <span>{selectedEmail.generationRun.status}</span>
                  {formatDuration(selectedEmail.generationRun.startedAt, selectedEmail.generationRun.completedAt) && (
                    <span>— {formatDuration(selectedEmail.generationRun.startedAt, selectedEmail.generationRun.completedAt)}</span>
                  )}
                  <span className="ml-auto font-medium text-gray-700">
                    {formatCostDetailed(selectedEmail.generationRun.totalCostInUsdCents)}
                  </span>
                </div>
                {selectedEmail.generationRun.costs.length > 0 && (
                  <div className="space-y-1">
                    {selectedEmail.generationRun.costs.map((cost) => (
                      <div key={cost.costName} className="flex items-center justify-between text-xs text-gray-400">
                        <span className="font-mono">{cost.costName}</span>
                        <span>
                          {formatCostDetailed(cost.totalCostInUsdCents)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {selectedEmail.generationRun.status === "failed" && selectedEmail.generationRun.errorSummary && (
                  <div className="mt-3 bg-red-50 border border-red-100 rounded-md p-3">
                    <p className="text-sm text-red-700">{selectedEmail.generationRun.errorSummary.rootCause}</p>
                    <p className="text-xs text-red-500 mt-1">
                      Step: <span className="font-mono">{selectedEmail.generationRun.errorSummary.failedStep}</span>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Metadata */}
            <div className="mt-4 text-xs text-gray-400">
              Generated {timeAgo(selectedEmail.createdAt)}
              <span className="ml-1">({new Date(selectedEmail.createdAt).toLocaleString()})</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
