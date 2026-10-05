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
  | "campaigns"
  | "workflows"
  | "sales-path"
  | "offers"
  | "targeting"
  | "channels"
  | "audience"
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

/**
 * The brand walk (the `/get-started` screens, signed in) for this org: "Add a brand",
 * "New brand", and "Finish setup" on an unfinished brand (`brandId`).
 */
export function v2NewBrandHref(orgId: string, brandId?: string | null): string {
  const base = `/v2/orgs/${encodeURIComponent(orgId)}/new-brand`;
  return brandId ? `${base}?brand=${encodeURIComponent(brandId)}` : base;
}

export function v2Href(orgId: string, brandId: string, section: V2Section): string {
  const base = v2Base(orgId, brandId);
  return section === "today" ? base : `${base}/${section}`;
}

/** The tabs of one campaign's page. Workflows is offered in staff mode only. */
export type V2CampaignTab = "overview" | "inbox" | "sent" | "targeting" | "settings" | "workflows";

/** One campaign (offer x leg x channel), Overview when no tab is named. */
export function v2CampaignHref(orgId: string, brandId: string, campaignId: string, tab?: V2CampaignTab): string {
  const base = `${v2Base(orgId, brandId)}/campaigns/${encodeURIComponent(campaignId)}`;
  return tab && tab !== "overview" ? `${base}?tab=${tab}` : base;
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
    "campaigns",
    "workflows",
    "sales-path",
    "offers",
    "targeting",
    "channels",
    "audience",
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
  // An offer's Campaigns, and the older channel pages under it, are Campaigns.
  if (s === "offers" && (parts[7] === "campaigns" || parts[7] === "channels")) return "campaigns";
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
export function v2OfferHref(orgId: string, brandId: string, offerId: string, tab?: "targeting" | "sales-path" | "campaigns" | "channels"): string {
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
