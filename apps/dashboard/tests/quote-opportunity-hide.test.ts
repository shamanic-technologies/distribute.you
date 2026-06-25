import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  isOpportunityOpen,
  BLOCKED_PITCH_STATUSES,
} from "../src/lib/quote-pitch-status";

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

const apiLib = read("../src/lib/api.ts");
const featureRequestsPage = read(
  "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/quote-requests/page.tsx",
);

describe("isOpportunityOpen — hide ⟺ Send would be blocked (backend reply idempotency)", () => {
  it("treats a never-pitched opportunity (null) as open", () => {
    expect(isOpportunityOpen(null)).toBe(true);
  });

  it("hides the 5 block statuses (drafted/submitted/selected/published/not_selected)", () => {
    expect(isOpportunityOpen("drafted")).toBe(false);
    expect(isOpportunityOpen("submitted")).toBe(false);
    expect(isOpportunityOpen("selected")).toBe(false);
    expect(isOpportunityOpen("published")).toBe(false);
    expect(isOpportunityOpen("not_selected")).toBe(false);
  });

  it("keeps failure statuses visible — re-reply is still allowed for them", () => {
    expect(isOpportunityOpen("error")).toBe(true);
    expect(isOpportunityOpen("length_violation")).toBe(true);
    expect(isOpportunityOpen("template_missing")).toBe(true);
    expect(isOpportunityOpen("brand_missing_fields")).toBe(true);
    expect(isOpportunityOpen("insufficient_credits")).toBe(true);
  });

  it("BLOCKED_PITCH_STATUSES is exactly the backend reply block set", () => {
    expect([...BLOCKED_PITCH_STATUSES].sort()).toEqual(
      ["drafted", "not_selected", "published", "selected", "submitted"].sort(),
    );
  });
});

describe("api.ts — wire shape completion", () => {
  it("RankedOpportunity interface carries pitchStatus", () => {
    const block =
      apiLib.split("export interface RankedOpportunity {")[1]?.split("\n}")[0] ??
      "";
    expect(block).toMatch(/pitchStatus:\s*QuotePitchStatus \| null/);
  });

  it("RankedOpportunitySchema declares pitchStatus (or Zod strips it from the parse)", () => {
    const block =
      apiLib.split("const RankedOpportunitySchema = z.object({")[1]?.split("});")[0] ??
      "";
    expect(block).toContain("pitchStatus");
  });

  it("SubmitQuotePitchBody accepts an optional campaignId", () => {
    const block =
      apiLib.split("export interface SubmitQuotePitchBody {")[1]?.split("\n}")[0] ??
      "";
    expect(block).toMatch(/campaignId\?:\s*string/);
  });

  it("listQuotePitches + getQuotePitch safeParse the response (DIS-74)", () => {
    const listBlock =
      apiLib
        .split("export async function listQuotePitches(")[1]
        ?.split("\nexport async function")[0] ?? "";
    const getBlock =
      apiLib
        .split("export async function getQuotePitch(")[1]
        ?.split("\nexport ")[0] ?? "";
    expect(listBlock).toContain("safeParse");
    expect(listBlock).toContain("[dashboard]");
    expect(getBlock).toContain("safeParse");
    expect(getBlock).toContain("[dashboard]");
  });
});

describe("Opportunities surfaces hide already-pitched (filter via isOpportunityOpen)", () => {
  it("feature quote-requests page filters opportunities", () => {
    expect(featureRequestsPage).toContain("isOpportunityOpen");
    expect(featureRequestsPage).toMatch(/filter\([\s\S]*?isOpportunityOpen/);
  });

  // (The brand sidebar quote-requests badge was removed with the entity Database
  // section — the feature page filter above is the surviving guard.)
});

// The "campaign HITL quote-requests page filters" + "Submit threads campaignId"
// blocks were removed: the campaign-level quote-requests page (+ its
// sidebar-wrapper) was deleted with the campaign concept. The brand-level page
// + the brand sidebar badge are the survivors.
