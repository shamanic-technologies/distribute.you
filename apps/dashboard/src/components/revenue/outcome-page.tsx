"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { getFeatureOutcomes, listBrandLeads, listBrandEmails, type Lead, type Email } from "@/lib/api";
import type { ConversionLead } from "@/lib/revenue-view";
import { OUTCOME_LENSES, type OutcomeLens } from "@/lib/outcome-lens";
import { OutcomeLeadsTable } from "@/components/revenue/outcome-leads-table";
import { OutcomeLeadPanel } from "@/components/revenue/outcome-lead-panel";
import { MaturityBadge } from "@/components/maturity-badge";
import { Skeleton } from "@/components/skeleton";

const nameKey = (first: string | null, last: string | null) =>
  `${(first ?? "").trim().toLowerCase()}|${(last ?? "").trim().toLowerCase()}`;

function formatUsd(n: number | null): string {
  if (n === null) return "—";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/**
 * Shared body for the three outcome lenses (Signups / Booked Meetings / Sales).
 * Beta-gated (Kevin + Adam) — a non-beta user gets the "not available" card, the
 * same hard-hide the sidebar applies. features-service computes the per-lead
 * probability + expected revenue; this only renders.
 */
export function OutcomePage({ lens }: { lens: OutcomeLens }) {
  const params = useParams();
  const brandId = params.brandId as string;
  const featureSlug = useSoleFeatureSlug();
  const meta = OUTCOME_LENSES[lens];

  const isBeta = useIsBetaUser();
  const revenueOk = isRevenueFeature(featureSlug);
  const enabled = isBeta && revenueOk;

  const { data, isPending } = useAuthQuery(
    ["featureOutcomes", brandId, featureSlug, lens],
    () => getFeatureOutcomes(featureSlug, brandId, lens),
    { enabled },
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

  const leadById = useMemo(() => {
    const m = new Map<string, Lead>();
    for (const l of leadsData?.leads ?? []) m.set(l.id, l);
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

      {/* Expected-revenue headline — value region only is skeletoned. */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
        <p className="text-xs text-gray-400">Total expected revenue</p>
        {isPending || !data ? (
          <Skeleton className="mt-1 h-8 w-32 rounded" />
        ) : (
          <p className="mt-1 text-2xl font-bold text-gray-900">{formatUsd(data.totalPipelineUsd)}</p>
        )}
      </div>

      {isPending || !data ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <OutcomeLeadsTable
          leads={data.leads}
          probabilityLabel={meta.probabilityLabel}
          empty={meta.empty}
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
