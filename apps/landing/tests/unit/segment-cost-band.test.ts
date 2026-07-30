import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { segmentCostBand } from "../../src/lib/static-html";

const homepagePath = path.resolve(
  __dirname,
  "../../public/landing/index-v1.html",
);
const html = fs.readFileSync(homepagePath, "utf-8");

const staticHtmlPath = path.resolve(__dirname, "../../src/lib/static-html.ts");
const staticHtmlSrc = fs.readFileSync(staticHtmlPath, "utf-8");

describe("segmentCostBand", () => {
  it("spreads the live rate by five dollars either side", () => {
    expect(segmentCostBand(72)).toEqual({
      low: "$67",
      mid: "$72",
      high: "$77",
    });
  });

  it("never lets the low leg reach zero on a cheap rate", () => {
    const band = segmentCostBand(3);
    expect(band).toEqual({ low: "$1.00", mid: "$3.00", high: "$5.00" });
  });

  it("keeps cents under ten dollars, whole dollars above", () => {
    expect(segmentCostBand(8.4).mid).toBe("$8.40");
    expect(segmentCostBand(64.6).mid).toBe("$65");
  });
});

describe("#measure segment rows read the live rate", () => {
  // The card headlines __CAC_PRICE__ a few lines above these rows. A hardcoded
  // segment price would freeze while the headline kept moving, so the two would
  // eventually disagree on the same card.
  it("prints one derived token per segment row", () => {
    expect(html).toContain("__SEG_COST_LOW__");
    expect(html).toContain("__SEG_COST_MID__");
    expect(html).toContain("__SEG_COST_HIGH__");
  });

  it("wires all three tokens through the server render", () => {
    expect(staticHtmlSrc).toContain('.replaceAll("__SEG_COST_LOW__"');
    expect(staticHtmlSrc).toContain('.replaceAll("__SEG_COST_MID__"');
    expect(staticHtmlSrc).toContain('.replaceAll("__SEG_COST_HIGH__"');
    // Without this the whole boot pass short-circuits on a page that carries
    // only the segment tokens, and they ship to the reader unresolved.
    expect(staticHtmlSrc).toContain('!html.includes("__SEG_COST_MID__")');
  });

  it("leaves the bar widths alone", () => {
    // The bars are a visual, not a scale: their length is deliberately not
    // proportional to the prices now sitting beside them.
    expect(html).toContain('width:38%');
    expect(html).toContain('width:61%');
    expect(html).toContain('width:92%');
  });
});
