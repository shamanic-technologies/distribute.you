import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Multi-brand campaign support", () => {
  const pageRel = "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/new/page.tsx";
  const content = fs.readFileSync(path.join(__dirname, pageRel), "utf-8");

  const apiRel = "../src/lib/api.ts";
  const apiContent = fs.readFileSync(path.join(__dirname, apiRel), "utf-8");

  it("tracks additional brand IDs in state", () => {
    expect(content).toContain("additionalBrandIds");
    expect(content).toContain("setAdditionalBrandIds");
  });

  it("fetches all org brands for the picker", () => {
    expect(content).toContain("listBrands()");
    expect(content).toContain("availableBrands");
  });

  it("builds brandUrls array from primary + additional brands", () => {
    expect(content).toContain("formData.brandUrl");
    expect(content).toContain("additionalBrands.map((b) => b.brandUrl)");
    expect(content).toContain("brandUrls");
  });

  it("sends brandUrls in the campaign payload body (not headers)", () => {
    // No header-based approach — brandUrls goes in the body
    expect(content).not.toContain('"x-brand-id"');
    expect(content).toContain("brandUrls,");
  });

  it("renders additional brands with an 'Additional' tag", () => {
    expect(content).toContain(">Additional</span>");
  });

  it("allows removing additional brands", () => {
    expect(content).toContain("prev.filter((id) => id !== ab.id)");
  });

  it("re-runs prefill when additionalBrandIds change while form is open", () => {
    // A useEffect should watch additionalBrandIds and re-prefill when showForm is true
    expect(content).toContain("// Re-run prefill when brands change while form is already open");
    // The effect must check showForm before firing
    expect(content).toContain("if (!showForm");
  });

  it("includes additionalBrandIds in the handleGo dependency array", () => {
    // The handleGo useCallback must include additionalBrandIds in its deps
    // so prefill uses the latest selected brands, not a stale closure
    const handleGoStart = content.indexOf("const handleGo = useCallback");
    const handleGoEnd = content.indexOf("];", handleGoStart);
    const handleGoBlock = content.slice(handleGoStart, handleGoEnd);
    expect(handleGoBlock).toContain("additionalBrandIds");
  });

  it("shows a brand picker dropdown from the three-dot menu", () => {
    expect(content).toContain("EllipsisVerticalIcon");
    expect(content).toContain("showBrandPicker");
    expect(content).toContain("Add a brand");
  });

  it("createCampaign in api.ts uses brandUrls: string[] and no custom headers param", () => {
    // Extract just the createCampaign function block
    const fnStart = apiContent.indexOf("export async function createCampaign");
    const fnEnd = apiContent.indexOf("\n}", fnStart) + 2;
    const fnBody = apiContent.slice(fnStart, fnEnd);
    expect(fnBody).toContain("brandUrls: string[]");
    expect(fnBody).not.toContain("brandUrl: string");
    expect(fnBody).not.toContain("headers?: Record<string, string>");
  });

  it("extractBrandFields sends brandIds in the body, not via headers", () => {
    const fnStart = apiContent.indexOf("export async function extractBrandFields");
    const fnEnd = apiContent.indexOf("\n}", fnStart) + 2;
    const fnBody = apiContent.slice(fnStart, fnEnd);
    expect(fnBody).toContain("brandIds: string[]");
    expect(fnBody).toContain("body: { brandIds, fields }");
    expect(fnBody).not.toContain("headers");
  });

  it("callers of extractBrandFields pass brandIds array as first arg", () => {
    const brandsPageRel = "../src/app/(dashboard)/orgs/[orgId]/brands/page.tsx";
    const brandsPage = fs.readFileSync(path.join(__dirname, brandsPageRel), "utf-8");
    expect(brandsPage).toContain("extractBrandFields([newBrandId]");

    const brandInfoRel = "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/brand-info/page.tsx";
    const brandInfo = fs.readFileSync(path.join(__dirname, brandInfoRel), "utf-8");
    expect(brandInfo).toContain("extractBrandFields([brandId]");
  });
});
