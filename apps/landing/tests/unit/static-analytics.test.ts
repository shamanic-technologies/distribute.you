import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { staticHtml } from "../../src/lib/static-html";

// The landing pages are served as raw HTML via route handlers that bypass
// the React root layout (GA) and Next client instrumentation (PostHog).
// staticHtml must inject both so the home + SEO cluster record unique visits.
describe("Static landing pages carry GA + PostHog", () => {
  const prevToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

  beforeAll(() => {
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "phc_test_token";
  });
  afterAll(() => {
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = prevToken;
  });

  const pages = [
    "index-v1.html",
    "performance.html",
    "use-cases.html",
    "cold-email-cost-guide.html",
    "cold-email-cost-guide/cold-email-roi.html",
    "cold-email-for-saas-founders/ai-cold-email-saas-founders.html",
    "cold-email-vs-linkedin/multichannel-outreach-strategy.html",
  ];

  for (const page of pages) {
    it(`injects GA + PostHog into ${page}`, () => {
      const html = staticHtml(page);
      expect(html).toContain(
        "googletagmanager.com/gtag/js?id=G-YJHNGLEJPP",
      );
      expect(html).toContain("gtag('config','G-YJHNGLEJPP')");
      // Google Ads tag (no conversion event on the landing — linker only)
      expect(html).toContain("gtag('config','AW-18233267088')");
      expect(html).toContain("posthog.init('phc_test_token'");
      // both trackers land inside <head>, before content
      expect(html.indexOf("googletagmanager")).toBeLessThan(
        html.indexOf("</head>"),
      );
      expect(html.indexOf("AW-18233267088")).toBeLessThan(
        html.indexOf("</head>"),
      );
    });
  }

  it("omits the PostHog snippet when no token is configured", () => {
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "";
    const html = staticHtml("index-v1.html");
    expect(html).toContain("googletagmanager.com/gtag/js?id=G-YJHNGLEJPP");
    expect(html).not.toContain("posthog.init(");
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "phc_test_token";
  });
});
