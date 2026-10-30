/**
 * The ONE catalogue of outcome pages (OFFER-RESET-1029, owner 2026-10-29).
 *
 * distribute.you sells outcomes, each two ways, split by buyer:
 * - `agent`: "<Outcome> Automation Done For You", for the cheap SaaS founder (CTA Start free);
 * - `agency`: "<Outcome> Agency", for a company automating its GTM department (CTA Book a call).
 *
 * The top nav, the three footer variants and the sitemap all READ this list, so a page
 * added here (with `live: true`) appears in the nav, the right footer and the sitemap with
 * no other edit. A page that is not live is linked from nowhere: no "coming soon".
 *
 * `/` is the Revenue AI Agent page (the most general). The other entries are the frame
 * for the follow-up pages; each flips `live` the day its route ships.
 *
 * Alias-free: the unit tests import it directly.
 */
import { agencyCompareLinks } from "./agencies";
import { coldEmailCompareLinks } from "./cold-email-agencies";
import {
  AI_LEAD_GEN_PATH,
  AI_SDR_PATH,
  COLD_EMAIL_AUTOMATION_PATH,
  GTM_AUTOMATION_PATH,
  aiLeadGenCompareLinks,
  aiSdrCompareLinks,
  coldEmailAutomationCompareLinks,
  gtmAutomationCompareLinks,
} from "./competitors";
import { leadgenCompareLinks } from "./lead-generation-agencies";
import { ppcCompareLinks } from "./ppc-agencies";
import { APPOINTMENT_PAGE_PATH, appointmentCompareLinks } from "./appointment-setting-agencies";
import { REACTIVATION_PAGE_PATH, reactivationCompareLinks } from "./reactivation-agencies";
import { NURTURING_PAGE_PATH, nurturingCompareLinks } from "./nurturing-tools";

export type Buyer = "agent" | "agency";

export type OutcomeSlug =
  | "revenue"
  | "gtm"
  | "cold-email"
  | "meetings"
  | "signups"
  | "website-visits"
  | "lead-generation"
  | "paid-acquisition"
  | "lead-nurturing"
  | "customer-success";

export type SitePage = {
  outcome: OutcomeSlug;
  buyer: Buyer;
  /** Served path, leading slash, no trailing slash. */
  path: string;
  /** What the nav and the footers call the page. */
  navLabel: string;
  /** One line under the label in the nav dropdown. */
  description: string;
  /** Linked from the nav, footers and sitemap only when true. */
  live: boolean;
  /** In-page anchors the page's own footer lists first (its "sections"). */
  sections?: { label: string; href: string }[];
  /** The page's own vs/alternatives cluster, listed in its footer (empty clusters are not linked). */
  compare?: { label: string; href: string }[];
  /** The footer column title over `compare` on an AI Agent page. */
  compareTitle?: string;
};

/** Outcome display names, in the owner's order (root CLAUDE.md POSITIONING). */
export const OUTCOMES: { slug: OutcomeSlug; name: string; line: string }[] = [
  { slug: "revenue", name: "Revenue", line: "Buyers found, contacted and booked for you" },
  { slug: "gtm", name: "GTM", line: "Your whole go-to-market run by one agent" },
  { slug: "cold-email", name: "Sales Cold Email", line: "Cold email written, sent and answered for you" },
  { slug: "meetings", name: "Meetings Booked", line: "Sales meetings land in your calendar" },
  { slug: "signups", name: "Signups", line: "More people sign up for your product" },
  { slug: "website-visits", name: "Website Visits", line: "The right buyers visit your website" },
  { slug: "lead-generation", name: "Lead Generation", line: "Qualified leads found every day" },
  { slug: "paid-acquisition", name: "Paid Acquisition", line: "Paid campaigns that bring buyers" },
  { slug: "lead-nurturing", name: "Lead Nurturing", line: "Every lead followed up until it buys" },
  { slug: "customer-success", name: "Customer Success", line: "Customers kept happy, and buying again" },
];

/**
 * An AI Agent page served at the path its buyers search for, not `/<slug>-automation`:
 * Meetings Booked is "ai sdr" (1,600 US searches a month, PAGE-AI-SDR-1029), Lead
 * Generation is "ai lead generation" (1,600, PAGE-AI-LEAD-GEN-1029).
 */
const AGENT_PATH: Partial<Record<OutcomeSlug, string>> = {
  revenue: "/",
  meetings: AI_SDR_PATH,
  "lead-generation": AI_LEAD_GEN_PATH,
};

