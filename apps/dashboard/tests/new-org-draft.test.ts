import { describe, expect, it } from "vitest";
import {
  NEW_ORG_DRAFT_MAX_AGE_MS,
  newOrgDraftKey,
  parseNewOrgDraft,
  resumeStep,
  serializeNewOrgDraft,
  type NewOrgDraft,
} from "../src/lib/v2/new-org-draft";

const NOW = Date.UTC(2026, 9, 5, 12);

function draft(over: Partial<NewOrgDraft> = {}): NewOrgDraft {
  return {
    v: 1,
    orgId: "org_A",
    brandId: "brand-1",
    savedAt: NOW,
    step: "audienceText",
    hasWebsite: true,
    website: "steadyrecruitment.com",
    brandName: "Steady Recruitment",
    offerText: "Temporary staffing for hotels",
    offerProposals: [{ name: "Temporary Staffing", description: "Staff on demand" }],
    pickedOfferIndex: 0,
    offerId: "offer-1",
    existingOffers: null,
    audienceText: "Hotel managers in London",
    segments: [{ name: "London hotels", description: "4 and 5 star" }],
    pickedSegments: [0],
    levers: { dreamOutcome: "Fully staffed", perceivedLikelihood: "", socialProof: "", riskReversal: "", urgency: "", scarcity: "" },
    leverIndex: 0,
    legKey: "start_to_conversation",
    budget: "",
    ...over,
  };
}

describe("new-org draft: progress survives a reload or a closed modal", () => {
  it("is keyed per org, so another org never resumes this brand", () => {
    expect(newOrgDraftKey("org_A")).not.toBe(newOrgDraftKey("org_B"));
  });

  it("round-trips everything the person typed and picked", () => {
    const d = draft();
    expect(parseNewOrgDraft(serializeNewOrgDraft(d), "org_A", NOW)).toEqual(d);
  });

  it("refuses a draft written for another org", () => {
    expect(parseNewOrgDraft(serializeNewOrgDraft(draft()), "org_B", NOW)).toBeNull();
  });

  it("refuses a draft with no brand (nothing exists server-side to resume)", () => {
    expect(parseNewOrgDraft(serializeNewOrgDraft(draft({ brandId: "" })), "org_A", NOW)).toBeNull();
  });

  it("drops a draft older than its max age", () => {
    const old = draft({ savedAt: NOW - NEW_ORG_DRAFT_MAX_AGE_MS - 1 });
    expect(parseNewOrgDraft(serializeNewOrgDraft(old), "org_A", NOW)).toBeNull();
  });

  it("refuses garbage and other versions", () => {
    expect(parseNewOrgDraft(null, "org_A", NOW)).toBeNull();
    expect(parseNewOrgDraft("{not json", "org_A", NOW)).toBeNull();
    expect(parseNewOrgDraft(JSON.stringify({ ...draft(), v: 2 }), "org_A", NOW)).toBeNull();
    expect(parseNewOrgDraft(JSON.stringify({ ...draft(), step: "nope" }), "org_A", NOW)).toBeNull();
  });
});

describe("resumeStep: where a reopened wizard lands", () => {
  it("lands on the step the person left", () => {
    expect(resumeStep(draft({ step: "levers" }))).toBe("levers");
    expect(resumeStep(draft({ step: "audiencePick" }))).toBe("audiencePick");
  });

  it("never reopens on the org step (the org exists) nor mid-launch", () => {
    expect(resumeStep(draft({ step: "org" }))).toBe("brand");
    expect(resumeStep(draft({ step: "launching" }))).toBe("plan");
  });

  it("a step past the offer with no confirmed offer goes back to the offer", () => {
    expect(resumeStep(draft({ step: "levers", offerId: null }))).toBe("offerText");
  });

  it("the audience pick with no proposals left goes back to the audience text", () => {
    expect(resumeStep(draft({ step: "audiencePick", segments: [] }))).toBe("audienceText");
  });
});

describe("the Add-a-brand modal keeps and resumes its draft", () => {
  const src = require("node:fs").readFileSync("src/components/v2/new-org-modal.tsx", "utf8") as string;

  it("opens on the saved draft of the brand it resumes (or the org's unfinished one)", () => {
    expect(src).toContain("readDraft(existingOrgId, existingBrand?.id)");
    expect(src).toContain("draft ? resumeStep(draft)");
  });

  it("writes every answer per org and clears it once the campaign is launched", () => {
    expect(src).toContain("window.localStorage.setItem(newOrgDraftKey(orgId), serializeNewOrgDraft(d))");
    const launch = src.slice(src.indexOf("function launch()"));
    expect(launch.indexOf("window.localStorage.removeItem(newOrgDraftKey(orgId!))")).toBeGreaterThan(launch.indexOf("/api/onboarding/complete"));
  });

  it("a resumed brand WITHOUT a website reuses its offers (never proposes and confirms a second one)", () => {
    const submitBrand = src.slice(src.indexOf("function submitBrand()"), src.indexOf("function submitOfferText()"));
    expect(submitBrand).toContain("if (hasWebsite || brandId)");
    expect(submitBrand.indexOf("listBrandOffers(id)")).toBeLessThan(submitBrand.indexOf("if (!hasWebsite) return forward();"));
  });
});
