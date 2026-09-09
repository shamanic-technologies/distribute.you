import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FOUNDER_COUNT_FLOOR,
  foundersFloor,
  foundersLine,
  reseedFounderCount,
} from "../../src/lib/founder-count";

const HTML = readFileSync(join(process.cwd(), "public/landing/index-v2.html"), "utf8");
const STATIC_HTML = readFileSync(join(process.cwd(), "src/lib/static-html.ts"), "utf8");

describe("the founder count is floored to a ten and can only understate us", () => {
  it("floors down, never up", () => {
    expect(foundersFloor(71)).toBe(70);
    expect(foundersFloor(79)).toBe(70);
    expect(foundersFloor(80)).toBe(80);
    expect(foundersFloor(153)).toBe(150);
  });

  it("states nothing below one floor, because `0+ founders` reads as nobody", () => {
    expect(foundersFloor(0)).toBeNull();
    expect(foundersFloor(9)).toBeNull();
    expect(foundersFloor(FOUNDER_COUNT_FLOOR)).toBe(FOUNDER_COUNT_FLOOR);
  });

  it("refuses a total that is not a count", () => {
    expect(foundersFloor(Number.NaN)).toBeNull();
    expect(foundersFloor(Number.POSITIVE_INFINITY)).toBeNull();
    expect(foundersFloor(-5)).toBeNull();
  });

  it("writes the sentence one way, with a thousands separator", () => {
    expect(foundersLine(70)).toBe("Loved by 70+ founders");
    expect(foundersLine(1_200)).toBe("Loved by 1,200+ founders");
  });
});

describe("the reseed keys on the attribute, never on the sentence", () => {
  const row = (copy: string) =>
    `<div class="faces-text"><span class="stars">★★★★★</span><span data-founder-count>${copy}</span></div>`;

  it("restates every row from one read", () => {
    const html = row("Loved by 70+ founders") + row("Loved by 70+ founders");
    const out = reseedFounderCount(html, 142);
    expect(out.match(/Loved by 140\+ founders/g)).toHaveLength(2);
    expect(out).not.toContain("Loved by 70+ founders");
  });

  it("keeps working once the shipped literal has gone stale", () => {
    // The seed says 70+ and the wire says 210 — a matcher written against the sentence
    // would restate the first crossing and never the second.
    expect(reseedFounderCount(row("Loved by 200+ founders"), 213)).toContain(
      "Loved by 210+ founders"
    );
  });

  it("keeps the shipped figure when the total is unstateable", () => {
    const html = row("Loved by 70+ founders");
    expect(reseedFounderCount(html, 4)).toBe(html);
    expect(reseedFounderCount(html, Number.NaN)).toBe(html);
  });

  it("leaves a page carrying no such row alone", () => {
    const html = "<p>Loved by 70+ founders</p>";
    expect(reseedFounderCount(html, 142)).toBe(html);
  });
});

describe("the homepage is keyed for the reseed and the reseed is called", () => {
  it("keys both trust rows", () => {
    expect(HTML.match(/<span data-founder-count[^>]*>/g)).toHaveLength(2);
  });

  it("ships a literal that is a SEED, not a claim — it is what serves only if the read fails", () => {
    expect(HTML).toContain("<span data-founder-count>Loved by 70+ founders</span>");
  });

  it("reads the public user count and reseeds at render", () => {
    expect(STATIC_HTML).toContain("/public/stats/users");
    expect(STATIC_HTML).toContain("reseedFounderCount(html, total)");
    // The call site, not only the helper: a page that never calls it renders the seed
    // forever with every guard above still green.
    expect(STATIC_HTML).toContain("await withFounderCount(");
  });

  it("drops nothing and blanks nothing when the read fails", () => {
    const at = STATIC_HTML.indexOf("async function withFounderCount(");
    expect(at).toBeGreaterThan(-1);
    const body = STATIC_HTML.slice(at, STATIC_HTML.indexOf("async function withHotLeadStats("));
    expect(body).toContain("return html;");
    expect(body).toContain("console.error");
    expect(body).not.toContain('""');
  });
});
