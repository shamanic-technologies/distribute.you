import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { wrapTables } from "../../src/lib/blog/table-scroll";

describe("wrapTables: wide article tables scroll inside their own box on a phone", () => {
  it("wraps every table in the scroll box", () => {
    const html = '<p>a</p><table class="x"><tr><td>1</td></tr></table><p>b</p><TABLE><tr><td>2</td></tr></TABLE>';
    expect(wrapTables(html)).toBe(
      '<p>a</p><div class="dy-table-scroll"><table class="x"><tr><td>1</td></tr></table></div><p>b</p><div class="dy-table-scroll"><TABLE><tr><td>2</td></tr></TABLE></div>',
    );
  });

  it("leaves a body with no table untouched", () => {
    expect(wrapTables("<p>no table</p>")).toBe("<p>no table</p>");
  });

  it("the article page renders the wrapped body", () => {
    const src = readFileSync("src/app/blog/[slug]/page.tsx", "utf8");
    expect(src).toContain("__html: wrapTables(body)");
  });

  it("the scroll box scrolls sideways", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/\.dy-table-scroll\s*\{[^}]*overflow-x:\s*auto/);
  });
});
