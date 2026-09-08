import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/blog/db", () => ({ listArticles: vi.fn(async () => []) }));

import { renderAboutPage } from "../../src/lib/pages/about";
import { renderContactPage } from "../../src/lib/pages/contact";
import { renderDevelopersPage } from "../../src/lib/pages/developers";
import { renderNotFoundPage } from "../../src/lib/pages/not-found";
import { renderComparePage } from "../../src/lib/compare-page";
import { COMPETITORS } from "../../src/lib/competitors";
import { V2_STYLES_VERSION } from "../../src/lib/v2-shell";

/**
 * The pages the homepage footer links (minus the comparison cluster, which has its own
 * guards) and the chrome they wear.
 *
 * The homepage was rebuilt (`index-v2.html`) and for a while every page behind its
 * footer still wore the previous design: a JS-injected nav with a "beta" chip and
 * links to pages the new footer no longer named, a footer describing an "AI outreach
 * automation platform", and React pages on the same old chrome. This guard pins that
 * every one of them now wears the homepage's nav and footer, from ONE shell, and that
 * the copy behind the footer states the positioning the homepage states.
 */
const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const home = read("public/landing/index-v2.html");

const RENDERED = {
  about: renderAboutPage(),
  contact: renderContactPage(),
  developers: renderDevelopersPage(),
  "404": renderNotFoundPage(),
};

