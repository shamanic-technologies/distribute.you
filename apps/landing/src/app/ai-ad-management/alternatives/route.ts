import { renderedResponse } from "@/lib/static-html";
import { renderToolAlternativesPage } from "@/lib/pages/agent-tools-compare";
import { AD_TOOL_CLUSTER } from "@/lib/pages/ai-ad-management";

export const revalidate = 86400;

export function GET(request: Request) {
  return renderedResponse(renderToolAlternativesPage(AD_TOOL_CLUSTER), request, { canonicalPath: "/ai-ad-management/alternatives" });
}
