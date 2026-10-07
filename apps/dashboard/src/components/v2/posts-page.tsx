"use client";

import { useParams } from "next/navigation";
import { Shimmer, TopBar } from "@/components/v2/ui";
import { LinkedinFeed, useLinkedinFeed } from "@/components/v2/linkedin-feed";
import { getBrandLinkedinPosts } from "@/lib/api";
import { formatCount } from "@/lib/format-number";

/**
 * Posting > Posts (staff mode, owner 2026-10-07): the brand's own LinkedIn company page
 * posts, newest first, drawn like LinkedIn's feed. Which page is the brand's comes from
 * brand-service, the posts from social-service (staff gateway route): nothing is guessed here.
 */
export function PostsPage() {
  const { brandId = "" } = useParams<{ brandId?: string }>();
  const feed = useLinkedinFeed(["staffBrandLinkedinPosts", brandId], (cursor) => getBrandLinkedinPosts(brandId, cursor), !!brandId);
  const first = feed.data?.pages[0];
  const answered = feed.data !== undefined || feed.isError;
  return (
    <div>
      <TopBar crumbs={[{ label: "Posting" }, { label: "Posts" }]} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <div className="mx-auto max-w-[555px]">
          <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.01em]">
            {!answered ? (
              <Shimmer className="h-8 w-64" />
            ) : first?.status === "ready" ? (
              `${formatCount(first.total)} post${first.total === 1 ? "" : "s"} on LinkedIn`
            ) : (
              "Posts on LinkedIn"
            )}
          </h1>
          <p className="k-fg2 mb-6 mt-1 text-[14px]">
            {first?.sourceUrl ? (
              <>
                From{" "}
                <a href={first.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
                  the brand&apos;s company page
                </a>
                , newest first.
              </>
            ) : (
              "The brand's own LinkedIn company page, newest first."
            )}
          </p>
          <LinkedinFeed feed={feed} noneSentence="No LinkedIn company page was found for this brand." />
        </div>
      </div>
    </div>
  );
}
