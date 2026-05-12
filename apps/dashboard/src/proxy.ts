import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sso-callback(.*)",
  "/claim(.*)",
]);

const isAuthRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/claim(.*)",
]);

export default clerkMiddleware(
  async (auth, req) => {
    const { userId } = await auth();

    // Redirect authenticated users away from auth pages
    if (isAuthRoute(req) && userId) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // Protect non-public routes
    if (!isPublicRoute(req) && !userId) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }

    return NextResponse.next();
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
