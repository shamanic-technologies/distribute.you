import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");
const BAND = read("components/campaigns/campaign-hold-band.tsx");
const PAGE = read("components/campaigns/campaign-overview-page.tsx");
const API = read("lib/api.ts");
const PERSIST = read("lib/persist-cache.ts");

describe("the campaign hold band", () => {
  it("reads the verdict off the producer and derives none of its own", () => {
    expect(BAND).toContain("readCampaignHold");
    // No second opinion built from budget numbers or a status column: campaign-service
    // already decided, and a client-side re-derivation drifts the day either side moves.
    expect(BAND).not.toMatch(/ceilingCents\s*[<>=]/);
    expect(BAND).not.toContain("spentCents >");
    expect(BAND).not.toContain("dailyBudgetCents");
  });

  it("asks for both hold slugs by name rather than paging every event", () => {
    expect(BAND).toContain("event: CAMPAIGN_HOLD_EVENTS");
  });

  it("shows nothing on a paused campaign, whose pill already says so", () => {
    expect(BAND).toContain("if (paused) return null;");
    expect(BAND).toContain("enabled: !paused");
  });

  it("takes the customer to the control that fixes it", () => {
    expect(BAND).toContain("/settings");
    expect(BAND).toContain("/billing");
  });

  it("wears a full-perimeter 1px border, never a side accent", () => {
    expect(BAND).toContain("border border-amber-200");
    expect(BAND).not.toMatch(/border-(l|r|t)-\d/);
  });

  it("carries no em-dash in anything a customer reads", () => {
    // Comments are exempt (internal prose); the strings a customer reads are not. So
    // strip every comment first, or the guard fires on the doc block explaining itself.
    const stripComments = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(stripComments(read("lib/campaign-hold.ts"))).not.toContain("—");
    expect(stripComments(BAND)).not.toContain("—");
  });
});

describe("the campaign Overview mounts it", () => {
  it("renders the band on BOTH return branches, so the empty state states its reason too", () => {
    expect(PAGE.split("<CampaignHoldBand").length - 1).toBe(2);
  });

  it("passes the campaign's own status, so a paused campaign is not told it is held", () => {
    expect(PAGE).toContain("paused={campaignPaused}");
  });

  it("declares campaignsPath above the band that builds its link off it", () => {
    // A const a JSX branch reads must be declared above it; the ordering is a TDZ throw
    // at render that `tsc` cannot see.
    expect(PAGE.indexOf("const campaignsPath")).toBeLessThan(PAGE.indexOf("<CampaignHoldBand"));
  });
});

describe("the events reader", () => {
  it("forwards the event filter the gateway accepts", () => {
    const at = API.indexOf("export async function listCampaignEvents");
    const body = API.slice(at, API.indexOf("\n}", at));
    expect(body).toContain('params.set("event"');
    expect(body).toContain('params.set("campaignId"');
    // The org is injected at the gateway from the auth context, never sent from here.
    expect(body).not.toContain('params.set("orgId"');
  });

  it("fails loud on wire-rot rather than rendering an empty hold", () => {
    const at = API.indexOf("export async function listCampaignEvents");
    expect(API.slice(at, API.indexOf("\n}", at))).toContain("invalid response shape");
  });

  it("is allowlisted for the persisted cache, or it cold-fetches every visit", () => {
    expect(PERSIST).toContain('"campaignHold"');
  });
});
