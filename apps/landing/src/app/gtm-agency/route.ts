import { renderedResponse } from "@/lib/static-html";
import { fetchIndexList } from "@/lib/fleet-indexes";
import { fetchMonthlyRuns, renderGtmAgencyPage } from "@/lib/pages/gtm-agency";

// Literal (Next reads it statically): the indexes record a new day every hour.
export const revalidate = 1800;

/**
 * The GTM Agency page (PAGE-REVENUE-AGENCY-1029). Its two live reads drop their own
 * section on failure; the page itself always renders.
 */
export async function GET(request: Request) {
  const [list, monthly] = await Promise.all([fetchIndexList(), fetchMonthlyRuns()]);
  return renderedResponse(renderGtmAgencyPage(list, monthly), request, {
    canonicalPath: "/gtm-agency",
    sMaxAge: list && monthly ? 1800 : 60,
  });
}
