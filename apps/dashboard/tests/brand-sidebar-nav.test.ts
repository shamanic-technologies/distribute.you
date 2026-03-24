import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Brand sidebar navigation", () => {
  const sidebarPath = path.join(__dirname, "../src/components/context-sidebar.tsx");
  const content = fs.readFileSync(sidebarPath, "utf-8");

  it("should have Campaigns link in brand sidebar", () => {
    expect(content).toContain('"Campaigns"');
    expect(content).toContain('`${basePath}/campaigns`');
  });

  it("should have Create Campaign link in brand sidebar", () => {
    expect(content).toContain('"Create Campaign"');
    expect(content).toContain('`${basePath}/campaigns/new`');
  });

  it("should have Workflows link in brand sidebar", () => {
    expect(content).toContain('"Workflows"');
    expect(content).toContain('`${basePath}/workflows`');
  });

  it("should have Features section with coming soon badges in brand sidebar", () => {
    expect(content).toContain("featureItems");
    expect(content).toContain("comingSoon: !wf.implemented");
  });

  it("should keep Overview and Brand Info links", () => {
    expect(content).toContain('"Overview"');
    expect(content).toContain('"Brand Info"');
  });
});

describe("Create brand button on brands page", () => {
  const brandsPagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/page.tsx"
  );
  const content = fs.readFileSync(brandsPagePath, "utf-8");

  it("should have a Create Brand button", () => {
    expect(content).toContain("Create Brand");
    expect(content).toContain("setShowCreate");
  });

  it("should have an inline creation form with URL input", () => {
    expect(content).toContain("brandUrl");
    expect(content).toContain("handleCreateBrand");
    expect(content).toContain('placeholder="https://example.com"');
  });

  it("should use upsertBrand to create brands", () => {
    expect(content).toContain("upsertBrand");
  });

  it("should navigate to brand after creation", () => {
    expect(content).toContain("router.push");
    expect(content).toContain("newBrandId");
  });
});

describe("Brand-scoped campaigns page", () => {
  const campaignsPath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/campaigns/page.tsx"
  );

  it("should exist", () => {
    expect(fs.existsSync(campaignsPath)).toBe(true);
  });

  it("should be a client component", () => {
    const content = fs.readFileSync(campaignsPath, "utf-8");
    expect(content).toContain('"use client"');
  });

  it("should fetch campaigns filtered by brand", () => {
    const content = fs.readFileSync(campaignsPath, "utf-8");
    expect(content).toContain("listCampaignsByBrand(brandId)");
  });

  it("should show funnel metrics and reply breakdown", () => {
    const content = fs.readFileSync(campaignsPath, "utf-8");
    expect(content).toContain("FunnelMetrics");
    expect(content).toContain("ReplyBreakdown");
  });

  it("should have a Create Campaign link pointing to brand-scoped creation", () => {
    const content = fs.readFileSync(campaignsPath, "utf-8");
    expect(content).toContain("/campaigns/new");
  });

  it("should show feature label badge on each campaign", () => {
    const content = fs.readFileSync(campaignsPath, "utf-8");
    expect(content).toContain("getFeatureSlug");
    expect(content).toContain("featureLabel");
  });
});

describe("Brand-scoped create campaign page", () => {
  const createPath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/campaigns/new/page.tsx"
  );

  it("should exist", () => {
    expect(fs.existsSync(createPath)).toBe(true);
  });

  it("should be a client component", () => {
    const content = fs.readFileSync(createPath, "utf-8");
    expect(content).toContain('"use client"');
  });

  it("should show locked brand info instead of brand selector", () => {
    const content = fs.readFileSync(createPath, "utf-8");
    expect(content).toContain("Brand locked");
    expect(content).toContain("BrandLogo");
  });

  it("should NOT have a brand selector dropdown", () => {
    const content = fs.readFileSync(createPath, "utf-8");
    expect(content).not.toContain("brand-selector");
    expect(content).not.toContain("__new__");
  });

  it("should fetch brand fields using extractBrandFields", () => {
    const content = fs.readFileSync(createPath, "utf-8");
    expect(content).toContain("extractBrandFields(brandId");
  });

  it("should have workflow leaderboard table", () => {
    const content = fs.readFileSync(createPath, "utf-8");
    expect(content).toContain("fetchRankedWorkflows");
    expect(content).toContain("WorkflowRow");
  });
});

describe("Brand-scoped workflows page", () => {
  const workflowsPath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/workflows/page.tsx"
  );

  it("should exist", () => {
    expect(fs.existsSync(workflowsPath)).toBe(true);
  });

  it("should be a client component", () => {
    const content = fs.readFileSync(workflowsPath, "utf-8");
    expect(content).toContain('"use client"');
  });

  it("should fetch and display workflows", () => {
    const content = fs.readFileSync(workflowsPath, "utf-8");
    expect(content).toContain("listWorkflows");
    expect(content).toContain("WorkflowDetailPanel");
  });
});

describe("Breadcrumbs for brand-scoped routes", () => {
  const breadcrumbPath = path.join(__dirname, "../src/components/breadcrumb-nav.tsx");
  const content = fs.readFileSync(breadcrumbPath, "utf-8");

  it("should show Campaigns label for brand campaigns route", () => {
    expect(content).toContain(">Campaigns<");
    expect(content).toContain('pathParts[4] === "campaigns"');
  });

  it("should show Create Campaign label for brand create campaign route", () => {
    expect(content).toContain(">Create Campaign<");
    expect(content).toContain('pathParts[5] === "new"');
  });

  it("should show Workflows label for brand workflows route", () => {
    expect(content).toContain(">Workflows<");
    expect(content).toContain('pathParts[4] === "workflows"');
  });
});
