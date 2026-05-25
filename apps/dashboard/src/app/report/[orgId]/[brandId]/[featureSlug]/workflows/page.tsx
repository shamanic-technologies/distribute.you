import { Suspense } from "react";
import { SectionCard } from "@/components/report/section-card";
import { CsvDownloadButton } from "@/components/report/csv-button";
import { toCsv, type CsvColumn } from "@/components/report/csv";
import { TableSectionSkeleton } from "@/components/report/skeletons";
import { WorkflowsTable, type WorkflowRow } from "@/components/report/workflows-table";
import {
  fetchWorkflows,
  fetchCampaigns,
  fetchFeatureStats,
  fetchFeatureStatsByWorkflow,
  fetchStatsRegistry,
} from "@/lib/report-api";
import type { StatsRegistry } from "@/lib/api";

export const revalidate = 14400;
export const maxDuration = 300;

interface PageProps {
  params: Promise<{ orgId: string; brandId: string; featureSlug: string }>;
}

/** Resolve a stats key's label from the registry; fall back to the key
 *  itself and log loud so a missing registry entry surfaces immediately
 *  (same pattern as `leads-stats-panel.tsx` operator-side). */
function registryLabel(registry: StatsRegistry, key: string): string {
  const entry = registry[key];
  if (!entry) {
    console.error(
      `[dashboard-report] workflows/page: stats key "${key}" missing from features-service registry; rendering raw key.`,
    );
    return key;
  }
  return entry.label;
}

