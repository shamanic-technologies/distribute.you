"use client";

import { LinkedinFeed, useLinkedinFeed } from "@/components/v2/linkedin-feed";
import { getMyLinkedinPosts } from "@/lib/api";
import { useStaffMode } from "@/lib/use-staff-mode";

/**
 * The bottom of the Profile page, staff mode only (owner 2026-10-07): the signed-in person's
 * own LinkedIn posts, the same feed and card as Posting > Posts. client-service names the
 * profile from the person's email; social-service reads its posts. Nothing is guessed here.
 */
export function MyLinkedinPosts() {
  const { staffMode } = useStaffMode();
  const feed = useLinkedinFeed(["staffMyLinkedinPosts"], (cursor) => getMyLinkedinPosts(cursor), staffMode);
  if (!staffMode) return null;
  const first = feed.data?.pages[0];
  return (
    <section className="mx-auto max-w-[555px] px-4 pb-16 pt-8">
      <h2 className="text-[18px] font-semibold">Your LinkedIn posts</h2>
      <p className="k-fg2 mb-4 mt-1 text-[13px]">
        {first?.sourceUrl ? (
          <>
            From{" "}
            <a href={first.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
              your profile
            </a>
            , newest first.
          </>
        ) : (
          "Your own LinkedIn profile, newest first."
        )}
      </p>
      <LinkedinFeed feed={feed} noneSentence="No LinkedIn profile was found for your email." />
    </section>
  );
}
