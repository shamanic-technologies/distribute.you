import { toCsv, type CsvColumn } from "@/components/report/csv";
import type { Lead } from "@/lib/api";

const yesNo = (b: boolean): string => (b ? "yes" : "no");
const date = (iso: string | null | undefined): string => (iso ? iso : "");
const list = (arr: string[] | null | undefined): string => (arr?.length ? arr.join("; ") : "");

/**
 * Build a flat, one-row-per-lead CSV of the WHOLE leads list.
 *
 * Exports EVERY lead passed in — never the active-tab / search-filtered subset —
 * so a single file carries all tabs (Positive replies, Website Visits, Outreach).
 * Tab membership is visible via the engagement booleans + Status column: a lead
 * in the Positive-replies tab has `Replied=yes, Reply sentiment=positive`, a
 * Website-Visits lead has `Clicked=yes`, an Outreach lead has `Contacted=yes`.
 *
 * `statusLabelFor` is the page's own latched display-status resolver (run through
 * `leadStatusLabel`), so the exported Status can't drift from the on-screen badge.
 * Columns cover every field on the wire: person, organization, engagement funnel,
 * per-event timestamps, and the attributed audience.
 */
export function buildLeadsCsv(
  leads: Lead[],
  statusLabelFor: (lead: Lead) => string,
): string {
  const columns: CsvColumn<Lead>[] = [
    // Person
    { label: "First name", value: (l) => l.lead?.firstName ?? "" },
    { label: "Last name", value: (l) => l.lead?.lastName ?? "" },
    { label: "Email", value: (l) => l.email },
    { label: "Email status", value: (l) => l.emailStatus ?? "" },
    { label: "Title", value: (l) => l.lead?.currentTitle ?? "" },
    { label: "Headline", value: (l) => l.lead?.headline ?? "" },
    { label: "Seniority", value: (l) => l.lead?.seniority ?? "" },
    { label: "Departments", value: (l) => list(l.lead?.departments) },
    { label: "Functions", value: (l) => list(l.lead?.functions) },
    { label: "City", value: (l) => l.lead?.city ?? "" },
    { label: "State", value: (l) => l.lead?.state ?? "" },
    { label: "Country", value: (l) => l.lead?.country ?? "" },
    { label: "LinkedIn", value: (l) => l.lead?.linkedinUrl ?? "" },
    // Organization
    { label: "Company", value: (l) => l.lead?.organization?.name ?? "" },
    { label: "Company domain", value: (l) => l.lead?.organization?.primaryDomain ?? "" },
    { label: "Company industry", value: (l) => l.lead?.organization?.industry ?? "" },
    { label: "Company revenue", value: (l) => l.lead?.organization?.annualRevenue ?? "" },
    { label: "Company employees", value: (l) => l.lead?.organization?.estimatedNumEmployees ?? "" },
    { label: "Company founded", value: (l) => l.lead?.organization?.foundedYear ?? "" },
    { label: "Company city", value: (l) => l.lead?.organization?.city ?? "" },
    { label: "Company state", value: (l) => l.lead?.organization?.state ?? "" },
    { label: "Company country", value: (l) => l.lead?.organization?.country ?? "" },
    // Engagement funnel (tab membership lives here)
    { label: "Status", value: (l) => statusLabelFor(l) },
    { label: "Contacted", value: (l) => yesNo(l.contacted) },
    { label: "Sent", value: (l) => yesNo(l.sent) },
    { label: "Delivered", value: (l) => yesNo(l.delivered) },
    { label: "Clicked", value: (l) => yesNo(l.clicked) },
    { label: "Replied", value: (l) => yesNo(l.replied) },
    { label: "Reply sentiment", value: (l) => l.replyClassification ?? "" },
    { label: "Bounced", value: (l) => yesNo(l.bounced) },
    { label: "Unsubscribed", value: (l) => yesNo(l.unsubscribed) },
    { label: "Global bounced", value: (l) => yesNo(l.global.bounced) },
    { label: "Global unsubscribed", value: (l) => yesNo(l.global.unsubscribed) },
    // Audience attribution
    { label: "Audience", value: (l) => l.audience?.name ?? "" },
    // Per-event timestamps
    { label: "Served at", value: (l) => date(l.servedAt) },
    { label: "First contacted at", value: (l) => date(l.firstContactedAt) },
    { label: "First sent at", value: (l) => date(l.firstSentAt) },
    { label: "First delivered at", value: (l) => date(l.firstDeliveredAt) },
    { label: "First clicked at", value: (l) => date(l.firstClickedAt) },
    { label: "First replied at", value: (l) => date(l.firstRepliedAt) },
    { label: "First bounced at", value: (l) => date(l.firstBouncedAt) },
    { label: "First unsubscribed at", value: (l) => date(l.firstUnsubscribedAt) },
  ];
  return toCsv(leads, columns);
}
