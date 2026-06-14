"use client";

import { type ReactNode } from "react";
import { useCoordinatedReveal } from "@/lib/use-coordinated-reveal";

/**
 * Component form of {@link useCoordinatedReveal} — the standard way to give a
 * page body the "all cards appear together, then never flicker back" behaviour
 * without hand-rolling the `!revealed ? skeleton : content` ternary per page.
 *
 * Reveal a COLD, COHERENT group as ONE paint (barrier), then keep it on screen
 * across background polls / token rotation / transient errors (monotonic latch).
 *
 * Pass one readiness flag per query in the group — `data !== undefined`, or
 * `!isPending` (a *disabled* React Query stays `isPending` forever, so gate its
 * flag behind its own enabled condition: `!enabled || !isPending`).
 *
 * `children` is a RENDER FUNCTION, not a node: it is only evaluated once the
 * group is revealed. This is load-bearing — the content closure dereferences the
 * now-resolved query data (`data.foo`, `data.bar`), which would throw if it ran
 * while the data is still undefined. Declare every `useAuthQuery` at the page top
 * (so they all fire in parallel on mount); this only gates the PAINT.
 *
 * Do NOT span a warm cache (e.g. `["features"]`) and a cold sibling in one group
 * — that holds the warm content hostage to the slow one. Group at the finest
 * coherent level; keep warm sections independent. See CLAUDE.md → "Coordinated
 * reveal" and "Dashboard data fetching".
 */
export function CoordinatedReveal({
  flags,
  skeleton,
  children,
}: {
  flags: boolean[];
  skeleton: ReactNode;
  children: () => ReactNode;
}) {
  const revealed = useCoordinatedReveal(flags);
  return <>{revealed ? children() : skeleton}</>;
}
