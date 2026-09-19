import { NextResponse } from "next/server";

/**
 * `/start` IS `/onboarding` now. The three sell-first screens (goal, path,
 * results) are the wizard's own first steps, so the route that hosted them on
 * their own is a redirect — the landing links here from five places and a
 * shared link keeps resolving. The query string rides along (`?url=` is how the
 * landing hands over the website).
 *
 * A RELATIVE Location on purpose: `request.url` on a self-hosted Next server is
 * the address the process binds to (`http://0.0.0.0:3000/...`), not the host the
 * visitor typed, so an absolute redirect built from it points at the container.
 */
export function GET(request: Request) {
  const search = new URL(request.url).search;
  return new NextResponse(null, { status: 308, headers: { Location: `/onboarding${search}` } });
}
