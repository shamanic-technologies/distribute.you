import { renderedResponse } from "@/lib/static-html";
import { renderCsAlternativesPage } from "@/lib/pages/customer-success-agency-compare";

export const revalidate = 86400;

export async function GET(request: Request) {
  return renderedResponse(renderCsAlternativesPage(), request, { canonicalPath: "/customer-success-agency/alternatives" });
}
