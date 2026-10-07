"use client";

import { useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { EmptyNote, Shimmer } from "@/components/v2/ui";
import { LinkedInPostCard } from "@/components/v2/linkedin-post-card";
import type { LinkedinFeedPage } from "@/lib/v2/linkedin-post-view";
import { useOrgQueryGate } from "@/lib/use-auth-query";
import { useClientClock } from "@/lib/use-client-clock";

/**
 * A LinkedIn feed drawn like LinkedIn's (owner 2026-10-07), scrolled back through the whole
 * history: the next page loads as the end comes into view. Shared by Posting > Posts (the
 * brand's company page) and the Profile page (the signed-in person's own profile): the
 * producer serves both with one contract, so one reader and one card draw both.
 * social-service fetches on demand when staff open it; `pending` = the first fetch runs.
 */

/** While social-service reads the posts for the first time, ask again at this pace. */
const PENDING_POLL_MS = 3000;

export function useLinkedinFeed(queryKey: readonly unknown[], fetchPage: (cursor: string | null) => Promise<LinkedinFeedPage>, enabled: boolean) {
  const gate = useOrgQueryGate();
  return useInfiniteQuery<LinkedinFeedPage, Error>({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage((pageParam as string | null) ?? null),
    initialPageParam: null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: gate && enabled,
    refetchInterval: (query) => (query.state.data?.pages[0]?.status === "pending" ? PENDING_POLL_MS : false),
  });
}

export function LinkedinFeed({
  feed,
  noneSentence,
}: {
  feed: ReturnType<typeof useLinkedinFeed>;
  /** The sentence when no LinkedIn page/profile was found ("No LinkedIn company page was found for this brand."). */
  noneSentence: string;
}) {
  const now = useClientClock();
  const first = feed.data?.pages[0];
  const posts = feed.data?.pages.flatMap((p) => p.posts) ?? [];
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, posts.length]);

  const answered = feed.data !== undefined || feed.isError;
  return (
    <div className="space-y-2">
      {!answered && [0, 1, 2].map((i) => <PostSkeleton key={i} />)}
      {feed.isError && !feed.data && (
        <div className="k-card">
          <EmptyNote>The posts could not be read. Try again in a minute.</EmptyNote>
        </div>
      )}
      {first?.status === "none" && (
        <div className="k-card">
          <EmptyNote>{noneSentence}</EmptyNote>
        </div>
      )}
      {first?.status === "undecided" && (
        <div className="k-card">
          <EmptyNote>We could not tell which LinkedIn page this is{first.reason ? `: ${first.reason}` : "."}</EmptyNote>
        </div>
      )}
      {first?.status === "failed" && (
        <div className="k-card">
          <EmptyNote>Reading the posts from LinkedIn failed{first.reason ? `: ${first.reason}` : "."}</EmptyNote>
        </div>
      )}
      {first?.status === "pending" && (
        <>
          <p className="k-fg3 text-[13px]">Reading the posts from LinkedIn…</p>
          {[0, 1].map((i) => <PostSkeleton key={i} />)}
        </>
      )}
      {first?.status === "ready" && posts.length === 0 && (
        <div className="k-card">
          <EmptyNote>Nothing posted on LinkedIn yet.</EmptyNote>
        </div>
      )}
      {posts.map((p) => (
        <LinkedInPostCard key={p.id} post={p} now={now} />
      ))}
      <div ref={sentinel} />
      {isFetchingNextPage && <PostSkeleton />}
      {first?.status === "ready" && posts.length > 0 && !hasNextPage && (
        <p className="k-fg3 py-4 text-center text-[12px]">That is every post we hold.</p>
      )}
    </div>
  );
}

function PostSkeleton() {
  return (
    <div className="k-card p-4">
      <div className="flex gap-2">
        <Shimmer className="h-12 w-12" />
        <div className="flex-1 space-y-1.5 pt-1">
          <Shimmer className="h-3.5 w-40" />
          <Shimmer className="h-3 w-24" />
        </div>
      </div>
      <Shimmer className="mt-4 h-3.5 w-full" />
      <Shimmer className="mt-2 h-3.5 w-11/12" />
      <Shimmer className="mt-2 h-3.5 w-2/3" />
    </div>
  );
}
