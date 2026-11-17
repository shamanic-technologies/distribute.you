import { describe, expect, it } from "vitest";

import { applyDistrySkin, hourFor, isSkinPassThrough, isSkinnedStylesheet, placeSections, skinStylesheet } from "../../src/lib/distry-skin";

describe("which requests a skin host fetches and skins", () => {
  it("lets files and framework internals through", () => {
    for (const p of ["/_next/static/chunks/a.js", "/landing/v2/main.js", "/landing/distry/assets/hero-night.webp", "/favicon.ico", "/api/x", "/blog/a/hero.png"]) {
      expect(isSkinPassThrough(p), p).toBe(true);
    }
  });

  it("skins every document, and re-themes the live stylesheets", () => {
    for (const p of ["/ai-sdr", "/compare/explee", "/blog", "/blog/some-article", "/docs/mcp", "/terms"]) {
      expect(isSkinPassThrough(p), p).toBe(false);
    }
    expect(isSkinnedStylesheet("/landing/v2/styles.css")).toBe(true);
    expect(isSkinPassThrough("/landing/v2/styles.css")).toBe(false);
    expect(isSkinnedStylesheet("/landing/distry/skin.css")).toBe(false);
  });
});

describe("skinStylesheet", () => {
  it("turns a white surface into paper and keeps a white ink", () => {
    const out = skinStylesheet(".card { background: #fff; border: 1px solid #ffffff; } .btn-accent { background: var(--accent); color: #fff; }");
    expect(out).toContain("background: var(--d-card, #fff)");
    expect(out).toContain("border: 1px solid var(--d-card, #fff)");
    expect(out).toContain("color: #fff");
  });

  it("gives every surface the paper tokens, and ink when it sets none", () => {
    const out = skinStylesheet(".card { background: #fff; } .panel { background: var(--surface); color: red; }");
    const card = out.slice(out.indexOf(".card"), out.indexOf(".panel"));
    expect(card).toContain("--text:#0b1230");
    expect(card).toContain("color:var(--text)");
    const panel = out.slice(out.indexOf(".panel"));
    expect(panel).toContain("--text:#0b1230");
    expect(panel).not.toContain("color:var(--text)");
  });

  it("leaves the page-level bands to the sky", () => {
    const out = skinStylesheet("body { background: var(--bg); } section.tint { background: linear-gradient(#ffffff, var(--accent-50)); } .hero { background: #fff; }");
    expect(out).not.toContain("--text:#0b1230");
  });

  it("reaches rules inside a media query and leaves the at-rule alone", () => {
    const out = skinStylesheet("@media (max-width: 640px) { .card { background: #fff; } }");
    expect(out).toContain("@media (max-width: 640px)");
    expect(out).toContain("--text:#0b1230");
  });
});

describe("placeSections", () => {
  it("walks the page from night to day", () => {
    const out = placeSections("<section>a</section><section class=\"framed\" id=\"x\">b</section><section>c</section>");
    expect(out).toContain('<section class="d-night" data-sky="0.00"');
    expect(out).toContain('class="framed d-dawn" id="x" data-sky="0.50"');
    expect(out).toContain('<section class="d-day" data-sky="1.00"');
    expect(out.match(/data-say="/g)).toHaveLength(3);
  });

  it("keeps a one-section page in the night", () => {
    expect(placeSections("<section>a</section>")).toContain('data-sky="0.00"');
    expect(hourFor(0)).toBe("night");
    expect(hourFor(0.5)).toBe("dawn");
    expect(hourFor(1)).toBe("day");
  });
});

describe("applyDistrySkin", () => {
  const page = `<!doctype html><html><head><title>t</title><script async src="https://www.googletagmanager.com/gtag/js?id=G-1"></script><script>posthog.init("k")</script><script type="application/ld+json">{"name":"posthog"}</script></head><body class="x"><section><a href="https://distribute.you/catalog">c</a><a href="https://distribute.you">h</a><a href="https://dashboard.distribute.you/get-started">go</a></section><script src="/landing/v2/main.js" defer></script></body></html>`;
  const out = applyDistrySkin(page);

  it("adds the sky, the stylesheet, Distry and the script", () => {
    expect(out).toContain('class="d-sky"');
    expect(out).toContain("/landing/distry/skin.css?v=");
    expect(out).toContain('id="buddy"');
    expect(out).toContain("/landing/distry/distry.js?v=");
    expect(out).toContain('name="robots" content="noindex, nofollow"');
    // Index compare: the skin stylesheet must come after the page's own head, the sky first in the body.
    expect(out.indexOf("skin.css")).toBeGreaterThan(out.indexOf("<title>"));
    expect(out.indexOf('class="d-sky"')).toBeLessThan(out.indexOf("<section"));
  });

  it("drops the trackers and keeps the page's own scripts and JSON-LD", () => {
    expect(out).not.toContain("googletagmanager");
    expect(out).not.toContain("posthog.init");
    expect(out).toContain("application/ld+json");
    expect(out).toContain("/landing/v2/main.js");
  });

  it("keeps site links on the reviewed host and leaves the app links alone", () => {
    expect(out).toContain('href="/catalog"');
    expect(out).toContain('<a href="/">h</a>');
    expect(out).toContain('href="https://dashboard.distribute.you/get-started"');
  });

  it("returns anything that is not a document untouched", () => {
    expect(applyDistrySkin("{}")).toBe("{}");
  });
});
