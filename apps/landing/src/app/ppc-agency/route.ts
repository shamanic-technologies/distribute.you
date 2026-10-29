import { renderedResponse } from "@/lib/static-html";
import { fetchIndexList } from "@/lib/fleet-indexes";
import { fetchMonthlySpend, renderPpcAgencyPage } from "@/lib/pages/ppc-agency";

// Literal (Next reads it statically): the indexes record a new day every hour.
export const revalidate = 1800;

/**
 * The PPC Agency page (PAGE-PPC-AGENCY-1029). Its two live reads drop their own block on
 * failure; the page itself always renders.
 */
export async function GET(request: Request) {
  const [list, spend] = await Promise.all([fetchIndexList(), fetchMonthlySpend()]);
  return renderedResponse(renderPpcAgencyPage(list, spend), request, {
    canonicalPath: "/ppc-agency",
    sMaxAge: list && spend ? 1800 : 60,
  });
}
