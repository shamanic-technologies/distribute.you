"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { useIsBetaUser } from "@/lib/use-beta-user";
import {
  getFeatureOutcomes,
  fetchFeatureStats,
  listBrandLeads,
  listBrandEmails,
  getLeadConsolidatedStatus,
  type Lead,
  type Email,
  type LeadConsolidatedStatus,
} from "@/lib/api";
import type { ConversionLead } from "@/lib/revenue-view";
import { useMonotonicStatuses } from "@/lib/use-monotonic-status";
import { LEAD_STATUS_PRIORITY } from "@/lib/lead-status-display";
import { OUTCOME_LENSES, type OutcomeLens } from "@/lib/outcome-lens";
import { OutcomeLeadsTable } from "@/components/revenue/outcome-leads-table";
import { OutcomeLeadPanel } from "@/components/revenue/outcome-lead-panel";
import {
  TopCampaignsByCpcCard,
  TopCampaignsByCostPerSignupCard,
} from "@/components/revenue/top-campaigns-by-cost";
import { MaturityBadge } from "@/components/maturity-badge";
import { Skeleton } from "@/components/skeleton";

const nameKey = (first: string | null, last: string | null) =>
  `${(first ?? "").trim().toLowerCase()}|${(last ?? "").trim().toLowerCase()}`;

function formatUsd(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n > 0 && Math.round(n) === 0) return "<$1";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
function formatCount(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  // Expected count is a Σ of probabilities — often < 1 (e.g. 0.44 expected
  // signups). Rounding to an integer would show a misleading "0"; keep one
  // decimal under 10 (mirrors the sub-10% probability format), integer above.
  if (n > 0 && n < 10) return n.toFixed(1);
  return Math.round(n).toLocaleString("en-US");
}
// Render a server-computed cents amount as $X.X. features-service owns the
// division (e.g. costPerRecipientClickCents = total spend ÷ link clicks); the
// dashboard only formats. Absent (no denominator) → "—".
function formatUsdFromCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
}

/**
 * Shared body for the three outcome lenses (Signups / Booked Meetings / Sales).
 * Beta-gated (Kevin + Adam) — a non-beta user gets the "not available" card, the
 * same hard-hide the sidebar applies. features-service computes the per-lead
 * probability + expected revenue; this only renders.
 */
