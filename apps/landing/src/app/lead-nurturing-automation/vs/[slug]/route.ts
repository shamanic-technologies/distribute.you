import { renderedResponse } from "@/lib/static-html";
import { renderNotFoundPage } from "@/lib/pages/not-found";
import { renderNurturingVsPage } from "@/lib/pages/lead-nurturing-automation-compare";
import { NURTURING_TOOLS, nurturingToolBySlug } from "@/lib/nurturing-tools";

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return NURTURING_TOOLS.map((t) => ({ slug: t.slug }));
}

/**
 * The lead nurturing automation page's own comparisons (PAGE-LEAD-NURTURING-AUTOMATION-1030):
 * one page per tool in `nurturing-tools.ts`. Any other slug is the ordinary 404.
 */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const tool = nurturingToolBySlug(slug);
  if (!tool) {
    return renderedResponse(renderNotFoundPage(), request, { status: 404, canonicalPath: "/404" });
  }
  return renderedResponse(renderNurturingVsPage(tool), request, { canonicalPath: `/lead-nurturing-automation/vs/${tool.slug}` });
}