function agentPath(slug: OutcomeSlug): string {
  return AGENT_PATH[slug] ?? `/${slug}-automation`;
}

/**
 * An Agency page served at the path its buyers search for, not `/<slug>-agency`:
 * Paid Acquisition is "ppc agency" (5,400 US searches a month, PAGE-PPC-AGENCY-1029),
 * Meetings Booked is "appointment setting agency" (320 to 390, PAGE-APPOINTMENT-AGENCY-1030),
 * Lead Nurturing is "database reactivation" (70, CPC $33.75, PAGE-DATABASE-REACTIVATION-AGENCY-1030).
 */
const AGENCY_PATH: Partial<Record<OutcomeSlug, string>> = {
  "paid-acquisition": "/ppc-agency",
  meetings: APPOINTMENT_PAGE_PATH,
  "lead-nurturing": REACTIVATION_PAGE_PATH,
};

function agencyPath(slug: OutcomeSlug): string {
  return AGENCY_PATH[slug] ?? `/${slug}-agency`;
}

/** Pages that are served today. Everything else waits for its own PR. */
const LIVE_PATHS = new Set<string>([
  "/",
  "/gtm-agency",
  "/lead-generation-agency",
  AI_SDR_PATH,
  AI_LEAD_GEN_PATH,
  "/ppc-agency",
  APPOINTMENT_PAGE_PATH,
  "/cold-email-agency",
  COLD_EMAIL_AUTOMATION_PATH,
  REACTIVATION_PAGE_PATH,
  GTM_AUTOMATION_PATH,
  NURTURING_PAGE_PATH,
]);

/** The sections of the GTM Agency page (PAGE-REVENUE-AGENCY-1029, moved to /gtm-agency). */
const GTM_AGENCY_SECTIONS = [
  { label: "How we work", href: "/gtm-agency#how" },
  { label: "Our data", href: "/gtm-agency#data" },
  { label: "Price", href: "/gtm-agency#price" },
  { label: "FAQ", href: "/gtm-agency#faq" },
];

/** The sections of the Lead Generation Agency page (PAGE-LEADGEN-AGENCY-1029). */
const LEADGEN_AGENCY_SECTIONS = [
  { label: "How we work", href: "/lead-generation-agency#how" },
  { label: "Every lead", href: "/lead-generation-agency#lead" },
  { label: "Our data", href: "/lead-generation-agency#data" },
  { label: "Price", href: "/lead-generation-agency#price" },
  { label: "FAQ", href: "/lead-generation-agency#faq" },
];

/** The sections of the Cold Email Agency page (PAGE-COLD-EMAIL-AGENCY-1030). */
const COLD_EMAIL_AGENCY_SECTIONS = [
  { label: "How we work", href: "/cold-email-agency#how" },
  { label: "Our sending", href: "/cold-email-agency#sending" },
  { label: "Client results", href: "/cold-email-agency#proof" },
  { label: "Our data", href: "/cold-email-agency#data" },
  { label: "Price", href: "/cold-email-agency#price" },
  { label: "FAQ", href: "/cold-email-agency#faq" },
];

/** The sections of the PPC Agency page (PAGE-PPC-AGENCY-1029). */
const PPC_AGENCY_SECTIONS = [
  { label: "Where your budget goes", href: "/ppc-agency#how" },
  { label: "Every click", href: "/ppc-agency#clicks" },
  { label: "Our data", href: "/ppc-agency#data" },
  { label: "Price", href: "/ppc-agency#price" },
  { label: "FAQ", href: "/ppc-agency#faq" },
];

/** The sections of the Appointment Setting Agency page (PAGE-APPOINTMENT-AGENCY-1030). */
const APPOINTMENT_AGENCY_SECTIONS = [
  { label: "Real clients", href: `${APPOINTMENT_PAGE_PATH}#clients` },
  { label: "How we set meetings", href: `${APPOINTMENT_PAGE_PATH}#how` },
  { label: "Our data", href: `${APPOINTMENT_PAGE_PATH}#data` },
  { label: "Agencies compared", href: `${APPOINTMENT_PAGE_PATH}#compare` },
  { label: "Price", href: `${APPOINTMENT_PAGE_PATH}#price` },
  { label: "FAQ", href: `${APPOINTMENT_PAGE_PATH}#faq` },
];

