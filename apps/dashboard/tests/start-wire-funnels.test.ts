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
    it(`${flow} reads the producer's catalogue WHOLE, not just its channels`, () => {
      // All three screens are derived from it — which outcomes exist, which channels
      // lead to them, which (funnel x channel) pairs they buy — so a flow holding only
      // the channel array resolves a different set from the one beside it.
      const s = src(flow);
      expect(s).toContain("funnels: cat?.funnels ?? []");
      expect(s).toContain("legs: cat?.legs ?? []");
      expect(s).toContain("steps: cat?.steps ?? []");
    });

    it(`${flow} passes it to funnelsForChannels`, () => {
      const s = src(flow);
      const at = s.indexOf("funnelsForChannels(");
      expect(at).toBeGreaterThan(-1);
      // Bounded to the call itself: the third argument is the whole fix.
      const call = s.slice(at, s.indexOf(")", at) + 1);
      expect(call).toMatch(/funnelsForChannels\([^)]*,[^)]*,[^)]*\)/);
    });

    it(`${flow} resolves its channels from that catalogue too`, () => {
      // `channelsForOutcomes` derives "can LEAD to this outcome" from the legs, so a
      // flow handing it a bare channel array would offer nothing for five of the eight
      // outcomes — nothing delivers a signup, a filled form or a paid client directly.
      expect(src(flow)).toMatch(/channelsForOutcomes\((catalogue\.)?wire[,)]/);
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
