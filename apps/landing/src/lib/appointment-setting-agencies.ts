/**
 * The agencies the Appointment Setting Agency page is compared with
 * (PAGE-APPOINTMENT-AGENCY-1030): one entry per `/appointment-setting-agency/vs/<slug>` page,
 * the `/appointment-setting-agency/alternatives` list, the page's cost table, the sitemap and
 * the page's footer all read it.
 *
 * Every figure is READ from the agency's own site, with the URL it came from and the day it
 * was read (apps/landing/CLAUDE.md "A competitor figure is READ from their own site").
 * SalesRoads, Belkins and SalesHive are the GTM cluster's entries (`agencies.ts`) and Callbox
 * the Lead Generation cluster's (`lead-generation-agencies.ts`), all read on 2026-10-29 and
 * reused as they stand, so two clusters can never describe one agency two ways. Each of the
 * four sells appointment setting by name. Martal Group was checked for those clusters and left
 * out: its site answered 403, so nothing on it could be verified.
 *
 * Alias-free: the unit tests import it directly.
 */
import { agencyBySlug, type Agency } from "./agencies";
import { leadgenAgencyBySlug } from "./lead-generation-agencies";

export const APPOINTMENT_PAGE_PATH = "/appointment-setting-agency";
export const APPOINTMENT_ALTERNATIVES_PATH = `${APPOINTMENT_PAGE_PATH}/alternatives`;

/** How WE answer each row on the appointment setting cluster, stated once. */
export const OUR_APPOINTMENT_ROW = {
  entryPrice: "From $1K/month + 10% of budget",
  pricing: "From $1K a month, plus 10% of the budget you put into your campaigns. The budget goes to reaching your buyers.",
  contract: "One call to start. Your budget is a hard cap you set.",
  channels: "Cold email from our own domains and WhatsApp. Our team runs your account, our AI agents write and answer.",
  guarantee: "Every meeting is shown on your dashboard with what it cost, and what a meeting costs across all our clients is public.",
  launch: "Live in 5 days from our first call.",
} as const;

function reused(found: Agency | undefined, slug: string): Agency {
  if (!found) throw new Error(`appointment-setting-agencies: no agency "${slug}" in its home cluster`);
  return found;
}

export const APPOINTMENT_AGENCIES: readonly Agency[] = [
  reused(agencyBySlug("salesroads"), "salesroads"),
  reused(agencyBySlug("belkins"), "belkins"),
  reused(agencyBySlug("saleshive"), "saleshive"),
  reused(leadgenAgencyBySlug("callbox"), "callbox"),
];

export function appointmentVsPath(a: Pick<Agency, "slug">): string {
  return `${APPOINTMENT_PAGE_PATH}/vs/${a.slug}`;
}

export function appointmentAgencyBySlug(slug: string): Agency | undefined {
  return APPOINTMENT_AGENCIES.find((a) => a.slug === slug);
}

/** Every page of the cluster, for the sitemap. */
export function appointmentClusterPaths(): string[] {
  return [APPOINTMENT_ALTERNATIVES_PATH, ...APPOINTMENT_AGENCIES.map(appointmentVsPath)];
}

/** The links the page's footer and its FAQ close on. */
export function appointmentCompareLinks(): { label: string; href: string }[] {
  return [
    ...APPOINTMENT_AGENCIES.map((a) => ({ label: `distribute.you vs ${a.name}`, href: appointmentVsPath(a) })),
    { label: "Appointment setting agency alternatives", href: APPOINTMENT_ALTERNATIVES_PATH },
  ];
}
