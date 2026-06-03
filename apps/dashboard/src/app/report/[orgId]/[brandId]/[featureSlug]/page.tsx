import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SectionCard } from "@/components/report/section-card";
import {
  fetchFeatureStats,
  fetchWorkflows,
  fetchStatsRegistry,
} from "@/lib/report-api";
import type { StatsRegistry } from "@/lib/api";

// ISR with a 4h TTL — the recipient gets HTML served from edge cache on
// every visit; fills happen at most once per (orgId, brandId, featureSlug)
// per 4h window. Stale-while-revalidate hides cache refreshes from users.
// `maxDuration` is still needed for the rare cold-fill render that pays
// the upstream cost.
export const revalidate = 14400;
export const maxDuration = 300;

// Features whose public report has no "Overview" surface — their primary
// surface is an interactive HITL queue, not a stats funnel. The base route
// redirects straight to the first entity (quote-requests).
const REDIRECT_TO_FIRST_ENTITY = new Set(["pr-expert-quote-opportunities"]);

interface PageProps {
  params: Promise<{ orgId: string; brandId: string; featureSlug: string }>;
}

export default async function OverviewPage({ params }: PageProps) {
  const { orgId, brandId, featureSlug } = await params;

  if (REDIRECT_TO_FIRST_ENTITY.has(featureSlug)) {
    redirect(`/report/${orgId}/${brandId}/${featureSlug}/quote-requests`);
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-gray-800 mb-1">Overview</h2>
        <p className="text-sm text-gray-500">
          Snapshot of all Sales Cold Email Outreach activity for this brand.
        </p>
      </div>

      <Suspense fallback={<StatsGridSkeleton />}>
        <StatsGrid orgId={orgId} brandId={brandId} featureSlug={featureSlug} />
      </Suspense>

      <Suspense fallback={<CpaSkeleton />}>
        <CpaFunnel orgId={orgId} brandId={brandId} featureSlug={featureSlug} />
      </Suspense>

      <SectionCard
        title="What's in this report"
        description="Use the left sidebar to navigate each section. Every table includes CSV export."
      >
        <ul className="px-5 py-4 space-y-2 text-sm text-gray-700">
          <li><strong>Leads</strong> — every prospect targeted, with company, email and current status.</li>
          <li><strong>Workflows</strong> — pipelines used to generate emails, with prompts and per-workflow CAC.</li>
        </ul>
      </SectionCard>
    </div>
  );
}

/** Resolve a stats key's label from the registry; fall back to the key
 *  itself and log loud so a missing registry entry surfaces immediately
 *  (same pattern as `leads-stats-panel.tsx` operator-side). */
function registryLabel(registry: StatsRegistry, key: string): string {
  const entry = registry[key];
  if (!entry) {
    console.error(
      `[dashboard-report] overview: stats key "${key}" missing from features-service registry; rendering raw key.`,
    );
    return key;
  }
  return entry.label;
}

function statValue(stats: Record<string, number>, key: string): number {
  const v = stats[key];
  return typeof v === "number" ? v : 0;
}

async function StatsGrid({ orgId, brandId, featureSlug }: { orgId: string; brandId: string; featureSlug: string }) {
  const [featureStats, workflows, registry] = await Promise.all([
    fetchFeatureStats(orgId, brandId, featureSlug),
    fetchWorkflows(orgId, featureSlug),
    fetchStatsRegistry(orgId),
  ]);

  const stats = featureStats?.stats ?? {};

  // Each card pulls its label from the registry so the displayed copy can
  // never drift from what the underlying stat key actually counts. Notes
  // are authored copy (registry only exposes a label, no longer-form note).
  //
  // "Sent" sources from `leadsSent` (NOT `recipientsSent`) so the count
  // matches the CPA funnel + the Leads page "Sent" tab. Both `leadsSent`
  // and `recipientsSent` are spec'd as COUNT DISTINCT lead (per the
  // email-gateway + lead-service OpenAPI docs), but the two upstream
  // queries diverge in production (~5% drift on this brand). Until the
  // backend reconciles, the dashboard picks `leadsSent` as the single
  // surface-wide source of truth — funnel + tabs both already use it,
  // so the overview card matches by construction.
  const statCards: Array<{ statKey: string; note: string }> = [
    { statKey: "leadsServed", note: "Targeted prospects" },
    { statKey: "leadsSent", note: "Leads we sent at least one email to" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {statCards.map((c) => (
        <div key={c.statKey} className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{registryLabel(registry, c.statKey)}</div>
          <div className="text-2xl font-bold text-gray-800 mt-1">
            {statValue(stats, c.statKey).toLocaleString("en-US")}
          </div>
          <div className="text-xs text-gray-500 mt-1">{c.note}</div>
        </div>
      ))}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Workflows</div>
        <div className="text-2xl font-bold text-gray-800 mt-1">{workflows.length.toLocaleString("en-US")}</div>
        <div className="text-xs text-gray-500 mt-1">Email generation pipelines</div>
      </div>
    </div>
  );
}

async function CpaFunnel({ orgId, brandId, featureSlug }: { orgId: string; brandId: string; featureSlug: string }) {
  const [featureStats, registry] = await Promise.all([
    fetchFeatureStats(orgId, brandId, featureSlug),
    fetchStatsRegistry(orgId),
  ]);
  const stats = featureStats?.stats ?? {};
  const totalCostCents = Number(featureStats?.systemStats?.totalCostInUsdCents ?? 0);

  // Funnel stages all keyed on cumulative `leads*` stats (every lead that
  // ever reached this milestone). The Leads page tabs use the same boolean
  // semantics, so per-stage counts and per-tab counts match by construction.
  const stageKeys = ["leadsSent", "leadsDelivered", "leadsOpened", "leadsClicked", "leadsRepliesPositive"];

  return (
    <SectionCard
      title="Cost per acquisition"
      description="Effective cost to reach each milestone, computed from total spend divided by count at that stage."
    >
      <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        {stageKeys.map((key) => (
          <CpaCard
            key={key}
            label={registryLabel(registry, key)}
            count={statValue(stats, key)}
            totalCostCents={totalCostCents}
          />
        ))}
      </div>
    </SectionCard>
  );
}

function formatUsd(cents: number): string {
  const usd = cents / 100;
  if (usd === 0) return "$0";
  if (usd < 0.01) return "<$0.01";
  if (usd < 100) return `$${usd.toFixed(2)}`;
  return `$${usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function CpaCard({ label, count, totalCostCents }: { label: string; count: number; totalCostCents: number }) {
  const cpa = count > 0 ? totalCostCents / count : null;
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-xl font-bold text-gray-800 mt-0.5">
        {cpa != null ? formatUsd(cpa) : "—"}
      </div>
      <div className="text-[10px] text-gray-500 mt-0.5">
        {count.toLocaleString("en-US")} {count === 1 ? "lead" : "leads"}
      </div>
    </div>
  );
}

function StatsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
          <div className="h-7 w-12 bg-gray-100 rounded animate-pulse" />
          <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function CpaSkeleton() {
  return (
    <SectionCard
      title="Cost per acquisition"
      description="Effective cost to reach each milestone, computed from total spend divided by count at that stage."
    >
      <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="h-3 w-16 bg-gray-100 rounded animate-pulse mx-auto" />
            <div className="h-6 w-12 bg-gray-100 rounded animate-pulse mx-auto" />
            <div className="h-2 w-10 bg-gray-100 rounded animate-pulse mx-auto" />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
