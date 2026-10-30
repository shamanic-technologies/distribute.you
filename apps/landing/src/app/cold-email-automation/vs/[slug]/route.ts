import { renderedResponse } from "@/lib/static-html";
import { renderNotFoundPage } from "@/lib/pages/not-found";
import { renderComparePage } from "@/lib/compare-page";
import { coldEmailAutomationCompetitors, competitorBySlug, isColdEmailAutomationCluster } from "@/lib/competitors";

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return coldEmailAutomationCompetitors().map((c) => ({ slug: c.slug }));
}

/**
 * The cold email automation page's own comparisons (PAGE-COLD-EMAIL-AUTOMATION-1030): one page per
 * cold email tool in `COLD_EMAIL_AUTOMATION_SLUGS`. Any other slug is the ordinary 404.
 */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const competitor = competitorBySlug(slug);
  if (!competitor || !isColdEmailAutomationCluster(competitor)) {
    return renderedResponse(renderNotFoundPage(), request, { status: 404, canonicalPath: "/404" });
  }
  return renderedResponse(renderComparePage(competitor), request, { canonicalPath: `/cold-email-automation/vs/${competitor.slug}` });
}
