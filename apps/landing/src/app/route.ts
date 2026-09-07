import { staticResponse } from "@/lib/static-html";

export const revalidate = 86400;

// The homepage. `index-v2.html` was authored in the lab beside the competitor
// clones it borrows from (`lab-distribute.distribute.you`, retired with this
// promote) and served raw bytes there — no analytics, no canonical, noindex.
// Served here it goes through the whole pipeline instead: the charter favicon,
// the GA4 + Google Ads + PostHog + Partnero head, one Organization JSON-LD, and
// `Accept: text/markdown` negotiation. The previous homepage is archived at /v3.
export function GET(request: Request) {
  return staticResponse("index-v2.html", request);
}
