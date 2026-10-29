import { renderedResponse } from "@/lib/static-html";
import { renderNotFoundPage } from "@/lib/pages/not-found";
import { renderComparePage } from "@/lib/compare-page";
import { aiLeadGenCompetitors, competitorBySlug, isAiLeadGenCluster } from "@/lib/competitors";

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return aiLeadGenCompetitors().map((c) => ({ slug: c.slug }));
}

/**
 * The AI lead generation page's own comparisons (PAGE-AI-LEAD-GEN-1029): one page per
 * lead tool in `AI_LEAD_GEN_SLUGS`. Any other slug is the ordinary 404.
 */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const competitor = competitorBySlug(slug);
  if (!competitor || !isAiLeadGenCluster(competitor)) {
    return renderedResponse(renderNotFoundPage(), request, { status: 404, canonicalPath: "/404" });
  }
  return renderedResponse(renderComparePage(competitor), request, { canonicalPath: `/ai-lead-generation/vs/${competitor.slug}` });
}
