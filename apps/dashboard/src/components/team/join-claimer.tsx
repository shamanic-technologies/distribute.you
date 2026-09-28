"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useClerk } from "@clerk/nextjs";
import posthog from "posthog-js";
import { clearJoinCookieAssignment, readJoinCookie } from "@/lib/org-invite";

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
  const body = (await res.json().catch(() => null)) as { orgId?: string; error?: string } | null;
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
  const dest = `/orgs/${encodeURIComponent(body.orgId)}`;
  // The membership was just created SERVER-side, and the browser's session does not
  // know it yet, so a bare setActive is refused as "not a member". Reload the user
  // first; if the switch is still refused, a full page load of the org lets the edge
  // activate it from the URL. The join has already succeeded either way, so neither
  // path may surface as a failure.
  try {
    await clerk.user?.reload();
    await clerk.setActive({ organization: body.orgId });
    router.replace(dest);
  } catch (err) {
    console.error("[join] setActive after join refused, opening the org with a full load", err);
    posthog.capture("team_join_activate_fallback");
    window.location.assign(dest);
  }
  return true;
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
