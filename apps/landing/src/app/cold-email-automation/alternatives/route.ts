import { renderedResponse } from "@/lib/static-html";
import { renderColdEmailAutomationAlternativesPage } from "@/lib/compare-page";

export const revalidate = 86400;

export function GET(request: Request) {
  return renderedResponse(renderColdEmailAutomationAlternativesPage(), request, { canonicalPath: "/cold-email-automation/alternatives" });
}
