import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isCampaignLayoutPreview, withLayoutNext } from "../src/lib/v2/campaign-layout-preview";

const read = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");

// Owner 2026-10-15: the campaign page's next layout is a STAFF PREVIEW. Everyone else, and
// staff without ?layout=next, keep today's page.
describe("campaign page next layout: staff preview only", () => {
  it("needs BOTH staff mode and ?layout=next", () => {
    expect(isCampaignLayoutPreview(true, "next")).toBe(true);
    expect(isCampaignLayoutPreview(false, "next")).toBe(false);
    expect(isCampaignLayoutPreview(true, null)).toBe(false);
    expect(isCampaignLayoutPreview(true, "")).toBe(false);
    expect(isCampaignLayoutPreview(true, "old")).toBe(false);
    expect(isCampaignLayoutPreview(false, null)).toBe(false);
  });

  it("keeps the preview on across the page's own links", () => {
    expect(withLayoutNext("/v2/orgs/o/brands/b/campaigns/c")).toBe("/v2/orgs/o/brands/b/campaigns/c?layout=next");
    expect(withLayoutNext("/v2/orgs/o/brands/b/campaigns/c?tab=targeting")).toBe("/v2/orgs/o/brands/b/campaigns/c?tab=targeting&layout=next");
  });

  it("FunnelCampaignPage branches on the gate and otherwise renders the current page", () => {
    const page = read("components/v2/funnel-campaigns.tsx");
    const at = page.indexOf("export function FunnelCampaignPage(");
    const body = page.slice(at, page.indexOf("function FunnelCampaignPageCurrent("));
    expect(body).toContain("const { staffMode } = useStaffMode();");
    expect(body).toContain("if (isCampaignLayoutPreview(staffMode, layout)) return <FunnelCampaignPageNext campaign={campaign} />;");
    expect(body).toContain("return <FunnelCampaignPageCurrent campaign={campaign} />;");
    // The current page keeps its whole anatomy.
    const current = page.slice(page.indexOf("function FunnelCampaignPageCurrent("), page.indexOf("export function useFunnelCampaignById("));
    expect(current).toContain("<PipeSections");
    expect(current).toContain("<FunnelResults");
  });

  it("the preview computes no metric in the browser", () => {
    const next = read("components/v2/campaign-page-next.tsx");
    expect(next).not.toMatch(/\.reduce\(/);
    expect(next).toContain("<RoiLabel />");
    expect(next).not.toMatch(/text-gray-|bg-brand-50|rounded-lg border|shadow-2xl/);
  });
});
