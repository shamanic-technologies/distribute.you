import { renderedResponse } from "@/lib/static-html";
import { fetchIndexList } from "@/lib/fleet-indexes";
import { fetchMonthlyRuns, renderRevenueAgencyPage } from "@/lib/pages/revenue-agency";

// Literal (Next reads it statically): the indexes record a new day every hour.
export const revalidate = 1800;

/**
 * The Revenue Agency page (PAGE-REVENUE-AGENCY-1029). Its two live reads drop their
 * own section on failure; the page itself always renders.
 */
export async function GET(request: Request) {
  const [list, monthly] = await Promise.all([fetchIndexList(), fetchMonthlyRuns()]);
  return renderedResponse(renderRevenueAgencyPage(list, monthly), request, {
    canonicalPath: "/revenue-agency",
    sMaxAge: list && monthly ? 1800 : 60,
  });
}
