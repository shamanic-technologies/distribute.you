"use client";

import { useState } from "react";
import { type Email } from "@/lib/api";
import { useCampaign } from "@/lib/campaign-context";

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

export default function CampaignEmailsPage() {
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const { emails, loading: isLoading } = useCampaign();

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-32 bg-gray-200 rounded" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl" />
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
            <span className="ml-2 text-sm font-normal text-gray-500">({emails.length})</span>
          </h1>
        </div>

        {emails.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="text-4xl mb-4">📧</div>
            <h3 className="font-display font-bold text-lg text-gray-800 mb-2">No emails yet</h3>
            <p className="text-gray-600 text-sm">Emails will appear here once generated.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {emails.map((email) => {
              const cost = formatCostRounded(email.generationRun);
              return (
                <button
                  key={email.id}
                  onClick={() => setSelectedEmail(email)}
                  className={`w-full text-left bg-white rounded-xl border p-4 hover:border-primary-300 hover:shadow-sm transition ${
                    selectedEmail?.id === email.id ? 'border-primary-500 ring-1 ring-primary-500' : 'border-gray-200'
                  }`}
                >
                  <p className="font-medium text-gray-800 truncate">{email.subject}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm text-gray-500 truncate">
                      To: {email.leadFirstName} {email.leadLastName} • {email.leadCompany}
                    </p>
                    {cost && (
                      <span className="text-xs text-gray-400 ml-2 shrink-0">{cost}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Email Detail Panel - Full screen on mobile, side panel on desktop */}
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
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">To:</span>
                  <p className="font-medium">{selectedEmail.leadFirstName} {selectedEmail.leadLastName}</p>
                </div>
                <div>
                  <span className="text-gray-500">Title:</span>
                  <p className="font-medium">{selectedEmail.leadTitle || '-'}</p>
                </div>
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
                {selectedEmail.bodyHtml ? (
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: selectedEmail.bodyHtml }}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                    {selectedEmail.bodyText}
                  </pre>
                )}
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
                    <span>• {formatDuration(selectedEmail.generationRun.startedAt, selectedEmail.generationRun.completedAt)}</span>
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
                          {Number(cost.quantity).toLocaleString()} × {formatCostDetailed(cost.unitCostInUsdCents)}
                          {" = "}
                          {formatCostDetailed(cost.totalCostInUsdCents)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Metadata */}
            <div className="mt-4 text-xs text-gray-400">
              Generated: {new Date(selectedEmail.createdAt).toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
