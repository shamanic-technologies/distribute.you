import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LEADS_POLL_INTERVAL,
  POLL_INTERVAL,
  leadsPollOptions,
  pollOptions,
} from "../src/lib/query-options";

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

describe("LEADS_POLL_INTERVAL", () => {
  it("is slower than the default, because the payload is the reason", () => {
    // The brand's leads list is unpaginated by design and ~100MB of slim rows on a
    // heavy brand. Every user action that can change it invalidates it explicitly.
    expect(LEADS_POLL_INTERVAL).toBeGreaterThan(POLL_INTERVAL);
    expect(LEADS_POLL_INTERVAL).toBe(15_000);
  });

  it("leadsPollOptions carries it", () => {
    expect(leadsPollOptions.refetchInterval).toBe(LEADS_POLL_INTERVAL);
  });

  it("is what the two lead-list readers poll on", () => {
    for (const path of [
      "components/audiences/engaged-leads-page.tsx",
      "components/funnels/funnel-leg-page.tsx",
    ]) {
      expect(read(path)).toContain("refetchInterval: LEADS_POLL_INTERVAL");
    }
  });

  it("the revenue read on the leads page stays on the fast tier", () => {
    // Same file, different question: the money above the table is small and is exactly
    // what a reader watches after stating an outcome.
    expect(read("components/audiences/engaged-leads-page.tsx")).toContain(
      "refetchInterval: POLL_INTERVAL",
    );
  });
});
