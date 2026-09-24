import { renderedResponse, staticResponse } from "@/lib/static-html";
import { renderBestForPage } from "@/lib/best-for-page";
import { BEST_FOR_PAGES, bestForBySlug } from "@/lib/best-for";

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return BEST_FOR_PAGES.map((p) => ({ slug: p.slug }));
}

/**
 * One page per "best X for Y" question in the catalogue. A slug the catalogue does not
 * carry is the ordinary negotiated 404, never an empty ranking.
 */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const page = bestForBySlug(slug);
  if (!page) {
    return staticResponse("404.html", request, { status: 404, canonicalPath: "/404" });
  }
  return renderedResponse(renderBestForPage(page), request, { canonicalPath: `/best/${page.slug}` });
}
