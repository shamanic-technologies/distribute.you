import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The docs wear the brand guidelines of dashboard v2 (Keel): the blue brand
 * ramp, neutral greys, Geist. They wore a pink ramp and Inter until 2026-10-01
 * ("Update to our brand guidelines"), so the ramp is pinned to the dashboard's.
 */
const DOCS = join(__dirname, "../..");
const TAILWIND = readFileSync(join(DOCS, "tailwind.config.ts"), "utf8");
const DASH_CSS = readFileSync(join(DOCS, "../dashboard/src/app/globals.css"), "utf8");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const f = join(dir, e);
    return statSync(f).isDirectory() ? files(f) : /\.(tsx?|css)$/.test(e) ? [f] : [];
  });
}

describe("docs follow the dashboard v2 brand guidelines", () => {
  it("carry the dashboard's brand ramp, step for step", () => {
    for (const step of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]) {
      const m = DASH_CSS.match(new RegExp(`--color-brand-${step}: (oklch\\([^)]+\\));`));
      expect(m, `dashboard brand-${step}`).not.toBeNull();
      expect(TAILWIND).toContain(`${step}: "${m![1]}"`);
    }
  });

  it("set type in Geist, never Inter", () => {
    const layout = readFileSync(join(DOCS, "src/app/layout.tsx"), "utf8");
    expect(layout).toContain('import { Geist, Geist_Mono } from "next/font/google"');
    expect(TAILWIND).toContain('"var(--font-geist-sans)"');
    for (const f of [...files(join(DOCS, "src")), join(DOCS, "tailwind.config.ts")]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/family=Inter|"Inter"/);
    }
  });

  it("hold no trace of the retired pink ramp", () => {
    const PINK = /#ec4899|#db2777|#be185d|#fdf2f8|#f472b6|#f9a8d4|219, 39, 119/i;
    for (const f of [...files(join(DOCS, "src")), join(DOCS, "tailwind.config.ts")]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(PINK);
    }
  });
});

describe("the sidebar selects one row", () => {
  it("picks the most specific href, trailing slash or not", async () => {
    const { activeNavHref } = await import("@/components/sidebar");
    const hrefs = ["/", "/api", "/api/campaigns", "/mcp", "/mcp/tools"];
    expect(activeNavHref("/api/campaigns/", hrefs)).toBe("/api/campaigns");
    expect(activeNavHref("/api/", hrefs)).toBe("/api");
    expect(activeNavHref("/", hrefs)).toBe("/");
    expect(activeNavHref("/mcp/tools/", hrefs)).toBe("/mcp/tools");
    expect(activeNavHref("/openapi/", hrefs)).toBeNull();
  });
});
