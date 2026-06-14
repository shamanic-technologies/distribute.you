"use client";

import { useState, useEffect } from "react";
import type { WorkflowSummary } from "@/lib/api";

const LOGO_DEV_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";

const PROVIDER_DOMAINS: Record<string, string> = {
  anthropic: "anthropic.com",
  openai: "openai.com",
  instantly: "instantly.ai",
  apollo: "apollo.io",
  perplexity: "perplexity.ai",
  google: "google.com",
  sendgrid: "sendgrid.com",
  postmark: "postmarkapp.com",
  mailgun: "mailgun.com",
  stripe: "stripe.com",
  twilio: "twilio.com",
  slack: "slack.com",
  hubspot: "hubspot.com",
  salesforce: "salesforce.com",
  linkedin: "linkedin.com",
  twitter: "x.com",
  reddit: "reddit.com",
  youtube: "youtube.com",
};

function getProviderDomain(provider: string): string {
  return PROVIDER_DOMAINS[provider.toLowerCase()] || `${provider.toLowerCase()}.com`;
}

function ProviderLogo({ provider, size = 20 }: { provider: string; size?: number }) {
  const [error, setError] = useState(false);
  const [mounted, setMounted] = useState(false);
  const domain = getProviderDomain(provider);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted || error) {
    return (
      <div
        className="rounded bg-gray-200 flex items-center justify-center flex-shrink-0"
        style={{ width: size, height: size }}
      >
        <span className="text-[10px] font-bold text-gray-500">{provider[0]?.toUpperCase()}</span>
      </div>
    );
  }

  return (
    <img
      src={`https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}`}
      alt={provider}
      width={size}
      height={size}
      className="rounded flex-shrink-0"
      onError={() => setError(true)}
    />
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface WorkflowOverviewProps {
  summary: WorkflowSummary | null;
  providers: string[];
  description: string | null;
}

export function WorkflowOverview({ summary, providers, description }: WorkflowOverviewProps) {
  return (
    <div className="bg-white dark:bg-white/[0.04] rounded-xl border border-gray-200 dark:border-white/[0.08] p-5 space-y-4">
      {description && (
        <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
          {description}
        </div>
      )}

      {summary?.steps && summary.steps.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
            {summary.steps.length} steps
          </span>
          <ol className="list-decimal list-inside space-y-1">
            {summary.steps.map((step, i) => (
              <li key={i} className="text-sm text-gray-600 dark:text-gray-400">{step.replace(/^\d+\.\s*/, "")}</li>
            ))}
          </ol>
        </div>
      )}

      {providers && providers.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Uses</span>
          {providers.map((p) => (
            <span key={p} className="inline-flex items-center gap-1.5 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg px-2.5 py-1.5 text-sm text-gray-700 dark:text-gray-300">
              <ProviderLogo provider={p} size={18} />
              {capitalize(p)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
