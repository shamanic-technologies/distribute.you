import { NextResponse } from "next/server";
import { startDestination } from "@/lib/start-destination";

/**
 * `/start` is the landing's way in (it links here from several places and a
 * shared link keeps resolving). It hands the visitor to onboarding v2
 * (`/get-started`), except the subscription arm, which keeps `/onboarding`
 * (`lib/start-destination.ts` says why). The query string rides along (`?url=` is
 * how the landing hands over the website).
 *
 * 307, not 308: the target depends on the visitor's cookie, so the browser must
 * not cache it as permanent.
 *
 * A RELATIVE Location on purpose: `request.url` on a self-hosted Next server is
 * the address the process binds to (`http://0.0.0.0:3000/...`), not the host the
 * visitor typed, so an absolute redirect built from it points at the container.
 */
export function GET(request: Request) {
  const search = new URL(request.url).search;
  const target = startDestination(request.headers.get("cookie"));
  return new NextResponse(null, { status: 307, headers: { Location: `${target}${search}` } });
}
