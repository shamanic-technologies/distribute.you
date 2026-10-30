import { renderedResponse } from "@/lib/static-html";
import { renderNotFoundPage } from "@/lib/pages/not-found";
import { renderComparePage } from "@/lib/compare-page";
import { competitorBySlug, gtmAutomationCompetitors, isGtmAutomationCluster } from "@/lib/competitors";

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return gtmAutomationCompetitors().map((c) => ({ slug: c.slug }));
}

/**
 * The GTM automation page's own comparisons (PAGE-GTM-AUTOMATION-1030): one page per GTM
 * platform in `GTM_AUTOMATION_SLUGS`. Any other slug is the ordinary 404.
 */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const competitor = competitorBySlug(slug);
  if (!competitor || !isGtmAutomationCluster(competitor)) {
    return renderedResponse(renderNotFoundPage(), request, { status: 404, canonicalPath: "/404" });
  }
  return renderedResponse(renderComparePage(competitor), request, { canonicalPath: `/gtm-automation/vs/${competitor.slug}` });
}
