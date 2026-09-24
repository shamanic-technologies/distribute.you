import { renderedResponse } from "@/lib/static-html";
import { renderAssistantPage } from "@/lib/pages/assistant";

export const revalidate = 86400;

// A candidate homepage testing a different value proposition. Not indexed, not in
// the sitemap, linked from nowhere until it is put into an A/B test against `/`.
export async function GET(request: Request) {
  return renderedResponse(renderAssistantPage(), request);
}
