import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Owner 2026-10-10: "Mets l'Unibox en GA". Every signed-in customer reaches it. */
const read = (p: string) => readFileSync(join(__dirname, "../src", p), "utf8");

describe("the Unibox is GA", () => {
  it("the page renders for everyone, not behind StaffOnly", () => {
    const page = read("app/(authed)/v2/orgs/[orgId]/brands/[brandId]/unibox/page.tsx");
    expect(page).not.toContain("StaffOnly");
    expect(page).toContain("<UniboxPage />");
  });

  it("its sidebar entry and palette row are not staff-gated", () => {
    const shell = read("components/v2/v2-shell.tsx");
    const at = shell.indexOf('href={v2Href(orgId, brandId, "unibox")}');
    expect(at).toBeGreaterThan(0);
    // The 80 characters before the entry: no staff gate opening on it.
    expect(shell.slice(at - 80, at)).not.toContain("staffMode &&");
    const menus = read("components/v2/sidebar-menus.tsx");
    const row = menus.indexOf('words: "Unibox conversations inbox"');
    expect(row).toBeGreaterThan(0);
    expect(menus.slice(row - 200, row)).not.toContain("staffMode");
  });

  it("our internal 'Not cleaned' chip stays staff only", () => {
    const view = read("components/v2/integrations-conversations.tsx");
    expect(view).toContain('{staffMode && notCleaned && <span className="k-chip shrink-0">Not cleaned</span>}');
  });
});
