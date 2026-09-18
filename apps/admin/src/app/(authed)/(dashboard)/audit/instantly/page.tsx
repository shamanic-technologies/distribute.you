import { redirect } from "next/navigation";

/**
 * `/audit/instantly` is the old single page. The cold-email estate is a SECTION
 * now (`/audit/cold-email`), one page per object, so this route stays reachable
 * and sends every old bookmark and link to the Overview rather than 404ing.
 */
export default function AuditInstantlyRedirect() {
  redirect("/audit/cold-email");
}
