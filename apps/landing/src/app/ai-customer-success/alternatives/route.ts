import { renderedResponse } from "@/lib/static-html";
import { renderCsAlternativesPage } from "@/lib/pages/ai-customer-success-compare";

export const revalidate = 86400;

export function GET(request: Request) {
  return renderedResponse(renderCsAlternativesPage(), request, { canonicalPath: "/ai-customer-success/alternatives" });
}
