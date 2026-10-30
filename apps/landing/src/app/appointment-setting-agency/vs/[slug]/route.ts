import { renderedResponse } from "@/lib/static-html";
import { renderNotFoundPage } from "@/lib/pages/not-found";
import { renderAppointmentVsPage } from "@/lib/pages/appointment-setting-agency-compare";
import { APPOINTMENT_AGENCIES, appointmentAgencyBySlug, appointmentVsPath } from "@/lib/appointment-setting-agencies";

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return APPOINTMENT_AGENCIES.map((a) => ({ slug: a.slug }));
}

/** One page per agency in the appointment setting cluster; any other slug is the ordinary 404. */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const agency = appointmentAgencyBySlug(slug);
  if (!agency) {
    return renderedResponse(renderNotFoundPage(), request, { status: 404, canonicalPath: "/404" });
  }
  return renderedResponse(renderAppointmentVsPage(agency), request, { canonicalPath: appointmentVsPath(agency) });
}
