"use client";

import { useState } from "react";
import type { DAG, DAGNode, WorkflowSummary } from "@/lib/api";
import { MermaidDiagram } from "./mermaid-diagram";

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
  const domain = getProviderDomain(provider);

  if (error) {
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

const NODE_TYPE_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  "http.call": { icon: "arrow-path", label: "API Call", color: "bg-blue-50 text-blue-700 border-blue-200" },
  condition: { icon: "question", label: "Condition", color: "bg-amber-50 text-amber-700 border-amber-200" },
  wait: { icon: "clock", label: "Wait", color: "bg-purple-50 text-purple-700 border-purple-200" },
  "for-each": { icon: "loop", label: "Loop", color: "bg-teal-50 text-teal-700 border-teal-200" },
};

function NodeTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "http.call":
      return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      );
    case "condition":
      return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "wait":
      return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "for-each":
      return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    default:
      return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );
  }
}

function getNodeDescription(node: DAGNode): { service?: string; method?: string; path?: string; detail?: string } {
  if (node.type === "http.call" && node.config) {
    return {
      service: node.config.service as string | undefined,
      method: (node.config.method as string)?.toUpperCase(),
      path: node.config.path as string | undefined,
    };
  }
  if (node.type === "wait" && node.config?.seconds) {
    return { detail: `${node.config.seconds}s delay` };
  }
  if (node.type === "for-each") {
    return { detail: "Iterate over items" };
  }
  if (node.type === "condition") {
    return { detail: "Branch logic" };
  }
  return {};
}

function StepTimeline({ dag, errorNodeId }: { dag: DAG; errorNodeId?: string }) {
  const mainNodes = dag.nodes.filter((n) => n.id !== errorNodeId);
  const errorNode = dag.nodes.find((n) => n.id === errorNodeId);

  return (
    <div className="space-y-0">
      {mainNodes.map((node, i) => {
        const typeConfig = NODE_TYPE_CONFIG[node.type] || { label: node.type, color: "bg-gray-50 text-gray-700 border-gray-200" };
        const desc = getNodeDescription(node);
        const isLast = i === mainNodes.length - 1;

        return (
          <div key={node.id} className="flex gap-3">
            {/* Timeline connector */}
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border ${typeConfig.color}`}>
                <NodeTypeIcon type={node.type} />
              </div>
              {!isLast && <div className="w-px h-full bg-gray-200 min-h-[16px]" />}
            </div>

            {/* Step content */}
            <div className={`pb-4 ${isLast ? "" : ""} flex-1 min-w-0`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-800">{node.id.replace(/-/g, " ").replace(/_/g, " ")}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide ${typeConfig.color}`}>
                  {typeConfig.label}
                </span>
              </div>
              {desc.service && (
                <div className="flex items-center gap-1.5 mt-1">
                  {desc.method && (
                    <span className="text-[10px] font-mono font-semibold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                      {desc.method}
                    </span>
                  )}
                  <span className="text-xs text-gray-500 font-mono truncate">
                    {desc.service}{desc.path}
                  </span>
                </div>
              )}
              {desc.detail && (
                <p className="text-xs text-gray-500 mt-1">{desc.detail}</p>
              )}
            </div>
          </div>
        );
      })}

      {errorNode && (
        <div className="flex gap-3 mt-1">
          <div className="flex flex-col items-center">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border border-dashed bg-red-50 text-red-600 border-red-300">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
          <div className="pb-2 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-red-700">{errorNode.id.replace(/-/g, " ").replace(/_/g, " ")}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide bg-red-50 text-red-600 border border-red-200">
                Error Handler
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
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
      {/* Summary */}
      {(description || summary?.summary) && (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-sm text-gray-700 leading-relaxed">
            {summary?.summary || description}
          </p>
        </div>
      )}

      {/* Two-column layout: Steps + Providers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Steps timeline */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pipeline</h3>
            <span className="text-xs text-gray-400">{dag.nodes.length} steps</span>
          </div>
          <StepTimeline dag={dag} errorNodeId={dag.onError} />
        </div>

        {/* Providers */}
        {providers.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Providers</h3>
            <div className="space-y-2">
              {providers.map((p) => (
                <div key={p} className="flex items-center gap-2.5 py-1">
                  <ProviderLogo provider={p} size={24} />
                  <span className="text-sm text-gray-700 font-medium">{capitalize(p)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Diagram toggle */}
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
