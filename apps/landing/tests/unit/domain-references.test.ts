import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * Regression test: ensure no old domain references remain in user-facing
 * landing app source files. Only distribute.you should appear.
 *
 * Excludes: node_modules, .next, package.json, package-lock.json (npm package names).
 */

const ROOT = join(__dirname, "../..");

const EXCLUDED_DIRS = new Set(["node_modules", ".next", ".git", "tests"]);
const EXCLUDED_FILES = new Set(["package.json", "package-lock.json"]);

function collectFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (EXCLUDED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...collectFiles(full));
    } else if (!EXCLUDED_FILES.has(entry)) {
      results.push(full);
    }
  }
  return results;
}

describe("domain references in landing app", () => {
  const files = collectFiles(ROOT);

  it("should not contain mcpfactory.org in any source file", () => {
    const matches: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      if (content.includes("mcpfactory.org")) {
        matches.push(file.replace(ROOT + "/", ""));
      }
    }
    expect(matches, `Files still referencing mcpfactory.org: ${matches.join(", ")}`).toEqual([]);
  });

  it("should not contain distribute.eu in any source file", () => {
    const matches: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      if (content.includes("distribute.eu")) {
        matches.push(file.replace(ROOT + "/", ""));
      }
    }
    expect(matches, `Files still referencing distribute.eu: ${matches.join(", ")}`).toEqual([]);
  });

  it("should not contain @distribute_eu twitter handle", () => {
    const matches: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      if (content.includes("@distribute_eu")) {
        matches.push(file.replace(ROOT + "/", ""));
      }
    }
    expect(matches, `Files still referencing @distribute_eu: ${matches.join(", ")}`).toEqual([]);
  });

  it("should use ENV_URLS.landing in sitemap", () => {
    const sitemap = readFileSync(join(ROOT, "src/app/sitemap.ts"), "utf-8");
    expect(sitemap).toContain("ENV_URLS.landing");
  });

  it("should use distribute.you in robots.txt", () => {
    const robots = readFileSync(join(ROOT, "public/robots.txt"), "utf-8");
    expect(robots).toContain("https://distribute.you");
  });

  it("should use @distribute_you twitter handle in layout", () => {
    const layout = readFileSync(join(ROOT, "src/app/layout.tsx"), "utf-8");
    expect(layout).toContain("@distribute_you");
  });
});
