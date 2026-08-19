import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { formatRoiMultiple } from "@/lib/static-html";

const staticHtmlPath = path.resolve(__dirname, "../../src/lib/static-html.ts");
const homepagePath = path.resolve(
  __dirname,
  "../../public/landing/index-v1.html",
);

describe("ROI calculator", () => {
  it("computes lifetime revenue times win rate over the live cost", () => {
    // $2,500 x 30% = $750 of client revenue per meeting, at $53 a meeting.
    expect(formatRoiMultiple(2500, 30, 53)).toBe("14×");
  });

  it("keeps one decimal below 10x, where rounding would hide a real difference", () => {
    expect(formatRoiMultiple(1000, 20, 53)).toBe("3.8×");
  });

  it("returns null rather than Infinity when the live cost is missing or zero", () => {
    expect(formatRoiMultiple(2500, 30, 0)).toBeNull();
    expect(formatRoiMultiple(2500, 30, Number.NaN)).toBeNull();
  });

  it("returns null on negative inputs instead of a negative return", () => {
    expect(formatRoiMultiple(-2500, 30, 53)).toBeNull();
    expect(formatRoiMultiple(2500, -30, 53)).toBeNull();
  });

  it("handles a zero win rate as a real zero, not an error", () => {
    expect(formatRoiMultiple(2500, 0, 53)).toBe("0.0×");
  });
});

describe("ROI calculator wiring", () => {
  const src = fs.readFileSync(staticHtmlPath, "utf8");
  const page = fs.readFileSync(homepagePath, "utf8");

  it("replaces the numeric token BEFORE the formatted one", () => {
    // "__CAC_PRICE__" is a prefix of "__CAC_PRICE_NUMERIC__". Replacing the
    // formatted token first rewrites the numeric one to "$53_NUMERIC__", which
    // parses as NaN and silently breaks the calculator.
    expect(src.indexOf('"__CAC_PRICE_NUMERIC__"')).toBeLessThan(
      src.indexOf('.replaceAll("__CAC_PRICE__"'),
    );
  });

  it("keeps the defaults in one place so the render and the inputs cannot drift", () => {
    expect(src).toContain("const ROI_DEFAULT_LTR_USD = 2500");
    expect(src).toContain("const ROI_DEFAULT_WIN_RATE_PCT = 30");
    expect(page).toContain('value="__ROI_LTR__"');
    expect(page).toContain('value="__ROI_WIN_RATE__"');
  });

  it("server-renders the default multiple so the raw HTML carries a real number", () => {
    expect(page).toContain("__ROI_MULT__");
    expect(src).toContain('.replaceAll(\n      "__ROI_MULT__"');
  });

  it("locks the cost input and feeds it the live numeric rate", () => {
    expect(page).toContain('data-roi-cost="__CAC_PRICE_NUMERIC__"');
    expect(page).not.toContain('id="roi-cost"');
  });

  it("attributes the cost to the client, who is the one paying it", () => {
    // Not "our" cost. The client authorises a budget and is charged what the
    // campaign spent, so the measured cost per interested reply is theirs.
    expect(page).toContain("the live cost per interested reply our clients are paying");
    expect(page).not.toContain("our live cost per interested reply");
  });
});
