import { renderedResponse } from "@/lib/static-html";
import { renderNotFoundPage } from "@/lib/pages/not-found";
import { renderBestForPage } from "@/lib/best-for-page";
import { BEST_FOR_PAGES, COLD_EMAIL_AGENCY_HOME, bestForBySlug, bestForPath } from "@/lib/best-for";

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return BEST_FOR_PAGES.filter((p) => p.home === COLD_EMAIL_AGENCY_HOME).map((p) => ({ slug: p.slug }));
}

/**
 * The "best cold email agency for Y" rankings, under the Cold Email Agency page
 * (PAGE-COLD-EMAIL-AGENCY-1030). Their old `/best/<slug>` paths 301 here (`next.config.ts`).
 * A slug that does not live here is the ordinary 404.
 */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const page = bestForBySlug(slug, COLD_EMAIL_AGENCY_HOME);
  if (!page) {
    return renderedResponse(renderNotFoundPage(), request, { status: 404, canonicalPath: "/404" });
  }
  return renderedResponse(renderBestForPage(page), request, { canonicalPath: bestForPath(page) });
}