/** The sections of the Database Reactivation Agency page (PAGE-DATABASE-REACTIVATION-AGENCY-1030). */
const REACTIVATION_AGENCY_SECTIONS = [
  { label: "How we reactivate", href: `${REACTIVATION_PAGE_PATH}#how` },
  { label: "Signals we act on", href: `${REACTIVATION_PAGE_PATH}#signals` },
  { label: "Our data", href: `${REACTIVATION_PAGE_PATH}#data` },
  { label: "Agencies compared", href: `${REACTIVATION_PAGE_PATH}#compare` },
  { label: "Price", href: `${REACTIVATION_PAGE_PATH}#price` },
  { label: "FAQ", href: `${REACTIVATION_PAGE_PATH}#faq` },
];

/** The sections of the homepage (the Revenue AI Agent page, PAGE-REVENUE-AGENT-1029), listed first in its footer. */
const HOME_SECTIONS = [
  { label: "How it works", href: "/#how" },
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Open source", href: "/#open-source" },
  { label: "Use from your agent", href: "/#agent" },
  { label: "FAQ", href: "/#faq" },
];

/** The sections of the AI SDR page (Meetings Booked, AI Agent buyer, PAGE-AI-SDR-1029). */
const AI_SDR_SECTIONS = [
  { label: "How it books", href: `${AI_SDR_PATH}#how` },
  { label: "Prices", href: `${AI_SDR_PATH}#prices` },
  { label: "AI SDRs compared", href: `${AI_SDR_PATH}#compare` },
  { label: "Pricing", href: `${AI_SDR_PATH}#pricing` },
  { label: "FAQ", href: `${AI_SDR_PATH}#faq` },
];

/** The sections of the AI lead generation page (Lead Generation, AI Agent buyer, PAGE-AI-LEAD-GEN-1029). */
const AI_LEAD_GEN_SECTIONS = [
  { label: "How it finds leads", href: `${AI_LEAD_GEN_PATH}#how` },
  { label: "Price of a lead", href: `${AI_LEAD_GEN_PATH}#prices` },
  { label: "Lead tools compared", href: `${AI_LEAD_GEN_PATH}#compare` },
  { label: "Pricing", href: `${AI_LEAD_GEN_PATH}#pricing` },
  { label: "FAQ", href: `${AI_LEAD_GEN_PATH}#faq` },
];

/** The sections of the Lead Nurturing Automation page (Lead Nurturing, AI Agent buyer, PAGE-LEAD-NURTURING-AUTOMATION-1030). */
const NURTURING_SECTIONS = [
  { label: "How it nurtures", href: `${NURTURING_PAGE_PATH}#how` },
  { label: "Signals it acts on", href: `${NURTURING_PAGE_PATH}#signals` },
  { label: "Price of a message", href: `${NURTURING_PAGE_PATH}#prices` },
  { label: "Nurturing tools compared", href: `${NURTURING_PAGE_PATH}#compare` },
  { label: "Pricing", href: `${NURTURING_PAGE_PATH}#pricing` },
  { label: "FAQ", href: `${NURTURING_PAGE_PATH}#faq` },
];

/** The sections of the cold email automation page (Sales Cold Email, AI Agent buyer, PAGE-COLD-EMAIL-AUTOMATION-1030). */
const COLD_EMAIL_AUTOMATION_SECTIONS = [
  { label: "How it writes", href: `${COLD_EMAIL_AUTOMATION_PATH}#how` },
  { label: "Sending", href: `${COLD_EMAIL_AUTOMATION_PATH}#sending` },
  { label: "Price of an email", href: `${COLD_EMAIL_AUTOMATION_PATH}#prices` },
  { label: "Cold email tools compared", href: `${COLD_EMAIL_AUTOMATION_PATH}#compare` },
  { label: "Pricing", href: `${COLD_EMAIL_AUTOMATION_PATH}#pricing` },
  { label: "FAQ", href: `${COLD_EMAIL_AUTOMATION_PATH}#faq` },
];

/** The sections of the GTM automation page (GTM, AI Agent buyer, PAGE-GTM-AUTOMATION-1030). */
const GTM_AUTOMATION_SECTIONS = [
  { label: "From found to paid", href: `${GTM_AUTOMATION_PATH}#run` },
  { label: "Every outcome", href: `${GTM_AUTOMATION_PATH}#outcomes` },
  { label: "How it runs", href: `${GTM_AUTOMATION_PATH}#how` },
  { label: "GTM platforms compared", href: `${GTM_AUTOMATION_PATH}#compare` },
  { label: "Pricing", href: `${GTM_AUTOMATION_PATH}#pricing` },
  { label: "FAQ", href: `${GTM_AUTOMATION_PATH}#faq` },
];

