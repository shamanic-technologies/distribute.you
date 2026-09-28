import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

// v1 components embedded in v2 pages read as v2 through ONE CSS layer (keel.css),
// scoped to `.v2-embed`, so v1 itself is untouched.
describe("v2 embed layer", () => {
  it("every V2Page wraps its body in .v2-embed", () => {
    const setup = read("src/components/v2/setup-pages.tsx");
    const page = setup.slice(setup.indexOf("export function V2Page("), setup.indexOf("// ─── Offers"));
    expect(page).toContain('<div className="v2-embed">{children}</div>');
  });

  it("the layer is scoped to .v2-root .v2-embed and maps the v1 families onto Keel tokens", () => {
    const css = read("src/components/v2/keel.css");
    const layer = css.slice(css.indexOf("v1 components inside v2"));
    for (const rule of [
      ".v2-root .v2-embed .text-gray-500",
      ".v2-root .v2-embed .border-gray-200",
      ".v2-root .v2-embed .rounded-xl.border",
      ".v2-root .v2-embed button.bg-brand-600",
      ".v2-root .v2-embed th[class]",
    ]) {
      expect(layer, rule).toContain(rule);
    }
    // Every selector in the layer is scoped, so the v1 dashboard cannot change.
    const selectors = layer.split("}").map((b) => b.split("{")[0]).filter((s) => s.includes(".") && !s.includes("*/"));
    for (const s of selectors) {
      for (const part of s.split(",")) {
        if (part.trim()) expect(part.trim().startsWith(".v2-root .v2-embed"), part.trim()).toBe(true);
      }
    }
  });
});
