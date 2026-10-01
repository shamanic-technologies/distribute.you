import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * Regression test: ensure no old color token references (primary, secondary,
 * accent) remain in the docs app source files. All colors should use the
 * new `brand` token or built-in Tailwind colors (gray, etc.).
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

describe("color system in docs app", () => {
  const files = collectFiles(ROOT);

  it("should not contain primary-* Tailwind class references", () => {
    const matches: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      // Match Tailwind-style primary- references (e.g. text-primary-500, bg-primary-100)
      if (/(?:text|bg|border|ring|shadow|from|to|via|hover:|focus:|active:)-?primary-\d{2,3}/.test(content)) {
        matches.push(file.replace(ROOT + "/", ""));
      }
    }
    expect(matches, `Files still using primary-* color classes: ${matches.join(", ")}`).toEqual([]);
  });

  it("should not contain secondary-* Tailwind class references", () => {
    const matches: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      if (/(?:text|bg|border|ring|shadow|from|to|via|hover:|focus:|active:)-?secondary-\d{2,3}/.test(content)) {
        matches.push(file.replace(ROOT + "/", ""));
      }
    }
    expect(matches, `Files still using secondary-* color classes: ${matches.join(", ")}`).toEqual([]);
  });

  it("should not contain accent-* Tailwind class references", () => {
    const matches: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      if (/(?:text|bg|border|ring|shadow|from|to|via|hover:|focus:|active:)-?accent-\d{2,3}/.test(content)) {
        matches.push(file.replace(ROOT + "/", ""));
      }
    }
    expect(matches, `Files still using accent-* color classes: ${matches.join(", ")}`).toEqual([]);
  });

  it("should not define primary/secondary/accent in tailwind config", () => {
    const config = readFileSync(join(ROOT, "tailwind.config.ts"), "utf-8");
    expect(config).not.toMatch(/\bprimary\b/);
    expect(config).not.toMatch(/\bsecondary\b/);
    expect(config).not.toMatch(/\baccent\b/);
  });

  it("should define brand color in tailwind config", () => {
    const config = readFileSync(join(ROOT, "tailwind.config.ts"), "utf-8");
    expect(config).toContain("brand");
    // The blue ramp of dashboard v2; brand-guidelines.test.ts pins every step.
    expect(config).toContain('600: "oklch(54% 0.16 258)"');
  });

  it("should not contain old orange hex values in globals.css", () => {
    const css = readFileSync(join(ROOT, "src/app/globals.css"), "utf-8");
    expect(css).not.toContain("#f97316"); // old primary-500
    expect(css).not.toContain("#ea580c"); // old primary-600
    expect(css).not.toContain("#c2410c"); // old primary-700
    expect(css).not.toContain("#fff7ed"); // old primary-50
  });

  it("colours links and code from the brand ramp in globals.css", () => {
    const css = readFileSync(join(ROOT, "src/app/globals.css"), "utf-8");
    expect(css).toContain("color: theme('colors.brand.600');"); // links
    expect(css).toContain("color: theme('colors.brand.700');"); // code, link hover
    expect(css).toContain("background-color: theme('colors.brand.50');"); // code bg
  });
});
