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
  | "missions";

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
  const known: V2Section[] = ["companies", "people", "deals", "work", "crew", "missions"];
  return (known as string[]).includes(s) ? (s as V2Section) : null;
}

/** The v1 brand page a v2 section has no equivalent for yet. */
export function v1Brand(orgId: string, brandId: string): string {
  return `/orgs/${encodeURIComponent(orgId)}/brands/${encodeURIComponent(brandId)}`;
}
