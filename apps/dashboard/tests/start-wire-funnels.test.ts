import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * THE FUNNEL SCREEN READS THE PRODUCER'S FUNNEL LIST, AND EVERY FLOW PASSES IT.
 *
 * `funnelsForChannels` takes the producer's own funnel descriptions because each
 * one states its entry step; resolving that through this app's four-funnel
 * catalogue is what took `/start` down on 2026-09-17. features-service published
 * eight funnels at 17:40 UTC and 37 of the 42 channels sell one of the four
 * added, so the local key normalizer — which THROWS by design, guarding a
 * CHECK-constrained column — threw inside a `useMemo` with no error boundary
 * under `app/start`. The visitor's first channel click blanked the page.
 *
 * These pin the CALL SITES, not the library. A filter perfectly able to read the
 * wire is the bug entirely intact if a flow never hands it the list, and the
 * three flows read the same catalogue for the same selection: `start-flow` picks,
 * `pay-flow` charges for the picks, `build-flow` writes their budgets. A flow
 * left behind would resolve a different set of funnels from the one the visitor
 * was shown — and `pay-flow` would resolve it while taking money.
 */
const FLOWS = ["start-flow", "pay-flow", "build-flow"] as const;

const src = (name: string): string =>
  readFileSync(new URL(`../src/components/start/${name}.tsx`, import.meta.url), "utf8");

describe("every /start flow hands the funnel filter the producer's own funnels", () => {
  for (const flow of FLOWS) {
    it(`${flow} reads the wire's funnel list`, () => {
      expect(src(flow)).toContain("body?.channels?.funnels ?? []");
    });

    it(`${flow} passes it to funnelsForChannels`, () => {
      const s = src(flow);
      const at = s.indexOf("funnelsForChannels(");
      expect(at).toBeGreaterThan(-1);
      // Bounded to the call itself: the third argument is the whole fix.
      const call = s.slice(at, s.indexOf(")", at) + 1);
      expect(call).toMatch(/funnelsForChannels\([^)]*,[^)]*,[^)]*\)/);
    });

    // A mark is decoration and its resolution must not be able to take the
    // screen down. The producer publishes more funnels than this app draws marks
    // for, and the name beside the tile comes off the wire, so an unmarked
    // funnel still reads correctly.
    it(`${flow} resolves a funnel's mark without the throwing normalizer`, () => {
      const s = src(flow);
      expect(s).not.toContain("normalizeSalesFunnelKey");
      expect(s).not.toContain("SALES_FUNNELS");
    });
  }
});
