import { renderedResponse } from "@/lib/static-html";
import { renderNotFoundPage } from "@/lib/pages/not-found";
import { renderCsVsPage } from "@/lib/pages/ai-customer-success-compare";
import { CS_TOOLS, csToolBySlug } from "@/lib/cs-tools";

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return CS_TOOLS.map((t) => ({ slug: t.slug }));
}

/**
 * The AI customer success page's own comparisons (PAGE-AI-CUSTOMER-SUCCESS-1030): one page per
 * tool in `cs-tools.ts`. Any other slug is the ordinary 404.
 */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const tool = csToolBySlug(slug);
  if (!tool) {
    return renderedResponse(renderNotFoundPage(), request, { status: 404, canonicalPath: "/404" });
  }
  return renderedResponse(renderCsVsPage(tool), request, { canonicalPath: `/ai-customer-success/vs/${tool.slug}` });
}
