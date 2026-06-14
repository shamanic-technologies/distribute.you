import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const contextSidebar = fs.readFileSync(
  path.join(__dirname, "../src/components/context-sidebar.tsx"),
  "utf-8",
);
const campaignSidebar = fs.readFileSync(
  path.join(__dirname, "../src/components/campaign-sidebar.tsx"),
  "utf-8",
);
const mcpSidebar = fs.readFileSync(
  path.join(__dirname, "../src/components/mcp-sidebar.tsx"),
  "utf-8",
);

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
      // maps a flat `topItems` list (Overview/Campaigns/Create/Conversions).
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

  describe("campaign-sidebar.tsx", () => {
    it("has no OUTCOME_GROUPS constant", () => {
      expect(campaignSidebar).not.toMatch(/OUTCOME_GROUPS/);
    });

    it("does not import McpSidebarGroup type", () => {
      expect(campaignSidebar).not.toMatch(/McpSidebarGroup/);
    });

    it("does not pass outcomesGroups to McpSidebar", () => {
      expect(campaignSidebar).not.toMatch(/outcomesGroups/);
    });

    it("passes entityItems flat via outcomesItems prop", () => {
      expect(campaignSidebar).toMatch(/outcomesItems=\{entityItems\}/);
    });

    it("has no hardcoded Sales/Hiring/Journalists group labels", () => {
      expect(campaignSidebar).not.toMatch(/label:\s*"Sales"/);
      expect(campaignSidebar).not.toMatch(/label:\s*"Hiring"/);
    });
  });

  describe("mcp-sidebar.tsx", () => {
    it("has no outcomesGroups prop", () => {
      expect(mcpSidebar).not.toMatch(/outcomesGroups/);
    });

    it("has no CollapsibleOutcomeGroup or CollapsibleOutcomeGroupList components", () => {
      expect(mcpSidebar).not.toMatch(/CollapsibleOutcomeGroup/);
    });

    it("does not export McpSidebarGroup interface", () => {
      expect(mcpSidebar).not.toMatch(/export interface McpSidebarGroup/);
    });
  });
});
