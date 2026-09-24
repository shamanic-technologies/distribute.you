import { renderedResponse } from "@/lib/static-html";
import { renderConciergePage } from "@/lib/pages/concierge";

export const dynamic = "force-dynamic";

// The concierge candidate (message the AI assistant, no app). Not indexed, not in the
// sitemap; served at `/` to its share of the homepage A/B test.
export async function GET(request: Request) {
  return renderedResponse(renderConciergePage(), request);
}
