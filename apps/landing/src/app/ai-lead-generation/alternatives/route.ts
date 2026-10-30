import { renderedResponse } from "@/lib/static-html";
import { renderAiLeadGenAlternativesPage } from "@/lib/compare-page";

export const revalidate = 86400;

export function GET(request: Request) {
  return renderedResponse(renderAiLeadGenAlternativesPage(), request, { canonicalPath: "/ai-lead-generation/alternatives" });
}
