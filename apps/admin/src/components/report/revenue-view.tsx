import {
  OrgConversionsTable,
  LeadConversionsTable,
} from "@/components/revenue/conversions-table";
import type { RevenueOverview } from "@/lib/revenue-view";

// Public-report revenue view. Free of the Clerk-authed api client — the data is
// fetched server-side via `getReportRevenue` (admin key) and passed in. Tables SSR
// their HTML so scrapers/readers see the data.

export function ReportRevenueView({ data }: { data: RevenueOverview }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700">Organizations</h3>
        <OrgConversionsTable orgs={data.organizations} />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700">Leads</h3>
        <LeadConversionsTable leads={data.leads} />
      </div>
    </div>
  );
}
