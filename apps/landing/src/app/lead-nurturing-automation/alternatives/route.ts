import { renderedResponse } from "@/lib/static-html";
import { renderNurturingAlternativesPage } from "@/lib/pages/lead-nurturing-automation-compare";

export const revalidate = 86400;

export function GET(request: Request) {
  return renderedResponse(renderNurturingAlternativesPage(), request, { canonicalPath: "/lead-nurturing-automation/alternatives" });
}
