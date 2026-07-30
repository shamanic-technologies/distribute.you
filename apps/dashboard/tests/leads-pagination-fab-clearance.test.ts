import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const LEADS = readFileSync(
  resolve(ROOT, "src/components/audiences/engaged-leads-page.tsx"),
  "utf8",
);
const FAB = readFileSync(
  resolve(ROOT, "src/components/support/support-button.tsx"),
  "utf8",
);

/** Slice the pagination block so the assertions cannot match markup elsewhere. */
function paginationBlock(): string {
  const at = LEADS.indexOf("filteredLeads.length > PAGE_SIZE");
  expect(at).toBeGreaterThan(-1);
  return LEADS.slice(at, at + 2400);
}

describe("leads pagination clears the floating support button", () => {
  it("the clearance is defined once, in the FAB's own file", () => {
    // Coupled to the FAB's size on purpose: the gutter must cover
    // right-4 (16px) + the button (48px, 56px on sm+) and still leave a gap.
    expect(FAB).toContain('export const SUPPORT_FAB_CLEARANCE = "pr-20"');
    expect(FAB).toContain("fixed right-4");
  });

  it("the pagination row consumes that constant, not a copied literal", () => {
    const block = paginationBlock();
    expect(block).toContain("${SUPPORT_FAB_CLEARANCE}");
    expect(LEADS).toContain(
      'import { SUPPORT_FAB_CLEARANCE } from "@/components/support/support-button"',
    );
    // A hardcoded gutter here would drift the moment the FAB is resized.
    expect(block).not.toContain('"pr-20');
    expect(block).not.toContain(" pr-20 ");
  });

  it("hides the page-number indicator below sm so the gutter cannot wrap the row", () => {
    // Measured at 390px: with the gutter AND this indicator, the row needs
    // exactly the width it has and "Page 1 of 26" wraps to a second line.
    const block = paginationBlock();
    expect(block).toContain('className="hidden sm:inline text-sm text-gray-500">Page ');
  });
});