describe("every rendered document page wears the homepage chrome", () => {
  for (const [name, html] of Object.entries(RENDERED)) {
    it(`${name}: the pill nav, the footer columns and the homepage stylesheet`, () => {
      expect(html).toContain('<div class="nav-pill">');
      expect(html).toContain('href="https://dashboard.distribute.you/sign-in">Log in');
      expect(html).toContain('href="https://dashboard.distribute.you/sign-up">Start free');
      expect(html).toContain(`href="/landing/v2/styles.css?v=${V2_STYLES_VERSION}"`);
      for (const col of ["<h4>Product</h4>", "<h4>Compare</h4>", "<h4>Company</h4>", "<h4>Legal</h4>"]) {
        expect(html).toContain(col);
      }
      for (const c of COMPETITORS) {
        expect(html).toContain(`href="/compare/${c.slug}">distribute.you vs `);
      }
      // Nothing of the previous chrome.
      expect(html).not.toContain("components.js");
      expect(html).not.toContain("/landing/css/");
      expect(html).not.toContain("nav-chip");
      expect(html).not.toContain(">beta<");
    });

    it(`${name}: links no page the homepage footer no longer names`, () => {
      expect(html).not.toMatch(/href="(https:\/\/distribute\.you)?\/(pricing|performance|use-cases|how-it-works|cold-email-[a-z-]+|v1|v2|v3)(["/#?])/);
    });

    it(`${name}: no em-dash, no cost-is-ours framing`, () => {
      expect(html).not.toContain(String.fromCharCode(0x2014));
      const lower = html.toLowerCase();
      expect(lower).not.toContain("costs us");
      expect(lower).not.toContain("at cost");
      expect(lower).not.toContain("cold email tool");
    });
  }

  it("the homepage and the comparison pages share the same stylesheet version", () => {
    expect(home).toContain(`href="/landing/v2/styles.css?v=${V2_STYLES_VERSION}"`);
    expect(renderComparePage(COMPETITORS[0])).toContain(
      `href="/landing/v2/styles.css?v=${V2_STYLES_VERSION}"`,
    );
  });

  it("the homepage footer and the rendered footer name the same pages", () => {
    const links = (html: string) =>
      [...html.matchAll(/<footer>[\s\S]*<\/footer>/g)]
        .flatMap((m) => [...m[0].matchAll(/href="([^"]+)"/g)].map((h) => h[1]))
        .map((h) => h.replace("https://distribute.you", "").replace(/^\/#/, "#"))
        .filter((h) => h !== "/")
        .sort();
    expect(links(RENDERED.about)).toEqual(links(home));
  });

  it("the 404 is not indexed and carries no CTA box", () => {
    expect(RENDERED["404"]).toContain('<meta name="robots" content="noindex">');
    expect(RENDERED["404"]).not.toContain("cta-box");
  });
});

describe("the React pages wear the same chrome", () => {
  const navbar = read("src/components/navbar.tsx");
  const footer = read("src/components/footer.tsx");

  it("the navbar carries the homepage links and actions, and no beta chip", () => {
    for (const href of ['href: "/#how"', 'href: "/#pricing"', 'href: "/compare"', 'href: "/#faq"']) {
      expect(navbar).toContain(href);
    }
    expect(navbar).toContain("Start free");
    expect(navbar).toContain("Log in");
    expect(navbar).not.toMatch(/beta/i);
    expect(navbar).not.toContain("/how-it-works");
  });

  it("the footer reads its Compare column from the catalogue and states no retired offer", () => {
    expect(footer).toContain("COMPETITORS.map(");
    expect(footer).toContain('href: "/about"');
    expect(footer).toContain('href: "/investors"');
    expect(footer).toContain('href: "/developers"');
    expect(footer).not.toMatch(/\$400|cold email outreach|beta|Gmail|\/pricing"|\/performance"/);
  });

  for (const page of [
    "src/app/investors/page.tsx",
    "src/app/terms/page.tsx",
    "src/app/privacy/page.tsx",
    "src/app/blog/page.tsx",
    "src/app/blog/[slug]/page.tsx",
  ]) {
    it(`${page} mounts the shared Navbar and Footer`, () => {
      const src = read(page);
      expect(src).toContain("<Navbar />");
      expect(src).toMatch(/<Footer( |\/>)/);
    });
  }
});

describe("the copy behind the footer states the current positioning", () => {
  const surfaces = [
    "src/app/layout.tsx",
    "src/lib/seo.ts",
    "src/app/investors/page.tsx",
    "src/components/investors/data-sections.tsx",
    "src/app/terms/page.tsx",
    "src/app/privacy/page.tsx",
    "src/app/blog/page.tsx",
    "src/components/footer.tsx",
    "src/components/navbar.tsx",
    "src/lib/v2-shell.ts",
    "src/lib/pages/about.ts",
    "src/lib/pages/contact.ts",
    "src/lib/pages/developers.ts",
    "public/llms.txt",
  ];
  // Each is a claim the homepage no longer makes, with the reason it is retired.
  const RETIRED: [RegExp, string][] = [
    [/\$400/, "the welcome offer is $30 at signup"],
    [/first \$400 spent matched/i, "nothing is matched any more"],
    [/bring-your-own-keys|BYOK/i, "customers do not bring keys; we run every vendor"],
    [/cold email outreach done for you/i, "cold email is the channel, not what is sold"],
    [/cold email outreach platform/i, "an agency, not a platform"],
    [/forward(s|ed)? buyers to Gmail/i, "interested replies are answered, then handed over with the meeting"],
    [/\b(Vercel|Railway|Neon)\b/, "the fleet runs on a Hetzner box behind Cloudflare"],
    [/Stories from the Solo Path/, "the blog is about B2B acquisition"],
    [/What We Need From Investors in [A-Z][a-z]+ 20\d\d/, "the ask carries no month"],
    [/distribute\.you\/(pricing|performance|use-cases)\b/, "those pages are gone"],
  ];
  for (const surface of surfaces) {
    it(`${surface} makes no retired claim`, () => {
      const src = read(surface);
      for (const [pattern, why] of RETIRED) {
        expect(pattern.test(src), `${surface} still says ${pattern} (${why})`).toBe(false);
      }
    });
  }

  it("the root layout declares no canonical for every page to inherit", () => {
    // A canonical in the root layout is inherited by every page that states none, which
    // tells a crawler that page is a duplicate of the homepage.
    expect(read("src/app/layout.tsx")).not.toMatch(/alternates:\s*\{\s*canonical/);
  });

  it("the terms state the current offer and describe an agency", () => {
    const terms = read("src/app/terms/page.tsx");
    expect(terms).toContain("(currently $30)");
    expect(terms).toContain("(currently $500 for each side of a referral)");
    expect(terms).toContain("is an acquisition agency delivered as a service");
    expect(terms).toContain('const LAST_UPDATED = "September 8, 2026"');
  });
});

describe("the orphaned pages are gone, everywhere they were listed", () => {
  const ROUTES = [
    "src/app/pricing",
    "src/app/performance",
    "src/app/use-cases",
    "src/app/v1",
    "src/app/v2",
    "src/app/v3",
    "src/app/cold-email-cost-guide",
    "src/app/cold-email-vs-linkedin",
    "src/app/cold-email-for-saas-founders",
    "public/landing/pricing.html",
    "public/landing/performance.html",
    "public/landing/use-cases.html",
    "public/landing/index-v1.html",
    "public/landing/archive-blue.html",
    "public/landing/about.html",
    "public/landing/contact.html",
    "public/landing/developers.html",
    "public/landing/404.html",
    "public/landing/js/components.js",
    "public/landing/css",
  ];
  for (const p of ROUTES) {
    it(`${p} does not exist`, () => {
      expect(existsSync(path.join(ROOT, p))).toBe(false);
    });
  }

  it("the sitemap lists none of them", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((e) => e.url);
    for (const gone of ["/pricing", "/performance", "/use-cases", "/cold-email-cost-guide", "/v3"]) {
      expect(urls).not.toContain(`https://distribute.you${gone}`);
    }
    for (const kept of ["/about", "/contact", "/developers", "/investors", "/terms", "/privacy", "/blog", "/compare"]) {
      expect(urls).toContain(`https://distribute.you${kept}`);
    }
  });

  it("/how-it-works survives as a redirect onto the homepage section", () => {
    expect(read("src/app/how-it-works/route.ts")).toContain('Location: "/#how"');
  });

  it("the live-figure machinery those pages carried is gone from the pipeline", () => {
    const pipeline = read("src/lib/static-html.ts");
    for (const token of ["__CAC_PRICE__", "__HERO_CONSOLE__", "__TICKER_BOARD__", "__BEST_POSITIVE_REPLY_COST__"]) {
      expect(pipeline).not.toContain(token);
    }
    expect(pipeline).toContain("__HOT_LEAD_ROW__");
    expect(pipeline).toContain("__HOT_LEAD_BAND__");
  });
});
