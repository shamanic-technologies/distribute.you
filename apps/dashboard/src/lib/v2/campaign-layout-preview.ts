/**
 * The campaign page's NEXT layout, a staff preview (owner 2026-10-15, Frontrunner-inspired):
 * it renders only for staff mode AND `?layout=next`; everyone else, and staff without the
 * param, get the current page byte for byte. Alias-free so it carries real unit tests.
 */
export const CAMPAIGN_LAYOUT_PARAM = "layout";
export const CAMPAIGN_LAYOUT_NEXT = "next";

/** True only when BOTH gates pass: staff mode on and the URL asks for the next layout. */
export function isCampaignLayoutPreview(staffMode: boolean, layoutParam: string | null | undefined): boolean {
  return staffMode === true && layoutParam === CAMPAIGN_LAYOUT_NEXT;
}

/** A campaign link that keeps the preview on (`?tab=x` or no query), so its tabs stay in it. */
export function withLayoutNext(href: string): string {
  return `${href}${href.includes("?") ? "&" : "?"}${CAMPAIGN_LAYOUT_PARAM}=${CAMPAIGN_LAYOUT_NEXT}`;
}
