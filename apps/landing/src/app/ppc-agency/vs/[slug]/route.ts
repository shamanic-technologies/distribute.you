import { renderedResponse } from "@/lib/static-html";
import { renderNotFoundPage } from "@/lib/pages/not-found";
import { renderPpcVsPage } from "@/lib/pages/ppc-agency-compare";
import { PPC_AGENCIES, ppcAgencyBySlug, ppcVsPath } from "@/lib/ppc-agencies";

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return PPC_AGENCIES.map((a) => ({ slug: a.slug }));
}

/** One page per agency in the PPC cluster; any other slug is the ordinary 404. */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const agency = ppcAgencyBySlug(slug);
  if (!agency) {
    return renderedResponse(renderNotFoundPage(), request, { status: 404, canonicalPath: "/404" });
  }
  return renderedResponse(renderPpcVsPage(agency), request, { canonicalPath: ppcVsPath(agency) });
}
