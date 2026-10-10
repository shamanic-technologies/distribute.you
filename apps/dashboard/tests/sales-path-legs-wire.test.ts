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

describe("no dashboard surface writes an offer's sales path any more (owner 2026-10-10)", () => {
  it("the api client carries no brand-service sales path, channels or ticked paths call", () => {
    const api = readFileSync(join(__dirname, "..", "src/lib/api.ts"), "utf8");
    for (const gone of ["/sales-path`", "offers/${offerId}/channels", "/selected-sales-paths", "/reactive-defaults"]) expect(api, gone).not.toContain(gone);
  });
});
