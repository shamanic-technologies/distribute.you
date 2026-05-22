import { SectionCard } from "@/components/report/section-card";
import { fetchBrand, fetchLeads, fetchEmails, fetchCampaigns, fetchWorkflows, deriveCompaniesFromLeads, deriveIndividualsFromLeads } from "@/lib/report-api";

interface PageProps {
  params: Promise<{ orgId: string; brandId: string; featureSlug: string }>;
}

export default async function OverviewPage({ params }: PageProps) {
  const { orgId, brandId, featureSlug } = await params;

  const [brand, leads, emails, campaigns, workflows] = await Promise.all([
    fetchBrand(orgId, brandId),
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

  const contacted = leads.filter((l) => l.contacted).length;
  const delivered = leads.filter((l) => l.delivered).length;
  const opened = leads.filter((l) => l.opened).length;
  const replied = leads.filter((l) => l.replied).length;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl">
      <div>
        <h2 className="font-display text-xl font-bold text-gray-800 mb-1">Overview</h2>
        <p className="text-sm text-gray-500">
          Snapshot of all Sales Cold Email Outreach activity{brand?.name ? ` for ${brand.name}` : ""}.
        </p>
      </div>

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

      <SectionCard title="Funnel" description="Lead progression across the outreach pipeline.">
        <div className="px-5 py-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <FunnelStep label="Leads" value={leads.length} />
            <FunnelStep label="Contacted" value={contacted} />
            <FunnelStep label="Delivered" value={delivered} />
            <FunnelStep label="Opened" value={opened} />
            <FunnelStep label="Replied" value={replied} />
          </div>
        </div>
      </SectionCard>

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

function FunnelStep({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-xl font-bold text-gray-800 mt-0.5">{value.toLocaleString("en-US")}</div>
    </div>
  );
}
