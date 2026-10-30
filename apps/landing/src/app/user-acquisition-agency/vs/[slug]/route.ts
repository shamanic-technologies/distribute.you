import { renderedResponse } from "@/lib/static-html";
import { renderNotFoundPage } from "@/lib/pages/not-found";
import { renderUaVsPage } from "@/lib/pages/user-acquisition-agency-compare";
import { UA_AGENCIES, uaAgencyBySlug, uaVsPath } from "@/lib/user-acquisition-agencies";

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return UA_AGENCIES.map((a) => ({ slug: a.slug }));
}

/** One page per agency in the user acquisition cluster; any other slug is the ordinary 404. */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const agency = uaAgencyBySlug(slug);
  if (!agency) {
    return renderedResponse(renderNotFoundPage(), request, { status: 404, canonicalPath: "/404" });
  }
  return renderedResponse(renderUaVsPage(agency), request, { canonicalPath: uaVsPath(agency) });
}
