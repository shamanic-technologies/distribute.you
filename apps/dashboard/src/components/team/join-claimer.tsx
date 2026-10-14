"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useClerk } from "@clerk/nextjs";
import posthog from "posthog-js";
import { clearJoinCookieAssignment, readJoinCookie } from "@/lib/org-invite";
import { withTimeout } from "@/lib/with-timeout";

/** Each Clerk leg of opening the joined org is bounded (same budget as an org switch). */
const JOIN_ACTIVATE_TIMEOUT_MS = 15_000;

type Clerk = ReturnType<typeof useClerk>;
type Router = ReturnType<typeof useRouter>;

/**
 * Join the org an invite link names, then open it. Shared by the `/join` page (the
 * person is already signed in when they open the link) and `JoinClaimer` (they signed
 * in or signed up after opening it, and landed somewhere else).
 *
 * Returns true when the attempt is over (joined, or the link is dead), false when it
 * failed in a way worth retrying on the next page.
 */
export async function claimJoin(token: string, clerk: Clerk, router: Router): Promise<boolean> {
  const res = await fetch("/api/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const body = (await res.json().catch(() => null)) as { orgId?: string; error?: string; code?: string } | null;
  if (res.status === 409 && body?.code === "team_full") {
    // Every seat is taken: no retry can fix it, so drop the link and say so.
    document.cookie = clearJoinCookieAssignment();
    posthog.capture("team_join_failed", { status: res.status, code: "team_full" });
    router.replace(`/join/${encodeURIComponent(token)}?error=full`);
    return true;
  }
  if (res.status === 404 || res.status === 410) {
    // The link itself is dead (revoked, or never valid): drop it and say so.
    document.cookie = clearJoinCookieAssignment();
    posthog.capture("team_join_failed", { status: res.status });
    router.replace(`/join/${encodeURIComponent(token)}?error=revoked`);
    return true;
  }
  if (!res.ok || !body?.orgId) {
    // Anything else is ours or transient: keep the cookie so the next page retries.
    console.error("[join] claim failed", res.status, body);
    posthog.capture("team_join_failed", { status: res.status });
    return false;
  }
  document.cookie = clearJoinCookieAssignment();
  posthog.capture("team_join_completed");
  await openJoinedOrg(body.orgId, clerk);
  return true;
}

/**
 * Make the joined org the session's active org, then open it with ONE full page load.
 *
 * Never `clerk.setActive` + a soft navigation here. A person who just signed in or up
 * through the link has a PENDING session (no org yet), and clerk-js `setActive`
 * decides its task redirect from the session as it was BEFORE the switch: it still
 * soft-navigates to the choose-organization task (which the edge 307s to `/v2`),
 * Clerk's Next provider adds a `router.refresh()`, and our own navigation makes three
 * concurrent App Router navigations. Next then takes its full-page-navigation branch
 * mid-render and crashes on React #310 ("This page couldn't load"; prod 2026-10-14,
 * a reload always worked). Touching the session posts the org to Clerk and mints a
 * token that carries it, without any of that routing, and the full load is then the
 * only navigation. A full load alone cannot do it: the edge does not activate an org
 * for a pending session, it sends it to the task page.
 *
 * The join has already succeeded, so a failed activation is logged and the org is
 * opened anyway (the edge activates it from the URL for an active session).
 */
async function openJoinedOrg(orgId: string, clerk: Clerk): Promise<void> {
  const dest = `/orgs/${encodeURIComponent(orgId)}`;
  try {
    // The membership was created server-side: let the browser's user know it first.
    if (clerk.user) await withTimeout(clerk.user.reload(), JOIN_ACTIVATE_TIMEOUT_MS, "Reloading your account");
    const session = clerk.session;
    if (session) {
      session.lastActiveOrganizationId = orgId;
      await withTimeout(session.touch({ intent: "select_org" }), JOIN_ACTIVATE_TIMEOUT_MS, "Opening the team");
      await withTimeout(session.getToken({ skipCache: true }), JOIN_ACTIVATE_TIMEOUT_MS, "Opening the team");
    }
  } catch (err) {
    console.error("[join] activating the joined org failed, opening it with a full load anyway", err);
    posthog.capture("team_join_activate_fallback");
  }
  window.location.assign(dest);
}

/**
 * Finishes a join started on `/join/<token>` on whatever authed page the person
 * reaches once signed in (sign-up, sign-in and Google each land somewhere different,
 * often the choose-organization task). Mounted once in the authed layout; does nothing
 * without the cookie, and nothing on `/join` itself, which claims on its own.
 *
 * Re-checks on every navigation: the cookie is written by the page, whose effect runs
 * AFTER this one, so a single check at mount would never see it.
 */
export function JoinClaimer() {
  const { isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const clerk = useClerk();
  const router = useRouter();
  const pathname = usePathname();
  const running = useRef(false);

  useEffect(() => {
    if (!isSignedIn || running.current || pathname.startsWith("/join")) return;
    const token = readJoinCookie(document.cookie);
    if (!token) return;
    running.current = true;
    void claimJoin(token, clerk, router)
      .catch((err) => {
        console.error("[join] claim failed", err);
        return false;
      })
      .then((done) => {
        if (!done) running.current = false;
      });
  }, [isSignedIn, clerk, router, pathname]);

  return null;
}
