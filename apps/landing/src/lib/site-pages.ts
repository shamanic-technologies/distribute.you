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

function agentPath(slug: OutcomeSlug): string {
  return slug === "revenue" ? "/" : `/${slug}-automation`;
}

function agencyPath(slug: OutcomeSlug): string {
  return `/${slug}-agency`;
}

/** Pages that are served today. Everything else waits for its own PR. */
const LIVE_PATHS = new Set<string>(["/"]);

/** The sections of the homepage, listed first in its footer. */
const HOME_SECTIONS = [
  { label: "How it works", href: "/#how" },
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
];

export const SITE_PAGES: SitePage[] = OUTCOMES.flatMap((o) => [
  {
    outcome: o.slug,
    buyer: "agent" as const,
    path: agentPath(o.slug),
    navLabel: `${o.name} Automation`,
    description: o.line,
    live: LIVE_PATHS.has(agentPath(o.slug)),
    ...(o.slug === "revenue" ? { sections: HOME_SECTIONS } : {}),
  },
  {
    outcome: o.slug,
    buyer: "agency" as const,
    path: agencyPath(o.slug),
    navLabel: `${o.name} Agency`,
    description: o.line,
    live: LIVE_PATHS.has(agencyPath(o.slug)),
  },
]);

/** The live pages, optionally of one buyer. `pages` defaults to the catalogue (tests pass a fixture). */
export function livePages(buyer?: Buyer, pages: SitePage[] = SITE_PAGES): SitePage[] {
  return pages.filter((p) => p.live && (!buyer || p.buyer === buyer));
}

/** The catalogue page served at `path`, if any (live only). */
export function pageAt(path: string, pages: SitePage[] = SITE_PAGES): SitePage | undefined {
  return livePages(undefined, pages).find((p) => p.path === path);
}

/** Sitemap paths of every live outcome page (the homepage included). */
export function sitePagePaths(pages: SitePage[] = SITE_PAGES): string[] {
  return livePages(undefined, pages).map((p) => p.path);
}