export function OutcomePage({ lens }: { lens: OutcomeLens }) {
  const params = useParams();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  const featureSlug = useSoleFeatureSlug();
  const meta = OUTCOME_LENSES[lens];
  // Clicks → signups is the signups funnel, so the click stat cards + the
  // cost-efficiency leaderboards only render on the signups lens.
  const isSignups = lens === "signups";
  const basePath = `/orgs/${orgId}/brands/${brandId}/features/${featureSlug}`;

  const isBeta = useIsBetaUser();
  const revenueOk = isRevenueFeature(featureSlug);
  const enabled = isBeta && revenueOk;

  const { data, isPending } = useAuthQuery(
    ["featureOutcomes", brandId, featureSlug, lens],
    () => getFeatureOutcomes(featureSlug, brandId, lens),
    { enabled },
  );

  // Brand-level outreach stats — real Clicks + CPC for the signups header cards.
  const { data: statsData, isPending: statsPending } = useAuthQuery(
    ["featureStats", featureSlug, brandId],
    () => fetchFeatureStats(featureSlug, { brandId }),
    { enabled: enabled && isSignups },
  );

  // Detail-panel data — joined from existing endpoints (display affordance, no
  // backend change): full Lead (status booleans + timestamps) by leadId, and the
  // emails sent to the lead matched by name. Both gated on `enabled`.
  const { data: leadsData } = useAuthQuery(
    ["brandLeads", brandId],
    () => listBrandLeads(brandId),
    { enabled },
  );
  const { data: emailsData } = useAuthQuery(
    ["brandEmails", brandId],
    () => listBrandEmails(brandId),
    { enabled },
  );

  // Key on the CANONICAL lead id (`leadId`), NOT the leads_campaigns membership
  // row `id` — features-service revenue keys its leads on `leadId`, so the join
  // (status column + panel) only matches on `leadId`. A lead can appear under
  // several campaign memberships brand-wide; keep the most-advanced status row.
  const leadById = useMemo(() => {
    const rank = (l: Lead) => LEAD_STATUS_PRIORITY.indexOf(getLeadConsolidatedStatus(l));
    const m = new Map<string, Lead>();
    for (const l of leadsData?.leads ?? []) {
      if (!l.leadId) continue;
      const prev = m.get(l.leadId);
      // Lower index = more advanced; an unranked status sorts last (Infinity).
      const idx = (r: number) => (r === -1 ? Number.POSITIVE_INFINITY : r);
      if (!prev || idx(rank(l)) < idx(rank(prev))) m.set(l.leadId, l);
    }
    return m;
  }, [leadsData]);
  const emailsByName = useMemo(() => {
    const m = new Map<string, Email[]>();
    for (const e of emailsData?.emails ?? []) {
      const k = nameKey(e.leadFirstName, e.leadLastName);
      (m.get(k) ?? m.set(k, []).get(k)!).push(e);
    }
    return m;
  }, [emailsData]);

  // Status column — derive each lensed lead's consolidated status from the full
  // Lead (joined by leadId), latched monotonic so a transient delivery-overlay
  // drop never flaps the badge back to "Processing".
  const statusEntries = useMemo(() => {
    const out: { id: string; status: LeadConsolidatedStatus }[] = [];
    for (const l of data?.leads ?? []) {
      const fl = leadById.get(l.leadId);
      if (fl) out.push({ id: l.leadId, status: getLeadConsolidatedStatus(fl) });
    }
    return out;
  }, [data, leadById]);
  const statusByLeadId = useMonotonicStatuses(
    statusEntries,
    LEAD_STATUS_PRIORITY,
    "outcome-leads",
  ) as Map<string, LeadConsolidatedStatus>;

  const [selected, setSelected] = useState<ConversionLead | null>(null);

  if (!isBeta || !revenueOk) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          This view isn&apos;t available yet.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Static shell — header renders on first paint, never skeletoned. */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-gray-900">{meta.label}</h1>
          <MaturityBadge level="beta" />
        </div>
        <p className="text-sm text-gray-500 mt-1">{meta.subtitle}</p>
      </div>

      {/* Top stats — static shell (labels) always paint; only the value region
          skeletons. All numbers computed server-side (features-service), the
          dashboard only formats. Signups leads with the real click funnel input
          (Clicks · Cost per click) then the signup econ; other lenses show the
          three outcome cards (count · cost per outcome · expected revenue). */}
      <div className={isSignups ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4" : "grid grid-cols-1 sm:grid-cols-3 gap-4"}>
        {[
          ...(isSignups
            ? [
                {
                  label: "Clicks",
                  value: formatCount(statsData?.stats.recipientsClicked ?? null),
                  pending: statsPending || !statsData,
                },
                {
                  label: "Cost per click",
                  value: formatUsdFromCents(statsData?.stats.costPerRecipientClickCents),
                  pending: statsPending || !statsData,
                },
              ]
            : []),
          { label: meta.countLabel, value: formatCount(data?.costEconomics.expectedConversions), pending: isPending || !data },
          { label: meta.costPerLabel, value: formatUsd(data?.costEconomics.costPerConversionUsd), pending: isPending || !data },
          { label: meta.revenueLabel, value: formatUsd(data?.totalPipelineUsd), pending: isPending || !data },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
            <p className="text-xs text-gray-400">{stat.label}</p>
            {stat.pending ? (
              <Skeleton className="mt-1 h-8 w-24 rounded" />
            ) : (
              <p className="mt-1 text-2xl font-bold text-gray-900">{stat.value}</p>
            )}
          </div>
        ))}
      </div>

      {/* Signups: leads table on the left half, cost-efficiency leaderboards on
          the right. Other lenses keep the full-width table. */}
      {isSignups ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* min-w-0 lets the table column shrink below its content width so the
              table scrolls inside its card instead of overflowing the page. */}
          <div className="min-w-0">
          {isPending || !data ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : (
            <OutcomeLeadsTable
              leads={data.leads}
              probabilityLabel={meta.probabilityLabel}
              empty={meta.empty}
              statusByLeadId={statusByLeadId}
              onSelect={setSelected}
              selectedLeadId={selected?.leadId}
            />
          )}
          </div>
          <div className="space-y-4">
            <TopCampaignsByCpcCard brandId={brandId} featureSlug={featureSlug} basePath={basePath} />
            <TopCampaignsByCostPerSignupCard brandId={brandId} featureSlug={featureSlug} basePath={basePath} />
          </div>
        </div>
      ) : isPending || !data ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <OutcomeLeadsTable
          leads={data.leads}
          probabilityLabel={meta.probabilityLabel}
          empty={meta.empty}
          statusByLeadId={statusByLeadId}
          onSelect={setSelected}
          selectedLeadId={selected?.leadId}
        />
      )}

      {selected && (
        <OutcomeLeadPanel
          lead={selected}
          fullLead={leadById.get(selected.leadId) ?? null}
          emails={emailsByName.get(nameKey(selected.firstName, selected.lastName)) ?? []}
          probabilityLabel={meta.probabilityLabel}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
