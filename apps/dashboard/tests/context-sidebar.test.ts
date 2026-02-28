import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SIDEBAR_PATH = path.join(
  __dirname,
  "../src/components/context-sidebar.tsx"
);

describe("ContextSidebar", () => {
  const content = fs.readFileSync(SIDEBAR_PATH, "utf-8");

  describe("module structure", () => {
    it("should be a client component", () => {
      expect(content).toMatch(/^"use client"/);
    });

    it("should export ContextSidebar as a named export", () => {
      expect(content).toContain("export function ContextSidebar()");
    });

    it("should import WORKFLOW_DEFINITIONS from @mcpfactory/content", () => {
      expect(content).toContain(
        'import { WORKFLOW_DEFINITIONS } from "@mcpfactory/content"'
      );
    });
  });

  describe("getNavigationLevel logic", () => {
    // Extract the function source and test its pattern matching
    it("should handle app-level routes (root)", () => {
      // The function should return type "app" when no segments match
      expect(content).toContain('return { type: "app" }');
    });

    it("should handle org-level routes (/orgs/[orgId])", () => {
      expect(content).toContain('return { type: "org", orgId }');
    });

    it("should handle brand-level routes (/orgs/[orgId]/brands/[brandId])", () => {
      expect(content).toContain('return { type: "brand", orgId, brandId }');
    });

    it("should handle feature-level routes (/orgs/.../features/[sectionKey])", () => {
      expect(content).toContain(
        'return { type: "feature", orgId, brandId, sectionKey }'
      );
    });

    it("should handle campaign-level routes (/orgs/.../campaigns/[id])", () => {
      expect(content).toContain('type: "campaign"');
      expect(content).toContain("campaignId: segments[7]");
    });
  });

  describe("sidebar levels", () => {
    it("should render AppLevelSidebar with Home, API Keys, and Workflows links", () => {
      // Check that app-level items exist
      expect(content).toContain('"Home"');
      expect(content).toContain('"API Keys"');
      expect(content).toContain('"Workflows"');
      expect(content).toContain('href: "/"');
      expect(content).toContain('href: "/api-keys"');
      expect(content).toContain('href: "/workflows"');
    });

    it("should render OrgLevelSidebar with back link to all organizations", () => {
      expect(content).toContain('backLabel="All Organizations"');
      expect(content).toContain('backHref="/"');
    });

    it("should render BrandLevelSidebar with Overview, Brand Info, and workflow features", () => {
      expect(content).toContain('"Brand Info"');
      expect(content).toContain("WORKFLOW_DEFINITIONS.map");
    });

    it("should render FeatureLevelSidebar with a back link to Brand", () => {
      expect(content).toContain('backLabel="Brand"');
    });

    it("should return null for campaign-level navigation", () => {
      // Campaign level defers to CampaignSidebar
      const campaignCase = content.match(
        /case\s+"campaign":\s*\n?\s*\/\/.*\n?\s*return\s+null/
      );
      expect(campaignCase).toBeTruthy();
    });
  });

  describe("SidebarLink active state styling", () => {
    it("should apply primary styling when active", () => {
      expect(content).toContain("bg-primary-50");
      expect(content).toContain("text-primary-700");
      expect(content).toContain("border-primary-200");
    });

    it("should apply gray styling when inactive", () => {
      expect(content).toContain("text-gray-600");
      expect(content).toContain("hover:bg-gray-50");
    });
  });

  describe("BackLink component", () => {
    it("should render a chevron-left SVG icon", () => {
      // BackLink uses the chevron path
      expect(content).toContain("M15 19l-7-7 7-7");
    });
  });

  describe("feature icon mapping", () => {
    it("should map sales-prefixed sections to EnvelopeIcon", () => {
      expect(content).toContain('sectionKey.startsWith("sales")');
    });

    it("should map pr-prefixed sections to NewspaperIcon", () => {
      expect(content).toContain('sectionKey.startsWith("pr")');
    });

    it("should fall back to WorkflowIcon for other sections", () => {
      // getFeatureIcon defaults to WorkflowIcon
      expect(content).toContain("return <WorkflowIcon />");
    });
  });
});
