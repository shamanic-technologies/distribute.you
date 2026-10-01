import { renderedResponse } from "@/lib/static-html";
import { renderInstinctPage } from "@/lib/pages/instinct";

export const revalidate = 86400;

// The instinct.com-style candidate. Not indexed, not in the sitemap; served at `/` to
// its share of the homepage A/B test.
export async function GET(request: Request) {
  return renderedResponse(renderInstinctPage(), request);
}
