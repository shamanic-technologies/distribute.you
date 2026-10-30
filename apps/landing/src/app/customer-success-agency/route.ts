import { renderedResponse } from "@/lib/static-html";
import { renderCustomerSuccessAgencyPage } from "@/lib/pages/customer-success-agency";

export const revalidate = 86400;

/**
 * The Customer Success Agency page (Customer Success, Agency buyer, PAGE-CUSTOMER-SUCCESS-AGENCY-1030).
 * No live read: no index measures this leg yet, so the page states no figure of ours.
 */
export async function GET(request: Request) {
  return renderedResponse(renderCustomerSuccessAgencyPage(), request, { canonicalPath: "/customer-success-agency" });
}
