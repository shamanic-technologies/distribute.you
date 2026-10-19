import { redirect } from "next/navigation";
import { monitoringUrlForColdEmail } from "@/lib/cold-email-moved";

/** `/audit/instantly` is the old single page: it lands on dashboard v2 Monitoring > Emails. */
export default function AuditInstantlyRedirect() {
  redirect(monitoringUrlForColdEmail(undefined));
}
