import { renderedResponse } from "@/lib/static-html";
import { renderDesktopPage } from "@/lib/pages/desktop";

export const revalidate = 86400;

// distribute for Mac, private beta. Not linked from the main landing, not in the
// sitemap, noindex (owner-decided 2026-10-04).
export async function GET(request: Request) {
  return renderedResponse(renderDesktopPage(), request);
}
