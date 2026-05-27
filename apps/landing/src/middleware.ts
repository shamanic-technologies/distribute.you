import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  INVITE_COOKIE_NAME,
  INVITE_COOKIE_MAX_AGE_SECONDS,
  isValidInviteSlug,
  resolveCookieDomain,
} from "@/lib/invite-cookie";

/**
 * Captures `?invite=<slug>` query param into a long-lived cookie on any page.
 *
 * Behaviour:
 *  - New `?invite=` value overwrites any existing cookie.
 *  - Cookie survives navigation across all distribute.you pages.
 *  - Survives Clerk subdomain redirects via `.distribute.you` domain.
 *  - Skipped for static / image / API routes.
 */
export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const inviteParam = url.searchParams.get("invite");

  if (!inviteParam) {
    return NextResponse.next();
  }

  const normalised = inviteParam.trim().toLowerCase();

  if (!isValidInviteSlug(normalised)) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.cookies.set({
    name: INVITE_COOKIE_NAME,
    value: normalised,
    domain: resolveCookieDomain(req.headers.get("host")),
    maxAge: INVITE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    secure: req.nextUrl.protocol === "https:",
  });
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     *  - api routes
     *  - _next static and image
     *  - favicon and common public assets
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
