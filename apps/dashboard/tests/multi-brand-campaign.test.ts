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

  it("builds a CSV brand ID header from primary + additional brands", () => {
    expect(content).toContain('[brandId, ...additionalBrandIds].join(",")');
  });

  it("passes x-brand-id header to createCampaign", () => {
    expect(content).toContain('"x-brand-id": allBrandIds');
  });

  it("renders additional brands with an 'Additional' tag", () => {
    expect(content).toContain(">Additional</span>");
  });

  it("allows removing additional brands", () => {
    expect(content).toContain("prev.filter((id) => id !== ab.id)");
  });

  it("shows a brand picker dropdown from the three-dot menu", () => {
    expect(content).toContain("EllipsisVerticalIcon");
    expect(content).toContain("showBrandPicker");
    expect(content).toContain("Add a brand");
  });

  it("createCampaign in api.ts accepts optional headers", () => {
    expect(apiContent).toContain("headers?: Record<string, string>");
    // headers should be separated from the body
    expect(apiContent).toContain("const { headers, ...body } = params");
  });
});
