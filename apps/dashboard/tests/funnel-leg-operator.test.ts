import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  funnelLegOperator,
  funnelLegOperatorLabel,
} from "../src/lib/funnel-leg-operator";
import { SALES_FUNNELS } from "../src/lib/sales-funnels";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

/**
 * WHO works an arrow no campaign performs.
 *
 * The table said `Done by you` on every unclaimed arrow, including the two OUR team
 * works: a customer reading that on `Sales interest -> Meeting booked` concludes nobody
 * is answering the replies their budget just bought. The split is by arrow, and these
 * pin which arrows are whose.
 */
describe("an unclaimed arrow states who works it", () => {
  it("gives our team the two arrows we work by hand today", () => {
    // Replying to a sales interest until a meeting is on the calendar, then chasing the
    // show-up. Both are conversation work on a lead our own outreach produced.
    expect(funnelLegOperator("conversation", "meeting_booked")).toBe("platform");
    expect(funnelLegOperator("meeting_booked", "meeting_attended")).toBe("platform");
  });

  it("gives the brand every arrow nobody on our side touches", () => {
    // Closing a deal, whichever funnel reached it.
    expect(funnelLegOperator("meeting_attended", "paid_client")).toBe("customer");
    expect(funnelLegOperator("signup", "paid_client")).toBe("customer");
    expect(funnelLegOperator("form_filled", "paid_client")).toBe("customer");
    // The two arrows a lead walks on the brand's OWN site: their page, their form.
    expect(funnelLegOperator("website_visit", "signup")).toBe("customer");
    expect(funnelLegOperator("website_visit", "form_filled")).toBe("customer");
    // A meeting booked straight off the website is self-serve on their booking page.
    expect(funnelLegOperator("website_visit", "meeting_booked")).toBe("customer");
  });

  // The DEFAULT direction is the cheap mistake: an arrow we have not named is one
  // nobody here touches, and claiming it would tell a brand we are doing work they are
  // in fact doing themselves.
  it("defaults an unknown arrow to the brand, never to us", () => {
    expect(funnelLegOperator("something", "unheard_of")).toBe("customer");
    expect(funnelLegOperator(null, "conversation")).toBe("customer");
    expect(funnelLegOperator(undefined, "paid_client")).toBe("customer");
  });

  // An ENTRY leg is always a channel's — `from: null` means the lead was not on the
  // funnel at all — so it never reaches this catalogue and must not be claimed here.
  it("claims no entry leg", () => {
    for (const funnel of SALES_FUNNELS) {
      expect(funnelLegOperator(null, funnel.stepKeys[0])).toBe("customer");
    }
  });

  // Every arrow this answers for is an arrow of a funnel we actually sell, so the
  // catalogue cannot drift onto steps no funnel contains.
  it("only names arrows that belong to a funnel we sell", () => {
    const sold = new Set<string>();
    for (const funnel of SALES_FUNNELS) {
      for (let i = 1; i < funnel.stepKeys.length; i += 1) {
        sold.add(`${funnel.stepKeys[i - 1]}->${funnel.stepKeys[i]}`);
      }
    }
    const src = read("../src/lib/funnel-leg-operator.ts");
    const block = src.slice(src.indexOf("const PLATFORM_LEGS"), src.indexOf("]);"));
    for (const [, from, to] of block.matchAll(/key\("([^"]+)", "([^"]+)"\)/g)) {
      expect(sold.has(`${from}->${to}`)).toBe(true);
    }
  });
});

describe("what the second line reads", () => {
  it("names us by the product's own name", () => {
    expect(funnelLegOperatorLabel("platform", "Acme")).toBe("Distribute.you team");
  });

  it("names the brand's team by the brand", () => {
    expect(funnelLegOperatorLabel("customer", "Acme")).toBe("Acme team");
    expect(funnelLegOperatorLabel("customer", "  Acme  ")).toBe("Acme team");
  });

  // A brand whose name has not resolved yet still states WHOSE team it is. Falling back
  // to `Done by you` would put the retired sentence back on exactly the rows the name is
  // slowest on.
  it("still says whose team it is before the brand name resolves", () => {
    for (const missing of [null, undefined, "", "   "]) {
      expect(funnelLegOperatorLabel("customer", missing)).toBe("Your team");
    }
  });
});
