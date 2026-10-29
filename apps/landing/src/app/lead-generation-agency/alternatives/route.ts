import { renderedResponse } from "@/lib/static-html";
import { renderLeadgenAlternativesPage } from "@/lib/pages/lead-generation-agency-compare";

export const revalidate = 86400;

export async function GET(request: Request) {
  return renderedResponse(renderLeadgenAlternativesPage(), request, { canonicalPath: "/lead-generation-agency/alternatives" });
}
