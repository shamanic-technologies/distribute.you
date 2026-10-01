import { NextResponse } from "next/server";

/**
 * `/start` is the landing's way in (it links here from several places and a
 * shared link keeps resolving). It opens onboarding v2, `/get-started` (owner
 * 2026-10-01), for every visitor, the $99/month arm included; `/onboarding` (v1)
 * stays served for direct links. The query string rides along (`?url=` is how the
 * landing hands over the website).
 *
 * 307, not 308: a permanent redirect is cached by the browser, and this one may
 * move again.
 *
 * A RELATIVE Location on purpose: `request.url` on a self-hosted Next server is
 * the address the process binds to (`http://0.0.0.0:3000/...`), not the host the
 * visitor typed, so an absolute redirect built from it points at the container.
 */
export function GET(request: Request) {
  const search = new URL(request.url).search;
  return new NextResponse(null, { status: 307, headers: { Location: `/get-started${search}` } });
}
