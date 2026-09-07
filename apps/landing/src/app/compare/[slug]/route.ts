import { renderedResponse, staticResponse } from "@/lib/static-html";
import { renderComparePage } from "@/lib/compare-page";
import { COMPETITORS, competitorBySlug } from "@/lib/competitors";

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return COMPETITORS.map((c) => ({ slug: c.slug }));
}

/**
 * One page per competitor in the catalogue. A slug the catalogue does not carry is the
 * ordinary 404, negotiated like every other one, never an empty comparison.
 */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const competitor = competitorBySlug(slug);
  if (!competitor) {
    return staticResponse("404.html", request, { status: 404, canonicalPath: "/404" });
  }
  return renderedResponse(renderComparePage(competitor), request, {
    canonicalPath: `/compare/${competitor.slug}`,
  });
}
