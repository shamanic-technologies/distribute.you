import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The React landing pages (investors/benchmarks/privacy/terms/blog) render
// through src/app/layout.tsx, which is SEPARATE from the static-served HTML
// (guarded by static-analytics.test.ts). The Google Ads tag must be config'd
// here too so a gclid landing on a React page sets the `_gcl_aw` cookie on
// `.distribute.you` for cross-subdomain conversion attribution. #1394 silently
// dropped this config; nothing caught it. This guard pins it.
describe("React landing layout carries GA + Google Ads config", () => {
  const src = readFileSync(
    fileURLToPath(new URL("../../src/app/layout.tsx", import.meta.url)),
    "utf8",
  );

  it("configs GA4", () => {
    expect(src).toContain("gtag('config','G-YJHNGLEJPP')");
  });

  it("configs the Google Ads gclid carrier tag", () => {
    expect(src).toContain("gtag('config','AW-18233267088')");
  });
});
