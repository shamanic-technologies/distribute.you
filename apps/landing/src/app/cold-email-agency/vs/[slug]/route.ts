import { renderedResponse } from "@/lib/static-html";
import { renderNotFoundPage } from "@/lib/pages/not-found";
import { renderColdEmailVsPage } from "@/lib/pages/cold-email-agency-compare";
import { COLD_EMAIL_AGENCIES, coldEmailAgencyBySlug, coldEmailVsPath } from "@/lib/cold-email-agencies";

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return COLD_EMAIL_AGENCIES.map((a) => ({ slug: a.slug }));
}

/** One page per agency in the cold email cluster; any other slug is the ordinary 404. */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const agency = coldEmailAgencyBySlug(slug);
  if (!agency) {
    return renderedResponse(renderNotFoundPage(), request, { status: 404, canonicalPath: "/404" });
  }
  return renderedResponse(renderColdEmailVsPage(agency), request, { canonicalPath: coldEmailVsPath(agency) });
}
