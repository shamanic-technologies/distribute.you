import { Suspense } from "react";
import { SectionCard } from "@/components/report/section-card";
import {
  fetchLeads,
  fetchEmails,
  fetchCampaigns,
  fetchWorkflows,
  fetchTotalCostCents,
  deriveCompaniesFromLeads,
  deriveIndividualsFromLeads,
} from "@/lib/report-api";

export const revalidate = 30;

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
          <li><strong>Leads</strong> — every prospect (company × person) with email and current status.</li>
          <li><strong>Companies</strong> — unique organizations targeted, with enrichment data.</li>
          <li><strong>Individuals</strong> — every person enriched, with role and contact details.</li>
          <li><strong>Emails</strong> — every email generated, including subject and body.</li>
          <li><strong>Workflows</strong> — pipelines used to generate emails, including prompts.</li>
          <li><strong>Campaigns</strong> — programs run with budget, status and associated workflow.</li>
        </ul>
      </SectionCard>
    </div>
  );
}

async function StatsGrid({ orgId, brandId, featureSlug }: { orgId: string; brandId: string; featureSlug: string }) {
  const [leads, emails, campaigns, workflows] = await Promise.all([
    fetchLeads(orgId, brandId, featureSlug),
    fetchEmails(orgId, brandId),
    fetchCampaigns(orgId, brandId, featureSlug),
    fetchWorkflows(orgId, featureSlug),
  ]);

  const companies = deriveCompaniesFromLeads(leads);
  const individuals = deriveIndividualsFromLeads(leads);

  const stats = [
    { label: "Leads", value: leads.length, note: "Targeted prospects across campaigns" },
    { label: "Companies", value: companies.length, note: "Unique organizations targeted" },
    { label: "Individuals", value: individuals.length, note: "People reached or queued" },
    { label: "Emails sent", value: emails.length, note: "Total emails generated" },
    { label: "Workflows", value: workflows.length, note: "Email generation pipelines" },
    { label: "Campaigns", value: campaigns.length, note: "Outreach programs" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {stats.map((s) => (
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
  const [leads, totalCostCents] = await Promise.all([
    fetchLeads(orgId, brandId, featureSlug),
    fetchTotalCostCents(orgId, brandId, featureSlug),
  ]);

  const cpaStages = [
    { label: "Sent", count: leads.filter((l) => l.sent).length },
    { label: "Delivered", count: leads.filter((l) => l.delivered).length },
    { label: "Opened", count: leads.filter((l) => l.opened).length },
    { label: "Clicked", count: leads.filter((l) => l.clicked).length },
    { label: "Positive reply", count: leads.filter((l) => l.replied && l.replyClassification === "positive").length },
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
      <div className="text-[10px] text-gray-400 mt-0.5">
        {count.toLocaleString("en-US")} {count === 1 ? "lead" : "leads"}
      </div>
    </div>
  );
}

function StatsGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
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
