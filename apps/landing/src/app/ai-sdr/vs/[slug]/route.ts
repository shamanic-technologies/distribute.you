import { renderedResponse } from "@/lib/static-html";
import { renderNotFoundPage } from "@/lib/pages/not-found";
import { renderComparePage } from "@/lib/compare-page";
import { aiSdrCompetitors, competitorBySlug, isAiSdrCluster } from "@/lib/competitors";

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return aiSdrCompetitors().map((c) => ({ slug: c.slug }));
}

/**
 * The AI SDR page's own comparisons (PAGE-AI-SDR-1029): one page per competitor in
 * `AI_SDR_SLUGS`. Any other slug, a cold email tool included, is the ordinary 404.
 */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const competitor = competitorBySlug(slug);
  if (!competitor || !isAiSdrCluster(competitor)) {
    return renderedResponse(renderNotFoundPage(), request, { status: 404, canonicalPath: "/404" });
  }
  return renderedResponse(renderComparePage(competitor), request, { canonicalPath: `/ai-sdr/vs/${competitor.slug}` });
}
