import { renderedResponse } from "@/lib/static-html";
import { renderNotFoundPage } from "@/lib/pages/not-found";
import { renderComparePage } from "@/lib/compare-page";
import { COMPETITORS, competitorBySlug, competitorPath } from "@/lib/competitors";

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return COMPETITORS.filter((c) => competitorPath(c) === `/compare/${c.slug}`).map((c) => ({ slug: c.slug }));
}

/**
 * One page per competitor in the catalogue. A slug the catalogue does not carry is the
 * ordinary 404, negotiated like every other one, never an empty comparison.
 */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const competitor = competitorBySlug(slug);
  if (!competitor) {
    return renderedResponse(renderNotFoundPage(), request, { status: 404, canonicalPath: "/404" });
  }
  // The AI SDR agents moved under the AI SDR page's own cluster (PAGE-AI-SDR-1029):
  // the old URL answers a permanent redirect, never a 404. Relative `Location`:
  // `request.url` is the bind address on the box.
  const path = competitorPath(competitor);
  if (path !== `/compare/${competitor.slug}`) {
    return new Response(null, { status: 301, headers: { Location: path } });
  }
  return renderedResponse(renderComparePage(competitor), request, { canonicalPath: path });
}
