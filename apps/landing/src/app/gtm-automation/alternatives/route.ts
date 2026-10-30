import { renderedResponse } from "@/lib/static-html";
import { renderGtmAutomationAlternativesPage } from "@/lib/compare-page";

export const revalidate = 86400;

export function GET(request: Request) {
  return renderedResponse(renderGtmAutomationAlternativesPage(), request, { canonicalPath: "/gtm-automation/alternatives" });
}
