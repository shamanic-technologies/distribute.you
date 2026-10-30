import { renderedResponse } from "@/lib/static-html";
import { fetchIndexList } from "@/lib/fleet-indexes";
import { renderAppointmentSettingAgencyPage } from "@/lib/pages/appointment-setting-agency";

// Literal (Next reads it statically): the indexes and the client counts record a new day every hour.
export const revalidate = 1800;

/**
 * The Appointment Setting Agency page (Meetings Booked, Agency buyer, PAGE-APPOINTMENT-AGENCY-1030).
 * The index list drops its own section on failure; the meeting price, the ROI and the client
 * cards are resolved by `renderedResponse`. The page itself always renders.
 */
export async function GET(request: Request) {
  const list = await fetchIndexList();
  return renderedResponse(renderAppointmentSettingAgencyPage(list), request, {
    canonicalPath: "/appointment-setting-agency",
    sMaxAge: list ? 1800 : 60,
  });
}
