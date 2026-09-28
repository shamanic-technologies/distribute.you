"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useClerk } from "@clerk/nextjs";
import posthog from "posthog-js";
import { clearJoinCookieAssignment, readJoinCookie } from "@/lib/org-invite";

/**
 * Finishes a join started on `/join/<token>`, on whatever authed page the person
 * reaches once they are signed in (the sign-up / sign-in / Google flows each land
 * somewhere different, often the choose-organization task). Mounted once in the
 * authed layout; does nothing without the cookie.
 *
 * A pending session counts: somebody who just created an account has no org yet,
 * which is exactly the case this exists for.
 */
export function JoinClaimer() {
  const { isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const clerk = useClerk();
  const router = useRouter();
  const running = useRef(false);

  useEffect(() => {
    if (!isSignedIn || running.current) return;
    const token = readJoinCookie(document.cookie);
    if (!token) return;
    running.current = true;
    void (async () => {
      try {
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
          return;
        }
        if (!res.ok || !body?.orgId) {
          // Anything else is ours or transient: keep the cookie so the next page retries.
          console.error("[join] claim failed", res.status, body);
          posthog.capture("team_join_failed", { status: res.status });
          return;
        }
        document.cookie = clearJoinCookieAssignment();
        posthog.capture("team_join_completed");
        await clerk.setActive({ organization: body.orgId });
        router.replace(`/orgs/${encodeURIComponent(body.orgId)}`);
      } catch (err) {
        running.current = false;
        console.error("[join] claim failed", err);
      }
    })();
  }, [isSignedIn, clerk, router]);

  return null;
}
