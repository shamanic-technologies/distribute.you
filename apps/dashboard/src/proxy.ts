import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  lastBrandCookieName,
  matchOrgLanding,
  matchBrandPath,
  hasExplicitHierarchyIntent,
} from "@/lib/last-brand";
import { landingHref } from "@/lib/landing-drilldown";
import {
  onboardingBrandCookieName,
  onboardingResumeHref,
} from "@/lib/onboarding-brand-cookie";
import {
  UI_VERSION_COOKIE,
  parseUiVersion,
  v2PathForV1,
  stripV2Prefix,
  v2DashboardHref,
} from "@/lib/ui-version";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/forgot-password(.*)",
  "/sso-callback(.*)",
  "/claim(.*)",
  // The sell-first half of onboarding. It runs BEFORE signup by design: a
  // visitor picks the outcomes they want to buy, and only then makes an account. Behind the auth gate it
  // would be a screen nobody in the market can reach.
  "/start(.*)",
  // The BUILD half, which now runs before signup too: a visitor walks their own
  // services, audiences and offer, and sees what we assembled,
  // before being asked for an account or a card. It spends against an anonymous
  // org through `/api/anon/*`, which carries its own signed session and its own
  // allowlist — this entry only decides that the SCREEN is reachable.
  //
  // EXACT, not a prefix: `/onboarding/claim` needs the account to exist and stays
  // behind the gate. A `(.*)` here would open it.
  "/onboarding",
  "/api/public(.*)",
  "/api/anon(.*)",
  "/api/cron(.*)",
]);

const isAuthRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/forgot-password(.*)",
  "/claim(.*)",
]);
const isSessionTaskRoute = createRouteMatcher([
  "/session-tasks(.*)",
]);

// Routes the first-run gate must NOT redirect: the onboarding flow itself and
// every API route (the onboarding / brand-create flow calls /api/* — redirecting
// those to an HTML page would break the fetch).
const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)"]);
const isApiRoute = createRouteMatcher(["/api(.*)"]);

export default clerkMiddleware(
  async (auth, req) => {
    const { userId, orgId, sessionClaims, sessionStatus } = await auth();
    const pathname = req.nextUrl.pathname;

    // Where an unfinished onboarding resumes. The wizard's own progress lives in
    // sessionStorage, so it is gone the moment the tab closes — but the brand it
    // created is still in brand-service, and `/onboarding?brandId=` re-hydrates
    // everything from there (services, offer) and lands on the picks. Without the brand id the flow can only start over at
    // the welcome screen, which is what a user who left at the budget step used to
    // get. Org-scoped cookie, so a brand abandoned under one org never resumes
    // inside another (onboarding can create a brand-new org).
    const onboardingHref = (): string => {
      const inProgressBrand = orgId
        ? req.cookies.get(onboardingBrandCookieName(orgId))?.value
        : undefined;
      if (inProgressBrand) return onboardingResumeHref(inProgressBrand);
      return "/onboarding";
    };
    const isExplicitDashboardRoot =
      pathname === "/" && hasExplicitHierarchyIntent(req.nextUrl.searchParams);

    // Clerk keeps users in a pending session when personal accounts are
    // disabled and an org still needs to be chosen. Let only pending sessions
    // reach the task UI; signed-out users go to auth and active users go home.
    if (isSessionTaskRoute(req)) {
      if (sessionStatus === "pending") {
        return NextResponse.next();
      }
      return NextResponse.redirect(
        new URL(userId ? "/orgs" : "/sign-in", req.url),
      );
    }

    // Redirect authenticated users away from auth pages
    if (isAuthRoute(req) && userId) {
      return NextResponse.redirect(new URL("/orgs", req.url));
    }

    // `/?view=overview` is the dashboard hierarchy intent emitted by the authed
    // header logo. Resolve it at the edge so first-run users hit onboarding
    // pre-paint and everyone else lands on /orgs with their search preserved
    // (the root page itself is now a bare redirect to /orgs).
    if (userId && isExplicitDashboardRoot) {
      if (sessionClaims?.orgMeta?.onboardingComplete !== true) {
        return NextResponse.redirect(new URL(onboardingHref(), req.url));
      }
      const orgsUrl = new URL("/orgs", req.url);
      orgsUrl.search = req.nextUrl.search;
      return NextResponse.redirect(orgsUrl);
    }

    // Protect non-public routes
    if (!isPublicRoute(req) && !userId) {
      if (sessionStatus === "pending") {
        return NextResponse.redirect(
          new URL("/session-tasks/choose-organization", req.url),
        );
      }
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
      return NextResponse.redirect(new URL(onboardingHref(), req.url));
    }

    // Dashboard v2 is the default for every signed-in user. A user on v2 lands on v2 from the first frame:
    // the choice is a cookie so it survives a reload and a new sign-in, and it is
    // read HERE, pre-paint, rather than by a client redirect that would flash v1.
    // Every v1 brand page has a v2 twin now (`v2PathForV1`), so a v2 user is never
    // sent back to v1 by a link, a `router.push` or a typed URL — including the
    // links inside the v1 business components v2 embeds. The bare org lands on the
    // last brand. The only way into v1 is the "Back to v1" switch, which flips the
    // cookie to `v1` first; nothing else sends anyone back to v1.
    const wantsV2 =
      !!userId &&
      parseUiVersion(req.cookies.get(UI_VERSION_COOKIE)?.value) === "v2" &&
      !req.nextUrl.searchParams.has("autoCreate") &&
      !hasExplicitHierarchyIntent(req.nextUrl.searchParams);
    if (wantsV2) {
      const v2Path = v2PathForV1(pathname, req.nextUrl.search, {
        lastBrand: (org) => req.cookies.get(lastBrandCookieName(org))?.value,
        activeOrgId: orgId ?? null,
      });
      if (v2Path) return NextResponse.redirect(new URL(v2Path, req.url));
      const landing = matchOrgLanding(pathname);
      const lastBrand = landing
        ? req.cookies.get(lastBrandCookieName(landing.orgId))?.value
        : undefined;
      if (landing && lastBrand) {
        return NextResponse.redirect(new URL(v2DashboardHref(landing.orgId, lastBrand), req.url));
      }
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
          // The marker says the hierarchy is still being RESOLVED, not that this is the
          // destination: the brand page reads its offers and, if the brand sells exactly
          // one, hands the landing down to it. Gated on the marker so no ordinary link into a
          // brand ever bounces — see `lib/landing-drilldown.ts`.
          return NextResponse.redirect(
            new URL(
              landingHref(`/orgs/${landing.orgId}/brands/${lastBrand}`),
              req.url,
            ),
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
      // A v2 brand URL is the same brand, so it refreshes the same memory.
      const brandPath = matchBrandPath(stripV2Prefix(pathname));
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
      organizationPatterns: ["/orgs/:id", "/orgs/:id/(.*)", "/v2/orgs/:id", "/v2/orgs/:id/(.*)"],
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
