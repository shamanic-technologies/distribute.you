import { renderedResponse } from "@/lib/static-html";
import { renderNotFoundPage } from "@/lib/pages/not-found";
import { renderAgencyVsPage } from "@/lib/pages/agency-compare";
import { AGENCIES, agencyBySlug, agencyVsPath } from "@/lib/agencies";

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return AGENCIES.map((a) => ({ slug: a.slug }));
}

/** One page per agency in the catalogue; any other slug is the ordinary 404. */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const agency = agencyBySlug(slug);
  if (!agency) {
    return renderedResponse(renderNotFoundPage(), request, { status: 404, canonicalPath: "/404" });
  }
  return renderedResponse(renderAgencyVsPage(agency), request, { canonicalPath: agencyVsPath(agency) });
}
