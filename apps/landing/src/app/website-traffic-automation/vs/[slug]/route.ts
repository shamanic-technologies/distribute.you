import { renderedResponse } from "@/lib/static-html";
import { renderNotFoundPage } from "@/lib/pages/not-found";
import { renderToolVsPage } from "@/lib/pages/agent-tools-compare";
import { TRAFFIC_TOOL_CLUSTER } from "@/lib/pages/website-traffic-automation";
import { TRAFFIC_TOOLS, trafficToolBySlug, trafficToolVsPath } from "@/lib/traffic-tools";

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return TRAFFIC_TOOLS.map((t) => ({ slug: t.slug }));
}

/** One page per tool in `traffic-tools.ts`; any other slug is the ordinary 404. */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const tool = trafficToolBySlug(slug);
  if (!tool) {
    return renderedResponse(renderNotFoundPage(), request, { status: 404, canonicalPath: "/404" });
  }
  return renderedResponse(renderToolVsPage(TRAFFIC_TOOL_CLUSTER, tool), request, { canonicalPath: trafficToolVsPath(tool) });
}