/** Per-page extras of the AI Agent pages: their own sections and vs/alternatives cluster. */
const AGENT_EXTRAS: Partial<Record<OutcomeSlug, Pick<SitePage, "sections" | "compare" | "compareTitle">>> = {
  revenue: { sections: HOME_SECTIONS },
  gtm: { sections: GTM_AUTOMATION_SECTIONS, compare: gtmAutomationCompareLinks(), compareTitle: "Compare GTM platforms" },
  meetings: { sections: AI_SDR_SECTIONS, compare: aiSdrCompareLinks(), compareTitle: "Compare AI SDRs" },
  "lead-generation": { sections: AI_LEAD_GEN_SECTIONS, compare: aiLeadGenCompareLinks(), compareTitle: "Compare lead tools" },
  "cold-email": {
    sections: COLD_EMAIL_AUTOMATION_SECTIONS,
    compare: coldEmailAutomationCompareLinks(),
    compareTitle: "Compare cold email tools",
  },
  "lead-nurturing": { sections: NURTURING_SECTIONS, compare: nurturingCompareLinks(), compareTitle: "Compare nurturing tools" },
};

/**
 * Revenue has no Agency page of its own (owner 2026-10-29): "revenue agency" searches are
 * people looking for a tax office, so its outcome is folded into the GTM Agency page.
 */
const NO_AGENCY_PAGE = new Set<OutcomeSlug>(["revenue"]);

export const SITE_PAGES: SitePage[] = OUTCOMES.flatMap((o): SitePage[] => [
  {
    outcome: o.slug,
    buyer: "agent" as const,
    path: agentPath(o.slug),
    navLabel: `${o.name} Automation`,
    description: o.line,
    live: LIVE_PATHS.has(agentPath(o.slug)),
    ...(AGENT_EXTRAS[o.slug] ?? {}),
  },
  ...(NO_AGENCY_PAGE.has(o.slug)
    ? []
    : [
        {
          outcome: o.slug,
          buyer: "agency" as const,
          path: agencyPath(o.slug),
          navLabel: `${o.name} Agency`,
          description: o.slug === "gtm" ? "Your GTM department, run for you" : o.line,
          live: LIVE_PATHS.has(agencyPath(o.slug)),
          ...(o.slug === "gtm" ? { sections: GTM_AGENCY_SECTIONS, compare: agencyCompareLinks() } : {}),
          ...(o.slug === "cold-email" ? { sections: COLD_EMAIL_AGENCY_SECTIONS, compare: coldEmailCompareLinks() } : {}),
          ...(o.slug === "lead-generation" ? { sections: LEADGEN_AGENCY_SECTIONS, compare: leadgenCompareLinks() } : {}),
          ...(o.slug === "paid-acquisition" ? { navLabel: "PPC Agency", sections: PPC_AGENCY_SECTIONS, compare: ppcCompareLinks() } : {}),
          ...(o.slug === "meetings"
            ? { navLabel: "Appointment Setting Agency", sections: APPOINTMENT_AGENCY_SECTIONS, compare: appointmentCompareLinks() }
            : {}),
          ...(o.slug === "lead-nurturing"
            ? { navLabel: "Database Reactivation Agency", sections: REACTIVATION_AGENCY_SECTIONS, compare: reactivationCompareLinks() }
            : {}),
        },
      ]),
]);

/** The live pages, optionally of one buyer. `pages` defaults to the catalogue (tests pass a fixture). */
export function livePages(buyer?: Buyer, pages: SitePage[] = SITE_PAGES): SitePage[] {
  return pages.filter((p) => p.live && (!buyer || p.buyer === buyer));
}

/** The catalogue page served at `path`, if any (live only). */
export function pageAt(path: string, pages: SitePage[] = SITE_PAGES): SitePage | undefined {
  return livePages(undefined, pages).find((p) => p.path === path);
}

/**
 * The live page that owns `path`: the page itself, or the page whose own cluster it sits
 * under (`/gtm-agency/vs/belkins` belongs to `/gtm-agency`), so a cluster page
 * wears its page's nav and footer.
 */
export function ownerPage(path: string, pages: SitePage[] = SITE_PAGES): SitePage | undefined {
  return pageAt(path, pages) ?? livePages(undefined, pages).find((p) => p.path !== "/" && path.startsWith(`${p.path}/`));
}

/** Sitemap paths of every live outcome page (the homepage included). */
export function sitePagePaths(pages: SitePage[] = SITE_PAGES): string[] {
  return livePages(undefined, pages).map((p) => p.path);
}
