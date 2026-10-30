import { renderedResponse } from "@/lib/static-html";
import { renderColdEmailAlternativesPage } from "@/lib/pages/cold-email-agency-compare";

export const revalidate = 86400;

export async function GET(request: Request) {
  return renderedResponse(renderColdEmailAlternativesPage(), request, { canonicalPath: "/cold-email-agency/alternatives" });
}
