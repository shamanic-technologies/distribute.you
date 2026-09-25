"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { listCampaignWorkflowRunGroups } from "@/lib/api";
import { pollOptionsSlow } from "@/lib/query-options";
import {
  RAN_WORKFLOWS_WINDOW_DAYS,
  summarizeRanWorkflows,
  workflowShortName,
  type RanWorkflowsSummary,
} from "@/lib/campaign-ran-workflows";

/**
 * What the campaign ACTUALLY RAN over the last week, off its trigger runs. Never the
 * creation-time workflow on the campaign row: campaign-service picks one per run. One
 * cheap aggregate, so the campaign page, its sidebar and a list card share one key.
 */
export function useRanWorkflows(campaignId: string | null | undefined) {
  return useAuthQuery(
    ["campaignRanWorkflows", campaignId ?? "none", RAN_WORKFLOWS_WINDOW_DAYS],
    async (): Promise<RanWorkflowsSummary> =>
      summarizeRanWorkflows(
        await listCampaignWorkflowRunGroups(campaignId as string, RAN_WORKFLOWS_WINDOW_DAYS),
      ),
    { enabled: Boolean(campaignId), ...pollOptionsSlow },
  );
}

function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Campaign page card: every workflow in the recent window, newest first. */
export function RanWorkflowsCard({
  campaignId,
  featureSlug,
}: {
  campaignId: string;
  featureSlug: string;
}) {
  const { data, isPending, isError } = useRanWorkflows(campaignId);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4" data-testid="ran-workflows">
      <h3 className="font-medium text-gray-800">Workflows it ran</h3>
      <p className="text-xs text-gray-500 mb-3">
        Read from the campaign&apos;s own runs. A workflow is picked for every run, so this is
        not the workflow the campaign was created with.
      </p>
      {isPending && !isError ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-4 w-48 bg-gray-100 rounded" />
          <div className="h-4 w-40 bg-gray-100 rounded" />
        </div>
      ) : isError || !data ? (
        <p className="text-sm text-red-600">Could not read this campaign&apos;s runs.</p>
      ) : data.workflows.length === 0 ? (
        <p className="text-sm text-gray-500">No run in the last {RAN_WORKFLOWS_WINDOW_DAYS} days.</p>
      ) : (
        <>
          <ul className="divide-y divide-gray-100">
            {data.workflows.map((w) => (
              <li
                key={w.workflowSlug}
                className="flex items-center justify-between gap-3 py-1.5 text-sm"
                title={w.workflowSlug}
              >
                <span className="text-gray-800 truncate">
                  {workflowShortName(w.workflowSlug, featureSlug)}
                </span>
                <span className="text-xs text-gray-500 shrink-0">
                  {w.runs.toLocaleString("en-US")} run{w.runs === 1 ? "" : "s"}, last{" "}
                  {ago(w.lastStartedAt)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-gray-400">
            Last {RAN_WORKFLOWS_WINDOW_DAYS} days, {data.totalRuns.toLocaleString("en-US")} runs.
          </p>
        </>
      )}
    </div>
  );
}

/** One line for a campaign card on a list: the recent workflows, newest first. */
export function RanWorkflowsInline({
  campaignId,
  featureSlug,
}: {
  campaignId: string;
  featureSlug?: string | null;
}) {
  const { data, isPending, isError } = useRanWorkflows(campaignId);
  if (isPending && !isError) return <span className="inline-block h-3 w-24 bg-gray-100 rounded animate-pulse" />;
  if (isError || !data) return <span>Runs unavailable</span>;
  if (data.workflows.length === 0) return <span>No run in {RAN_WORKFLOWS_WINDOW_DAYS} days</span>;
  const names = data.workflows.map((w) => workflowShortName(w.workflowSlug, featureSlug));
  const shown = names.slice(0, 3).join(", ");
  const more = names.length > 3 ? ` +${names.length - 3}` : "";
  return (
    <span title={data.workflows.map((w) => w.workflowSlug).join("\n")}>
      Ran {shown}
      {more}
    </span>
  );
}
