import { describe, expect, it } from "vitest";

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { DISTRY_CHAT_URL, applyDistrySkin, hourFor, isHydratedPage, isSkinPassThrough, isSkinnedStylesheet, placeSections, sceneFor, skinStylesheet, withDistryLogo } from "../../src/lib/distry-skin";

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
  it("keeps the night for the opening section and a clean day for the rest", () => {
    const out = placeSections("<section>a</section><section class=\"framed\" id=\"x\">b</section><section>c</section>");
    expect(out).toContain('<section class="d-night" data-sky="0.00"');
    expect(out).toContain('class="framed d-day" id="x" data-sky="1.00"');
    expect(out.match(/d-day/g)).toHaveLength(2);
    expect(out).not.toContain("d-dawn");
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

describe("sceneFor", () => {
  const ASSETS = path.resolve(__dirname, "../../public/landing/distry/assets");
  const cases: [string, string][] = [
    ["/ai-sdr", "page-meetings"],
    ["/ai-sdr/vs/11x", "page-compare"],
    ["/compare/explee", "page-compare"],
    ["/cold-email-agency/best/cold-email-agency-for-saas-founders", "page-best"],
    ["/blog/some-article", "page-blog"],
    ["/gtm-agency", "page-gtm"],
    ["/website-traffic-agency", "page-traffic"],
    ["/database-reactivation-agency", "page-nurturing"],
    ["/indexes/cold-email-cost-per-meeting", "page-indexes"],
    ["/catalog", "page-catalog"],
    ["/docs/mcp", "page-docs"],
    ["/terms", "page-legal"],
    ["/investors", "page-investors"],
    ["/something-else", "hero-night"],
  ];

  it("gives each kind of page its own painting, comparisons first", () => {
    for (const [pathname, scene] of cases) expect(sceneFor(pathname), pathname).toBe(scene);
    expect(sceneFor("/ai-sdr", 404)).toBe("page-notfound");
  });

  it("names only paintings that are on disk", () => {
    for (const scene of new Set([...cases.map(([, scene]) => scene), "page-notfound", "page-about", "page-contact", "page-ads", "page-leadgen", "page-signups", "page-cold-email", "page-customer-success"])) {
      expect(existsSync(path.join(ASSETS, `${scene}.webp`)), scene).toBe(true);
    }
  });

  it("frames the painting once, in the closing box, never as a background", () => {
    const out = applyDistrySkin('<html><head></head><body><section><h1>a</h1></section><section><div class="cta-box rv"><h2>b</h2></div></section><footer></footer></body></html>', "/catalog");
    expect(out.match(/class="d-frame"/g)).toHaveLength(1);
    expect(out).toContain("/landing/distry/assets/page-catalog.webp");
    expect(out.indexOf('class="d-frame"')).toBeGreaterThan(out.indexOf('class="cta-box rv"'));
    expect(out.indexOf('class="d-frame"')).toBeLessThan(out.indexOf("<h2>b</h2>"));
    expect(out).not.toContain("background-image");
  });

  it("frames it above the footer on a page with no closing box", () => {
    const out = applyDistrySkin("<html><head></head><body><section><h1>a</h1></section><footer></footer></body></html>", "/catalog");
    expect(out.indexOf('class="d-frame"')).toBeGreaterThan(out.indexOf("</section>"));
    expect(out.indexOf('class="d-frame"')).toBeLessThan(out.indexOf("<footer"));
  });
});

describe("a page React hydrates", () => {
  const page = `<!doctype html><html><head><title>t</title></head><body><main><section><h1>a</h1></section></main><script>self.__next_f=self.__next_f||[]</script></body></html>`;
  const out = applyDistrySkin(page, "/terms");

  it("is recognised", () => {
    expect(isHydratedPage(page)).toBe(true);
    expect(isHydratedPage("<html><head></head><body><section></section></body></html>")).toBe(false);
  });

  it("gets nothing added to its body: React would throw it away", () => {
    const body = (html: string) => html.slice(html.indexOf("<body"));
    expect(body(out)).toBe(body(page));
  });

  it("hands the sky, Distry, the lines and the painting to the script instead", () => {
    const head = out.slice(0, out.indexOf("</head>"));
    expect(head).toContain("window.__distry=");
    expect(head).toContain('"late":true');
    expect(head).toContain("/landing/distry/assets/page-legal.webp");
    expect(head).toContain("/landing/distry/distry.js?v=");
    // The handover sits in a script: no raw tag may close it early.
    const handover = head.slice(head.indexOf("window.__distry="), head.indexOf("</script>", head.indexOf("window.__distry=")));
    expect(handover).not.toContain("<");
  });
});

describe("Distry's mark replaces the site's", () => {
  it("swaps every use of the site logo on a static page", () => {
    const out = applyDistrySkin('<html><head></head><body><section><img src="/landing/v2/assets/logo-mark.svg"></section><footer><img src="/landing/v2/assets/logo-mark.svg"></footer></body></html>', "/ai-sdr");
    expect(out).not.toContain("/landing/v2/assets/logo-mark.svg");
    expect(out.match(/\/landing\/distry\/assets\/distry-mark\.webp/g)!.length).toBeGreaterThanOrEqual(2);
    expect(out).toContain("/landing/distry/assets/distry-mark-64.png");
    expect(withDistryLogo("x")).toBe("x");
  });

  it("hands the logo to the script on a page React hydrates", () => {
    const out = applyDistrySkin('<html><head></head><body><main></main><script>self.__next_f=[]</script></body></html>', "/blog");
    expect(out).toContain('"logo":"/landing/distry/assets/distry-mark.webp"');
  });

  it("ships the logo, and the home wears it", () => {
    expect(existsSync(path.resolve(__dirname, "../../public/landing/distry/assets/distry-mark.webp"))).toBe(true);
    const route = readFileSync(path.resolve(__dirname, "../../src/app/internal-prototype/[slug]/[[...path]]/route.ts"), "utf8");
    expect(route).toMatch(/withDistryLogo\(\s*withLabHome\(await withOutcomeRanges\(await withLiveFigures\(/);
  });
});

describe("Distry beside the visitor is a way to talk to us", () => {
  const skinCss = readFileSync(path.resolve(__dirname, "../../public/landing/distry/skin.css"), "utf8");

  it("is a link a visitor can click, on static and on hydrated pages", () => {
    const fixed = applyDistrySkin("<html><head></head><body><section></section></body></html>", "/ai-sdr");
    expect(fixed).toContain(`<a class="buddy-face" href="${DISTRY_CHAT_URL}"`);
    expect(fixed).toContain('aria-label="Chat with Distry"');
    const hydrated = applyDistrySkin("<html><head></head><body><main></main><script>self.__next_f=[]</script></body></html>", "/blog");
    expect(hydrated).toContain("buddy-face");
    expect(hydrated).toContain("wa.me/33680478702");
    expect(skinCss).toMatch(/\.buddy-face \{[^}]*pointer-events: auto/);
  });

  it("replaces the floating WhatsApp button instead of sitting beside it", () => {
    expect(skinCss).toContain('a[aria-label="Chat with us on WhatsApp"] { display: none !important; }');
    // The button the rule hides is spelled this way in the component.
    expect(readFileSync(path.resolve(__dirname, "../../src/components/support-whatsapp-button.tsx"), "utf8")).toContain('aria-label="Chat with us on WhatsApp"');
  });

  it("shows the chat preview without the green WhatsApp phone", () => {
    expect(skinCss).toMatch(/html\.distry \.wa-top \{[^}]*background: #ffffff/);
    expect(skinCss).toMatch(/html\.distry \.wa-row\.out \.wa-msg \{[^}]*background: #2563eb/);
  });
});
