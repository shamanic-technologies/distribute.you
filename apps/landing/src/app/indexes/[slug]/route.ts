import { renderedResponse } from "@/lib/static-html";
import { renderNotFoundPage } from "@/lib/pages/not-found";
import { INDEX_REVALIDATE_SECONDS, fetchIndexDetail, fetchIndexList } from "@/lib/fleet-indexes";
import { renderIndexPage } from "@/lib/pages/indexes";

// Literal (Next reads it statically); equals INDEX_REVALIDATE_SECONDS.
export const revalidate = 1800;
export const dynamicParams = true;

/**
 * One page per fleet index the service serves (no hard-coded list: a new slug gets its
 * page the day it is served). An unknown slug is the ordinary 404; a failed read
 * renders the page's "could not be read" state, cached for a minute only.
 */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) {
    return renderedResponse(renderNotFoundPage(), request, { status: 404, canonicalPath: "/404" });
  }
  const [detail, list] = await Promise.all([fetchIndexDetail(slug), fetchIndexList()]);
  if (detail === "not_found") {
    return renderedResponse(renderNotFoundPage(), request, { status: 404, canonicalPath: "/404" });
  }
  return renderedResponse(renderIndexPage(slug, detail, list), request, {
    canonicalPath: `/indexes/${slug}`,
    sMaxAge: detail ? INDEX_REVALIDATE_SECONDS : 60,
  });
}
