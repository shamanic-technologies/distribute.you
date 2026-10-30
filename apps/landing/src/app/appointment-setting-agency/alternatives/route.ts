import { renderedResponse } from "@/lib/static-html";
import { renderAppointmentAlternativesPage } from "@/lib/pages/appointment-setting-agency-compare";

export const revalidate = 86400;

export async function GET(request: Request) {
  return renderedResponse(renderAppointmentAlternativesPage(), request, { canonicalPath: "/appointment-setting-agency/alternatives" });
}
