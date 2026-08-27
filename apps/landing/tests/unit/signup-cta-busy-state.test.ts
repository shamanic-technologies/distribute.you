import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const landingDir = path.resolve(__dirname, "../../public/landing");
const read = (rel: string) => fs.readFileSync(path.join(landingDir, rel), "utf8");

const homepage = read("index-v1.html");
const modalV1 = read("js/pricing-modal-v1.js");
const mainJs = read("js/main.js");

/**
 * Signup lives on `dashboard.distribute.you`, a different origin. Between the
 * click and its first paint the browser keeps showing the landing, unchanged —
 * so a CTA with no busy state reads as dead and gets clicked again.
 */
describe("landing signup CTA states what it is doing", () => {
  it("hero form marks the submit busy and swaps its label", () => {
    expect(homepage).toContain("function beginLeaving()");
    expect(homepage).toContain("classList.add('is-busy')");
    expect(homepage).toContain("setAttribute('aria-busy','true')");
    expect(homepage).toContain("Opening your signup");
    expect(homepage).toContain("data-cta-label");
  });

  it("only marks busy once the URL has passed validation", () => {
    // A rejected URL keeps the visitor on this page, so freezing the button
    // there would leave a permanently dead CTA. The busy call must sit AFTER
    // the hostname check, never before the try block.
    const check = homepage.indexOf("if(!parsed.hostname.includes('.'))");
    const busy = homepage.indexOf("beginLeaving();\n            window.location.href=");
    expect(check).toBeGreaterThan(0);
    expect(busy).toBeGreaterThan(check);
  });

  it("guards against a second submit", () => {
    expect(homepage).toContain("if(leaving)return;");
  });

  it("ships the spinner styles the busy class switches on", () => {
    expect(homepage).toContain(".button.is-busy .btn-spin{display:block");
    expect(homepage).toContain(".button.is-busy .btn-arrow{display:none}");
    expect(homepage).toContain("@keyframes btn-spin");
  });

  for (const [name, src] of [
    ["pricing-modal-v1.js", modalV1],
    ["main.js", mainJs],
  ] as const) {
    it(`${name} marks the start button busy before navigating`, () => {
      expect(src).toContain("function markLeaving(btn)");
      expect(src).toContain("Opening your signup");
      expect(src).toContain("goSignup(this)");
      expect(src).toContain("function goSignup(btn)");
    });

    it(`${name} sends an absolute URL, path intact`, () => {
      // One shape from every entry point on the page, so onboarding can render
      // the value back as a URL. The scheme strip this replaced produced a
      // second shape for the same param.
      expect(src).toContain("function absoluteSite(raw)");
      expect(src).toContain("parsed.href");
      expect(src).not.toContain("state.url.replace(/^https?:\\/\\//i, '')");
    });
  }
});

/**
 * Each of these files is linked with a manual `?v=N` cache-buster that is its
 * own edge + browser cache key: editing the JS without bumping the token ships
 * nothing to a returning visitor.
 */
describe("cache-buster tokens moved with the JS", () => {
  it("index-v1.html links a bumped pricing-modal-v1.js", () => {
    expect(homepage).toContain("js/pricing-modal-v1.js?v=7");
    expect(homepage).not.toContain("js/pricing-modal-v1.js?v=6");
  });

  it("every page linking main.js links the same bumped token", () => {
    const pages = fs
      .readdirSync(landingDir)
      .filter((f) => f.endsWith(".html"))
      .filter((f) => read(f).includes("js/main.js"));
    expect(pages.length).toBeGreaterThan(0);
    for (const page of pages) {
      expect(read(page)).toContain("js/main.js?v=11");
      expect(read(page)).not.toContain("js/main.js?v=10");
    }
  });
});
