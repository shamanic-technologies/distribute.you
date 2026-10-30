import { renderedResponse } from "@/lib/static-html";
import { renderToolAlternativesPage } from "@/lib/pages/agent-tools-compare";
import { TRAFFIC_TOOL_CLUSTER } from "@/lib/pages/website-traffic-automation";

export const revalidate = 86400;

export function GET(request: Request) {
  return renderedResponse(renderToolAlternativesPage(TRAFFIC_TOOL_CLUSTER), request, { canonicalPath: "/website-traffic-automation/alternatives" });
}
