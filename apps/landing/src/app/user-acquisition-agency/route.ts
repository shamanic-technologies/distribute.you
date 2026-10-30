import { renderedResponse } from "@/lib/static-html";
import { renderUserAcquisitionAgencyPage } from "@/lib/pages/user-acquisition-agency";

export const revalidate = 86400;

/**
 * The User Acquisition Agency page (Signups, Agency buyer, PAGE-USER-ACQUISITION-AGENCY-1030).
 * No live read: no index measures a signup yet, so the page states no figure of ours.
 */
export async function GET(request: Request) {
  return renderedResponse(renderUserAcquisitionAgencyPage(), request, { canonicalPath: "/user-acquisition-agency" });
}
