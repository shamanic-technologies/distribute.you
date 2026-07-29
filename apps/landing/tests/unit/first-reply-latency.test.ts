import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { firstReplyCeilingPhrase, formatRoiMultiple } from "@/lib/static-html";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const staticHtmlPath = path.resolve(__dirname, "../../src/lib/static-html.ts");
const homepagePath = path.resolve(
  __dirname,
  "../../public/landing/index-v1.html",
);

describe("firstReplyCeilingPhrase", () => {
  it("returns null below the model floor, so the sentence is removed", () => {
    // One model with plenty of samples is still one model: a single observation
    // window is not a fleet-wide ceiling.
    expect(
      firstReplyCeilingPhrase([{ medianMs: 2 * HOUR_MS, sampleSize: 40 }]),
    ).toBeNull();
  });

  it("returns null below the total-sample floor", () => {
    expect(
      firstReplyCeilingPhrase([
        { medianMs: 2 * HOUR_MS, sampleSize: 1 },
        { medianMs: 5 * HOUR_MS, sampleSize: 1 },
      ]),
    ).toBeNull();
  });

  it("returns null when the producer reports nothing at all", () => {
    expect(firstReplyCeilingPhrase([])).toBeNull();
  });

  it("phrases a sub-week ceiling as 'in under a week'", () => {
    // Mirrors the live prod shape: 1h32 / 4h08 / 12h36 / 5j05 medians.
    expect(
      firstReplyCeilingPhrase([
        { medianMs: 5_495_941, sampleSize: 4 },
        { medianMs: 14_876_092, sampleSize: 4 },
        { medianMs: 45_368_703, sampleSize: 1 },
        { medianMs: 450_957_306, sampleSize: 1 },
      ]),
    ).toBe("in under a week");
  });

  it("phrases a longer ceiling in whole days, rounded up", () => {
    expect(
      firstReplyCeilingPhrase([
        { medianMs: 2 * DAY_MS, sampleSize: 3 },
        { medianMs: 9.2 * DAY_MS, sampleSize: 3 },
      ]),
    ).toBe("in under 10 days");
  });

  it("ignores 0-outcome husk models when taking the ceiling", () => {
    // A model that produced no interested reply has no latency to report. If it
    // leaked into the max it would inflate the ceiling with a number nobody
    // observed.
    expect(
      firstReplyCeilingPhrase([
        { medianMs: 2 * HOUR_MS, sampleSize: 3 },
        { medianMs: 6 * HOUR_MS, sampleSize: 3 },
        { medianMs: 90 * DAY_MS, sampleSize: 0 },
        { medianMs: null, sampleSize: 0 },
      ]),
    ).toBe("in under a week");
  });
});

describe("first-reply line wiring", () => {
  const src = fs.readFileSync(staticHtmlPath, "utf8");

  it("gates the fetch on the token being present", () => {
    expect(src).toContain('const FIRST_REPLY_LINE_TOKEN = "__FIRST_REPLY_LINE__"');
    expect(src).toContain("if (!html.includes(FIRST_REPLY_LINE_TOKEN)) return html;");
  });

  it("bounds the fetch so a cold endpoint cannot blow the prerender budget", () => {
    const fn = src.slice(src.indexOf("async function fetchFirstReplyCeiling"));
    expect(fn.slice(0, 1200)).toContain("AbortSignal.timeout(8_000)");
  });

  it("omits the sentence instead of printing a substitute when unavailable", () => {
    const fn = src.slice(src.indexOf("async function withFirstReplyLine"));
    expect(fn.slice(0, 900)).toContain('return null;');
    expect(fn.slice(0, 900)).toContain('phrase\n      ?');
  });

  it("runs the pass inside staticResponse", () => {
    expect(src).toContain("await withFirstReplyLine(");
  });

  it("places the token on the homepage", () => {
    expect(fs.readFileSync(homepagePath, "utf8")).toContain(
      "__FIRST_REPLY_LINE__",
    );
  });
});

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

  it("states that the cost shown is the live cost per interested reply", () => {
    expect(page).toContain("our live cost per interested reply");
  });
});
