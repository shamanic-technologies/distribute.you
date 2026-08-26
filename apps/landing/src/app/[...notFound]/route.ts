import { staticResponse } from "@/lib/static-html";

/**
 * Catch-all 404 for every unmatched path.
 *
 * A route handler rather than `not-found.tsx` because the body has to be
 * negotiated: a human needs a designed page in the landing's own look, and an
 * agent asking for `text/markdown` needs a short list of where to look next.
 * `not-found.tsx` cannot read the request's `Accept` header without opting the
 * whole root segment into dynamic rendering, and it still exists for the
 * `notFound()` calls made from inside a page.
 *
 * This segment is the least specific match in the tree, so every real route
 * (including `/blog/[slug]`) still wins. `public/` files are served before
 * routing, so `/robots.txt` and `/llms.txt` are unaffected.
 */
export function GET(request: Request) {
  return staticResponse("404.html", request, { status: 404, canonicalPath: "/404" });
}
