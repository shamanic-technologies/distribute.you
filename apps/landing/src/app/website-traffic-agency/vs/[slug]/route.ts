import { renderedResponse } from "@/lib/static-html";
import { renderNotFoundPage } from "@/lib/pages/not-found";
import { renderTrafficAgencyVsPage } from "@/lib/pages/website-traffic-agency-compare";
import { TRAFFIC_AGENCIES, trafficAgencyBySlug, trafficAgencyVsPath } from "@/lib/traffic-agencies";

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return TRAFFIC_AGENCIES.map((a) => ({ slug: a.slug }));
}

/** One page per agency in `traffic-agencies.ts`; any other slug is the ordinary 404. */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const agency = trafficAgencyBySlug(slug);
  if (!agency) {
    return renderedResponse(renderNotFoundPage(), request, { status: 404, canonicalPath: "/404" });
  }
  return renderedResponse(renderTrafficAgencyVsPage(agency), request, { canonicalPath: trafficAgencyVsPath(agency) });
}
