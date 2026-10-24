import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OFFER_FIELDS, parseGetStartedSnapshot, resumeOfferPlan } from "../src/lib/v2/get-started";

const gs = readFileSync(new URL("../src/components/v2/get-started/get-started.tsx", import.meta.url), "utf8");
const base = {
  version: 2,
  website: "https://www.inogates.com",
  brandId: "55212ee9-8e05-4ea4-88ee-47f773c3b8ff",
  brandName: "InoGates",
  domain: "inogates.com",
  overview: "InoGates is a Dubai-based technology consulting company.",
  facts: [],
  competitors: [],
  offer: null,
  audience: null,
  email: null,
};
const offers = [
  { name: "GTM Representation", description: "Market entry for tech vendors.", icon: "rocket" },
  { name: "SOC as a Service", description: "Managed security monitoring.", icon: "shield" },
];

describe("/get-started: a reload never asks the model again for a list it showed (owner 2026-10-24)", () => {
  it("the snapshot keeps the offer lines, the offers shown and the audiences shown", () => {
    const s = parseGetStartedSnapshot(
      JSON.stringify({
        ...base,
        offerLines: ["Go-to-market representation", " "],
        offerProposals: { items: offers, main: 1 },
        audienceProposals: [{ name: "Vendors", description: "Tech vendors.", icon: "users", iconConfidence: 0.9 }],
      }),
    )!;
    expect(s.offerLines).toEqual(["Go-to-market representation"]);
    expect(s.offerProposals).toEqual({ items: offers, main: 1 });
    expect(s.audienceProposals?.[0]).toEqual({ name: "Vendors", description: "Tech vendors.", icon: "users", iconConfidence: 0.9, estimatedLeadCount: null });
  });

  it("drops a malformed list rather than showing half of it", () => {
    const s = parseGetStartedSnapshot(JSON.stringify({ ...base, offerProposals: { items: [offers[0], { name: 3 }], main: 0 }, audienceProposals: [{ name: "x" }] }))!;
    expect(s.offerProposals).toBeNull();
    expect(s.audienceProposals).toBeNull();
    expect(parseGetStartedSnapshot(JSON.stringify({ ...base, offerProposals: { items: offers, main: 9 } }))!.offerProposals?.main).toBe(0);
  });

  it("shows the stored list; asks only when none was shown, with the site's lines", () => {
    expect(resumeOfferPlan({ offerProposals: { items: offers, main: 0 }, offerLines: ["a"], overview: "o" })).toEqual({ kind: "show", proposals: { items: offers, main: 0 } });
    expect(resumeOfferPlan({ offerProposals: null, offerLines: ["line one", "line two"], overview: "o" })).toEqual({ kind: "ask", lines: ["line one", "line two"] });
  });

  it("the resume path no longer asks with an empty input (the overview alone)", () => {
    expect(gs).not.toContain("prepareOffers(s.brandId, [], s.overview)");
    const at = gs.indexOf("function resumePreparing(");
    const body = gs.slice(at, gs.indexOf("// ── Steps 3 and 4", at));
    expect(body).toContain("resumeOfferPlan(s)");
    expect(body).toContain("showOffers(plan.proposals.items, plan.proposals.main)");
    expect(body).toContain("setAudienceProposals(s.audienceProposals)");
  });

  it("each list is saved the moment it is shown, and the site's lines with the first read", () => {
    expect(gs).toContain("saveSnapshot({ offerProposals: { items: offers, main } })");
    expect(gs).toContain("saveSnapshot({ audienceProposals: shown })");
    expect(gs).toContain("saveSnapshot({ overview: ov, facts: fs, competitors: list, offerLines: lines })");
  });

  it("a resumed walk with no offer shows step 4 waiting, never Nothing found", () => {
    expect(gs).toContain('audience: s.audience ? "done" : "waiting",');
  });
});

describe("/get-started step 3: Something else (owner 2026-10-24)", () => {
  it("the offer step ends on a dashed Something else card that opens a text box in place", () => {
    const at = gs.indexOf("function OfferStage(");
    const body = gs.slice(at, gs.indexOf("function CampaignChoice(", at));
    expect(body).toContain("Something else");
    expect(body).toContain("border-dashed");
    expect(body).toContain("What do you sell?");
    expect(body).toContain("{!picked && ownBox}");
    expect(gs).toContain("onOwn={(text) => void proposeOwnOffer(text)}");
  });

  it("their words go to the same offer proposals; one offer is picked at once", () => {
    const at = gs.indexOf("async function proposeOwnOffer(");
    const body = gs.slice(at, gs.indexOf("/** The offers the site describes", at));
    expect(body).toContain("await proposeBrandOffers(brandId, text)");
    expect(body).toContain("if (offers.length === 1) pickOffer(0, offers);");
  });
});

describe("/get-started site read: offers are not pre-cut one line per service", () => {
  it("asks one line per offer a buyer buys on its own, main offer first", () => {
    const d = OFFER_FIELDS[0].description;
    expect(d).not.toContain("one line per service line");
    expect(d).toContain("Services sold to the same buyer for the same need are ONE line");
    expect(d).toContain("comes first");
  });
});
