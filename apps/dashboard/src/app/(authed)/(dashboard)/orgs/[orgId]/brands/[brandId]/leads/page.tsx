import { EngagedLeadsPage } from "@/components/audiences/engaged-leads-page";

/**
 * The brand's leads.
 *
 * It sits at `/brands/[brandId]/leads` rather than under `audiences/`, because
 * audiences moved down to the offer when that level shipped — a brand-level path
 * under `audiences/` would name a level that is no longer there.
 *
 * `EngagedLeadsPage` reads the brand's leads when the route names no narrower
 * scope, so this is a route and a nav entry, not a second page body.
 *
 * The note is what makes the scope honest. This is VERY NEARLY every offer's leads
 * added up, and it is not exactly that: `leads_campaigns` rows carry the campaign
 * that contacted the person, and a campaign created before the offer level existed
 * names no offer at all (~145 of them in production). Those leads are here and
 * under no offer, so calling this page a union of the offers would claim something
 * it does not return.
 */
export default function BrandLeadsPage() {
  return (
    <EngagedLeadsPage scopeNote="Every lead this brand has, whichever offer it was contacted for. Leads from campaigns that predate offers are here too, and they appear under no offer." />
  );
}
