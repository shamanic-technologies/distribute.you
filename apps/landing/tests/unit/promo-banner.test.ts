import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { applyPromoBanners } from "../../src/lib/promo-banner";

const page = `<body>\n<!--promo:until=2026-11-01--><a class="promo-bar">Until October 31</a><!--/promo-->\n<nav></nav>`;

describe("time-boxed promo banners", () => {
  it("keeps the banner up to the last day, drops it from its end date on", () => {
    expect(applyPromoBanners(page, new Date("2026-10-31T23:59:59Z"))).toContain("Until October 31");
    const after = applyPromoBanners(page, new Date("2026-11-01T00:00:00Z"));
    expect(after).not.toContain("promo");
    expect(after).toBe("<body>\n<nav></nav>");
  });

  it("fails loud on an unreadable end date", () => {
    expect(() => applyPromoBanners("<!--promo:until=2026-13-45-->x<!--/promo-->", new Date())).toThrow(/unreadable end date/);
  });

  it("wraps the homepage's $100 match, ending after October 31, 2026", () => {
    const html = readFileSync(path.join(__dirname, "../../public/landing/index-v2.html"), "utf8");
    expect(html).toContain("<!--promo:until=2026-11-01-->");
    expect(applyPromoBanners(html, new Date("2026-11-02T00:00:00Z"))).not.toContain("match your first");
    const route = readFileSync(path.join(__dirname, "../../src/app/route.ts"), "utf8");
    expect(route).toContain("applyPromoBanners(readFileSync(");
  });
});
