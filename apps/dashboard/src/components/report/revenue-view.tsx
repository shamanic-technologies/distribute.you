import { RevenueChart } from "@/components/revenue/revenue-chart";
import {
  OrgConversionsTable,
  LeadConversionsTable,
  EventConversionsTable,
} from "@/components/revenue/conversions-table";
import type { RevenueOverview } from "@/lib/revenue-view";

// Public-report revenue view. Free of the Clerk-authed api client — the data is
// fetched server-side via `getReportRevenue` (admin key) and passed in. Tables SSR
// their HTML so scrapers/readers see the data; the chart hydrates client-side.

function formatUsd(n: number | null): string {
  if (n === null) return "—";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function ReportRevenueView({ data }: { data: RevenueOverview }) {
  return (
    <div className="space-y-6">
      {/* Headline + revenue over time */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="font-medium text-gray-800">Expected pipeline revenue</h3>
          <p className="text-2xl font-bold text-gray-900">{formatUsd(data.totalPipelineUsd)}</p>
        </div>
        <RevenueChart series={data.timeSeries} />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700">Organizations</h3>
        <OrgConversionsTable orgs={data.organizations} />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700">Leads</h3>
        <LeadConversionsTable leads={data.leads} />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700">Events</h3>
        <EventConversionsTable events={data.events} />
      </div>
    </div>
  );
}
