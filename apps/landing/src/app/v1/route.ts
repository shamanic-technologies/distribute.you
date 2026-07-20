import { staticResponse } from "@/lib/static-html";

// /v1 — ARCHIVE (non-indexed): the multicolor/beige pre-agency homepage,
// the design that ran before Adam's illustrated agency version (#1691).
// Self-contained snapshot (era CSS + nav inlined) so it renders faithfully
// despite the shared assets since being reskinned to the green charter.
export const revalidate = 300;

export async function GET() {
  const res = await staticResponse("archive-beige.html");
  const headers = new Headers(res.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow");
  return new Response(res.body, { status: res.status, headers });
}
