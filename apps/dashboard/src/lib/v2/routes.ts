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
  | "workflows"
  | "sales-path"
  | "offers"
  | "targeting"
  | "channels"
  | "integrations"
  | "settings"
  | "billing"
  | "api-keys"
  | "account"
  | "team"
  | "referral"
  | "research"
  | "monitoring";

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

/**
 * One workflow dynasty's page, priced for one crew (`<channel slug>|<leg key>`) on one
 * mission (its campaign id). The mission is what the ranking is asked through; a link
 * naming only the crew still resolves when the brand runs one mission for that crew.
 */
export function v2WorkflowHref(
  orgId: string,
  brandId: string,
  dynastySlug: string,
  crew: string,
  mission?: string | null,
): string {
  const m = mission ? `&mission=${encodeURIComponent(mission)}` : "";
  return `${v2Base(orgId, brandId)}/workflows/${encodeURIComponent(dynastySlug)}?crew=${encodeURIComponent(crew)}${m}`;
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
    "workflows",
    "sales-path",
    "offers",
    "targeting",
    "channels",
    "integrations",
    "settings",
    "billing",
    "api-keys",
    "account",
    "team",
    "referral",
    "research",
    "monitoring",
  ];
  // An offer's Sales path is its own section, opened from the sidebar.
  if (s === "offers" && parts[7] === "sales-path") return "sales-path";
  // An offer's Targeting tab is Targeting, not Offers.
  if (s === "offers" && parts[7] === "targeting") return "targeting";
  // An offer's Channels, and one channel's page under it, are Channels.
  if (s === "offers" && parts[7] === "channels") return "channels";
  return (known as string[]).includes(s) ? (s as V2Section) : null;
}

/** One workflow run in v2, under Work. */
export function v2RunHref(orgId: string, brandId: string, runId: string): string {
  return `${v2Base(orgId, brandId)}/work/runs/${encodeURIComponent(runId)}`;
}

/** One person (a `leads_campaigns` row) in v2. */
export function v2PersonHref(orgId: string, brandId: string, leadRowId: string): string {
  return `${v2Base(orgId, brandId)}/people/${encodeURIComponent(leadRowId)}`;
}

/** One offer in v2: its settings, with its Targeting beside it. */
export function v2OfferHref(orgId: string, brandId: string, offerId: string, tab?: "targeting" | "sales-path" | "channels"): string {
  const base = `${v2Base(orgId, brandId)}/offers/${encodeURIComponent(offerId)}`;
  return tab ? `${base}/${tab}` : base;
}

/** The tabs of one channel's page under an offer's Channels. */
export type V2ChannelTab = "overview" | "inbox" | "sent" | "targeting" | "settings";

/** One channel's page under an offer's Channels (Overview when no tab is named). */
export function v2OfferChannelHref(orgId: string, brandId: string, offerId: string, channelSlug: string, tab?: V2ChannelTab): string {
  const base = `${v2OfferHref(orgId, brandId, offerId, "channels")}/${encodeURIComponent(channelSlug)}`;
  return tab && tab !== "overview" ? `${base}?tab=${tab}` : base;
}
