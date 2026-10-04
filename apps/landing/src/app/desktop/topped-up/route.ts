import { renderedResponse } from "@/lib/static-html";
import { renderDesktopToppedUpPage } from "@/lib/pages/desktop";

export const revalidate = 86400;

// Stripe's return page for a top-up started in the Mac app.
export async function GET(request: Request) {
  return renderedResponse(renderDesktopToppedUpPage(), request);
}
