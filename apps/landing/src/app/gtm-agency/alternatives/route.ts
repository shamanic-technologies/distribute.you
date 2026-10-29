import { renderedResponse } from "@/lib/static-html";
import { renderAgencyAlternativesPage } from "@/lib/pages/agency-compare";

export const revalidate = 86400;

export async function GET(request: Request) {
  return renderedResponse(renderAgencyAlternativesPage(), request, { canonicalPath: "/gtm-agency/alternatives" });
}
