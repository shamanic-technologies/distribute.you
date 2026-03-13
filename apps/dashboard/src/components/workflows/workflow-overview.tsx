"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { DAG, WorkflowSummary } from "@/lib/api";

const MermaidDiagram = dynamic(
  () => import("./mermaid-diagram").then((m) => ({ default: m.MermaidDiagram })),
  { ssr: false }
);

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
  dag: DAG;
  providers: string[];
  mermaidChart: string;
  description: string | null;
}

export function WorkflowOverview({ summary, dag, providers, mermaidChart, description }: WorkflowOverviewProps) {
  const [showDiagram, setShowDiagram] = useState(false);

  return (
    <div className="space-y-4">
      {/* Summary + Providers card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        {/* Description */}
        {(summary?.summary || description) && (
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
            {summary?.summary || description}
          </div>
        )}

        {/* Providers */}
        {providers && providers.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Uses</span>
            {providers.map((p) => (
              <span key={p} className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-700">
                <ProviderLogo provider={p} size={18} />
                {capitalize(p)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Collapsible diagram */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setShowDiagram(!showDiagram)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h4v4H4zM10 14h4v4h-4zM16 6h4v4h-4zM6 10v4l4 0M18 10v4l-4 0" />
            </svg>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Flow Diagram</span>
            <span className="text-xs text-gray-400">{(dag.nodes ?? []).length} steps</span>
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${showDiagram ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showDiagram && (
          <div className="px-4 pb-4 border-t border-gray-100">
            <MermaidDiagram chart={mermaidChart} className="mt-3" />
          </div>
        )}
      </div>
    </div>
  );
}
