import { renderedResponse } from "@/lib/static-html";
import { renderNotFoundPage } from "@/lib/pages/not-found";
import { renderLeadgenVsPage } from "@/lib/pages/lead-generation-agency-compare";
import { LEADGEN_AGENCIES, leadgenAgencyBySlug, leadgenVsPath } from "@/lib/lead-generation-agencies";

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return LEADGEN_AGENCIES.map((a) => ({ slug: a.slug }));
}

/** One page per agency in the lead generation cluster; any other slug is the ordinary 404. */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const agency = leadgenAgencyBySlug(slug);
  if (!agency) {
    return renderedResponse(renderNotFoundPage(), request, { status: 404, canonicalPath: "/404" });
  }
  return renderedResponse(renderLeadgenVsPage(agency), request, { canonicalPath: leadgenVsPath(agency) });
}
