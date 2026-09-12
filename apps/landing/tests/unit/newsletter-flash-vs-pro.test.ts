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
const text = readFileSync(join(ROOT, "content", "newsletters", "flash-vs-pro", "index.txt"), "utf8");

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

  /**
   * The plain-text part is what a client rendering no HTML shows, and what a
   * spam filter reads beside the markup. It lived outside the repo once, went
   * unguarded through two re-derivations, and was still publishing the retired
   * figures when the HTML beside it had already moved. It ships here now, and
   * it states the same figures.
   */
  describe("plain-text part", () => {
    it("carries no em-dash", () => {
      expect(text).not.toContain("\u2014");
    });

    it("states the same headline figures as the HTML", () => {
      for (const figure of ["$139", "125,000", "$198", "$1,461"]) {
        expect(html).toContain(figure);
        expect(text).toContain(figure);
      }
    });

    it("links to the article with the newsletter attribution", () => {
      expect(text).toContain("utm_source=newsletter");
    });

    it("claims no all-of-them twist", () => {
      expect(text).not.toMatch(/\d+ of \d+/);
    });
  });

  /**
   * The newsletter is hand-authored beside a GENERATED article, so a re-derivation
   * moves the article's figures and leaves this page publishing the retired ones.
   * These read the article rather than pinning a literal, so the drift fails here
   * instead of reaching an inbox.
   */
  describe("stays coherent with the article it summarises", () => {
    const article = readFileSync(
      join(ROOT, "content", "blog", "flash-vs-pro-llm-cold-email", "article.html"),
      "utf8",
    );
    const text = article.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

    it("names the client count the article names", () => {
      const clients = text.match(/across (\d+) clients/)?.[1];
      expect(clients).toBeTruthy();
      expect(html).toContain(`${clients} clients`);
    });

    it("names the A/B-test count the article names", () => {
      const tests = text.match(/(\d+) A\/B tests, one winner per outcome/)?.[1];
      expect(tests).toBeTruthy();
      expect(html).toContain("A/B tests");
      expect(html).toContain(`>${tests}</div>`);
    });

    it("claims no all-of-them twist: replies come from linked emails too", () => {
      expect(html).not.toMatch(/\d+ of \d+/);
      expect(html).not.toMatch(/every reply came from/i);
    });
  });
});
