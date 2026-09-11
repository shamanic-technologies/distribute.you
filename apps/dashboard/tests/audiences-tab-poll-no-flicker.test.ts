import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * A tab that has SETTLED EMPTY must not re-skeleton on every poll.
 *
 * The per-tab loading gate skeletons a tab "while its own query is pending OR
 * fetching-while-empty". The second clause was written for the SWR restore case
 * (an empty snapshot from disk, revalidating in the background), and it was keyed
 * on `isFetching` — which is ALSO true for every 5s poll refetch. So a tab with
 * zero rows (a brand with no audience yet, an empty Archived tab) flashed its
 * skeleton on every tick, forever. Reported as "le loader de la section refresh
 * toutes les 2s de façon visible, c'est insupportable".
 *
 * `isFetchedAfterMount` answers the question the clause meant to ask — has the
 * NETWORK answered once since this page mounted — and stays true through every
 * later poll, so the restore case still skeletons until the first answer and a
 * settled-empty tab never skeletons again.
 */
const PAGE = fs.readFileSync(
  path.join(__dirname, "../src/components/audiences/customer-audiences-page.tsx"),
  "utf8",
);

function sliceFrom(marker: string, len: number): string {
  const at = PAGE.indexOf(marker);
  expect(at, `marker not found: ${marker}`).toBeGreaterThan(-1);
  return PAGE.slice(at, at + len);
}

describe("audiences tabs: a settled-empty tab does not re-skeleton on every poll", () => {
  const gate = sliceFrom("const activeTabLoading =", 900);

  it("gates the empty-while-loading skeleton on the first fetch after mount, never on isFetching", () => {
    expect(gate).toContain("FetchedAfterMount");
    expect(gate).not.toContain("activeFetching");
    expect(gate).not.toContain("pausedFetching");
    expect(gate).not.toContain("archivedFetching");
  });

  it("no list query destructures isFetching (nothing else has a use for it here)", () => {
    const reads = sliceFrom('["audiences", brandId, "active"', 1400);
    expect(reads).not.toContain("isFetching:");
    expect(reads).toContain("isFetchedAfterMount:");
  });
});
