import { staticResponse } from "@/lib/static-html";

// /v3 — ARCHIVE (non-indexed): the offer-argument homepage that served `/` from
// #3051 until the lab landing replaced it. Kept served rather than deleted for
// two reasons: it is the ONLY page that carries the live-figure machinery
// (`__CAC_PRICE__`, `__HERO_CONSOLE__`, the ROI calculator and segment-cost
// tokens), so removing it would make that whole surface dead code; and a
// CI-gated dashboard guard pins its path.
export const revalidate = 86400;

export async function GET(request: Request) {
  const res = await staticResponse("index-v1.html", request);
  const headers = new Headers(res.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow");
  return new Response(res.body, { status: res.status, headers });
}
