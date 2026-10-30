import { renderedResponse } from "@/lib/static-html";
import { fetchIndexList } from "@/lib/fleet-indexes";
import { renderDatabaseReactivationAgencyPage } from "@/lib/pages/database-reactivation-agency";

// Literal (Next reads it statically): the indexes record a new day every hour.
export const revalidate = 1800;

/**
 * The Database Reactivation Agency page (Lead Nurturing, Agency buyer, PAGE-DATABASE-REACTIVATION-AGENCY-1030).
 * The index list drops its own section on failure; the page itself always renders.
 */
export async function GET(request: Request) {
  const list = await fetchIndexList();
  return renderedResponse(renderDatabaseReactivationAgencyPage(list), request, {
    canonicalPath: "/database-reactivation-agency",
    sMaxAge: list ? 1800 : 60,
  });
}
