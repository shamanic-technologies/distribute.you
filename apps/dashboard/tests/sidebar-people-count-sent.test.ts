import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The sidebar People count = people actually SENT an email (lead-service `people.sent`), the
// same figure as the People page's Contacted tab. The `contacted` bucket also counts people still
// queued, so the sidebar read 127 beside a Contacted tab at 73 (Beyond Logic, 2026-10-29).
const src = (f: string) => readFileSync(join(__dirname, "..", "src/components/v2", f), "utf8");

describe("sidebar People count", () => {
  it("reads people.sent in the nav entry", () => {
    const shell = src("v2-shell.tsx");
    const at = shell.indexOf('label="People"');
    const entry = shell.slice(at, shell.indexOf('label="Deals"'));
    expect(entry).toContain("buckets?.people?.sent");
    expect(entry).not.toContain("counts.contacted");
  });

  it("reads people.sent in the search palette footer", () => {
    const menus = src("sidebar-menus.tsx");
    const at = menus.indexOf("companies` : \"\"}");
    const footer = menus.slice(at, menus.indexOf("</span>", at));
    expect(footer).toContain("buckets.people.sent");
    expect(footer).not.toContain("counts.contacted");
  });
});
