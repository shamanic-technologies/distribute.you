import { renderedResponse } from "@/lib/static-html";
import { renderNotFoundPage } from "@/lib/pages/not-found";
import { renderCompetitorAlternativesPage } from "@/lib/compare-page";
import { competitorAlternativesPath, competitorBySlug, pricingAnsweredCompetitors } from "@/lib/competitors";

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return pricingAnsweredCompetitors().map((c) => ({ slug: c.slug }));
}

/**
 * "<name> alternatives" (SEO-COMPETITOR-PRICING-PAGES-1106): one page per competitor whose
 * catalogue entry carries a pricing answer. Any other slug is the ordinary 404.
 */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const competitor = competitorBySlug(slug);
  if (!competitor?.pricingAnswer) {
    return renderedResponse(renderNotFoundPage(), request, { status: 404, canonicalPath: "/404" });
  }
  return renderedResponse(renderCompetitorAlternativesPage(competitor), request, {
    canonicalPath: competitorAlternativesPath(competitor),
  });
}
