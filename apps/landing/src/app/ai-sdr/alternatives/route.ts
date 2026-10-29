import { renderedResponse } from "@/lib/static-html";
import { renderAiSdrAlternativesPage } from "@/lib/compare-page";

export const revalidate = 86400;

export function GET(request: Request) {
  return renderedResponse(renderAiSdrAlternativesPage(), request, { canonicalPath: "/ai-sdr/alternatives" });
}
