"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";

/**
 * Warm a route's RSC payload before the click that navigates to it.
 *
 * WHY this is not just `<Link prefetch>`: the dashboard's drill-down rows navigate
 * with `router.push` inside an `onClick`, not with a `<Link>` — a table row carries
 * its own controls, so it cannot be an anchor. Nothing prefetches a `router.push`
 * target, so brand -> offer -> funnel -> campaign is four cold server round-trips,
 * and each one is filled by the nearest `loading.tsx`, which for every funnel and
 * campaign sub-route is the OFFER's — so the whole offer area blanks to a full-page
 * skeleton on each step down. That is the "skeleton on the funnel page" report.
 *
 * Hover (and keyboard focus) is the signal: a row the pointer is resting on is about
 * to be clicked, and the payload has the whole hover duration to arrive. Bounded by
 * construction — only rows a human actually points at are fetched, unlike a blanket
 * `prefetch` on every row of a long table, which would fire one request per visible
 * row. Each href is fetched at most ONCE per mount; Next caches the payload from
 * there, and a repeat `prefetch` for the same route would be wasted work on every
 * mouse re-entry.
 *
 * Best-effort by construction: `router.prefetch` resolves to nothing useful and a
 * failed warm just means the click pays what it pays today.
 */
export function useRoutePrefetch(): (href: string) => void {
  const router = useRouter();
  const seen = useRef<Set<string>>(new Set());

  return useCallback(
    (href: string) => {
      if (!href || seen.current.has(href)) return;
      seen.current.add(href);
      try {
        router.prefetch(href);
      } catch {
        // Prefetch is an optimization; a router that refuses one must never take a
        // row's hover handler down with it.
      }
    },
    [router],
  );
}
