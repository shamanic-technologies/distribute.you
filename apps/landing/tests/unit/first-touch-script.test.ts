import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FIRST_TOUCH_CAPTURE_SCRIPT } from "../../src/lib/first-touch-script";
import { FIRST_TOUCH_CAPTURE_SCRIPT as DASHBOARD_SCRIPT } from "../../../dashboard/src/lib/first-touch";

describe("first-touch capture on the landing", () => {
  it("is byte-equal to the dashboard's, so both hosts classify a visit the same way", () => {
    expect(FIRST_TOUCH_CAPTURE_SCRIPT).toBe(DASHBOARD_SCRIPT);
  });

  it("is rendered on every static page and in the React layout", () => {
    const html = readFileSync(join(__dirname, "../../src/lib/static-html.ts"), "utf8");
    expect(html).toContain("const firstTouch = `<script>${FIRST_TOUCH_CAPTURE_SCRIPT}</script>`");
    expect(html).toContain("return firstTouch + ga");
    const layout = readFileSync(join(__dirname, "../../src/app/layout.tsx"), "utf8");
    expect(layout).toContain("__html: FIRST_TOUCH_CAPTURE_SCRIPT");
  });
});
