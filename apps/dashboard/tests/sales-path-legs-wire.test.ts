import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { legKeysOfStored, offeredFromCatalogue, salesPathLegsWire, type PathLeg } from "../src/lib/offer-sales-path";
import { legCatalogueFromWire } from "../src/lib/legs";

// brand-service #636 (owner 2026-10-09): an offer's sales path stores each leg WITH the
// channel that performs it, so an offer selling through Google Ads AND cold email keeps
// "Website visit" for each.
const catalogue = legCatalogueFromWire({
  steps: [
    { key: "lead_found", label: "Lead found" },
    { key: "website_visit", label: "Website visit" },
    { key: "meeting_booked", label: "Meeting booked" },
  ],
  channels: [
    { slug: "google-ads", stepTransitions: [{ legKey: "start_to_website_visit", to: { key: "website_visit" } }] },
    {
      slug: "sales-cold-email-outreach",
      stepTransitions: [{ legKey: "lead_found_to_website_visit", from: { key: "lead_found" }, to: { key: "website_visit" } }],
    },
  ],
  legs: [{ legKey: "website_visit_to_meeting_booked", fromStep: { key: "website_visit" }, toStep: { key: "meeting_booked" } }],
});

describe("salesPathLegsWire", () => {
  it("writes Website visit on google-ads AND on sales-cold-email-outreach, each with its channel", () => {
    const offered = offeredFromCatalogue(catalogue, ["google-ads", "sales-cold-email-outreach"]);
    const wire = salesPathLegsWire(
      ["start_to_website_visit", "lead_found_to_website_visit"],
      offered.channelsByLeg,
      offered.legs,
    );
    expect(wire).toEqual([
      { legKey: "start_to_website_visit", featureSlug: "google-ads" },
      { legKey: "lead_found_to_website_visit", featureSlug: "sales-cold-email-outreach" },
    ]);
  });

  it("a leg several channels perform is one entry per channel", () => {
    const legs: PathLeg[] = [{ legKey: "start_to_website_visit", fromKey: null, toKey: "website_visit" }];
    const wire = salesPathLegsWire(["start_to_website_visit"], new Map([["start_to_website_visit", ["google-ads", "meta-ads"]]]), legs);
    expect(wire.map((l) => l.featureSlug)).toEqual(["google-ads", "meta-ads"]);
  });

  it("a later leg no channel performs is the brand's team (featureSlug null)", () => {
    const offered = offeredFromCatalogue(catalogue, ["google-ads"]);
    expect(salesPathLegsWire(["website_visit_to_meeting_booked"], offered.channelsByLeg, offered.legs)).toEqual([
      { legKey: "website_visit_to_meeting_booked", featureSlug: null },
    ]);
  });

  it("an entry leg with no channel never reaches the wire (brand-service would refuse it)", () => {
    const legs: PathLeg[] = [{ legKey: "start_to_website_visit", fromKey: null, toKey: "website_visit" }];
    expect(() => salesPathLegsWire(["start_to_website_visit"], new Map(), legs)).toThrow(/no channel/);
  });

  it("reads a stored path back to one tick per leg", () => {
    expect([
      ...legKeysOfStored([
        { legKey: "start_to_website_visit", featureSlug: "google-ads" },
        { legKey: "start_to_website_visit", featureSlug: "meta-ads" },
        { legKey: "website_visit_to_meeting_booked", featureSlug: null },
      ]),
    ]).toEqual(["start_to_website_visit", "website_visit_to_meeting_booked"]);
    expect(legKeysOfStored(null).size).toBe(0);
  });
});

describe("every write of an offer's sales path sends legs with their channel", () => {
  const read = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");
  it("the api helper puts `legs`, never the deprecated bare `legKeys`", () => {
    const api = read("src/lib/api.ts");
    const at = api.indexOf("export async function saveOfferSalesPath(");
    const fn = api.slice(at, api.indexOf("export async function getOfferChannels("));
    expect(fn).toContain("body: { steps, legs }");
    expect(fn).not.toContain("legKeys");
  });
  it("both callers build the legs with salesPathLegsWire", () => {
    for (const f of ["src/components/v2/offer-revenue-steps.tsx", "src/components/v2/get-started/get-started.tsx"]) {
      expect(read(f)).toContain("salesPathLegsWire(next.legs, offered.channelsByLeg, offered.legs)");
    }
  });
});
