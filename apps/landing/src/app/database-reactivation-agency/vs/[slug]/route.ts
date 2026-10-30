import { renderedResponse } from "@/lib/static-html";
import { renderNotFoundPage } from "@/lib/pages/not-found";
import { renderReactivationVsPage } from "@/lib/pages/database-reactivation-agency-compare";
import { REACTIVATION_AGENCIES, reactivationAgencyBySlug, reactivationVsPath } from "@/lib/reactivation-agencies";

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return REACTIVATION_AGENCIES.map((a) => ({ slug: a.slug }));
}

/** One page per agency in the database reactivation cluster; any other slug is the ordinary 404. */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const agency = reactivationAgencyBySlug(slug);
  if (!agency) {
    return renderedResponse(renderNotFoundPage(), request, { status: 404, canonicalPath: "/404" });
  }
  return renderedResponse(renderReactivationVsPage(agency), request, { canonicalPath: reactivationVsPath(agency) });
}
