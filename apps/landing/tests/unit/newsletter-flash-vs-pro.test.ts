import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The Flash-vs-Pro newsletter is a hand-authored HTML email under
 * content/newsletters, sent through transactional-email-service's mailing
 * lists. Mail clients strip <style>, <head> and inline SVG, so every visual
 * is either an inline style or a PNG hosted on distribute.you; the charts are
 * rendered from the article's own SVGs by scripts/render-newsletter-charts.mjs
 * so the newsletter and the page state the same figures.
 */
const ROOT = join(__dirname, "..", "..");
const html = readFileSync(join(ROOT, "content", "newsletters", "flash-vs-pro", "index.html"), "utf8");

describe("newsletter: flash vs pro", () => {
  it("carries no em-dash (user-facing copy)", () => {
    expect(html).not.toContain("—");
  });

  it("references only images hosted on distribute.you that exist under public/", () => {
    const srcs = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
    expect(srcs.length).toBeGreaterThan(5);
    for (const src of srcs) {
      expect(src.startsWith("https://distribute.you/")).toBe(true);
      // a cache-buster is not part of the path on disk
      const local = join(ROOT, "public", src.replace("https://distribute.you/", "").split("?")[0]);
      expect(existsSync(local), `${src} is not under public/`).toBe(true);
    }
  });

  it("carries no inline SVG (Gmail strips it)", () => {
    expect(html).not.toMatch(/<svg/i);
  });

  it("adds no unsubscribe of its own: email-gateway appends the footer downstream", () => {
    expect(html).not.toContain("pm:unsubscribe");
    expect(html).not.toMatch(/unsubscribe/i);
  });

  it("every link to the article carries the newsletter attribution", () => {
    const hrefs = [...html.matchAll(/href="(https:\/\/distribute\.you[^"]*)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThan(3);
    for (const href of hrefs) expect(href).toContain("utm_source=newsletter");
  });

  it("states the article's headline figures", () => {
    for (const figure of ["$139", "$1", "125,000", "36", "$198"]) expect(html).toContain(figure);
  });
});
