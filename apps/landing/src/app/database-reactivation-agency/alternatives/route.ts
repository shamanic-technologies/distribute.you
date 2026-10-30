import { renderedResponse } from "@/lib/static-html";
import { renderReactivationAlternativesPage } from "@/lib/pages/database-reactivation-agency-compare";

export const revalidate = 86400;

export async function GET(request: Request) {
  return renderedResponse(renderReactivationAlternativesPage(), request, { canonicalPath: "/database-reactivation-agency/alternatives" });
}
