import { renderedResponse } from "@/lib/static-html";
import { fetchIndexList } from "@/lib/fleet-indexes";
import { fetchSendingVolume, renderColdEmailAgencyPage } from "@/lib/pages/cold-email-agency";

// Literal (Next reads it statically): the indexes record a new day every hour.
export const revalidate = 1800;

/**
 * The Cold Email Agency page (PAGE-COLD-EMAIL-AGENCY-1030). Its live reads drop their own
 * section on failure; the client proof cards are reseeded by the showcase pass of
 * `renderedResponse`, like the homepage's. The page itself always renders.
 */
export async function GET(request: Request) {
  const [list, sending] = await Promise.all([fetchIndexList(), fetchSendingVolume()]);
  return renderedResponse(renderColdEmailAgencyPage(list, sending), request, {
    canonicalPath: "/cold-email-agency",
    sMaxAge: list && sending ? 1800 : 60,
  });
}
