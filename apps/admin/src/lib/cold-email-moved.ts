/**
 * The admin cold-email audit pages were moved to dashboard v2 Monitoring > Emails
 * (MONITORING-ADMIN-PORT-1019). `/v2/monitoring/<page>` is the dashboard's tenant-free entry: it
 * lands on that Monitoring page under the staff member's last brand. Alias-free (unit-tested).
 */
export const DASHBOARD_MONITORING_URL = "https://dashboard.distribute.you/v2/monitoring";

const MOVED: Record<string, string> = {
  domains: "emails/domains",
  blocklists: "emails/blocklists",
  mailboxes: "emails/mailboxes",
  accounts: "emails/accounts",
  inbox: "emails/threads",
  rules: "emails/rules",
};

/** Where an old `/audit/cold-email/<segment>` page lives now; the Overview went to Capacity. */
export function monitoringUrlForColdEmail(segment: string | undefined): string {
  return `${DASHBOARD_MONITORING_URL}/${(segment && MOVED[segment]) || "emails/capacity"}`;
}
