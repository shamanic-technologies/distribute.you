import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");
const API = read("lib/api.ts");
const PERSIST = read("lib/persist-cache.ts");

describe("the campaign hold copy", () => {
  it("carries no em-dash in anything a customer reads", () => {
    // Comments are exempt (internal prose); the strings a customer reads are not. So
    // strip every comment first, or the guard fires on the doc block explaining itself.
    const stripComments = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(stripComments(read("lib/campaign-hold.ts"))).not.toContain("—");
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

describe("where the hold renders (campaign page, v2)", () => {
  const stripComments = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  const HOOK = read("components/v2/campaign-hold.tsx");
  const PAGE = stripComments(read("components/v2/campaign-page.tsx"));
  const FUNNEL = stripComments(read("components/v2/funnel-campaigns.tsx"));

  it("polls only a running campaign, on the persisted campaignHold root", () => {
    expect(HOOK).toContain('["campaignHold", campaignId]');
    expect(HOOK).toContain("enabled: running");
    expect(HOOK).toContain("CAMPAIGN_HOLD_EVENTS");
  });

  it("a pipe's own page states its hold on both overviews", () => {
    expect(PAGE).toContain("useCampaignHold(campaign.row.campaign.id, campaign.running)");
    expect(PAGE.match(/<CampaignHold campaign=\{campaign\} \/>/g)?.length).toBe(2);
  });

  it("a sales-funnel campaign page reads its RUNNING pipes and shows one note per reason", () => {
    const at = FUNNEL.indexOf("function FunnelCampaignPageCurrent(");
    const body = FUNNEL.slice(at, FUNNEL.indexOf("export function useFunnelCampaignById(", at));
    expect(body).toContain("campaignById.get(u.campaignId)?.running");
    expect(body).toContain("useCampaignHolds(runningPipes.map((u) => u.campaignId))");
    expect(body).toContain("<CampaignHoldNote");
    // billing's "Not funded yet" banner already states the unfunded hold.
    expect(body).toContain('!(notFunded && g.hold.reason === "unfunded")');
  });

  it("the note uses the held colour, never a raw grey or brand fill", () => {
    expect(HOOK).toContain("var(--data-amber)");
    expect(HOOK).not.toMatch(/text-gray-|bg-brand-50|rounded-lg border/);
  });
});
