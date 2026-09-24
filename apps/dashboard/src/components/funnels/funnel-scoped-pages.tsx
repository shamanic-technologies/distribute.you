"use client";

import { EngagedLeadsPage } from "@/components/audiences/engaged-leads-page";
import { CustomerAudiencesPage } from "@/components/audiences/customer-audiences-page";

/**
 * The funnel's people, and the sets they are picked from.
 *
 * Both are the SAME components every other scope renders. The LEADS are narrowed to
 * this funnel by lead-service (`offerId` + `funnelKey`, passed by the page from the
 * route). The AUDIENCES are not: an audience is a set picked for a PROPOSITION and
 * carries no funnel, so it answers for the offer.
 */
export function FunnelLeadsPage() {
  return <EngagedLeadsPage />;
}

export function FunnelAudiencesPage() {
  return <CustomerAudiencesPage />;
}
