import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  lastBrandCookieName,
  matchOrgLanding,
  matchBrandPath,
  hasExplicitHierarchyIntent,
} from "@/lib/last-brand";
import { isAdminEmail } from "@/lib/admin-allowlist";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sso-callback(.*)",
  "/claim(.*)",
  "/report(.*)",
  "/api/public(.*)",
  "/api/cron(.*)",
]);

const isAuthRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/claim(.*)",
]);

// Routes the first-run gate must NOT redirect: the onboarding flow itself and
// every API route (the onboarding / brand-create flow calls /api/* — redirecting
// those to an HTML page would break the fetch).
const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)"]);
const isApiRoute = createRouteMatcher(["/api(.*)"]);

export default clerkMiddleware(
  async (auth, req) => {
    const { userId, sessionClaims } = await auth();
    const pathname = req.nextUrl.pathname;

    // Admin allowlist gate — refuse any signed-in non-staff user. Public/auth
    // routes stay open so allowed users can reach sign-in; unauth users fall
    // through to the standard sign-in redirect below.
    if (userId && !isPublicRoute(req)) {
      if (!isAdminEmail(sessionClaims?.email)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const isExplicitDashboardRoot =
      pathname === "/" && hasExplicitHierarchyIntent(req.nextUrl.searchParams);

    // Redirect authenticated users away from auth pages
    if (isAuthRoute(req) && userId) {
      return NextResponse.redirect(new URL("/orgs", req.url));
    }

    // `/?view=overview` is the dashboard hierarchy intent emitted by the
    // authed header logo. Treat it as dashboard navigation, not as the public
    // build-in-public metrics page, so first-run users hit onboarding pre-paint.
    if (userId && isExplicitDashboardRoot) {
      if (sessionClaims?.orgMeta?.onboardingComplete !== true) {
        return NextResponse.redirect(new URL("/onboarding", req.url));
      }
      const orgsUrl = new URL("/orgs", req.url);
      orgsUrl.search = req.nextUrl.search;
      return NextResponse.redirect(orgsUrl);
    }

    // Protect non-public routes
    if (!isPublicRoute(req) && !userId) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }

    // First-run gate (DIS-111). Decided at the edge from a session-token claim
    // (`org.public_metadata.onboardingComplete`, surfaced as `orgMeta`), so the
    // onboarding redirect happens pre-paint with zero data fetch — no dashboard
    // flash, no coupling to the (slow) brands API. A brand-less / org-less user
    // has no `onboardingComplete: true` claim → routed to onboarding.
    // Exempt: public/auth routes, the onboarding flow itself, all API routes,
    // and the `?autoCreate` brand-creation hop (the org is transiently
    // brand-less while it creates its first brand + sets the flag).
    if (
      userId &&
      !isPublicRoute(req) &&
      !isOnboardingRoute(req) &&
      !isApiRoute(req) &&
      !req.nextUrl.searchParams.has("autoCreate") &&
      sessionClaims?.orgMeta?.onboardingComplete !== true
    ) {
      return NextResponse.redirect(new URL("/onboarding", req.url));
    }

    // "Land on last-visited brand" — READ side. On a bare `/orgs/:orgId`,
    // redirect pre-paint to the last brand opened in that org (remembered in
    // the org-scoped cookie below). Zero flash, zero data fetch — same edge
    // pattern as the onboarding gate. A stale cookie (brand later deleted)
    // lands on the brand page's "Brand not found" recovery state (it links back
    // to the brand list), mirroring Clerk's invalid-active-org handling. The
    // no-cookie / single-brand cases are resolved client-side on the org page
    // (the edge can't count brands without a fetch). Skip during the
    // `?autoCreate` brand-creation hop.
    if (
      userId &&
      !req.nextUrl.searchParams.has("autoCreate") &&
      !hasExplicitHierarchyIntent(req.nextUrl.searchParams)
    ) {
      const landing = matchOrgLanding(pathname);
      if (landing) {
        const lastBrand = req.cookies.get(
          lastBrandCookieName(landing.orgId),
        )?.value;
        if (lastBrand) {
          return NextResponse.redirect(
            new URL(`/orgs/${landing.orgId}/brands/${lastBrand}`, req.url),
          );
        }
      }
    }

    const res = NextResponse.next();

    // "Land on last-visited brand" — WRITE side. On any brand URL, remember it
    // as this org's last brand so the next bare-org visit lands here. httpOnly
    // (only the edge reads it), org-scoped, 1 year. `secure` only in prod so the
    // cookie persists over http on localhost.
    if (userId) {
      const brandPath = matchBrandPath(pathname);
      if (brandPath) {
        res.cookies.set(
          lastBrandCookieName(brandPath.orgId),
          brandPath.brandId,
          {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 365,
          },
        );
      }
    }

    return res;
  },
  {
    // URL [orgId] segment is the source of truth for Clerk's active org.
    // When the URL and Clerk's active org disagree, Clerk auto-setActives to the URL id
    // (or redirects if the user is not a member). Prevents the dashboard from issuing
    // API calls under a stale active org after navigation or tab switching.
    organizationSyncOptions: {
      organizationPatterns: ["/orgs/:id", "/orgs/:id/(.*)"],
    },
  },
);

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
