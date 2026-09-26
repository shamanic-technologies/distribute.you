/**
 * Every v2 page, as a path. One home so the sidebar, the top bar and every link agree.
 * Alias-free.
 */
export type V2Section =
  | "today"
  | "companies"
  | "people"
  | "deals"
  | "work"
  | "crew"
  | "missions"
  | "offers"
  | "targeting"
  | "integrations"
  | "settings"
  | "billing"
  | "api-keys"
  | "account"
  | "team"
  | "referral";

export function v2Base(orgId: string, brandId: string): string {
  return `/v2/orgs/${encodeURIComponent(orgId)}/brands/${encodeURIComponent(brandId)}`;
}

export function v2Href(orgId: string, brandId: string, section: V2Section): string {
  const base = v2Base(orgId, brandId);
  return section === "today" ? base : `${base}/${section}`;
}

export function v2MissionHref(orgId: string, brandId: string, campaignId: string): string {
  return `${v2Base(orgId, brandId)}/missions/${encodeURIComponent(campaignId)}`;
}

/** Which section a v2 pathname is on. */
export function v2SectionOf(pathname: string): V2Section | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "v2" || parts[1] !== "orgs" || parts[3] !== "brands") return null;
  const s = parts[5];
  if (!s) return "today";
  const known: V2Section[] = [
    "companies",
    "people",
    "deals",
    "work",
    "crew",
    "missions",
    "offers",
    "targeting",
    "integrations",
    "settings",
    "billing",
    "api-keys",
    "account",
    "team",
    "referral",
  ];
  // An offer's Targeting tab is Targeting, not Offers.
  if (s === "offers" && parts[7] === "targeting") return "targeting";
  return (known as string[]).includes(s) ? (s as V2Section) : null;
}

/** One person (a `leads_campaigns` row) in v2. */
export function v2PersonHref(orgId: string, brandId: string, leadRowId: string): string {
  return `${v2Base(orgId, brandId)}/people/${encodeURIComponent(leadRowId)}`;
}

/** One offer in v2: its settings, with its Targeting beside it. */
export function v2OfferHref(orgId: string, brandId: string, offerId: string, tab?: "targeting"): string {
  const base = `${v2Base(orgId, brandId)}/offers/${encodeURIComponent(offerId)}`;
  return tab ? `${base}/${tab}` : base;
}
