import { renderedResponse } from "@/lib/static-html";
import { renderTrafficAgencyAlternativesPage } from "@/lib/pages/website-traffic-agency-compare";

export const revalidate = 86400;

export async function GET(request: Request) {
  return renderedResponse(renderTrafficAgencyAlternativesPage(), request, { canonicalPath: "/website-traffic-agency/alternatives" });
}
