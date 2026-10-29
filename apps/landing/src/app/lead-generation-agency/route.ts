import { renderedResponse } from "@/lib/static-html";
import { fetchIndexList } from "@/lib/fleet-indexes";
import { fetchCheckedDelivery, renderLeadGenerationAgencyPage } from "@/lib/pages/lead-generation-agency";

// Literal (Next reads it statically): the indexes record a new day every hour.
export const revalidate = 1800;

/**
 * The Lead Generation Agency page (PAGE-LEADGEN-AGENCY-1029). Its two live reads drop their
 * own section on failure; the page itself always renders.
 */
export async function GET(request: Request) {
  const [list, delivery] = await Promise.all([fetchIndexList(), fetchCheckedDelivery()]);
  return renderedResponse(renderLeadGenerationAgencyPage(list, delivery), request, {
    canonicalPath: "/lead-generation-agency",
    sMaxAge: list && delivery ? 1800 : 60,
  });
}
