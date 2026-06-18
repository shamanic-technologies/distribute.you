import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const contextSidebar = fs.readFileSync(
  path.join(__dirname, "../src/components/context-sidebar.tsx"),
  "utf-8",
);
// campaign-sidebar.tsx + mcp-sidebar.tsx were deleted with the campaign concept.

describe("Sidebars render Feature Service entities flat — no hardcoded outcome groups", () => {
  describe("context-sidebar.tsx", () => {
    it("has no OUTCOME_GROUPS constant", () => {
      expect(contextSidebar).not.toMatch(/OUTCOME_GROUPS/);
    });

    it("has no groupOutcomeItems helper", () => {
      expect(contextSidebar).not.toMatch(/groupOutcomeItems/);
    });

    it("has no CollapsibleGroup or CollapsibleGroupList components", () => {
      expect(contextSidebar).not.toMatch(/CollapsibleGroup/);
      expect(contextSidebar).not.toMatch(/CollapsibleGroupList/);
    });

    it("renders BrandLevelSidebar top items flat (no hardcoded outcome groups)", () => {
      // The old `outcomeItems` group machinery is gone — the brand sidebar now
      // maps a flat `topItems` list (Overview + beta personas).
      expect(contextSidebar).toMatch(/topItems\.map\(/);
      expect(contextSidebar).not.toMatch(/outcomeItems/);
    });

    it("renders FeatureLevelSidebar entityItems flat", () => {
      expect(contextSidebar).toMatch(/entityItems\.map\(/);
    });

    it("has no hardcoded Sales/Hiring/Journalists group labels", () => {
      expect(contextSidebar).not.toMatch(/label:\s*"Sales"/);
      expect(contextSidebar).not.toMatch(/label:\s*"Hiring"/);
    });
  });
});
