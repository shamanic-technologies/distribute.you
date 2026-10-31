import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { footerInnerHtml } from "../../src/lib/site-chrome";

/**
 * The footer is treg.to's dark closing chapter (owner 2026-10-31: « fais-nous la même
 * chose »): a black band, a dot field drawn in WebGL that the cursor pushes aside, and the
 * giant faint wordmark cropped by the page edge. These guards hold what is not looks: the
 * field never runs under reduced motion or off screen, and the wordmark stays decorative.
 */
const V2 = path.resolve(__dirname, "../../public/landing/v2");
const field = readFileSync(path.join(V2, "footer-field.js"), "utf8");
const main = readFileSync(path.join(V2, "main.js"), "utf8");
const css = readFileSync(path.join(V2, "styles.css"), "utf8");
const react = readFileSync(path.resolve(__dirname, "../../src/components/footer.tsx"), "utf8");

describe("the footer dot field", () => {
  it("loads only on a page with a footer and only when motion is welcome", () => {
    const load = main.slice(main.indexOf("footer-field.js") - 300, main.indexOf("footer-field.js"));
    expect(load).toContain("!reduced");
    expect(load).toContain('document.querySelector("footer")');
    expect(field).toContain("if (reduced.matches) return;");
  });

  it("draws only while the footer is on screen and the tab is visible", () => {
    expect(field).toContain("new IntersectionObserver(");
    expect(field).toContain("if (!visible || document.hidden)");
    expect(field).toContain("Math.min(window.devicePixelRatio || 1, 1.25)");
  });

  it("keeps a static dot texture as the state without the field", () => {
    const at = css.indexOf("Footer: the dark closing chapter");
    const rule = css.slice(at, css.indexOf("footer.has-field", at));
    expect(rule).toContain("background: #000");
    expect(rule).toContain("radial-gradient(");
  });

  it("runs the same script on the React pages' footer", () => {
    expect(react).toContain('src="/landing/v2/footer-field.js?v=1"');
    expect(main).toContain('"/landing/v2/footer-field.js?v=1"');
  });
});

describe("the wordmark", () => {
  it("is decorative: hidden from assistive tech, links untouched", () => {
    const html = footerInnerHtml("/");
    expect(html).toContain('<div class="foot-mark" aria-hidden="true">distribute.you</div>');
    expect(react).toContain('aria-hidden="true"');
  });
});
