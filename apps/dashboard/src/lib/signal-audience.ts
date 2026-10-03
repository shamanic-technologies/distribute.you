/**
 * The "LinkedIn signal" audience: the people who recently reacted to or commented on
 * 1-3 competitor LinkedIn company pages' posts. human-service creates it
 * (`POST /orgs/audiences/signal`) and stores the criterion on the row as
 * `filters.buying_signal = { type: "linkedin_engagement", window_days, competitor_pages }`.
 *
 * We find the competitors and create it (done for you); the client never types pages.
 * This module only READS the criterion back for the table and the drawer.
 *
 * Alias-free on purpose (no runtime `@/` import) so the unit tests import it directly.
 */

const COMPANY_PAGE = /^https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/company\/([^/?#\s]+)\/?(?:[?#].*)?$/i;

/** The `<slug>` of `https://www.linkedin.com/company/<slug>/`, or the URL itself when it has none. */
export function companyPageSlug(url: string): string {
  const m = url.trim().match(COMPANY_PAGE);
  return m ? decodeURIComponent(m[1]) : url;
}

export interface LinkedInSignal {
  windowDays: number | null;
  competitorPages: string[];
}

/**
 * The LinkedIn engagement criterion an audience's filters carry, or null for every
 * other audience (Apollo search, CRM, Apify), which then render exactly as before.
 */
export function linkedInSignalOf(filters: Record<string, unknown> | null | undefined): LinkedInSignal | null {
  const signal = filters?.buying_signal;
  if (!signal || typeof signal !== "object" || Array.isArray(signal)) return null;
  const s = signal as Record<string, unknown>;
  if (s.type !== "linkedin_engagement") return null;
  const pages = Array.isArray(s.competitor_pages)
    ? s.competitor_pages.filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    : [];
  return { windowDays: typeof s.window_days === "number" ? s.window_days : null, competitorPages: pages };
}
