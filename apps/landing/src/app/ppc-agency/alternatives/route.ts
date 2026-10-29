import { renderedResponse } from "@/lib/static-html";
import { renderPpcAlternativesPage } from "@/lib/pages/ppc-agency-compare";

export const revalidate = 86400;

export async function GET(request: Request) {
  return renderedResponse(renderPpcAlternativesPage(), request, { canonicalPath: "/ppc-agency/alternatives" });
}
