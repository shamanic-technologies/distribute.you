import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Sign-in must work on networks that cannot reach Clerk's own IPs (Kazakhtelecom,
// 2026-11-17): the Clerk Frontend API is served through our domain at /__clerk.
const src = readFileSync(join(__dirname, "../src/proxy.ts"), "utf8");

describe("Clerk Frontend API proxy", () => {
  it("serves /__clerk through clerkMiddleware, scoped to the proxy path only", () => {
    expect(src).toContain('frontendApiProxy: { enabled: (url: URL) => url.pathname.startsWith("/__clerk") }');
  });

  it("runs the middleware on /__clerk paths, .js files included", () => {
    expect(src).toContain('"/__clerk/(.*)"');
  });
});
