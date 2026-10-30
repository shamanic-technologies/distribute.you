import { renderedResponse } from "@/lib/static-html";
import { renderNotFoundPage } from "@/lib/pages/not-found";
import { renderToolVsPage } from "@/lib/pages/agent-tools-compare";
import { AD_TOOL_CLUSTER } from "@/lib/pages/ai-ad-management";
import { AD_TOOLS, adToolBySlug, adToolVsPath } from "@/lib/ad-management-tools";

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return AD_TOOLS.map((t) => ({ slug: t.slug }));
}

/** One page per tool in `ad-management-tools.ts`; any other slug is the ordinary 404. */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const tool = adToolBySlug(slug);
  if (!tool) {
    return renderedResponse(renderNotFoundPage(), request, { status: 404, canonicalPath: "/404" });
  }
  return renderedResponse(renderToolVsPage(AD_TOOL_CLUSTER, tool), request, { canonicalPath: adToolVsPath(tool) });
}