function formatUsd(cents: number): string {
  const usd = cents / 100;
  if (usd === 0) return "$0";
  if (usd < 0.01) return "<$0.01";
  if (usd < 100) return `$${usd.toFixed(2)}`;
  return `$${usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export default async function WorkflowsPage({ params }: PageProps) {
  const { orgId, brandId, featureSlug } = await params;
  // Skeleton uses the keys that will populate the table so the fallback
  // column count matches the final render; labels are placeholders.
  const skeletonColumns = ["Workflow", "Version", "Leads Sent", "Leads Positive", "CAC / positive reply"];
  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <Suspense
        fallback={
          <TableSectionSkeleton
            title="Workflows"
            description="Pipelines actually used for this brand, with cost-per-positive-reply for A/B comparison."
            columnLabels={skeletonColumns}
          />
        }
      >
        <WorkflowsSection orgId={orgId} brandId={brandId} featureSlug={featureSlug} />
      </Suspense>
    </div>
  );
}

async function WorkflowsSection({ orgId, brandId, featureSlug }: { orgId: string; brandId: string; featureSlug: string }) {
  const [allWorkflows, campaigns, totalStats, groupedStats, registry] = await Promise.all([
    fetchWorkflows(orgId, featureSlug),
    fetchCampaigns(orgId, brandId, featureSlug),
    fetchFeatureStats(orgId, brandId, featureSlug),
    fetchFeatureStatsByWorkflow(orgId, brandId, featureSlug),
    fetchStatsRegistry(orgId),
  ]);

  const leadsSentLabel = registryLabel(registry, "leadsSent");
  const leadsPositiveLabel = registryLabel(registry, "leadsRepliesPositive");

  // Filter to workflows actually used by this brand's campaigns.
  const brandWorkflowSlugs = new Set(campaigns.map((c) => c.workflowSlug).filter((s): s is string => !!s));
  const workflows = allWorkflows.filter((w) => brandWorkflowSlugs.has(w.workflowSlug));

  // Per-workflow stats index
  const statsBySlug = new Map(groupedStats.groups.map((g) => [g.workflowSlug ?? "", g]));

  const rows: WorkflowRow[] = workflows.map((w) => {
    const g = statsBySlug.get(w.workflowSlug);
    const stats = g?.stats ?? {};
    const cost = Number(g?.systemStats?.totalCostInUsdCents ?? 0);
    return {
      id: w.id,
      name: w.workflowDynastyName,
      version: w.version,
      status: w.status ?? "active",
      description: w.description ?? "",
      emailsSent: typeof stats.leadsSent === "number" ? stats.leadsSent : 0,
      positiveReplies: typeof stats.leadsRepliesPositive === "number" ? stats.leadsRepliesPositive : 0,
      totalCostCents: cost,
      createdAt: w.createdAt,
    };
  });

  // Default order for the public report: cheapest CAC first (the metric
  // that matters), tie-broken by highest send volume (signal strength),
  // then by newest workflow (recency). Zero-reply rows sink to the bottom
  // because their CAC is treated as +Infinity. User can still click a
  // column header to override with a single-column sort.
  rows.sort((a, b) => {
    const aCac = a.positiveReplies > 0 ? a.totalCostCents / a.positiveReplies : Number.POSITIVE_INFINITY;
    const bCac = b.positiveReplies > 0 ? b.totalCostCents / b.positiveReplies : Number.POSITIVE_INFINITY;
    if (aCac !== bCac) return aCac - bCac;
    if (a.emailsSent !== b.emailsSent) return b.emailsSent - a.emailsSent;
    return b.createdAt.localeCompare(a.createdAt);
  });

  // Brand-level totals for header card
  const brandStats = totalStats?.stats ?? {};
  const brandTotalCost = Number(totalStats?.systemStats?.totalCostInUsdCents ?? 0);
  const brandPositiveReplies = typeof brandStats.leadsRepliesPositive === "number" ? brandStats.leadsRepliesPositive : 0;
  const brandCacPerReply = brandPositiveReplies > 0 ? formatUsd(brandTotalCost / brandPositiveReplies) : "—";
  const brandEmailsSent = typeof brandStats.leadsSent === "number" ? brandStats.leadsSent : 0;

  interface FlatRow {
    workflow: string;
    version: number;
    emailsSent: number;
    positiveReplies: number;
    totalCostUsd: string;
    cacPerReply: string;
  }

  const csvRows: FlatRow[] = rows.map((r) => ({
    workflow: r.name,
    version: r.version,
    emailsSent: r.emailsSent,
    positiveReplies: r.positiveReplies,
    totalCostUsd: formatUsd(r.totalCostCents),
    cacPerReply: r.positiveReplies > 0 ? formatUsd(r.totalCostCents / r.positiveReplies) : "",
  }));

  const csvColumns: CsvColumn<FlatRow>[] = [
    { label: "Workflow", value: (r) => r.workflow },
    { label: "Version", value: (r) => r.version },
    { label: leadsSentLabel, value: (r) => r.emailsSent },
    { label: leadsPositiveLabel, value: (r) => r.positiveReplies },
    { label: "Total cost", value: (r) => r.totalCostUsd },
    { label: "CAC per positive reply", value: (r) => r.cacPerReply },
  ];

  return (
    <>
      <SectionCard
        title="Brand totals"
        description="All workflows combined for this brand. Use the per-workflow table below to compare performance."
      >
        <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryTile label="Workflows used" value={workflows.length.toLocaleString("en-US")} />
          <SummaryTile label={leadsSentLabel} value={brandEmailsSent.toLocaleString("en-US")} />
          <SummaryTile label={leadsPositiveLabel} value={brandPositiveReplies.toLocaleString("en-US")} />
          <SummaryTile label="CAC / positive reply" value={brandCacPerReply} highlight />
        </div>
      </SectionCard>

      <SectionCard
        title="Workflows"
        description="Pipelines actually used for this brand. Sort by CAC to identify the best performer."
        count={rows.length}
        actions={
          <CsvDownloadButton filename={`workflows-${featureSlug}.csv`} csv={toCsv(csvRows, csvColumns)} isEmpty={csvRows.length === 0} />
        }
      >
        <WorkflowsTable rows={rows} labels={{ leadsSent: leadsSentLabel, leadsRepliesPositive: leadsPositiveLabel }} />
      </SectionCard>
    </>
  );
}

function SummaryTile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-3 text-center ${highlight ? "bg-green-50 border border-green-200" : "bg-gray-50"}`}>
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-xl font-bold mt-0.5 ${highlight ? "text-green-700" : "text-gray-800"}`}>{value}</div>
    </div>
  );
}
