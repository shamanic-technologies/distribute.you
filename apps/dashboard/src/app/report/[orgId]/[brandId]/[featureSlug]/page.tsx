import { Suspense } from "react";
import { SectionCard } from "@/components/report/section-card";
import {
  fetchFeatureStats,
  fetchWorkflows,
} from "@/lib/report-api";

// ISR with a 4h TTL — the recipient gets HTML served from edge cache on
// every visit; fills happen at most once per (orgId, brandId, featureSlug)
// per 4h window. Stale-while-revalidate hides cache refreshes from users.
// `maxDuration` is still needed for the rare cold-fill render that pays
// the upstream cost.
export const revalidate = 14400;
export const maxDuration = 300;

interface PageProps {
  params: Promise<{ orgId: string; brandId: string; featureSlug: string }>;
}

export default async function OverviewPage({ params }: PageProps) {
  const { orgId, brandId, featureSlug } = await params;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl">
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
          <li><strong>Emails</strong> — every email generated, including subject and body.</li>
          <li><strong>Workflows</strong> — pipelines used to generate emails, with prompts and per-workflow CAC.</li>
        </ul>
      </SectionCard>
    </div>
  );
}

// Pick a stat by trying multiple candidate keys. Backend stat naming varies
// across feature versions; this avoids hard-coding one and shows 0 only when
// none of the candidates exist.
function pickStat(stats: Record<string, number>, ...keys: string[]): number {
  for (const key of keys) {
    const v = stats[key];
    if (typeof v === "number") return v;
  }
  return 0;
}

async function StatsGrid({ orgId, brandId, featureSlug }: { orgId: string; brandId: string; featureSlug: string }) {
  // Stats endpoint provides all the counts we need — no transactional list
  // fetches on Overview. fetchCampaigns + fetchWorkflows are small and fast.
  const [featureStats, workflows] = await Promise.all([
    fetchFeatureStats(orgId, brandId, featureSlug),
    fetchWorkflows(orgId, featureSlug),
  ]);

  const stats = featureStats?.stats ?? {};

  const cards = [
    { label: "Leads", value: pickStat(stats, "leadsServed", "leads", "leadsCount", "leadsTotal", "leadsBuffered"), note: "Targeted prospects" },
    { label: "Emails sent", value: pickStat(stats, "emailsSent", "leadsSent", "emails", "emailsGenerated"), note: "Total emails generated" },
    { label: "Workflows", value: workflows.length, note: "Email generation pipelines" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {cards.map((s) => (
        <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{s.label}</div>
          <div className="text-2xl font-bold text-gray-800 mt-1">
            {s.value.toLocaleString("en-US")}
          </div>
          <div className="text-xs text-gray-500 mt-1">{s.note}</div>
        </div>
      ))}
    </div>
  );
}

async function CpaFunnel({ orgId, brandId, featureSlug }: { orgId: string; brandId: string; featureSlug: string }) {
  // featureStats.systemStats.totalCostInUsdCents is the same number the
  // separate /v1/runs/stats/costs call returned, embedded in the stats
  // response. No need for a second slow upstream call.
  const featureStats = await fetchFeatureStats(orgId, brandId, featureSlug);
  const stats = featureStats?.stats ?? {};
  const totalCostCents = Number(featureStats?.systemStats?.totalCostInUsdCents ?? 0);

  const cpaStages = [
    { label: "Sent", count: pickStat(stats, "leadsSent", "emailsSent", "sent") },
    { label: "Delivered", count: pickStat(stats, "leadsDelivered", "delivered") },
    { label: "Opened", count: pickStat(stats, "leadsOpened", "opened") },
    { label: "Clicked", count: pickStat(stats, "leadsClicked", "clicked") },
    { label: "Positive reply", count: pickStat(stats, "leadsRepliesPositive", "repliesPositive", "leadsRepliedPositive", "positiveReplies") },
  ];

  return (
    <SectionCard
      title="Cost per acquisition"
      description="Effective cost to reach each milestone, computed from total spend divided by count at that stage."
    >
      <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        {cpaStages.map((s) => (
          <CpaCard key={s.label} label={s.label} count={s.count} totalCostCents={totalCostCents} />
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
