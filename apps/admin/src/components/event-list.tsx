"use client";

import { useState } from "react";
import Link from "next/link";

export interface RunEvent {
  id: string;
  run_id: string;
  service: string;
  event: string;
  detail: string | null;
  level: "info" | "warn" | "error";
  data: Record<string, unknown> | null;
  org_id: string | null;
  user_id: string | null;
  brand_ids: string[] | null;
  campaign_id: string | null;
  workflow_slug: string | null;
  feature_slug: string | null;
  created_at: string;
}

const LEVEL_BADGE: Record<string, string> = {
  info: "bg-blue-100 text-blue-800",
  warn: "bg-amber-100 text-amber-800",
  error: "bg-red-100 text-red-800",
};

const LEVEL_DOT: Record<string, string> = {
  info: "bg-blue-500",
  warn: "bg-amber-500",
  error: "bg-red-500",
};

const LEVEL_ROW: Record<string, string> = {
  info: "border-gray-200 bg-white",
  warn: "border-amber-200 bg-amber-50/30",
  error: "border-red-200 bg-red-50/30",
};

interface EventListProps {
  events: RunEvent[];
  showService?: boolean;
  showRunLink?: boolean;
  serviceName?: string;
}

export function EventList({
  events,
  showService = false,
  showRunLink = false,
  serviceName,
}: EventListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (events.length === 0) {
    return (
      <p className="text-gray-400 text-center py-8" data-testid="event-list-empty">
        No events found
      </p>
    );
  }

  return (
    <div className="space-y-1" data-testid="event-list">
      {events.map((evt) => {
        const expanded = expandedIds.has(evt.id);
        const identityFields = [
          evt.org_id ? { label: "org_id", value: evt.org_id } : null,
          evt.user_id ? { label: "user_id", value: evt.user_id } : null,
          evt.brand_ids?.length
            ? { label: "brand_ids", value: evt.brand_ids.join(", ") }
            : null,
          evt.campaign_id
            ? { label: "campaign_id", value: evt.campaign_id }
            : null,
          evt.workflow_slug
            ? { label: "workflow_slug", value: evt.workflow_slug }
            : null,
          evt.feature_slug
            ? { label: "feature_slug", value: evt.feature_slug }
            : null,
        ].filter((f): f is { label: string; value: string } => f !== null);

        return (
          <div
            key={evt.id}
            className={`border rounded-lg transition-colors ${LEVEL_ROW[evt.level] || LEVEL_ROW.info}`}
            data-testid="event-row"
          >
            <button
              onClick={() => toggleExpand(evt.id)}
              className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50/50 transition-colors"
              data-testid="event-toggle"
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${LEVEL_DOT[evt.level] || "bg-gray-400"}`}
              />

              <span className="text-xs text-gray-400 font-mono shrink-0 w-44">
                {new Date(evt.created_at).toLocaleString()}
              </span>

              <span
                className={`text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${LEVEL_BADGE[evt.level] || "bg-gray-100 text-gray-800"}`}
                data-testid="event-level"
              >
                {evt.level}
              </span>

              {showService && (
                <span className="text-xs font-mono text-gray-500 shrink-0">
                  {evt.service}
                </span>
              )}

              <span className="text-sm font-medium text-gray-900 truncate">
                {evt.event}
              </span>

              <span className="ml-auto flex items-center gap-2 shrink-0">
                {showRunLink && serviceName && (
                  <Link
                    href={`/${serviceName}/runs/${evt.run_id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-blue-600 hover:underline"
                    data-testid="event-run-link"
                  >
                    Run
                  </Link>
                )}
                <span
                  className={`text-gray-400 transition-transform text-xs ${expanded ? "rotate-90" : ""}`}
                >
                  &#9656;
                </span>
              </span>
            </button>

            {expanded && (
              <div
                className="px-4 pb-3 space-y-2 border-t border-gray-100"
                data-testid="event-detail"
              >
                {evt.detail && (
                  <div>
                    <span className="text-xs font-medium text-gray-400 uppercase">
                      Detail
                    </span>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap mt-0.5">
                      {evt.detail}
                    </p>
                  </div>
                )}

                {identityFields.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {identityFields.map((f) => (
                      <span
                        key={f.label}
                        className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono"
                        data-testid="event-identity-field"
                      >
                        {f.label}: {f.value}
                      </span>
                    ))}
                  </div>
                )}

                {evt.data && Object.keys(evt.data).length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-gray-400 uppercase">
                      Data
                    </span>
                    <pre className="text-xs bg-gray-50 rounded p-2 overflow-x-auto mt-0.5 text-gray-700">
                      {JSON.stringify(evt.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
