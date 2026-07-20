import { staticResponse } from "@/lib/static-html";

// /v2 — ARCHIVE (non-indexed): Adam's last agency homepage (light indigo/blue),
// the exact state of `/` the moment before the green landing took over (#2595).
// Self-contained snapshot (era CSS + nav inlined) so it renders faithfully
// despite the shared assets since being reskinned to the green charter (#2611).
export const revalidate = 300;

export async function GET() {
  const res = await staticResponse("archive-blue.html");
  const headers = new Headers(res.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow");
  return new Response(res.body, { status: res.status, headers });
}
