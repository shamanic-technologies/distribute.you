import { renderedResponse } from "@/lib/static-html";
import { renderNotFoundPage } from "@/lib/pages/not-found";
import { renderCsVsPage } from "@/lib/pages/customer-success-agency-compare";
import { CS_AGENCIES, csAgencyBySlug, csVsPath } from "@/lib/customer-success-agencies";

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return CS_AGENCIES.map((a) => ({ slug: a.slug }));
}

/** One page per provider in the customer success cluster; any other slug is the ordinary 404. */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const agency = csAgencyBySlug(slug);
  if (!agency) {
    return renderedResponse(renderNotFoundPage(), request, { status: 404, canonicalPath: "/404" });
  }
  return renderedResponse(renderCsVsPage(agency), request, { canonicalPath: csVsPath(agency) });
}
