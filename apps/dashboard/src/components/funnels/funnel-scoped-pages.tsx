"use client";

import { useParams } from "next/navigation";
import { EngagedLeadsPage } from "@/components/audiences/engaged-leads-page";
import { CustomerAudiencesPage } from "@/components/audiences/customer-audiences-page";
import { campaignFunnel } from "@/lib/campaign-funnel";
import type { SalesFunnelKeyWire } from "@/lib/sales-funnels";

/**
 * The funnel's people, and the sets they are picked from.
 *
 * Both are the SAME components every other scope renders. What they are NOT is
 * funnel-scoped: lead-service serves leads per brand and per campaign, and an
 * audience is a set picked for a PROPOSITION, so neither carries a funnel. They
 * answer for the OFFER here, and each says so rather than letting a reader take an
 * offer-wide list for one funnel's. Stating the scope is the alternative to hiding
 * the surface, and hiding it would be the bigger lie: these people ARE the ones this
 * funnel works, plus the ones its siblings work.
 *
 * The day either producer narrows by funnel, the note goes and the scope prop moves
 * to the component. Nothing here derives a narrowing the backend does not serve.
 */
function useFunnelName(): string | null {
  const params = useParams<{ funnelKey: string }>();
  const raw = params?.funnelKey ? decodeURIComponent(params.funnelKey) : "";
  if (!raw) return null;
  return campaignFunnel(raw as SalesFunnelKeyWire)?.name ?? raw;
}

export function FunnelLeadsPage() {
  const name = useFunnelName();
  return (
    <EngagedLeadsPage
      scopeNote={
        name
          ? `Every lead of this offer. Leads are recorded per campaign, not per sales funnel, so this is not narrowed to ${name}.`
          : undefined
      }
    />
  );
}

export function FunnelAudiencesPage() {
  return <CustomerAudiencesPage />;
}
