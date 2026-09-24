import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as queryOptions from "../src/lib/query-options";
import { POLL_INTERVAL, pollOptions } from "../src/lib/query-options";

const read = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");

describe("POLL_INTERVAL", () => {
  it("is 5s — a refresh may lag, never by more than about five seconds", () => {
    expect(POLL_INTERVAL).toBe(5_000);
  });

  it("matches the producer's own view-cache TTL", () => {
    // features-service `view-cache.ts` DEFAULT_TTL_MS = 5_000, with no
    // FEATURE_VIEW_SNAPSHOT_TTL_MS override on the box. Inside the TTL a request costs
    // no fan-out, so this interval buys freshness without multiplying upstream work.
    expect(POLL_INTERVAL).toBe(5_000);
  });

  it("pollOptions carries it", () => {
    expect(pollOptions.refetchInterval).toBe(POLL_INTERVAL);
  });
});

describe("the Leads reads", () => {
  it("poll on the ONE 5s cadence — there is no slower leads tier any more", () => {
    // The 15s tier existed because a Leads read used to be the whole population
    // (~100MB). Every reader pages now, and lead-service answers from a kept read model
    // (sales-lead-service#578) instead of rebuilding the scope per request, so the only
    // reason for a slower tier is gone. Won and every other statement must land within
    // the ~5s the rest of the dashboard promises.
    expect("LEADS_POLL_INTERVAL" in queryOptions).toBe(false);
    expect("leadsPollOptions" in queryOptions).toBe(false);
    for (const path of [
      "components/audiences/engaged-leads-page.tsx",
      "components/funnels/funnel-leg-page.tsx",
    ]) {
      const src = read(path);
      expect(src).not.toContain("LEADS_POLL_INTERVAL");
      expect(src).toContain("refetchInterval: POLL_INTERVAL");
    }
  });
});
