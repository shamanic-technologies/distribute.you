import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { lastBrandCookieName, matchBrandPath } from "@/lib/last-brand";
import { v2PathForV1, stripV2Prefix } from "@/lib/ui-version";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/forgot-password(.*)",
  "/sso-callback(.*)",
  "/claim(.*)",
  // Where an organization invitation email lands. Reachable signed OUT (the ticket
  // creates the account or signs it in) and signed IN (the account accepts it), so it
  // is public but NOT an auth route: an auth route bounces a signed-in visitor away.
  "/invite(.*)",
  // A team's shareable invite link, and the join it finishes. `/api/join` is public
  // because a brand-new account is a PENDING session (no org yet), which the gate
  // below would bounce to the choose-organization task; the route checks its own auth.
  "/join(.*)",
  "/api/join",
  // The sell-first half of onboarding. It runs BEFORE signup by design: a
  // visitor picks the outcomes they want to buy, and only then makes an account. Behind the auth gate it
  // would be a screen nobody in the market can reach.
  "/start(.*)",
  // The old onboarding URL: it only redirects now (to `/get-started` signed out, the
  // org page signed in), and a signed-out visitor must reach that redirect.
  // EXACT, not a prefix: `/onboarding/claim` needs the account to exist and stays
  // behind the gate. A `(.*)` here would open it.
  "/onboarding",
  // The signup flow (owner 2026-10-04: the only one). It runs before signup on an
  // anonymous org through `/api/anon/*`, which carries its own signed session and its
  // own allowlist: this entry only decides that the SCREEN is reachable. EXACT.
  "/get-started",
  // distribute for Mac's browser sign-in. Public so the first-run gate cannot bounce
  // it to onboarding (DesktopConnectResume would bounce it back: a loop); the page
  // sends a signed-out visitor to /sign-in itself. EXACT.
  "/desktop/connect",
  "/api/public(.*)",
  "/api/anon(.*)",
  "/api/cron(.*)",
  // Service-to-service reads (social-service): no Clerk session, each route checks the
  // `x-api-key` service key itself (lib/service-key.ts).
  "/api/internal(.*)",
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

    // Where an unfinished setup resumes: the org page, which offers the org's brand
    // under "Finish setup" (the brand walk, ending on "Choose your plan"), or
    // "Add a brand" when it has none. It is exempt from this gate below, so no loop.
    // No org at all (an active session normally has one; a pending one is handled
    // above): `/get-started`, public, never an automatic redirect back here.
    const onboardingHref = (): string =>
      orgId ? `/v2/orgs/${encodeURIComponent(orgId)}` : "/get-started";

    // Clerk keeps users in a pending session when personal accounts are
    // disabled and an org still needs to be chosen. Let only pending sessions
    // reach the task UI; signed-out users go to auth and active users go home.
    if (isSessionTaskRoute(req)) {
      if (sessionStatus === "pending") {
        return NextResponse.next();
      }
      return NextResponse.redirect(
        new URL(userId ? "/v2" : "/sign-in", req.url),
      );
    }

    // Redirect authenticated users away from auth pages
    if (isAuthRoute(req) && userId) {
      return NextResponse.redirect(new URL("/v2", req.url));
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
    // Exempt: public/auth routes, the onboarding flow itself, all API routes.
    //
    // Exempt too: the bare ORG page (`/orgs/:id`, `/v2/orgs/:id`). An org with no
    // brand yet (a new org whose brand walk was closed) lands on the v2 org page,
    // which offers "Add a brand" (the brand walk). Sending
    // it to the full-page onboarding instead is what this replaces. Every other path
    // of such an org is still gated, except its brand walk (`/v2/orgs/:id/new-brand`):
    // a new org's first brand is set up there, and only its launch marks the org set up.
    const v2OrgRoot = /^(\/v2)?\/orgs\/[^/]+\/?$/.test(pathname);
    const v2BrandWalk = /^\/v2\/orgs\/[^/]+\/new-brand\/?$/.test(pathname);
    if (
      userId &&
      !isPublicRoute(req) &&
      !isOnboardingRoute(req) &&
      !isApiRoute(req) &&
      !v2OrgRoot &&
      !v2BrandWalk &&
      sessionClaims?.orgMeta?.onboardingComplete !== true
    ) {
      return NextResponse.redirect(new URL(onboardingHref(), req.url));
    }

    // v1 is gone (git history has it). Its URLs still arrive (sent emails, bookmarks,
    // Stripe returns, links inside the shared components v2 embeds), so every one is
    // redirected to its v2 page HERE, pre-paint. The bare org lands on v2's org page,
    // which reads the last-brand cookie itself.
    if (userId) {
      const v2Path = v2PathForV1(pathname, req.nextUrl.search, {
        lastBrand: (org) => req.cookies.get(lastBrandCookieName(org))?.value,
        activeOrgId: orgId ?? null,
      });
      if (v2Path) return NextResponse.redirect(new URL(v2Path, req.url));
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
